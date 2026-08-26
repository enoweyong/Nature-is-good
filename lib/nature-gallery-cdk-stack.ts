import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class NatureGalleryCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── 1. S3 BUCKET (Static Hosting) ───
    const bucket = new s3.Bucket(this, 'NatureGalleryBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI');
    bucket.grantRead(originAccessIdentity);

    const distribution = new cloudfront.Distribution(this, 'NatureGalleryDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(bucket, { originAccessIdentity }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // ─── 2. DYNAMODB TABLE ───
    const imagesTable = new dynamodb.Table(this, 'ImagesTable', {
      partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for searching by title
    imagesTable.addGlobalSecondaryIndex({
      indexName: 'TitleIndex',
      partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'title', type: dynamodb.AttributeType.STRING },
    });

    // ─── 3. LAMBDA FUNCTIONS ───
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        TABLE_NAME: imagesTable.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: false,
      },
    };

    // Get all images by category
    const getImagesLambda = new nodejs.NodejsFunction(this, 'GetImagesLambda', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../lambda/get-images.ts'),
      handler: 'handler',
    });

    // Add/Upload image
    const addImageLambda = new nodejs.NodejsFunction(this, 'AddImageLambda', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../lambda/add-image.ts'),
      handler: 'handler',
    });

    // Delete image
    const deleteImageLambda = new nodejs.NodejsFunction(this, 'DeleteImageLambda', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../lambda/delete-image.ts'),
      handler: 'handler',
    });

    // Update likes
    const updateLikesLambda = new nodejs.NodejsFunction(this, 'UpdateLikesLambda', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../lambda/update-likes.ts'),
      handler: 'handler',
    });

    // Grant table permissions
    imagesTable.grantReadData(getImagesLambda);
    imagesTable.grantWriteData(addImageLambda);
    imagesTable.grantWriteData(deleteImageLambda);
    imagesTable.grantWriteData(updateLikesLambda);

    // ─── 4. API GATEWAY ───
    const api = new apigateway.RestApi(this, 'NatureGalleryAPI', {
      restApiName: 'Nature Gallery API',
      description: 'API for nature gallery images',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const imagesResource = api.root.addResource('images');

    // GET /images/{category}
    const categoryResource = imagesResource.addResource('{category}');
    categoryResource.addMethod('GET', new apigateway.LambdaIntegration(getImagesLambda));

    // POST /images
    imagesResource.addMethod('POST', new apigateway.LambdaIntegration(addImageLambda));

    // DELETE /images/{category}/{id}
    const imageResource = categoryResource.addResource('{id}');
    imageResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteImageLambda));

    // PUT /images/{category}/{id}/like
    const likeResource = imageResource.addResource('like');
    likeResource.addMethod('PUT', new apigateway.LambdaIntegration(updateLikesLambda));

    // ─── 5. DEPLOY WEBSITE ───
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./')],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // ─── 6. OUTPUTS ───
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: distribution.domainName,
      description: 'The CloudFront distribution URL',
    });

    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });
  }
}