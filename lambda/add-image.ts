import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN!;

export const handler = async (event: any) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { category, title, sub, desc, type, imageUrl, imageData, contentType } = body;
    const id = body.id || randomUUID();
    if (!category || !title || !desc) return response(400, { error: 'Category, title, and description are required' });

    let storedImageUrl = imageUrl || '';
    if (imageData) {
      const match = String(imageData).match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return response(400, { error: 'imageData must be a base64 data URL' });
      const objectKey = `images/${category}/${id}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: Buffer.from(match[2], 'base64'),
        ContentType: contentType || match[1],
      }));
      storedImageUrl = `https://${CLOUDFRONT_DOMAIN}/${objectKey}`;
    }

    const item = {
      category,
      id,
      title,
      sub: sub || '',
      desc,
      type: type || 'user',
      likes: 0,
      views: 0,
      imageUrl: storedImageUrl,
      createdAt: new Date().toISOString(),
    };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return response(201, item);
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error' });
  }
};

function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}
