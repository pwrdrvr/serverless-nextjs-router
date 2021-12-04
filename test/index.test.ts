/// <reference types="jest" />

import * as s3 from '@aws-sdk/client-s3';
// eslint-disable-next-line import/no-unresolved
import type * as lambda from 'aws-lambda';
import { mockClient, AwsClientStub } from 'aws-sdk-client-mock';
import { handler } from '../src/index';

let s3Client: AwsClientStub<s3.S3Client>;

describe('index.ts', () => {
  beforeEach(async () => {
    s3Client = mockClient(s3.S3Client);
  });

  afterEach(() => {
    s3Client.restore();
  });

  it.skip('/nextjs-demo/0.0.1 that hits defaultLambda', async () => {
    const response = await handler(
      {
        version: '2.0',
        routeKey: 'ANY /nextjs-demo/0.0.1',
        rawPath: '/nextjs-demo/0.0.1',
        rawQueryString: '',
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en-US,en;q=0.9',
          'content-length': '0',
          host: 'apps.pwrdrvr.com',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'sec-fetch-user': '?1',
          'upgrade-insecure-requests': '1',
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36 Edg/88.0.705.68',
          via: '2.0 edf4d9eb8e5d775f8b1cd6b4e97dd4c6.cloudfront.net (CloudFront)',
          'x-amz-cf-id': 'OQ90cBE6PHgp5ZhZOq9kyqLqc0VLF2YEWECm2GvFtzWWROCtSJigWA==',
          'x-amzn-trace-id': 'Root=1-6033064f-37056f62012474e661860953',
          'x-forwarded-for': '68.192.58.143, 52.46.46.148',
          'x-forwarded-port': '443',
          'x-forwarded-proto': 'https',
        },
        requestContext: {
          accountId: '239161478713',
          apiId: '4jssqkktsg',
          domainName: 'apps.pwrdrvr.com',
          domainPrefix: 'apps',
          http: {
            method: 'GET',
            path: '/nextjs-demo/0.0.1',
            protocol: 'HTTP/1.1',
            sourceIp: '68.192.58.143',
            userAgent:
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36 Edg/88.0.705.68',
          },
          requestId: 'bH3sggjcCYcEPxg=',
          routeKey: 'ANY /nextjs-demo/0.0.1',
          stage: '$default',
          time: '22/Feb/2021:01:18:07 +0000',
          timeEpoch: 1613956687917,
        },
        isBase64Encoded: false,
      },
      {
        awsRequestId: '123',
      } as lambda.Context,
    );

    expect(response.statusCode).toBeDefined();
    expect(response.statusCode).toBe(200);
  });

  // How to test without the imageLambda?
  it.skip('/nextjs-demo/0.0.1/_next/image that hits imageLambda', async () => {
    const response = await handler(
      {
        version: '2.0',
        routeKey: 'ANY /nextjs-demo/0.0.1/{proxy+}',
        rawPath: '/nextjs-demo/0.0.1/_next/image',
        rawQueryString: 'url=%2Fimages%2Fprofile.jpg&w=384&q=75',
        headers: {
          accept: 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en-US,en;q=0.9',
          'content-length': '0',
          host: 'apps.pwrdrvr.com',
          referer: 'https://apps.pwrdrvr.com/nextjs-demo/0.0.1',
          'sec-fetch-dest': 'image',
          'sec-fetch-mode': 'no-cors',
          'sec-fetch-site': 'same-origin',
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36 Edg/88.0.705.68',
          via: '2.0 3b1807627d3f1dc0cdeb157fc313627b.cloudfront.net (CloudFront)',
          'x-amz-cf-id': 'CmgabPbMDH0IVfJeGj6LcD9CbTj8hUBuz8UZb4m0IKDoV1Z7Fp27gA==',
          'x-amzn-trace-id': 'Root=1-60330d03-3380e966609d55001e48a790',
          'x-forwarded-for': '68.192.58.143, 52.46.46.178',
          'x-forwarded-port': '443',
          'x-forwarded-proto': 'https',
        },
        queryStringParameters: {
          q: '75',
          url: '/images/profile.jpg',
          w: '384',
        },
        requestContext: {
          accountId: '239161478713',
          apiId: '4jssqkktsg',
          domainName: 'apps.pwrdrvr.com',
          domainPrefix: 'apps',
          http: {
            method: 'GET',
            path: '/nextjs-demo/0.0.1/_next/image',
            protocol: 'HTTP/1.1',
            sourceIp: '68.192.58.143',
            userAgent:
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36 Edg/88.0.705.68',
          },
          requestId: 'bH74mhWUiYcEPPw=',
          routeKey: 'ANY /nextjs-demo/0.0.1/{proxy+}',
          stage: '$default',
          time: '22/Feb/2021:01:46:43 +0000',
          timeEpoch: 1613958403765,
        },
        pathParameters: {
          proxy: '_next/image',
        },
        isBase64Encoded: false,
      },
      {
        awsRequestId: '123',
      } as lambda.Context,
    );

    expect(response.statusCode).toBeDefined();
    expect(response.statusCode).toBe(200);
  });
});
