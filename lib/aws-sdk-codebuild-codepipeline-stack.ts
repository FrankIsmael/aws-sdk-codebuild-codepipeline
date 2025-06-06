import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as dotenv from 'dotenv';
import * as iam from 'aws-cdk-lib/aws-iam';

// Load environment variables
dotenv.config();

// Define interface for environment props
export interface PipelineStackProps extends cdk.StackProps {
  environmentName: string; // 'prod', 'staging', 'dev'
  branchName: string; // git branch to track
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // Define the pipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: `Serverless-${props.environmentName}-Pipeline`,
    });

    // Source stage
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: process.env.GITHUB_OWNER || 'your-github-username',
      repo: process.env.GITHUB_BACKEND_REPO || 'your-backend-repo',
      oauthToken: cdk.SecretValue.secretsManager(
        process.env.GITHUB_TOKEN_SECRET_NAME || 'github-token',
        {
          jsonField: 'github-token',
        }
      ),
      trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
      output: sourceOutput,
      branch: props.branchName,
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // Create IAM role with required permissions for serverless
    const buildProjectRole = new iam.Role(this, 'BuildProjectRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: 'Role used by CodeBuild to execute Serverless deployments',
    });

    // Add required permissions for Serverless Framework
    buildProjectRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudformation:*',
          's3:*',
          'logs:*',
          'iam:PassRole',
          'iam:GetRole',
          'iam:CreateRole',
          'iam:DeleteRole',
          'iam:PutRolePolicy',
          'iam:DeleteRolePolicy',
          'iam:GetRolePolicy',
          'iam:ListRolePolicies',
          'iam:ListAttachedRolePolicies',
          'iam:AttachRolePolicy',
          'iam:DetachRolePolicy',
          'iam:PassRole',
          'iam:TagRole',
          'iam:UntagRole',
          'iam:UpdateRole',
          'iam:UpdateRoleDescription',
          'iam:UpdateAssumeRolePolicy',
          'iam:ListRoles',
          'lambda:*',
          'apigateway:*',
          'events:*',
          'ssm:GetParameter',
          'ssm:GetParameters',
          'ssm:GetParametersByPath',
          'ssm:PutParameter',
        ],
        resources: ['*'], // For production, you should restrict this to specific resources
      })
    );

    // Build stage
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      role: buildProjectRole,
      buildSpec: codebuild.BuildSpec.fromAsset('buildspec-build.yml'),
      // buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec-build.yml'), // from the source repository
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        environmentVariables: {
          SERVERLESS_ACCESS_KEY: {
            value: process.env.SERVERLESS_ACCESS_KEY || '',
          },
          ENVIRONMENT_NAME: {
            value: props.environmentName,
          },
          // SonarCloud environment variables
          SONAR_TOKEN: {
            value: process.env.SONAR_TOKEN || '',
            // type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
          },
          SONAR_HOST_URL: {
            value: process.env.SONAR_HOST_URL || 'https://sonarcloud.io',
          },
          PROJECT_KEY: {
            value: process.env.SONAR_PROJECT_KEY,
          },
          PROJECT_NAME: {
            value: process.env.SONAR_PROJECT_NAME,
          },
          SONAR_ORGANIZATION: {
            value: process.env.SONAR_ORGANIZATION,
          },
        },
      },
    });

    const buildOutput = new codepipeline.Artifact();
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });

    // Add approval action for production environment
    if (props.environmentName === 'prod') {
      pipeline.addStage({
        stageName: 'Approval',
        actions: [
          new codepipeline_actions.ManualApprovalAction({
            actionName: 'ApproveDeployment',
            notificationTopic: undefined, // Optional: Add SNS topic for notifications
            additionalInformation:
              'Please review and approve the deployment to production',
          }),
        ],
      });
    }

    // Deploy stage
    const deployProject = new codebuild.PipelineProject(this, 'DeployProject', {
      role: buildProjectRole,
      buildSpec: codebuild.BuildSpec.fromAsset('buildspec-deploy.yml'),
      // buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec-deploy.yml'), // from the source repository
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        environmentVariables: {
          SERVERLESS_ACCESS_KEY: {
            value: process.env.SERVERLESS_ACCESS_KEY || '',
          },
          ENVIRONMENT_NAME: {
            value: props.environmentName,
          },
        },
      },
    });

    const deployAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Deploy',
      project: deployProject,
      input: buildOutput,
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [deployAction],
    });
  }
}
