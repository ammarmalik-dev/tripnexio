import { z } from "zod";

/**
 * A PATCH-style "every field optional" version of a create schema that does
 * NOT apply the create schema's `.default()` values to fields the caller left
 * out.
 *
 * Why not `schema.partial()`: in zod 4, `.partial()` keeps each field's
 * `.default(...)`, so a body like `{ active: false }` parses to
 * `{ active: false, otbRequired: false, displayOrder: 0, ... }` — every
 * omitted defaulted field is silently reset on update. This unwraps each
 * default before making the field optional, so only keys actually present in
 * the request body appear in the parsed data.
 */
export function partialUpdateSchema<S extends z.ZodObject>(schema: S): z.ZodType<Partial<z.output<S>>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const unwrapped = field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : (field as z.ZodType);
    shape[key] = unwrapped.optional();
  }
  return z.object(shape) as unknown as z.ZodType<Partial<z.output<S>>>;
}
