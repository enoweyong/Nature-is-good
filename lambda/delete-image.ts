import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  try {
    const rawCategory = event.pathParameters?.category;
    const id = event.pathParameters?.id;

    if (!rawCategory || !id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
         },
        body: JSON.stringify({ error: 'Category and ID are required' }),
      };
    }
const category = decodeURIComponent(rawCategory);
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { category, id },
    });

    await docClient.send(command);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
       },
      body: JSON.stringify({ message: 'Image deleted successfully' }),
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