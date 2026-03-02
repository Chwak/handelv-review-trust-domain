import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface ReviewTablesConstructProps {
  environment: string;
  regionCode: string;
  removalPolicy?: cdk.RemovalPolicy;
}

export class ReviewTablesConstruct extends Construct {
  public readonly reviewsTable: dynamodb.Table;
  public readonly ratingAggregatesTable: dynamodb.Table;
  public readonly abuseReportsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: ReviewTablesConstructProps) {
    super(scope, id);

    const removalPolicy = props.removalPolicy ?? cdk.RemovalPolicy.DESTROY;

    // Reviews Table
    this.reviewsTable = new dynamodb.Table(this, 'ReviewsTable', {
      tableName: `${props.environment}-${props.regionCode}-review-trust-domain-reviews-table`,
      partitionKey: {
        name: 'reviewId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: removalPolicy,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: props.environment === 'prod' },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // GSI: reviews by maker
    this.reviewsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-MakerUserId',
      partitionKey: {
        name: 'makerUserId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // GSI: reviews by product
    this.reviewsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-ProductId',
      partitionKey: {
        name: 'productId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // GSI: reviews by order
    this.reviewsTable.addGlobalSecondaryIndex({
      indexName: 'GSI3-OrderId',
      partitionKey: {
        name: 'orderId',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // GSI: reviews by moderation status
    this.reviewsTable.addGlobalSecondaryIndex({
      indexName: 'GSI4-ModerationStatus',
      partitionKey: {
        name: 'moderationStatus',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Rating Aggregates Table
    this.ratingAggregatesTable = new dynamodb.Table(this, 'RatingAggregatesTable', {
      tableName: `${props.environment}-${props.regionCode}-review-trust-domain-rating-aggregates-table`,
      partitionKey: {
        name: 'entityId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'entityType',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: removalPolicy,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: props.environment === 'prod' },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Abuse Reports Table
    this.abuseReportsTable = new dynamodb.Table(this, 'AbuseReportsTable', {
      tableName: `${props.environment}-${props.regionCode}-review-trust-domain-abuse-reports-table`,
      partitionKey: {
        name: 'reportId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: removalPolicy,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: props.environment === 'prod' },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // GSI: abuse reports by status
    this.abuseReportsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-Status',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // GSI: abuse reports by entity
    this.abuseReportsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-Entity',
      partitionKey: {
        name: 'reportedEntityType',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'reportedEntityId',
        type: dynamodb.AttributeType.STRING,
      },
    });
  }
}
