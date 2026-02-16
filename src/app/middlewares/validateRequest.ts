import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodEffects } from "zod";

const validateRequest =
  (schema: AnyZodObject | ZodEffects<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if schema expects body/params/query structure
      const schemaShape = '_def' in schema && 'shape' in schema._def 
        ? schema._def.shape() 
        : null;
      
      const hasRequestStructure = schemaShape && 
        (schemaShape.body || schemaShape.params || schemaShape.query);

      // If schema has body/params/query properties, pass full request structure
      // Otherwise, pass body directly for backward compatibility
      const dataToValidate = hasRequestStructure
        ? {
            body: req.body,
            params: req.params,
            query: req.query,
          }
        : req.body;

      await schema.parseAsync(dataToValidate);
      return next();
    } catch (err) {
      next(err);
    }
  };

export default validateRequest;
