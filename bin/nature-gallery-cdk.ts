#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NatureGalleryCdkStack } from '../lib/nature-gallery-cdk-stack';

const app = new cdk.App();
new NatureGalleryCdkStack(app, 'NatureGalleryCdkStack', {
 

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
