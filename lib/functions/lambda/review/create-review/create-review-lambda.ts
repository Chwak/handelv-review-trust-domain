import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { initTelemetryLogger } from "../../../../utils/telemetry-logger";
import {
  requireAuthenticatedUser,
  validateId,
  validateRating,
} from '../../../../utils/review-validation';

const REVIEWS_TABLE = process.env.REVIEWS_TABLE_NAME;
const RATING_AGGREGATES_TABLE = process.env.RATING_AGGREGATES_TABLE_NAME;

interface SubmitReviewInput {
  orderId?: unknown;
  productId?: unknown;
  makerUserId?: unknown;
  collectorUserId?: unknown;
  rating?: unknown;
  comment?: unknown;
  media?: unknown[];
}

export const handler = async (event: {
  arguments?: { input?: SubmitReviewInput };
  identity?: { sub?: string; claims?: { sub?: string } };
  headers?: Record<string, string>;
}) => {
  initTelemetryLogger(event, { domain: "review-trust-domain", service: "create-review" });
  if (!REVIEWS_TABLE || !RATING_AGGREGATES_TABLE) throw new Error('Internal server error');

  const input = event.arguments?.input ?? {};
  const orderId = validateId(input.orderId);
  const productId = validateId(input.productId);
  const makerUserId = validateId(input.makerUserId);
  const collectorUserId = validateId(input.collectorUserId);
  const rating = validateRating(input.rating, 1, 5);
  if (!orderId || !productId || !makerUserId || !collectorUserId || rating == null) {
    throw new Error('Invalid input format');
  }

  const auth = requireAuthenticatedUser(event);
  if (!auth || auth !== collectorUserId) throw new Error('Forbidden');

  const comment = typeof input.comment === 'string' ? input.comment.trim().slice(0, 2000) : undefined;
  const media = Array.isArray(input.media) ? input.media.slice(0, 5) : undefined;

  const now = new Date().toISOString();
  const reviewId = randomUUID();

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  await client.send(
    new PutCommand({
      TableName: REVIEWS_TABLE,
      Item: {
        reviewId,
        orderId,
        productId,
        makerUserId,
        collectorUserId,
        rating,
        comment: comment ?? null,
        media: media ?? null,
        status: 'PENDING',
        moderationStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
      },
    })
  );

  return {
    reviewId,
    orderId,
    productId,
    makerUserId,
    collectorUserId,
    rating,
    comment: comment ?? null,
    media: media ?? null,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
};