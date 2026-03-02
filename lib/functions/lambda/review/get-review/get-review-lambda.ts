import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { requireAuthenticatedUser, validateId } from '../../../../utils/review-validation';
import { initTelemetryLogger } from "../../../../utils/telemetry-logger";

const REVIEWS_TABLE = process.env.REVIEWS_TABLE_NAME;

export const handler = async (event: { arguments?: { reviewId?: unknown }; identity?: { sub?: string; claims?: { sub?: string } } }) => {
  initTelemetryLogger(event, { domain: "review-trust-domain", service: "get-review" });
  if (!REVIEWS_TABLE) throw new Error('Internal server error');

  const reviewId = validateId(event.arguments?.reviewId);
  if (!reviewId) throw new Error('Invalid input format');

  const auth = requireAuthenticatedUser(event);
  if (!auth) throw new Error('Not authenticated');

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const result = await client.send(
    new GetCommand({
      TableName: REVIEWS_TABLE,
      Key: { reviewId },
    })
  );

  if (!result.Item) throw new Error('Review not found');
  const makerUserId = result.Item.makerUserId as string | undefined;
  const collectorUserId = result.Item.collectorUserId as string | undefined;
  if (auth !== makerUserId && auth !== collectorUserId) throw new Error('Forbidden');
  return result.Item as Record<string, unknown>;
};