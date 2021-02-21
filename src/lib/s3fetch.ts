import * as lambda from 'aws-lambda';
import type { Readable } from 'stream';
import path from 'path';
import { retryStrategy } from './retryStrategy';

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

export async function fetchFromS3(
  request: lambda.CloudFrontRequest,
): Promise<lambda.CloudFrontResultResponse> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { domainName, region } = request.origin!.s3!;
  const bucketName = domainName.replace(`.s3.${region}.amazonaws.com`, '');
  const response = {} as lambda.CloudFrontResultResponse;

  // Lazily import only S3Client to reduce init times until actually needed
  const { S3Client } = await import('@aws-sdk/client-s3/S3Client');

  const s3 = new S3Client({
    region: request.origin?.s3?.region,
    maxAttempts: 3,
    retryStrategy: retryStrategy,
  });

  // TODO: Get the file

  // If route has fallback, return that page from S3, otherwise return 404 page
  const s3Key = path.join(request.origin?.s3?.path as string, request.uri).substr(1);

  const { GetObjectCommand } = await import('@aws-sdk/client-s3/commands/GetObjectCommand');
  // S3 Body is stream per: https://github.com/aws/aws-sdk-js-v3/issues/1096
  const getStream = await import('get-stream');

  const s3Params = {
    Bucket: bucketName,
    Key: s3Key,
  };

  console.log(`sending request to s3: ${JSON.stringify(s3Params)}`);

  try {
    const { Body, CacheControl, ContentType } = await s3.send(new GetObjectCommand(s3Params));
    const bodyString = await getStream.default(Body as Readable);

    return {
      status: '200',
      statusDescription: 'OK',
      headers: {
        ...response.headers,
        'content-type': [
          {
            key: 'Content-Type',
            value: ContentType ?? 'text/html',
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
    };
  } catch {
    return {
      status: '404',
      statusDescription: 'Not Found',
    };
  }
}
