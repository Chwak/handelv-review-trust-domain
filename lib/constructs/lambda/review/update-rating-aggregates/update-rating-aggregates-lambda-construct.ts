import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export interface UpdateRatingAggregatesLambdaConstructProps {
  environment: string;
  regionCode: string;
  reviewsTable: dynamodb.ITable;
  ratingAggregatesTable: dynamodb.ITable;
  removalPolicy?: cdk.RemovalPolicy;
}

export class UpdateRatingAggregatesLambdaConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: UpdateRatingAggregatesLambdaConstructProps) {
    super(scope, id);

    const role = new iam.Role(this, 'UpdateRatingAggregatesLambdaRole', {
      roleName: `${props.environment}-${props.regionCode}-review-trust-update-rating-agg-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for Update Rating Aggregates Lambda',
      inlinePolicies: {
        CloudWatchLogsAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: [
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${props.environment}-${props.regionCode}-review-trust-domain-update-rating-aggregates-lambda*`,
              ],
            }),
          ],
        }),
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
              ],
              resources: [
                props.reviewsTable.tableArn,
                `${props.reviewsTable.tableArn}/index/*`,
                props.ratingAggregatesTable.tableArn,
              ],
            }),
          ],
        }),
      },
    });

    const logGroup = new logs.LogGroup(this, 'UpdateRatingAggregatesLogGroup', {
      logGroupName: `/aws/lambda/${props.environment}-${props.regionCode}-review-trust-domain-update-rating-aggregates-lambda`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    const lambdaCodePath = path.join(__dirname, '../../../../functions/lambda/review/update-rating-aggregates');
    this.function = new lambda.Function(this, 'UpdateRatingAggregatesFunction', {
      functionName: `${props.environment}-${props.regionCode}-review-trust-domain-update-rating-aggregates-lambda`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'update-rating-aggregates-lambda.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role,
      timeout: cdk.Duration.seconds(60), // Longer timeout for aggregation calculations
      memorySize: 512, // More memory for processing multiple reviews
      tracing: lambda.Tracing.DISABLED,
      logGroup,
      environment: {
        ENVIRONMENT: props.environment,
        REGION_CODE: props.regionCode,
        REVIEWS_TABLE_NAME: props.reviewsTable.tableName,
        RATING_AGGREGATES_TABLE_NAME: props.ratingAggregatesTable.tableName,
        LOG_LEVEL: props.environment === 'prod' ? 'ERROR' : 'INFO',
      },
      description: 'Update rating aggregates when reviews are created, updated, or deleted',
    });

    props.reviewsTable.grantReadData(this.function);
    props.ratingAggregatesTable.grantReadWriteData(this.function);


    if (props.removalPolicy) {
      this.function.applyRemovalPolicy(props.removalPolicy);
    }
  }
}
