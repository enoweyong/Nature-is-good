import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  try {
    const category = event.pathParameters?.category;
    const id = event.pathParameters?.id;
    const body = JSON.parse(event.body || '{}');
    const increment = body?.increment ?? 1;

    if (!category || !id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Category and ID are required' }),
      };
    }

    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { category, id },
      UpdateExpression: 'SET likes = if_not_exists(likes, :start) + :inc',
      ExpressionAttributeValues: {
        ':inc': increment,
        ':start': 0,
      },
      ReturnValues: 'ALL_NEW',
    });

    const response = await docClient.send(command);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response.Attributes),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};