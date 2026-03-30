import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodEffects } from "zod";

// Primitive Zod type names that indicate a regular field, not a request-wrapper
const ZOD_PRIMITIVES = [
  "ZodString",
  "ZodNumber",
  "ZodBoolean",
  "ZodEnum",
  "ZodNativeEnum",
  "ZodLiteral",
  "ZodDate",
];

const validateRequest =
  (schema: AnyZodObject | ZodEffects<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if schema expects body/params/query structure
      const schemaShape =
        "_def" in schema && "shape" in schema._def ? schema._def.shape() : null;

      // A schema field named "body" is a request-wrapper key ONLY when its
      // type is ZodObject (nested validation), not a primitive like ZodString.
      // This prevents false-positives when a schema has a plain `body: string` field.
      const bodyField = schemaShape?.body;
      const bodyIsObjectWrapper =
        bodyField &&
        !ZOD_PRIMITIVES.includes(bodyField._def?.typeName as string);

      const hasRequestStructure =
        schemaShape &&
        (bodyIsObjectWrapper || schemaShape.params || schemaShape.query);

      // If schema has body/params/query properties, pass full request structure
      // Otherwise, pass body directly for backward compatibility
      const dataToValidate = hasRequestStructure
        ? {
            body: req.body,
            params: req.params,
            query: req.query,
          }
        : req.body;

      const parsedData = await schema.parseAsync(dataToValidate);

      if (hasRequestStructure) {
        if (parsedData?.body) {
          req.body = parsedData.body;
        }
        if (parsedData?.params) {
          req.params = parsedData.params;
        }
        if (parsedData?.query) {
          req.query = parsedData.query;
        }
      } else {
        req.body = parsedData;
      }

      return next();
    } catch (err) {
      next(err);
    }
  };

export default validateRequest;
