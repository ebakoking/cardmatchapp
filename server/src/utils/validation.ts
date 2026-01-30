import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: result.error.issues.map((i) => i.message).join(', '),
        },
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: result.error.issues.map((i) => i.message).join(', '),
        },
      });
    }
    req.query = result.data;
    next();
  };
}

export const schemas = {
  authRequestOtp: z.object({
    phoneNumber: z.string().min(8).max(20),
  }),
  authVerifyOtp: z.object({
    phoneNumber: z.string().min(8).max(20),
    code: z.string().length(6),
  }),
};

