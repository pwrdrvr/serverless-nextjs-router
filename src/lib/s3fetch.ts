import * as path from 'path';
import type { Readable } from 'stream';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
// eslint-disable-next-line import/no-unresolved
import type * as lambda from 'aws-lambda';
import { IConfig } from './config';

export const binaryMimeTypes = new Set<string>([
  'application/octet-stream',
  'image/bmp',
  'image/jpeg',
  'image/gif',
  'image/vnd.microsoft.icon',
  'image/png',
  'image/svg+xml',
  'image/tiff',
  'image/webp',
]);

// The parameters don't change
let s3: S3Client;

export async function fetchFromS3(
  request: lambda.CloudFrontRequest,
  config: IConfig,
): Promise<lambda.CloudFrontResultResponse> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const bucketName = config.s3BucketName;
  const response = {} as lambda.CloudFrontResultResponse;

  // Init client once as region doesn't change
  if (s3 === undefined) {
    s3 = new S3Client({
      // AWS_REGION is set automatically for the Lambda @ Origin function
      region: process.env.AWS_REGION,
      maxAttempts: 8,
    });
  }

  // If route has fallback, return that page from S3, otherwise return 404 page
  const s3Key = path.join(request.origin?.s3?.path as string, request.uri).substr(1);

  //const { GetObjectCommand } = await import('@aws-sdk/client-s3/commands/GetObjectCommand');
  // S3 Body is stream per: https://github.com/aws/aws-sdk-js-v3/issues/1096
  const getStream = await import('get-stream');

  const s3Params = {
    Bucket: bucketName,
    Key: s3Key,
  };

  //console.log(`sending request to s3: ${JSON.stringify(s3Params)}`);

  try {
    const { Body, CacheControl, ContentType } = await s3.send(new GetObjectCommand(s3Params));
    const bodyString = await getStream.default(Body as Readable);
    const responseContentType = ContentType ?? 'text/html';

    const responseEncoding = binaryMimeTypes.has(responseContentType) ? 'base64' : 'text';

    return {
      status: '200',
      statusDescription: 'OK',
      headers: {
        ...response.headers,
        'content-type': [
          {
            key: 'Content-Type',
            value: responseContentType,
          },
        ],
        'cache-control': [
          {
            key: 'Cache-Control',
            value: CacheControl ?? 'public, max-age=0, s-maxage=2678400, must-revalidate',
          },
        ],
      },
      body: bodyString,
      bodyEncoding: responseEncoding,
    };
  } catch {
    return {
      status: '404',
      statusDescription: 'Not Found',
    };
  }
}
