import * as lambda from 'aws-lambda';

// Installed as Origin Request / Origin Response handler
export async function handler(
  event: lambda.CloudFrontRequestEvent | lambda.CloudFrontResponseEvent,
  context: lambda.Context,
): Promise<lambda.CloudFrontResultResponse | lambda.CloudFrontRequest> {
  return {} as lambda.CloudFrontResultResponse;
}
