import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  try {
    const rawCategory = event.pathParameters?.category;

    if (!rawCategory) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
         },
        body: JSON.stringify({ error: 'Category is required' }),
      };
    }
const category = decodeURIComponent(rawCategory);
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'category = :category',
      ExpressionAttributeValues: {
        ':category': category,
      },
    });

    const response = await docClient.send(command);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
       },
      body: JSON.stringify(response.Items || []),
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