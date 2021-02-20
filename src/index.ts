import * as lambda from 'aws-lambda';

import { handler as apiHandler } from './api-lambda';
import { handler as defaultHandler } from './default-lambda';
import { handler as imageHandler } from './image-lambda';

function apigwyRequestTocfRequest(
  event: lambda.APIGatewayProxyEventV2,
): lambda.CloudFrontRequestEvent {
  const apigwyRequest = {} as lambda.CloudFrontRequestEvent;

  // TODO: Copy in headers

  // TODO: Copy in URI

  // TODO: Copy in querystring

  // TODO: Copy in body

  // TODO: Fake the Origin object

  return apigwyRequest;
}

export async function handler(
  event: lambda.APIGatewayProxyEventV2,
  context: lambda.Context,
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

  // Convert API Gateway Request to Origin Request
  const apigwyRequest = apigwyRequestTocfRequest(event);

  // TODO: Call corresponding handler based on path
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
    // they should instead be routed to s3 by the microapp CF
    return {
      statusCode: 500,
      body: '/_next/static/ or /static/ request received when not expected',
    };
  }

  // TODO: For DefaultHandler, call the response handler

  // TODO: Translate the CF Response to API Gateway response

  return {} as lambda.APIGatewayProxyStructuredResultV2;
}
