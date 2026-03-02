import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ListReviewsLambdaConstructProps {
  environment: string;
  regionCode: string;
  reviewsTable: dynamodb.ITable;
  removalPolicy?: cdk.RemovalPolicy;
}

export class ListReviewsLambdaConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: ListReviewsLambdaConstructProps) {
    super(scope, id);

    const role = new iam.Role(this, 'ListReviewsLambdaRole', {
      roleName: `${props.environment}-${props.regionCode}-review-trust-domain-list-reviews-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for List Reviews Lambda',
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
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${props.environment}-${props.regionCode}-review-trust-domain-list-reviews-lambda*`,
              ],
            }),
          ],
        }),
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['dynamodb:Query'],
              resources: [
                props.reviewsTable.tableArn,
                `${props.reviewsTable.tableArn}/index/*`,
              ],
            }),
          ],
        }),
      },
    });

    const logGroup = new logs.LogGroup(this, 'ListReviewsLogGroup', {
      logGroupName: `/aws/lambda/${props.environment}-${props.regionCode}-review-trust-domain-list-reviews-lambda`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    const lambdaCodePath = path.join(__dirname, '../../../../functions/lambda/review/list-reviews');
    this.function = new lambda.Function(this, 'ListReviewsFunction', {
      functionName: `${props.environment}-${props.regionCode}-review-trust-domain-list-reviews-lambda`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'list-reviews-lambda.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.DISABLED,
      logGroup,
      environment: {
        ENVIRONMENT: props.environment,
        REGION_CODE: props.regionCode,
        REVIEWS_TABLE_NAME: props.reviewsTable.tableName,
        LOG_LEVEL: props.environment === 'prod' ? 'ERROR' : 'INFO',
      },
      description: 'List reviews with filters',
    });

    props.reviewsTable.grantReadData(this.function);


    if (props.removalPolicy) {
      this.function.applyRemovalPolicy(props.removalPolicy);
    }
  }
}
