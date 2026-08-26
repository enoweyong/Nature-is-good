import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  try {
    const category = event.pathParameters?.category;
    const id = event.pathParameters?.id;
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    if (!category || !id || !body.title || !body.desc) return response(400, { error: 'Category, ID, title, and description are required' });

    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { category: decodeURIComponent(category), id },
      UpdateExpression: 'SET title = :title, sub = :sub, #description = :description, #type = :type',
      ExpressionAttributeNames: { '#description': 'desc', '#type': 'type' },
      ExpressionAttributeValues: { ':title': body.title, ':sub': body.sub || '', ':description': body.desc, ':type': body.type || 'user' },
      ReturnValues: 'ALL_NEW',
    }));
    return response(200, result.Attributes);
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error' });
  }
};

function response(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) };
}