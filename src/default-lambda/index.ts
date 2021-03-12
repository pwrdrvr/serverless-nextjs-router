/* eslint-disable @typescript-eslint/no-unused-vars */
import type * as lambda from 'aws-lambda';

// Note: This is just a signature to match the functions dropped in
// .serverless-nextjs/default-lamba/index.js and to be
// at the same path so that a relative import will find it.
// The built output of this file is not copied to the consuming app.
// Installed as Origin Request / Origin Response handler
export async function handler(
  _event: lambda.CloudFrontRequestEvent | lambda.CloudFrontResponseEvent,
  _context?: lambda.Context,
): Promise<lambda.CloudFrontResultResponse | lambda.CloudFrontRequestEvent> {
  return {} as lambda.CloudFrontResultResponse;
}
