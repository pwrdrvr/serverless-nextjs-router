import * as lambda from 'aws-lambda';
import type { Readable } from 'stream';

import * as config from './config.json';

import { retryStrategy } from './lib/retryStrategy';

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

async function fetchFromS3(
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
  const s3Key = request.uri;

  const { GetObjectCommand } = await import('@aws-sdk/client-s3/commands/GetObjectCommand');
  // S3 Body is stream per: https://github.com/aws/aws-sdk-js-v3/issues/1096
  const getStream = await import('get-stream');

  const s3Params = {
    Bucket: bucketName,
    Key: s3Key,
  };

  const { Body, CacheControl } = await s3.send(new GetObjectCommand(s3Params));
  const bodyString = await getStream.default(Body as Readable);

  return {
    status: '200',
    statusDescription: 'OK',
    headers: {
      ...response.headers,
      'content-type': [
        {
          key: 'Content-Type',
          value: 'text/html',
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
}

function apigwyEventTocfRequestEvent(
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
    const cfEvent = apigwyEventTocfRequestEvent('origin-request', event);
    const apiImport = './api-lambda';
    const apiHandler = (await import(apiImport)).handler;
    const cfRequestResponse = await apiHandler(cfEvent as lambda.CloudFrontRequestEvent);

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
    const cfEvent = apigwyEventTocfRequestEvent('origin-request', event);
    const imageImport = './image-lambda';
    const imageHandler = (await import(imageImport)).handler;
    const cfRequestResponse = await imageHandler(cfEvent as lambda.CloudFrontRequestEvent);

    // TODO: Do we ever need to proxy to s3 or does imageHandler always do it?

    // Translate the CF Response to API Gateway response
    return cfResponseToapigwyResponse(cfRequestResponse);
  } else {
    // [root]/_next/data/* and everything else goes to default

    // Convert API Gateway Request to Origin Request
    const cfEvent = apigwyEventTocfRequestEvent('origin-request', event);

    // Call the request handler that modifies the request?
    const defaultImport = './default-lambda';
    const defaultHandler = (await import(defaultImport)).handler;
    const cfRequestResult = await defaultHandler(cfEvent as lambda.CloudFrontRequestEvent);
    if ((cfRequestResult as lambda.CloudFrontResultResponse).status !== undefined) {
      // The result is a response that we're supposed to send without calling the origin
      const cfRequestResponse = cfRequestResult as lambda.CloudFrontResultResponse;
      return cfResponseToapigwyResponse(cfRequestResponse);
    }

    console.log(`default - got response from request handler: ${JSON.stringify(cfRequestResult)}`);

    // No response was generated; call the s3 origin then call the response handler
    const cfRequestForOrigin = (cfRequestResult as unknown) as lambda.CloudFrontRequest;

    // Fall through to S3
    const s3Response = await fetchFromS3(cfRequestForOrigin);

    // Change the event type to origin-response
    const cfOriginResponseEvent = cfEvent as lambda.CloudFrontResponseEvent;
    // @ts-expect-error
    cfOriginResponseEvent.Records[0].cf.config.eventType = 'origin-response';
    // Overwrite the request with the returned request
    // @ts-expect-error
    cfOriginResponseEvent.Records[0].cf.response = s3Response;

    const cfResponse = (await defaultHandler(
      cfOriginResponseEvent,
    )) as lambda.CloudFrontResultResponse;

    // Translate the CF Response to API Gateway response
    return cfResponseToapigwyResponse(cfResponse);
  }
}
