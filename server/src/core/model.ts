export type ModelValue = string | number | boolean | Date | null;

export interface ModelDefinition<TRecord extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  table: string;
  primaryKey: keyof TRecord & string;
  fields: readonly (keyof TRecord & string)[];
  requiredFields: readonly (keyof TRecord & string)[];
  schoolScoped: boolean;
  hasCreatedAt: boolean;
  hasUpdatedAt: boolean;
  softDeleteField?: keyof TRecord & string;
}

export function defineModel<TRecord extends Record<string, unknown>>(
  definition: ModelDefinition<TRecord>,
): ModelDefinition<TRecord> {
  return Object.freeze(definition);
}
