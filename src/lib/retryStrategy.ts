//
// BEGIN: https://www.gitmemory.com/issue/aws/aws-sdk-js-v3/1196/636589545
//
import { StandardRetryStrategy, defaultRetryDecider } from '@aws-sdk/middleware-retry';
import { SdkError } from '@aws-sdk/smithy-client';

const retryDecider = (err: SdkError & { code?: string }) => {
  if (
    'code' in err &&
    (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ETIMEDOUT')
  ) {
    return true;
  } else {
    return defaultRetryDecider(err);
  }
};
// eslint-disable-next-line @typescript-eslint/require-await
export const retryStrategy = new StandardRetryStrategy(async () => 3, {
  retryDecider,
});

export const defaultClientConfig = {
  maxRetries: 3,
  retryStrategy,
};
//
// END: https://www.gitmemory.com/issue/aws/aws-sdk-js-v3/1196/636589545
//
