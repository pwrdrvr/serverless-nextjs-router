import * as lambda from 'aws-lambda';

// Installed as Origin Request handler
export function apiHandler(
  event: lambda.CloudFrontRequestEvent,
  context: lambda.Context,
): Promise<lambda.CloudFrontResultResponse>;

// Installed as Origin Request / Origin Response handler
export function defaultHandler(
  event: lambda.CloudFrontRequestEvent | lambda.CloudFrontResponseEvent,
  context: lambda.Context,
): Promise<lambda.CloudFrontResultResponse | lambda.CloudFrontRequest>;

// Installed as Origin Request handler
export function imageHandler(
  event: lambda.CloudFrontRequestEvent,
  context: lambda.Context,
): Promise<lambda.CloudFrontResultResponse>;
