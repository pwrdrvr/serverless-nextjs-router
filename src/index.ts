import * as lambda from 'aws-lambda';
import { cfResponseToapigwyResponse } from './lib/cfToApigwy';
import { apigwyEventTocfRequestEvent } from './lib/apigwyToCF';
import { binaryMimeTypes, fetchFromS3 } from './lib/s3fetch';

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

    console.log(`default - got response from s3: ${JSON.stringify(s3Response)}`);

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

    console.log(`default - got response from response handler: ${JSON.stringify(cfResponse)}`);

    // Translate the CF Response to API Gateway response
    return cfResponseToapigwyResponse(cfResponse);
  }
}
