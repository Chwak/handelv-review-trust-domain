import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export interface CreateAbuseReportLambdaConstructProps {
  environment: string;
  regionCode: string;
  abuseReportsTable: dynamodb.ITable;
  reviewsTable?: dynamodb.ITable;
  removalPolicy?: cdk.RemovalPolicy;
}

export class CreateAbuseReportLambdaConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: CreateAbuseReportLambdaConstructProps) {
    super(scope, id);

    const role = new iam.Role(this, 'CreateAbuseReportLambdaRole', {
      roleName: `${props.environment}-${props.regionCode}-review-trust-domain-create-abuse-report-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for Create Abuse Report Lambda',
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
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${props.environment}-${props.regionCode}-review-trust-domain-create-abuse-report-lambda*`,
              ],
            }),
          ],
        }),
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['dynamodb:PutItem', 'dynamodb:GetItem'],
              resources: [
                props.abuseReportsTable.tableArn,
                ...(props.reviewsTable ? [props.reviewsTable.tableArn] : []),
              ],
            }),
          ],
        }),
      },
    });

    const logGroup = new logs.LogGroup(this, 'CreateAbuseReportLogGroup', {
      logGroupName: `/aws/lambda/${props.environment}-${props.regionCode}-review-trust-domain-create-abuse-report-lambda`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    const lambdaCodePath = path.join(__dirname, '../../../../functions/lambda/review/create-abuse-report');
    this.function = new lambda.Function(this, 'CreateAbuseReportFunction', {
      functionName: `${props.environment}-${props.regionCode}-review-trust-domain-create-abuse-report-lambda`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'create-abuse-report-lambda.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.DISABLED,
      logGroup,
      environment: {
        ENVIRONMENT: props.environment,
        REGION_CODE: props.regionCode,
        ABUSE_REPORTS_TABLE_NAME: props.abuseReportsTable.tableName,
        ...(props.reviewsTable && { REVIEWS_TABLE_NAME: props.reviewsTable.tableName }),
        LOG_LEVEL: props.environment === 'prod' ? 'ERROR' : 'INFO',
      },
      description: 'Create an abuse report for a review or other entity',
    });

    props.abuseReportsTable.grantWriteData(this.function);
    if (props.reviewsTable) {
      props.reviewsTable.grantReadData(this.function);
    }


    if (props.removalPolicy) {
      this.function.applyRemovalPolicy(props.removalPolicy);
    }
  }
}
