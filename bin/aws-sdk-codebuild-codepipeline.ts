import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/aws-sdk-codebuild-codepipeline-stack';

const app = new cdk.App();

/* // Create a pipeline stack for each environment
new PipelineStack(app, 'PipelineProdStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  environmentName: 'prod',
  branchName: 'main', // Production deploys from main branch
});

new PipelineStack(app, 'PipelineStagingStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  environmentName: 'staging',
  branchName: 'staging', // Staging deploys from staging branch
}); */

new PipelineStack(app, 'PipelineDevStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  environmentName: 'main',
  branchName: 'main', // Development deploys from dev branch
});
