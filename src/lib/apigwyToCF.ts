import type * as lambda from 'aws-lambda';

export function apigwyEventTocfRequestEvent(
  cfEventType: string,
  event: lambda.APIGatewayProxyEventV2,
  config: any,
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
