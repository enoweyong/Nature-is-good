import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  try {
    const category = event.pathParameters?.category;
    const id = event.pathParameters?.id;

    if (!category || !id) {
      return response(400, { error: 'Category and ID are required' });
    }

    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { category: decodeURIComponent(category), id: decodeURIComponent(id) },
      UpdateExpression: 'SET views = if_not_exists(views, :start) + :inc',
      ExpressionAttributeValues: { ':start': 0, ':inc': 1 },
      ReturnValues: 'ALL_NEW',
    }));

    return response(200, result.Attributes);
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
