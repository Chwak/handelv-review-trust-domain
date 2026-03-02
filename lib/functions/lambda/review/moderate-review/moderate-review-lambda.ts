import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { requireAuthenticatedUser, validateId } from '../../../../utils/review-validation';
import { initTelemetryLogger } from "../../../../utils/telemetry-logger";

const REVIEWS_TABLE = process.env.REVIEWS_TABLE_NAME;

export const handler = async (event: {
  arguments?: { reviewId?: unknown };
  identity?: { sub?: string; claims?: { sub?: string } };
  headers?: Record<string, string>;
}) => {
  initTelemetryLogger(event, { domain: "review-trust-domain", service: "moderate-review" });
  if (!REVIEWS_TABLE) throw new Error('Internal server error');

  const reviewId = validateId(event.arguments?.reviewId);
  if (!reviewId) throw new Error('Invalid input format');

  const auth = requireAuthenticatedUser(event);
  if (!auth) throw new Error('Not authenticated');
  throw new Error('Review moderation moved to admin platform');

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const getResult = await client.send(
    new GetCommand({
      TableName: REVIEWS_TABLE,
      Key: { reviewId },
    })
  );
  const review = getResult.Item as Record<string, unknown> | undefined;
  if (!review) throw new Error('Review not found');

  const now = new Date().toISOString();

  const updateResult = await client.send(
    new UpdateCommand({
      TableName: REVIEWS_TABLE,
      Key: { reviewId },
      UpdateExpression: 'SET #st = :status, moderationStatus = :modStatus, approvedAt = :now, updatedAt = :now',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: {
        ':status': 'APPROVED',
        ':modStatus': 'APPROVED',
        ':now': now,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  return (updateResult.Attributes ?? review) as Record<string, unknown>;
};