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
	enumEntries?: Record<string, string> | undefined;
	arrayElement?: FieldMap | undefined;
	innerKind?: FieldKind | undefined;
	checks?: string[] | undefined;
};

export type FieldMap = Record<string, FieldDef>;

// biome-ignore lint/suspicious/noExplicitAny: Zod internal _zod property is untyped
export function getKind(schema: any): FieldKind {
	const type: string = schema._zod?.def?.type ?? "";
	switch (type) {
		case "string":
		case "number":
		case "boolean":
		case "enum":
		case "array":
		case "optional":
			return type;
		default:
			return "unknown";
	}
}

// biome-ignore lint/suspicious/noExplicitAny: Zod internal .meta() return is untyped
export function getMeta(schema: any): FieldMeta | undefined {
	if (typeof schema.meta === "function") {
		const result = schema.meta();
		if (result && typeof result === "object") return result;
	}
	return undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: Zod internal _zod property is untyped
export function getChecks(schema: any): string[] {
	const def = schema._zod?.def;
	if (!def?.checks) return [];
	return (
		def.checks
			// biome-ignore lint/suspicious/noExplicitAny: Zod check objects are untyped
			.map((c: any) => c.format ?? c._zod?.def?.type ?? c.type)
			.filter(Boolean)
	);
}

// biome-ignore lint/suspicious/noExplicitAny: Zod internal _zod property is untyped
export function buildFieldDef(schema: any): FieldDef {
	const kind = getKind(schema);
	const meta = getMeta(schema);

	if (kind === "optional") {
		const innerSchema = schema._zod?.def?.innerType;
		const innerKind: FieldKind = innerSchema ? getKind(innerSchema) : "unknown";
		const innerMeta = innerSchema ? getMeta(innerSchema) : undefined;
		const def: FieldDef = {
			checks: innerSchema ? getChecks(innerSchema) : [],
			innerKind,
			isOptional: true,
			kind,
			meta: meta ?? innerMeta,
		};
		if (innerKind === "enum" && innerSchema) {
			def.enumEntries = innerSchema._zod?.def?.entries;
		}
		if (innerKind === "array" && innerSchema) {
			def.arrayElement = buildFieldMap(innerSchema._zod?.def?.element);
		}
		return def;
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

	const def: FieldDef = {
		checks: getChecks(schema),
		isOptional: false,
		kind,
		meta,
	};
	if (kind === "enum") {
		def.enumEntries = schema._zod?.def?.entries;
	}
	return def;
}

// biome-ignore lint/suspicious/noExplicitAny: Zod internal .shape property is untyped
export function buildFieldMap(schema: any): FieldMap {
	if (!schema?.shape) return {};
	const map: FieldMap = {};
	for (const [key, fieldSchema] of Object.entries(schema.shape)) {
		map[key] = buildFieldDef(fieldSchema);
	}
	return map;
}

export function deriveDefault(fieldDef: FieldDef): unknown {
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
	fieldMap: FieldMap,
	overrides?: Record<string, unknown>,
): Record<string, unknown> {
	const defaults: Record<string, unknown> = {};
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
