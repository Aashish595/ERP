import { z } from "zod";
import type { ModelDefinition } from "./model.js";

export function createPayloadSchema<TRecord extends Record<string, unknown>>(model: ModelDefinition<TRecord>) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of model.fields) shape[field] = z.unknown().optional();
  return z.object(shape).strict().superRefine((payload, context) => {
    for (const field of model.requiredFields) {
      const value = payload[field];
      if (value === undefined || value === null || value === "") {
        context.addIssue({ code: "custom", path: [field], message: `${field} is required` });
      }
    }
  });
}

export function createUpdateSchema<TRecord extends Record<string, unknown>>(model: ModelDefinition<TRecord>) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of model.fields) shape[field] = z.unknown().optional();
  return z.object(shape).strict();
}
