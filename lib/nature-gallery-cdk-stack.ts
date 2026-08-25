import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';


export class NatureGalleryCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. S3 bucket – private, no public access
    const bucket = new s3.Bucket(this, 'NatureGalleryBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // for demo; remove for production
      autoDeleteObjects: true,
    });

    // 2. CloudFront Origin Access Identity (OAI)
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI');
    bucket.grantRead(originAccessIdentity);

    // 3. CloudFront distribution
   // 1. Create Origin Access Identity (OAI)

// 2. Define CloudFront Distribution
const distribution = new cloudfront.Distribution(this, 'NatureGalleryDistribution', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessIdentity(bucket, {
      originAccessIdentity: originAccessIdentity,
    }),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    compress: true,
  },
  defaultRootObject: 'index.htm',
  errorResponses: [
    {
      httpStatus: 404,
      responseHttpStatus: 200,
      responsePagePath: '/index.htm',
    },
  ],
});

    // 4. Deploy index.html to S3
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./')], // uploads everything in the project root
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // 5. Output the CloudFront URL
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: distribution.domainName,
      description: 'The CloudFront distribution URL',
    });
  }
}