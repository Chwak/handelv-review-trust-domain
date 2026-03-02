import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ModerateReviewLambdaConstructProps {
  environment: string;
  regionCode: string;
  reviewsTable: dynamodb.ITable;
  removalPolicy?: cdk.RemovalPolicy;
}

export class ModerateReviewLambdaConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: ModerateReviewLambdaConstructProps) {
    super(scope, id);

    const role = new iam.Role(this, 'ModerateReviewLambdaRole', {
      roleName: `${props.environment}-${props.regionCode}-review-trust-domain-moderate-review-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for Moderate Review Lambda',
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
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${props.environment}-${props.regionCode}-review-trust-domain-moderate-review-lambda*`,
              ],
            }),
          ],
        }),
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
              resources: [
                props.reviewsTable.tableArn,
                `${props.reviewsTable.tableArn}/index/*`,
              ],
            }),
          ],
        }),
      },
    });

    const logGroup = new logs.LogGroup(this, 'ModerateReviewLogGroup', {
      logGroupName: `/aws/lambda/${props.environment}-${props.regionCode}-review-trust-domain-moderate-review-lambda`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    const lambdaCodePath = path.join(__dirname, '../../../../functions/lambda/review/moderate-review');
    this.function = new lambda.Function(this, 'ModerateReviewFunction', {
      functionName: `${props.environment}-${props.regionCode}-review-trust-domain-moderate-review-lambda`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'moderate-review-lambda.handler',
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
      description: 'Moderate a review (approve, reject, flag)',
    });

    props.reviewsTable.grantReadWriteData(this.function);


    if (props.removalPolicy) {
      this.function.applyRemovalPolicy(props.removalPolicy);
    }
  }
}
