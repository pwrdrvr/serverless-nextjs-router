import * as lambda from 'aws-lambda';

// Installed as Origin Request handler
export async function handler(
  event: lambda.CloudFrontRequestEvent,
  //context: lambda.Context,
): Promise<lambda.CloudFrontResultResponse> {
  return {} as lambda.CloudFrontResultResponse;
}
