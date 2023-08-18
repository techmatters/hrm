export type NewErrorResultParams = {
  message: string;
  body?: any;
  statusCode?: number;
};

export const newErrorResult = ({
  body,
  message,
  statusCode = 500,
}: NewErrorResultParams) => ({
  status: 'error',
  body,
  message,
  statusCode,
});

export type ErrorResult = ReturnType<typeof newErrorResult>;

export type NewSuccessResultParms = {
  result: any;
  statusCode?: number;
};

export const newSuccessResult = ({
  result,
  statusCode = 200,
}: NewSuccessResultParms) => ({
  status: 'success',
  result,
  statusCode,
});

export type SuccessResult = ReturnType<typeof newSuccessResult>;

export type Result = SuccessResult | ErrorResult;

export const isErrorResult = (result: Result): result is ErrorResult =>
  result.status === 'error';
