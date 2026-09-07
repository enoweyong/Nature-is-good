import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class NatureGalleryCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // â”€â”€â”€ 1. S3 BUCKET (Static Hosting) â”€â”€â”€
    const bucket = new s3.Bucket(this, 'NatureGalleryBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI');
    bucket.grantRead(originAccessIdentity);

    const distribution = new cloudfront.Distribution(this, 'NatureGalleryDistribution', {
      defaultBehavior: {
        origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessIdentity(bucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      defaultRootObject: 'index.html',
      // NOTE: no SPA 404->index.html rewrite. Returning index.html (HTTP 200,
      // Content-Type text/html) for missing objects makes image URLs resolve
      // to HTML, which browsers block with ERR_BLOCKED_BY_ORB.
    });

    // â”€â”€â”€ 2. DYNAMODB TABLE â”€â”€â”€
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

    // â”€â”€â”€ 3. LAMBDA FUNCTIONS â”€â”€â”€
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        TABLE_NAME: imagesTable.tableName,
        BUCKET_NAME: bucket.bucketName,
        CLOUDFRONT_DOMAIN: distribution.domainName,
      },
      bundling: { //bundling options for NodejsFunction
        minify: true,
        sourceMap: false,
      },
    };

    // Get all images by category
    const getImagesLambda = new nodejs.NodejsFunction(this, 'GetImagesLambda', {
      ...commonLambdaProps,
      entry: path.join(process.cwd(), 'lambda/get-images.ts'),
      handler: 'handler',
    });

    // Add/Upload image
    const addImageLambda = new nodejs.NodejsFunction(this, 'AddImageLambda', {
      ...commonLambdaProps,
      entry: path.join(process.cwd(), 'lambda/add-image.ts'),
      handler: 'handler',
    });

    // Delete image
    const deleteImageLambda = new nodejs.NodejsFunction(this, 'DeleteImageLambda', {
      ...commonLambdaProps,
      entry: path.join(process.cwd(), 'lambda/delete-image.ts'),
      handler: 'handler',
    });

    // Update likes
    const updateLikesLambda = new nodejs.NodejsFunction(this, 'UpdateLikesLambda', {
      ...commonLambdaProps,
      entry: path.join(process.cwd(), 'lambda/update-likes.ts'),
      handler: 'handler',
    });

    const updateViewsLambda = new nodejs.NodejsFunction(this, 'UpdateViewsLambda', {
      ...commonLambdaProps,
      entry: path.join(process.cwd(), 'lambda/update-views.ts'),
      handler: 'handler',
    });

    const editImageLambda = new nodejs.NodejsFunction(this, 'EditImageLambda', {
      ...commonLambdaProps,
      entry: path.join(process.cwd(), 'lambda/edit-image.ts'),
      handler: 'handler',
    });

    // Grant table permissions
    imagesTable.grantReadData(getImagesLambda);
    imagesTable.grantWriteData(addImageLambda);
    imagesTable.grantWriteData(deleteImageLambda);
    imagesTable.grantWriteData(updateLikesLambda);
    imagesTable.grantWriteData(updateViewsLambda);
    imagesTable.grantWriteData(editImageLambda);
    bucket.grantPut(addImageLambda);

    // â”€â”€â”€ 4. API GATEWAY â”€â”€â”€
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
    const viewResource = imageResource.addResource('view');
    viewResource.addMethod('PUT', new apigateway.LambdaIntegration(updateViewsLambda));
    imageResource.addMethod('PUT', new apigateway.LambdaIntegration(editImageLambda));

    // â”€â”€â”€ 5. DEPLOY WEBSITE â”€â”€â”€
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./website')],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // â”€â”€â”€ 6. OUTPUTS â”€â”€â”€
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
