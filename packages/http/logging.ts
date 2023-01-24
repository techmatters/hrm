import morgan from 'morgan';

/**
 * Basic HTTP Logger that shows information about each request.
 * Example: 200 - GET /contacts HTTP/1.1 - time: 10 ms length: 95 - Agent: curl/7.58.0
 */
const httpLogger = morgan(
  ':status - :method :url HTTP/:http-version - time: :response-time ms - length: :res[content-length] - Agent: :user-agent',
);

export default httpLogger;
