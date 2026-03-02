import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { requireAuthenticatedUser, validateId } from '../../../../utils/review-validation';
import { initTelemetryLogger } from "../../../../utils/telemetry-logger";

const ABUSE_REPORTS_TABLE = process.env.ABUSE_REPORTS_TABLE_NAME;

interface SubmitAbuseReportInput {
  reviewId?: unknown;
  reporterUserId?: unknown;
  reason?: unknown;
}

function validateReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length < 1 || t.length > 1000) return null;
  return t;
}

export const handler = async (event: {
  arguments?: { input?: SubmitAbuseReportInput };
  identity?: { sub?: string; claims?: { sub?: string } };
  headers?: Record<string, string>;
}) => {
  initTelemetryLogger(event, { domain: "review-trust-domain", service: "create-abuse-report" });
  if (!ABUSE_REPORTS_TABLE) throw new Error('Internal server error');

  const input = event.arguments?.input ?? {};
  const reviewId = validateId(input.reviewId);
  const reporterUserId = validateId(input.reporterUserId);
  const reason = validateReason(input.reason);
  if (!reviewId || !reporterUserId || !reason) throw new Error('Invalid input format');

  const auth = requireAuthenticatedUser(event);
  if (!auth || auth !== reporterUserId) throw new Error('Forbidden');

  const now = new Date().toISOString();
  const reportId = randomUUID();

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  await client.send(
    new PutCommand({
      TableName: ABUSE_REPORTS_TABLE,
      Item: {
        reportId,
        reviewId,
        reporterUserId,
        reason,
        status: 'PENDING',
        createdAt: now,
      },
    })
  );

  return {
    reportId,
    reviewId,
    reporterUserId,
    reason,
    status: 'PENDING',
    createdAt: now,
  };
};