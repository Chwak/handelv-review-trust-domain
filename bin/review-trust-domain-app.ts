#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ReviewTrustDomainStack } from "../lib/review-trust-domain-stack";
import { ReviewTrustDomainPipelineStack } from "../lib/review-trust-domain-pipeline-stack";

const app = new cdk.App();

const environment = app.node.tryGetContext("environment") ?? "dev";
const regionCode = app.node.tryGetContext("regionCode") ?? "use1";

new ReviewTrustDomainStack(app, `${environment}-${regionCode}-hand-made-review-trust-domain-stack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  environment,
  regionCode,
});

// Domain-scoped pipeline infrastructure
const managementAccountId = "567608120268";
const devAccountId = "741429964649";
const mimicProdAccountId = "329177708881";
const prodAccountId = "021657748325";
const githubConnectionArn = "arn:aws:codestar-connections:us-east-1:567608120268:connection/ef226671-d921-4f3e-9935-c5f2549ecb0d";

new ReviewTrustDomainPipelineStack(
  app,
  "ReviewTrustDomainPipelineStack",
  {
    env: { account: managementAccountId, region: "us-east-1" },
    domain: "review-trust-domain",
    managementAccountId,
    devAccountId,
    mimicProdAccountId,
    prodAccountId,
    githubConnectionArn,
    description: "Domain-scoped pipeline for review-trust-domain",
  }
);

app.synth();
