import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { initTelemetryLogger } from "../../../../utils/telemetry-logger";
import {
  encodeNextToken,
  parseNextToken,
  requireAuthenticatedUser,
  validateId,
  validateLimit,
} from '../../../../utils/review-validation';

const REVIEWS_TABLE = process.env.REVIEWS_TABLE_NAME;
const GSI1_MAKER = 'GSI1-MakerUserId';
const GSI2_PRODUCT = 'GSI2-ProductId';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const handler = async (event: {
  arguments?: {
    productId?: unknown;
    makerUserId?: unknown;
    collectorUserId?: unknown;
    limit?: unknown;
    nextToken?: unknown;
  };
  identity?: { sub?: string; claims?: { sub?: string } };
}) => {
  initTelemetryLogger(event, { domain: "review-trust-domain", service: "list-reviews" });
  if (!REVIEWS_TABLE) throw new Error('Internal server error');

  const args = event.arguments ?? {};
  const productId = args.productId != null ? validateId(args.productId) : null;
  const makerUserId = args.makerUserId != null ? validateId(args.makerUserId) : null;
  if (!productId && !makerUserId) throw new Error('At least one of productId or makerUserId is required');

  const authUserId = requireAuthenticatedUser(event);
  if (!authUserId) throw new Error('Not authenticated');
  if (makerUserId && makerUserId !== authUserId) throw new Error('Forbidden');

  const limit = validateLimit(args.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const nextToken = parseNextToken(args.nextToken);

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const indexName = productId ? GSI2_PRODUCT : GSI1_MAKER;
  const pkName = productId ? 'productId' : 'makerUserId';
  const pkValue = productId ?? makerUserId;

  const queryInput: Record<string, unknown> = {
    TableName: REVIEWS_TABLE,
    IndexName: indexName,
    KeyConditionExpression: `${pkName} = :pk`,
    ExpressionAttributeValues: { ':pk': pkValue },
    Limit: limit,
  };
  if (productId) {
    queryInput.FilterExpression = 'makerUserId = :makerId';
    (queryInput.ExpressionAttributeValues as Record<string, unknown>)[':makerId'] = authUserId;
  }
  if (nextToken && typeof nextToken === 'object' && Object.keys(nextToken).length > 0) {
    queryInput.ExclusiveStartKey = nextToken as Record<string, unknown>;
  }

  const result = await client.send(new QueryCommand(queryInput as QueryCommandInput));
  const items = (result.Items ?? []) as Record<string, unknown>[];
  const newNextToken = result.LastEvaluatedKey
    ? encodeNextToken(result.LastEvaluatedKey as Record<string, unknown>)
    : null;

  return { items, nextToken: newNextToken };
};