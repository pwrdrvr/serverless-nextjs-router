import * as lambda from 'aws-lambda';
import * as config from './config.json';
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

  console.log(`got event: ${JSON.stringify(event)}`);

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
  try {
    if (
      event.rawPath.indexOf('/_next/static/') !== -1 ||
      event.rawPath.indexOf('/static/') !== -1
    ) {
      // These should proxy to s3
      // In fact... these should probably never get here
      // they should instead be routed to s3 directly by CloudFront

      // Fall through to S3
      const cfEvent = apigwyEventTocfRequestEvent('origin-request', event, config);
      const s3Response = await fetchFromS3(cfEvent.Records[0].cf.request);

      decodeResponse(s3Response);

      //console.log(`static - got response from s3 handler: ${JSON.stringify(s3Response)}`);

      // Translate the CF Response to API Gateway response
      return cfResponseToapigwyResponse(s3Response);
    } else if (event.rawPath.indexOf('/api/') !== -1) {
      // console.log('api-route');
      // Convert API Gateway Request to Origin Request
      const cfEvent = apigwyEventTocfRequestEvent('origin-request', event, config);
      // console.log(`api-route - cfEvent: ${JSON.stringify(cfEvent)}`);
      const apiImport = './api-lambda';
      const apiHandler = await import(apiImport);
      // console.log(`api-route - handler imported`);
      const cfRequestResponse = await apiHandler.handler(cfEvent as lambda.CloudFrontRequestEvent);
      // console.log(`api-route - cfRequestResponse: ${JSON.stringify(cfRequestResponse)}`);

      // API Gateway expects specific binary mime types to be base64 encoded
      // API Gateway expects everything else to not be encoded
      decodeResponse(cfRequestResponse);
      console.log(
        `api-route - decodeResponse(cfRequestResponse): ${JSON.stringify(cfRequestResponse)}`,
      );

      // Translate the CF Response to API Gateway response
      const response = cfResponseToapigwyResponse(cfRequestResponse);
      console.log(`api-route - response: ${JSON.stringify(response)}`);
      return response;
    } else if (event.rawPath.indexOf('/_next/image') !== -1) {
      // return {
      //   statusCode: 500,
      //   body: '/_next/static/ or /static/ request received when not expected',
      // };

      // Convert API Gateway Request to Origin Request
      const cfEvent = apigwyEventTocfRequestEvent('origin-request', event, config);
      const imageImport = './image-lambda';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const imageHandler = await import(imageImport);
      //const imageHandler = (await import(imageImport)).handler;
      const cfRequestResponse = await imageHandler.handler(
        cfEvent as lambda.CloudFrontRequestEvent,
      );

      // TODO: Do we ever need to proxy to s3 or does imageHandler always do it?
      if (cfRequestResponse.status === undefined) {
        // The result is a response that we're supposed to send without calling the origin
        //console.log('router - image handler did not return a response');
        throw new Error('router - no response from image handler');
      }

      // Translate the CF Response to API Gateway response
      return cfResponseToapigwyResponse(cfRequestResponse);
    } else {
      // [root]/_next/data/* and everything else goes to default

      // Convert API Gateway Request to Origin Request
      const cfEvent = apigwyEventTocfRequestEvent('origin-request', event, config);

      // Call the request handler that modifies the request?
      const defaultImport = './default-lambda';
      const defaultHandler = (await import(defaultImport)).handler;
      const cfRequestResult = await defaultHandler(cfEvent as lambda.CloudFrontRequestEvent);
      if ((cfRequestResult as lambda.CloudFrontResultResponse).status !== undefined) {
        // The result is a response that we're supposed to send without calling the origin
        const cfRequestResponse = cfRequestResult as lambda.CloudFrontResultResponse;
        return cfResponseToapigwyResponse(cfRequestResponse);
      }

      //console.log(
      //   `default - got response from request handler: ${JSON.stringify(cfRequestResult)}`,
      // );

      // No response was generated; call the s3 origin then call the response handler
      const cfRequestForOrigin = (cfRequestResult as unknown) as lambda.CloudFrontRequest;

      // Fall through to S3
      const s3Response = await fetchFromS3(cfRequestForOrigin);

      //console.log(`default - got response from s3: ${JSON.stringify(s3Response)}`);

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

      decodeResponse(cfResponse);

      //console.log(`default - got response from response handler: ${JSON.stringify(cfResponse)}`);

      // Translate the CF Response to API Gateway response
      return cfResponseToapigwyResponse(cfResponse);
    }
  } catch (error) {
    console.log(`caught exception: ${JSON.stringify(error)}`);
    const cfResponse = {
      status: '500',
      statusDescription: 'borked',
      body: JSON.stringify(error),
      bodyEncoding: 'text',
    } as lambda.CloudFrontResultResponse;
    return cfResponseToapigwyResponse(cfResponse);
  }
}

function decodeResponse(cfRequestResponse: lambda.CloudFrontResultResponse) {
  if (
    cfRequestResponse.headers !== undefined &&
    cfRequestResponse.headers['content-type'] !== undefined &&
    cfRequestResponse.body !== undefined &&
    cfRequestResponse.bodyEncoding === 'base64'
  ) {
    const types = cfRequestResponse.headers['content-type'][0].value.split(';');

    if (!binaryMimeTypes.has(types[0])) {
      const decodedBody = Buffer.from(cfRequestResponse.body as string, 'base64').toString('utf8');
      cfRequestResponse.body = decodedBody;
      cfRequestResponse.bodyEncoding = 'text';
    }
  }
}
