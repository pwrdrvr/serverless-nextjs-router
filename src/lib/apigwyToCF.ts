// eslint-disable-next-line import/no-unresolved
import type * as lambda from 'aws-lambda';
import { IConfig } from './config';

let s3BucketName: string;

export function apigwyEventTocfRequestEvent(
  cfEventType: string,
  event: lambda.APIGatewayProxyEventV2,
  config: IConfig,
): lambda.CloudFrontRequestEvent {
  const cfEvent = {
    Records: [{ cf: { config: { eventType: cfEventType }, request: { headers: {}, origin: {} } } }],
  } as lambda.CloudFrontRequestEvent;
  const cfRequest = cfEvent.Records[0].cf.request;

  // Copy in headers
  for (const headerKey in event.headers) {
    const headerValue = event.headers[headerKey] as string;
    cfRequest.headers[headerKey] = [{ key: headerKey, value: headerValue }];
  }

  // Copy in URI (which is really just the path)
  cfRequest.uri = event.rawPath;

  // Copy in querystring
  cfRequest.querystring = event.rawQueryString;

  // Copy in the method
  // @ts-ignore
  cfRequest.method = event.requestContext.http.method;

  // Set clientIp
  // @ts-ignore
  cfRequest.clientIp = event.requestContext.http.sourceIp;

  // Copy in body
  if (event.body !== undefined) {
    cfRequest.body = {
      action: 'read-only',
      data: event.body,
      encoding: event.isBase64Encoded ? 'base64' : 'text',
      inputTruncated: false,
    };
  }

  // The bucket name doesn't change, get it once
  if (s3BucketName !== undefined) {
    s3BucketName = process.env.S3BUCKETNAME as string;
  }

  // Fake the Origin object
  if (cfRequest.origin !== undefined) {
    cfRequest.origin.s3 = {
      customHeaders: {
        cat: [{ key: 'cat', value: 'dog' }],
      },
      domainName: config.s3BucketName,
      // We use AWS_REGION env var instead
      // region: 'dummy',
      region: config.region,
      path: '',
      // CF uses OAI to access S3 from Lambda @ Edge
      // But from Lambda we can just have IAM privs to get/put
      authMethod: 'none',
    };
  }

  return cfEvent;
}
