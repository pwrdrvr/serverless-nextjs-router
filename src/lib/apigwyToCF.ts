import * as lambda from 'aws-lambda';
import * as config from '../config.json';

export function apigwyEventTocfRequestEvent(
  cfEventType: string,
  event: lambda.APIGatewayProxyEventV2,
): lambda.CloudFrontEvent | lambda.CloudFrontRequestEvent {
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

  // TODO: Set clientIp
  //cfRequest.clientIp
  // Copy in body
  if (event.body !== undefined) {
    // TODO: Check what the encoding actually is
    cfRequest.body = {
      action: 'read-only',
      data: event.body,
      encoding: 'text',
      inputTruncated: false,
    };
  }

  // Fake the Origin object
  if (cfRequest.origin !== undefined) {
    cfRequest.origin.s3 = {
      customHeaders: {
        cat: [{ key: 'cat', value: 'dog' }],
      },
      domainName: config.s3.domainName,
      region: config.s3.region,
      path: '',
      // CF uses OAI to access S3 from Lambda @ Edge
      // But from Lambda we can just have IAM privs to get/put
      authMethod: 'none',
    };
  }

  return cfEvent;
}
