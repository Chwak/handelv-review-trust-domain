import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { validateId } from '../../../../utils/review-validation';
import { initTelemetryLogger } from "../../../../utils/telemetry-logger";

const REVIEWS_TABLE = process.env.REVIEWS_TABLE_NAME;
const RATING_AGGREGATES_TABLE = process.env.RATING_AGGREGATES_TABLE_NAME;
const GSI1_MAKER = 'GSI1-MakerUserId';
const GSI2_PRODUCT = 'GSI2-ProductId';

export const handler = async (event: {
  arguments?: { entityId?: unknown; entityType?: unknown };
  entityId?: string;
  entityType?: string;
}) => {
  initTelemetryLogger(event, { domain: "review-trust-domain", service: "update-rating-aggregates" });
  if (!REVIEWS_TABLE || !RATING_AGGREGATES_TABLE) throw new Error('Internal server error');

  const entityId = validateId(event.arguments?.entityId ?? event.entityId);
  const entityType = (event.arguments?.entityType ?? event.entityType) === 'product' ? 'product' : 'maker';
  if (!entityId) throw new Error('Invalid input format');

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const indexName = entityType === 'product' ? GSI2_PRODUCT : GSI1_MAKER;
  const pkName = entityType === 'product' ? 'productId' : 'makerUserId';

  const queryResult = await client.send(
    new QueryCommand({
      TableName: REVIEWS_TABLE,
      IndexName: indexName,
      KeyConditionExpression: `${pkName} = :pk`,
      FilterExpression: '#st = :approved',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':pk': entityId, ':approved': 'APPROVED' },
    })
  );

  const reviews = (queryResult.Items ?? []) as { rating?: number }[];
  const ratings = reviews.map((r) => (r.rating ?? 0)).filter((r) => r >= 1 && r <= 5);
  const totalReviews = ratings.length;
  const averageRating = totalReviews === 0 ? 0 : ratings.reduce((a, b) => a + b, 0) / totalReviews;
  const fiveStar = ratings.filter((r) => r === 5).length;
  const fourStar = ratings.filter((r) => r === 4).length;
  const threeStar = ratings.filter((r) => r === 3).length;
  const twoStar = ratings.filter((r) => r === 2).length;
  const oneStar = ratings.filter((r) => r === 1).length;

  const now = new Date().toISOString();
  const item = {
    entityId,
    entityType,
    ...(entityType === 'product' ? { productId: entityId } : {}),
    ...(entityType === 'maker' ? { makerUserId: entityId } : {}),
    averageRating: Math.round(averageRating * 100) / 100,
    totalReviews,
    ratingBreakdown: { fiveStar, fourStar, threeStar, twoStar, oneStar },
    lastUpdated: now,
  };

  await client.send(
    new PutCommand({
      TableName: RATING_AGGREGATES_TABLE,
      Item: item,
    })
  );

  return item;
};