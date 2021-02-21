import * as lambda from 'aws-lambda';

export function cfResponseToapigwyResponse(
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

  console.log(`default - sending munged response to client: ${JSON.stringify(response)}`);

  return response;
}
