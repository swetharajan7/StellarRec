import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { APIError, ErrorCodes } from '@stellarrec/types';

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
    }));

    throw new APIError(
      ErrorCodes.INVALID_INPUT,
      'Validation failed',
      400,
      errorMessages
    );
  }

  next();
};