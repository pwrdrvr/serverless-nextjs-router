import type * as lambda from 'aws-lambda';
import { LambdaLog, LogMessage } from 'lambda-log';
import * as config from './config.json';
import { cfResponseToapigwyResponse } from './lib/cfToApigwy';
import { apigwyEventTocfRequestEvent } from './lib/apigwyToCF';
import { binaryMimeTypes, fetchFromS3 } from './lib/s3fetch';

const localTesting = process.env.DEBUG ? true : false;

let log: LambdaLog;

export async function handler(
  event: lambda.APIGatewayProxyEventV2,
  context: lambda.Context,
): Promise<lambda.APIGatewayProxyStructuredResultV2> {
  // 2021-03-05 - Items in CF Request that are referenced
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
  // 2021-03-06 - Items in CF Response that are referenced
  // response.headers
  // response.status
  // response.statusDescription
  // response.body
  // response.headers

  // Change the logger on each request
  log = new LambdaLog({
    dev: localTesting,
    //debug: localTesting,
    meta: { source: 'router', awsRequestId: context.awsRequestId, rawPath: event.rawPath },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dynamicMeta: (_message: LogMessage) => {
      return {
        timestamp: new Date().toISOString(),
      };
    },
  });

  log.debug('got event', { event });

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
      log.options.meta = { ...log.options.meta, route: 'static' };

      // These should proxy to s3
      // In fact... these should probably never get here
      // they should instead be routed to s3 directly by CloudFront
      log.error('static route - unexpected request to /_next/static/, /static/ route');

      // Fall through to S3
      const cfEvent = apigwyEventTocfRequestEvent('origin-request', event, config);
      const s3Response = await fetchFromS3(cfEvent.Records[0].cf.request);

      decodeResponse(s3Response);

      //log.info('static - got response from s3 handler', { s3Response });

      // Translate the CF Response to API Gateway response
      return cfResponseToapigwyResponse(s3Response);
    } else if (event.rawPath.indexOf('/api/') !== -1) {
      log.options.meta = { ...log.options.meta, route: 'api' };
      log.info('api route');

      // Convert API Gateway Request to Origin Request
      const cfEvent = apigwyEventTocfRequestEvent('origin-request', event, config);
      log.debug('cfEvent', { cfEvent });
      const apiImport = './api-lambda';
      const apiHandler = await import(apiImport);
      log.debug('handler imported');
      const cfRequestResponse = await apiHandler.handler(cfEvent as lambda.CloudFrontRequestEvent);
      log.info('got response');

      // API Gateway expects specific binary mime types to be base64 encoded
      // API Gateway expects everything else to not be encoded
      decodeResponse(cfRequestResponse);

      // Translate the CF Response to API Gateway response
      const response = cfResponseToapigwyResponse(cfRequestResponse);
      return response;
    } else if (event.rawPath.indexOf('/_next/image') !== -1) {
      log.options.meta = { ...log.options.meta, route: 'image' };
      log.info('image route');

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
      // 2021-03-06 - Image optimizer does not currently save back to s3,
      // so we should never get a request that should fall through to the origin.
      // TODO: ensure that optimized images are marked as cacheable at the edge.
      // TODO: save optimized images to a cache directory on s3.
      if (cfRequestResponse.status === undefined) {
        // The result is a response that we're supposed to send without calling the origin
        log.error('image handler did not return a response');
        throw new Error('router - no response from image handler');
      }

      // Translate the CF Response to API Gateway response
      return cfResponseToapigwyResponse(cfRequestResponse);
    } else {
      log.options.meta = { ...log.options.meta, route: 'default' };
      log.info('default route');

      // [root]/_next/data/* and everything else goes to default

      // Convert API Gateway Request to Origin Request
      const cfEvent = apigwyEventTocfRequestEvent('origin-request', event, config);

      // Call the request handler that modifies the request?
      const defaultImport = './default-lambda';
      const defaultHandler = (await import(defaultImport)).handler;
      const cfRequestResult = await defaultHandler(cfEvent as lambda.CloudFrontRequestEvent);
      if ((cfRequestResult as lambda.CloudFrontResultResponse).status !== undefined) {
        log.info('returning response after OriginRequest handler');
        // The result is a response that we're supposed to send without calling the origin
        const cfRequestResponse = cfRequestResult as lambda.CloudFrontResultResponse;
        return cfResponseToapigwyResponse(cfRequestResponse);
      }

      log.debug('got response from request handler', { cfRequestResult });

      log.info('falling through to s3');

      // No response was generated; call the s3 origin then call the response handler
      const cfRequestForOrigin = (cfRequestResult as unknown) as lambda.CloudFrontRequest;

      // Fall through to S3
      const s3Response = await fetchFromS3(cfRequestForOrigin);

      log.debug('got response from s3', { s3Response });

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

      log.debug('got response from response handler', { cfResponse });

      // Translate the CF Response to API Gateway response
      return cfResponseToapigwyResponse(cfResponse);
    }
  } catch (error) {
    try {
      log.error(error);
      const cfResponse = {
        status: '599',
        statusDescription: 'borked',
        body: error.message,
        bodyEncoding: 'text',
      } as lambda.CloudFrontResultResponse;
      return cfResponseToapigwyResponse(cfResponse);
    } catch (error) {
      log.error('caught exception responding to exception');
      log.error(error);
      const cfResponse = {
        status: '599',
        body: 'router - caught exception responding to exception',
        bodyEncoding: 'text',
      } as lambda.CloudFrontResultResponse;
      return cfResponseToapigwyResponse(cfResponse);
    }
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
