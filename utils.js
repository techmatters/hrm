const asyncHandler = fn => (req, res, next) => fn(req, res, next).catch(next);

const unauthorized = res => {
  const authorizationFailed = { error: 'Authorization failed' };
  console.log(`[authorizationMiddleware]: ${JSON.stringify(authorizationFailed)}`);
  res.status(401).json(authorizationFailed);
  return authorizationFailed;
};

module.exports = { asyncHandler, unauthorized };
