import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { category,  title, sub, desc, type, likes, views, imageUrl } = body;
    const id = body.id || randomUUID(); // Generate a new UUID if not provided

    if (!category || !title) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
         },
        body: JSON.stringify({ error: 'Category and title are required' }),
      };
    }

    const item = {
      category,
      id,
      title,
      sub: sub || '',
      desc: desc || '',
      type: type || 'user',
      likes: typeof likes === 'number' ? likes : 0,
      views: typeof views === 'number' ? views : 0,
      imageUrl: imageUrl || '',
      createdAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    });

    await docClient.send(command);
    
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
       },
      body: JSON.stringify(item),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
       },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};