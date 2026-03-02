import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import type { DomainStackProps } from "./domain-stack-props";
import { ReviewAppSyncConstruct } from "./constructs/appsync/review-appsync/review-appsync-construct";
import { ReviewTablesConstruct } from "./constructs/dynamodb/review-tables/review-tables-construct";
import { OutboxTableConstruct } from "./constructs/dynamodb/outbox-table/outbox-table-construct";
import { CreateReviewLambdaConstruct } from "./constructs/lambda/review/create-review/create-review-lambda-construct";
import { GetReviewLambdaConstruct } from "./constructs/lambda/review/get-review/get-review-lambda-construct";
import { ListReviewsLambdaConstruct } from "./constructs/lambda/review/list-reviews/list-reviews-lambda-construct";
import { CreateAbuseReportLambdaConstruct } from "./constructs/lambda/review/create-abuse-report/create-abuse-report-lambda-construct";
import { UpdateRatingAggregatesLambdaConstruct } from "./constructs/lambda/review/update-rating-aggregates/update-rating-aggregates-lambda-construct";
import { ReviewAppSyncResolversConstruct } from "./constructs/appsync/review-appsync-resolvers/review-appsync-resolvers-construct";
import { RepublishLambdaConstruct } from "./constructs/lambda/republish/republish-lambda-construct";

export class ReviewTrustDomainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Domain", "hand-made-review-trust-domain");
    cdk.Tags.of(this).add("Environment", props.environment);
    cdk.Tags.of(this).add("Project", "hand-made");
    cdk.Tags.of(this).add("Region", props.regionCode);
    cdk.Tags.of(this).add("StackName", this.stackName);

    const removalPolicy = props.environment === 'prod'
      ? cdk.RemovalPolicy.RETAIN
      : cdk.RemovalPolicy.DESTROY;

    const schemaRegistryName = ssm.StringParameter.valueForStringParameter(
      this,
      `/${props.environment}/shared-infra/glue/schema-registry-name`,
    );

    const eventBusName = ssm.StringParameter.fromStringParameterName(
      this,
      "EventBusNameParameter",
      `/${props.environment}/shared-infra/eventbridge/event-bus-name`,
    ).stringValue;

    const eventBus = events.EventBus.fromEventBusName(this, "ImportedEventBus", eventBusName);

    // Create DynamoDB tables
    const reviewTables = new ReviewTablesConstruct(this, "ReviewTables", {
      environment: props.environment,
      regionCode: props.regionCode,
      removalPolicy,
    });

    const outboxTable = new OutboxTableConstruct(this, "OutboxTable", {
      environment: props.environment,
      regionCode: props.regionCode,
      domainName: "review-trust-domain",
      removalPolicy,
    });

    new RepublishLambdaConstruct(this, "RepublishLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      domainName: "review-trust-domain",
      outboxTable: outboxTable.table,
      eventBus,
      schemaRegistryName,
      removalPolicy,
    });

    const reviewAppSync = new ReviewAppSyncConstruct(this, "ReviewAppSync", {
      environment: props.environment,
      regionCode: props.regionCode,
    });

    // Create Lambda functions
    const createReviewLambda = new CreateReviewLambdaConstruct(this, "CreateReviewLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      reviewsTable: reviewTables.reviewsTable,
      ratingAggregatesTable: reviewTables.ratingAggregatesTable,
      removalPolicy,
    });

    const getReviewLambda = new GetReviewLambdaConstruct(this, "GetReviewLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      reviewsTable: reviewTables.reviewsTable,
      removalPolicy,
    });

    const listReviewsLambda = new ListReviewsLambdaConstruct(this, "ListReviewsLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      reviewsTable: reviewTables.reviewsTable,
      removalPolicy,
    });

    const createAbuseReportLambda = new CreateAbuseReportLambdaConstruct(this, "CreateAbuseReportLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      abuseReportsTable: reviewTables.abuseReportsTable,
      reviewsTable: reviewTables.reviewsTable,
      removalPolicy,
    });

    const updateRatingAggregatesLambda = new UpdateRatingAggregatesLambdaConstruct(this, "UpdateRatingAggregatesLambda", {
      environment: props.environment,
      regionCode: props.regionCode,
      reviewsTable: reviewTables.reviewsTable,
      ratingAggregatesTable: reviewTables.ratingAggregatesTable,
      removalPolicy,
    });

    // Create AppSync resolvers
    const reviewResolvers = new ReviewAppSyncResolversConstruct(this, "ReviewResolvers", {
      api: reviewAppSync.api,
      createReviewLambda: createReviewLambda.function,
      getReviewLambda: getReviewLambda.function,
      listReviewsLambda: listReviewsLambda.function,
      createAbuseReportLambda: createAbuseReportLambda.function,
      updateRatingAggregatesLambda: updateRatingAggregatesLambda.function,
    });
  }
}
