// eslint-disable-next-line import/no-unresolved
import type * as lambda from 'aws-lambda';

// Note: This is just a signature to match the functions dropped in
// .serverless-nextjs/image-lamba/index.js and to be
// at the same path so that a relative import will find it.
// The built output of this file is not copied to the consuming app.
// Installed as Origin Request handler
export async function handler(
  _event: lambda.CloudFrontRequestEvent,
  _context?: lambda.Context,
): Promise<lambda.CloudFrontResultResponse> {
  return {} as lambda.CloudFrontResultResponse;
}
