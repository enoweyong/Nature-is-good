import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as NatureGalleryCdk from '../lib/nature-gallery-cdk-stack';

let template: Template;

beforeAll(() => {
  const app = new cdk.App();
  const stack = new NatureGalleryCdk.NatureGalleryCdkStack(app, 'NatureGalleryCdkStack');
  template = Template.fromStack(stack);
});

test('S3 bucket for static hosting is created', () => {
  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
});

test('CloudFront distribution is created with index.html as root object', () => {
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultRootObject: 'index.html',
    },
  });
});

test('DynamoDB table has category partition key and id sort key', () => {
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    AttributeDefinitions: [
      { AttributeName: 'category', AttributeType: 'S' },
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'title', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'category', KeyType: 'HASH' },
      { AttributeName: 'id', KeyType: 'RANGE' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  });
});

test('exactly six application Lambda functions are created (plus custom resources)', () => {
  const all = template.findResources('AWS::Lambda::Function');
  const appLambdas = Object.values(all).filter((r: any) =>
    r.Properties?.Environment?.Variables?.TABLE_NAME !== undefined);
  expect(appLambdas.length).toBe(6);
});

test('API Gateway exposes the expected routes', () => {
  template.hasResourceProperties('AWS::ApiGateway::RestApi', {
    Name: 'Nature Gallery API',
  });
  // 7 data-plane methods + 5 CORS preflight OPTIONS = 12
  template.resourcePropertiesCountIs('AWS::ApiGateway::Method', {}, 12);
});

test('Lambdas receive the table name environment variable', () => {
  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'index.handler',
    Environment: {
      Variables: {
        TABLE_NAME: { Ref: 'ImagesTable39278AD9' },
      },
    },
  });
});
