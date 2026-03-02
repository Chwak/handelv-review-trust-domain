import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ReviewAppSyncResolversConstructProps {
  api: appsync.IGraphqlApi;
  createReviewLambda?: lambda.IFunction;
  getReviewLambda?: lambda.IFunction;
  listReviewsLambda?: lambda.IFunction;
  createAbuseReportLambda?: lambda.IFunction;
  updateRatingAggregatesLambda?: lambda.IFunction;
}

export class ReviewAppSyncResolversConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ReviewAppSyncResolversConstructProps) {
    super(scope, id);

    if (props.createReviewLambda) {
      const createReviewDataSource = props.api.addLambdaDataSource(
        'CreateReviewDataSource',
        props.createReviewLambda
      );

      createReviewDataSource.createResolver('CreateReviewResolver', {
        typeName: 'Mutation',
        fieldName: 'submitReview',
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
      });
    }

    if (props.getReviewLambda) {
      const getReviewDataSource = props.api.addLambdaDataSource(
        'GetReviewDataSource',
        props.getReviewLambda
      );

      getReviewDataSource.createResolver('GetReviewResolver', {
        typeName: 'Query',
        fieldName: 'getReview',
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
      });
    }

    if (props.listReviewsLambda) {
      const listReviewsDataSource = props.api.addLambdaDataSource(
        'ListReviewsDataSource',
        props.listReviewsLambda
      );

      listReviewsDataSource.createResolver('ListReviewsResolver', {
        typeName: 'Query',
        fieldName: 'listReviews',
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
      });
    }

    if (props.createAbuseReportLambda) {
      const createAbuseReportDataSource = props.api.addLambdaDataSource(
        'CreateAbuseReportDataSource',
        props.createAbuseReportLambda
      );

      createAbuseReportDataSource.createResolver('CreateAbuseReportResolver', {
        typeName: 'Mutation',
        fieldName: 'submitAbuseReport',
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
      });
    }

    // Note: updateRatingAggregates is not exposed as a GraphQL mutation
    // It's triggered internally by events when reviews are created/updated
    // if (props.updateRatingAggregatesLambda) {
    //   const updateRatingAggregatesDataSource = props.api.addLambdaDataSource(
    //     'UpdateRatingAggregatesDataSource',
    //     props.updateRatingAggregatesLambda
    //   );

    //   updateRatingAggregatesDataSource.createResolver('UpdateRatingAggregatesResolver', {
    //     typeName: 'Mutation',
    //     fieldName: 'updateRatingAggregates',
    //     requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
    //     responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    //   });
    // }
  }
}
