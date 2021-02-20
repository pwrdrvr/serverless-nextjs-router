import * as lambda from 'aws-lambda';

import { handler as apiHandler } from './api-lambda';
import { handler as defaultHandler } from './default-lambda';
import { handler as imageHandler } from './image-lambda';

import * as config from './config.json';

const binaryMimeTypes = new Set<string>([
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

function apigwyEventTocfEvent(
  cfEventType: string,
  event: lambda.APIGatewayProxyEventV2,
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

  // TODO: Fake the Origin object
  if (cfRequest.origin !== undefined) {
    cfRequest.origin.s3 = {
      customHeaders: {
        cat: [{ key: 'cat', value: 'dog' }],
      },
      domainName: config.s3.domainName,
      region: config.s3.region,
      path: '',
      authMethod: 'origin-access-identity',
    };
  }

  return cfEvent;
}

function cfResponseToapigwyResponse(
  cfResponse: lambda.CloudFrontResultResponse,
): lambda.APIGatewayProxyStructuredResultV2 {
  const response = {
    statusCode: parseInt(cfResponse.status, 10),
    body: cfResponse.body,
    headers: {},
  } as lambda.APIGatewayProxyStructuredResultV2;

  // Copy and translate the headers
  for (const headerKey in cfResponse.headers) {
    const header = cfResponse.headers[headerKey][0];
    if (header.key !== undefined) {
      // For some reason headers is declared to possibly be undefined
      // even though it's statically set above...
      // @ts-expect-error
      response.headers[header.key] = header.value;
    }
  }

  return response;
}

export async function handler(
  event: lambda.APIGatewayProxyEventV2,
  _context: lambda.Context,
): Promise<lambda.APIGatewayProxyStructuredResultV2> {
  // TODO: Find the items in CF Request that are referenced
  // request.headers
  // request.querystring
  // request.uri
  // request.body - default only
  // request.origin - default/image - default will pull from s3 in some cases
  //                - default - server side static are rendered and pushed to s3
  //                - image - images are pulled, rendered, and pushed to s3
  // image
  // - needs request.origin.s3.domainName and s3.region
  //   domainName = bucketName + `.s3.${region}.amazonaws.com`
  //
  // TODO: Find items in CF Response that are referenced
  // response.headers
  // response.status
  // response.statusDescription
  // response.body
  // response.headers

  //
  // Call corresponding handler based on path
  //
  // [root]/_next/static/* -> s3 direct
  // [root]/static/* -> s3 direct
  // [root]/api/* -> apiHandler
  // [root]/_next/image* -> imageHandler
  // -> Also falls through actually calling s3?
  // [root]/_next/data/* -> default handler
  // [default] -> default handler
  if (event.rawPath.indexOf('/_next/static/') !== -1 || event.rawPath.indexOf('/static/') !== -1) {
    // These should proxy to s3
    // In fact... these should probably never get here
    // they should instead be routed to s3 directly by CloudFront
    return {
      statusCode: 500,
      body: '/_next/static/ or /static/ request received when not expected',
    };
  } else if (event.rawPath.indexOf('/api/') !== -1) {
    // Convert API Gateway Request to Origin Request
    const cfEvent = apigwyEventTocfEvent('origin-request', event);
    const cfRequestResponse = await apiHandler(cfEvent);

    // API Gateway expects specific binary mime types to be base64 encoded
    // API Gateway expects everything else to not be encoded
    if (
      cfRequestResponse.headers !== undefined &&
      cfRequestResponse.headers['content-type'] !== undefined &&
      cfRequestResponse.body !== undefined
    ) {
      const types = cfRequestResponse.headers['content-type'][0].value.split(';');

      if (!binaryMimeTypes.has(types[0])) {
        const decodedBody = Buffer.from(cfRequestResponse.body as string, 'base64').toString(
          'utf8',
        );
        cfRequestResponse.body = decodedBody;
      }
    }

    // Translate the CF Response to API Gateway response
    return cfResponseToapigwyResponse(cfRequestResponse);
  } else if (event.rawPath.indexOf('/_next/image') !== -1) {
    // Convert API Gateway Request to Origin Request
    const cfEvent = apigwyEventTocfEvent('origin-request', event);
    const cfRequestResponse = await imageHandler(cfEvent);

    // TODO: Proxy to S3 to get the image

    // Translate the CF Response to API Gateway response
    return cfResponseToapigwyResponse(cfRequestResponse);
  } else {
    // [root]/_next/data/* and everything else goes to default

    // Convert API Gateway Request to Origin Request
    const cfEvent = apigwyEventTocfEvent('origin-request', event);

    // Call the request handler that modifies the request?
    const cfRequest = await defaultHandler(cfEvent);

    // TODO: Does this ever need to proxy to s3?

    // Call the response handler that writes the response?
    const cfResponse = await defaultHandler(cfEvent);

    // TODO: Translate the CF Response to API Gateway response
    return {
      statusCode: 501,
      body: `default handler is not yet implemented: ${JSON.stringify(cfResponse)}`,
    } as lambda.APIGatewayProxyStructuredResultV2;
  }
}
