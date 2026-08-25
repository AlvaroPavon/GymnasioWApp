import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

export type ValidationSchemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.params) (req as any).params = schemas.params.parse(req.params);
    if (schemas.query) (req as any).query = schemas.query.parse(req.query);
    next();
  };
}
