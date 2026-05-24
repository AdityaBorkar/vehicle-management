import type { ControllerRenderProps } from "react-hook-form";
import { Controller, useFormContext as useRhfContext } from "react-hook-form";

import { Label } from "@/components/ui/label";

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
import type { FieldDef, FieldMeta } from "./use-form";

type FieldConfig<T extends ComboboxOption> =
  | ComboboxConfig<T>
  | FieldArrayConfig;

export type { FieldConfig };

type FieldProps<T extends ComboboxOption> = {
  name: string;
  disabled?: boolean;
  config?: FieldConfig<T>;
  overrides?: (props: {
    field: ControllerRenderProps;
    config: FieldConfig<T> | undefined;
    error?: string;
    disabled?: boolean;
  }) => React.ReactNode;
};

function resolveFieldDef(fieldDef: FieldDef): {
  kind: string;
  meta: FieldMeta | undefined;
  isOptional: boolean;
  enumEntries?: Record<string, string>;
  arrayElement?: Record<string, any>;
  checks?: string[];
} {
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

function Field<T extends ComboboxOption>({
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
            <div className="space-y-2">
              <Label>{label}</Label>
              {overrides({ config, disabled, error, field })}
              {error && <p className="text-destructive text-xs">{error}</p>}
              {meta?.description && !error && (
                <p className="text-muted-foreground text-xs">
                  {meta.description}
                </p>
              )}
            </div>
          );
        }

        if (resolved.kind === "array") {
          return (
            <div className="space-y-2">
              <Label>{label}</Label>
              <FieldArray
                config={config as FieldArrayConfig | undefined}
                control={control}
                disabled={disabled}
                elementFields={resolved.arrayElement}
                meta={meta}
                name={name}
              />
              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>
          );
        }

        return (
          <div className="space-y-2">
            <Label>{label}</Label>
            {renderField(resolved, field, meta, disabled, config)}
            {error && <p className="text-destructive text-xs">{error}</p>}
            {meta?.description && !error && (
              <p className="text-muted-foreground text-xs">
                {meta.description}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}

function renderField<T>(
  resolved: ReturnType<typeof resolveFieldDef>,
  field: any,
  meta: FieldMeta | undefined,
  disabled: boolean | undefined,
  config: FieldConfig<T> | undefined,
): React.ReactNode {
  if (meta?.component === "combobox") {
    return (
      <ComboboxField
        config={config as ComboboxConfig<any> | undefined}
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
          checks={resolved.checks}
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

export type { FieldProps };
export { Field };
