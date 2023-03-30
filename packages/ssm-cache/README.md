# SSM-CACHE package

## Overview

This package provides a simple cache for AWS SSM parameters. It can be used in one of two ways:

### 1. Preload the cache by using the `loadSsmCache`

This function will load all the parameters in the cache using `getParametersByPath. This is useful if you want to load all the parameters at the start of your application to reduce the number of calls to SSM and to reduce the latency of the first call for a specific parameter.

Example:

```typescript
import { getParameterFromCache, loadSsmCache } from '@sailplane/ssm-cache';

const ssmCacheConfigs = [
  {
    path: `/development/twilio/`,
    regex: /auth_token/,
  },
  {
    path: `/development/s3/`,
    regex: /docs_bucket_name/,
  },
];

const doSomething = async () => {
  await loadSsmCache(ssmCacheConfigs);
  const authToken = await getParameterFromCache('/development/twilio/AC12345678/auth_token');
  const docsBucketName = await getParameterFromCache('/development/s3/AC12345678/docs_bucket_name');
  console.log(authToken, docsBucketName);
};
```

In this example, the `loadSsmCache` function will load all the parameters that match the regex in the `ssmCacheConfigs` array underneath the `path` key.

Every time `loadSsmCache` is called, it will check to see if a global TTL has been reached. If it has, it will reload the cache. If it hasn't, it will not do any work.

### 2. Use the `getParameterFromCache` function to build and use the cache

This function will load the parameter from SSM if it is not in the cache. It will also check to see if the TTL for the parameter has been reached. If it has, it will reload the parameter from SSM. This is useful if you want to load parameters as they are needed at the tradeoff of a slightly higher latency for the first call for a specific parameter. This pattern is also useful if you don't know all the parameters that you will need at the start of your application.

Example:

```typescript
import { getParameterFromCache } from '@sailplane/ssm-cache';

const doSomething = async () => {
  const authToken = await getParameterFromCache('/development/twilio/AC12345678/auth_token');
  const docsBucketName = await getParameterFromCache('/development/s3/AC12345678/docs_bucket_name');
  console.log(authToken, docsBucketName);
};
```
