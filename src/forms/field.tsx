import type { ReactNode } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { Controller, useFormContext as useRhfContext } from "react-hook-form";

import { Label } from "#/components/ui/label";
import { useFormContext } from "./context";
import { BooleanField } from "./field-components/boolean-field";
import type {
	ComboboxConfig,
	ComboboxOption,
} from "./field-components/combobox-field";
import { ComboboxField } from "./field-components/combobox-field";
import { EnumField } from "./field-components/enum-field";
import type { FieldArrayConfig } from "./field-components/field-array";
import { FieldArray } from "./field-components/field-array";
import { NumberField } from "./field-components/number-field";
import { StringField } from "./field-components/string-field";
import type { FieldDef, FieldMap, FieldMeta } from "./use-form";

type FieldConfig<T extends ComboboxOption> =
	| ComboboxConfig<T>
	| FieldArrayConfig;

// biome-ignore lint/style/useComponentExportOnlyModules: type-only export co-located with component
export type { FieldConfig };

type FieldProps<T extends ComboboxOption = ComboboxOption> = {
	name: string;
	disabled?: boolean;
	config?: FieldConfig<T>;
	overrides?: (props: {
		field: ControllerRenderProps;
		config: FieldConfig<T> | undefined;
		error?: string | undefined;
		disabled?: boolean | undefined;
	}) => ReactNode;
};

type ResolvedFieldDef = {
	kind: string;
	meta: FieldMeta | undefined;
	isOptional: boolean;
	enumEntries: Record<string, string> | undefined;
	arrayElement: FieldMap | undefined;
	checks: string[] | undefined;
};

function resolveFieldDef(fieldDef: FieldDef): ResolvedFieldDef {
	if (fieldDef.kind === "optional") {
		return {
			arrayElement: fieldDef.arrayElement,
			checks: fieldDef.checks,
			enumEntries: fieldDef.enumEntries,
			isOptional: true,
			kind: fieldDef.innerKind ?? "unknown",
			meta: fieldDef.meta,
		};
	}
	return {
		arrayElement: fieldDef.arrayElement,
		checks: fieldDef.checks,
		enumEntries: fieldDef.enumEntries,
		isOptional: false,
		kind: fieldDef.kind,
		meta: fieldDef.meta,
	};
}

function FieldShell({
	label,
	error,
	description,
	children,
}: {
	label: string;
	error?: string | undefined;
	description?: string | undefined;
	children: ReactNode;
}): ReactNode {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			{children}
			{error && <p className="text-destructive text-xs">{error}</p>}
			{description && !error && (
				<p className="text-muted-foreground text-xs">{description}</p>
			)}
		</div>
	);
}

function Field<T extends ComboboxOption = ComboboxOption>({
	name,
	disabled,
	config,
	overrides,
}: FieldProps<T>) {
	const { fieldMap } = useFormContext();
	const { control } = useRhfContext();

	const fieldDef = fieldMap[name];
	if (!fieldDef) return null;

	const resolved = resolveFieldDef(fieldDef);
	const meta = resolved.meta;
	const label = meta?.label ?? name;

	return (
		<Controller
			name={name}
			render={({ field, fieldState }) => {
				const error = fieldState.error?.message;

				if (overrides) {
					return (
						<FieldShell
							description={meta?.description}
							error={error}
							label={label}
						>
							{overrides({ config, disabled, error, field })}
						</FieldShell>
					);
				}

				if (resolved.kind === "array") {
					return (
						<FieldShell error={error} label={label}>
							<FieldArray
								config={config as FieldArrayConfig | undefined}
								control={control}
								disabled={disabled}
								elementFields={resolved.arrayElement}
								meta={meta}
								name={name}
							/>
						</FieldShell>
					);
				}

				return (
					<FieldShell
						description={meta?.description}
						error={error}
						label={label}
					>
						{renderField(
							resolved,
							field,
							meta,
							disabled,
							config as FieldConfig<ComboboxOption> | undefined,
						)}
					</FieldShell>
				);
			}}
		/>
	);
}

function renderField(
	resolved: ResolvedFieldDef,
	field: ControllerRenderProps,
	meta: FieldMeta | undefined,
	disabled: boolean | undefined,
	config: FieldConfig<ComboboxOption> | undefined,
): ReactNode {
	if (meta?.component === "combobox") {
		return (
			<ComboboxField
				config={config as ComboboxConfig<ComboboxOption> | undefined}
				disabled={disabled}
				field={field}
				meta={meta}
			/>
		);
	}

	switch (resolved.kind) {
		case "string":
			return (
				<StringField
					checks={resolved.checks ?? []}
					disabled={disabled}
					field={field}
					meta={meta}
				/>
			);
		case "number":
			return <NumberField disabled={disabled} field={field} meta={meta} />;
		case "boolean":
			return (
				<BooleanField
					disabled={disabled}
					field={field}
					label={meta?.label ?? ""}
					meta={meta}
				/>
			);
		case "enum":
			return (
				<EnumField
					disabled={disabled}
					entries={resolved.enumEntries}
					field={field}
					meta={meta}
				/>
			);
		default:
			return null;
	}
}

// biome-ignore lint/style/useComponentExportOnlyModules: type-only export co-located with component
export type { FieldProps };
export { Field };
