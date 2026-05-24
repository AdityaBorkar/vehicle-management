import type { z } from "zod";

export type FieldMeta = {
  label?: string;
  placeholder?: string;
  description?: string;
  component?: "textarea" | "password" | "combobox" | "checkbox";
};

export type FieldKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "array"
  | "optional"
  | "unknown";

export type FieldDef = {
  kind: FieldKind;
  meta: FieldMeta | undefined;
  isOptional: boolean;
  enumEntries?: Record<string, string>;
  arrayElement?: FieldMap;
  innerKind?: FieldKind;
  innerMeta?: FieldMeta | undefined;
  checks?: string[];
};

export type FieldMap = Record<string, FieldDef>;

export function getKind(schema: any): FieldKind {
  const type: string = schema._zod?.def?.type ?? "";
  if (type === "string") return "string";
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "enum") return "enum";
  if (type === "array") return "array";
  if (type === "optional") return "optional";
  return "unknown";
}

export function getMeta(schema: any): FieldMeta | undefined {
  if (typeof schema.meta === "function") {
    const result = schema.meta();
    if (result && typeof result === "object") return result;
  }
  return undefined;
}

export function getChecks(schema: any): string[] {
  const def = schema._zod?.def;
  if (!def?.checks) return [];
  return def.checks
    .map((c: any) => c.format ?? c._zod?.def?.type ?? c.type)
    .filter(Boolean);
}

export function buildFieldDef(schema: any): FieldDef {
  const kind = getKind(schema);
  const meta = getMeta(schema);

  if (kind === "optional") {
    const innerSchema = schema._zod?.def?.innerType;
    const innerKind = innerSchema ? getKind(innerSchema) : "unknown";
    const innerMeta = innerSchema ? getMeta(innerSchema) : undefined;
    const checks = innerSchema ? getChecks(innerSchema) : [];
    return {
      checks,
      innerKind,
      innerMeta,
      isOptional: true,
      kind,
      meta: meta ?? innerMeta,
      ...(innerKind === "enum" && innerSchema
        ? { enumEntries: innerSchema._zod?.def?.entries }
        : {}),
      ...(innerKind === "array" && innerSchema
        ? { arrayElement: buildFieldMap(innerSchema._zod?.def?.element) }
        : {}),
    };
  }

  if (kind === "array") {
    const elementSchema = schema._zod?.def?.element;
    return {
      arrayElement: elementSchema ? buildFieldMap(elementSchema) : undefined,
      isOptional: false,
      kind,
      meta,
    };
  }

  return {
    checks: getChecks(schema),
    isOptional: false,
    kind,
    meta,
    ...(kind === "enum" ? { enumEntries: schema._zod?.def?.entries } : {}),
  };
}

export function buildFieldMap(schema: any): FieldMap {
  if (!schema?.shape) return {};
  const map: FieldMap = {};
  for (const [key, fieldSchema] of Object.entries(schema.shape)) {
    map[key] = buildFieldDef(fieldSchema);
  }
  return map;
}

export function deriveDefault(fieldDef: FieldDef): any {
  if (fieldDef.isOptional) return undefined;
  if (fieldDef.kind === "string") return "";
  if (fieldDef.kind === "number") return 0;
  if (fieldDef.kind === "boolean") return false;
  if (fieldDef.kind === "enum" && fieldDef.enumEntries) {
    return Object.values(fieldDef.enumEntries)[0];
  }
  if (fieldDef.kind === "array") return [];
  return undefined;
}

export function buildDefaults(
  schema: z.ZodObject<any>,
  overrides?: Record<string, any>,
): Record<string, any> {
  const fieldMap = buildFieldMap(schema);
  const defaults: Record<string, any> = {};
  for (const [key, def] of Object.entries(fieldMap)) {
    defaults[key] = deriveDefault(def);
  }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      defaults[key] = value;
    }
  }
  return defaults;
}
