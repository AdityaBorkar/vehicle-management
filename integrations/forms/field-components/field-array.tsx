import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { FieldMap, FieldMeta } from "../use-form";

type FieldArrayConfig = {
  addLabel?: string;
  maxItems?: number;
  renderRow?: (props: {
    fields: Record<string, any>;
    index: number;
    remove: () => void;
  }) => React.ReactNode;
};

type FieldArrayProps = {
  meta: FieldMeta | undefined;
  disabled: boolean | undefined;
  elementFields: FieldMap | undefined;
  config: FieldArrayConfig | undefined;
  control: any;
  name: string;
};

function FieldArray({
  meta,
  disabled,
  elementFields,
  config,
  control,
  name,
}: FieldArrayProps) {
  const { register } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const addLabel = config?.addLabel ?? `Add ${meta?.label ?? "item"}`;
  const maxItems = config?.maxItems;

  function handleAdd() {
    if (disabled) return;
    if (maxItems && fields.length >= maxItems) return;
    const defaults: Record<string, any> = {};
    if (elementFields) {
      for (const [key, def] of Object.entries(elementFields)) {
        if (def.kind === "string") defaults[key] = "";
        else if (def.kind === "number") defaults[key] = 0;
        else if (def.kind === "boolean") defaults[key] = false;
      }
    }
    append(defaults);
  }

  if (config?.renderRow) {
    return (
      <div className="space-y-3">
        {fields.map((item, index) => (
          <div key={item.id}>
            {config?.renderRow?.({
              fields: item as Record<string, any>,
              index,
              remove: () => remove(index),
            })}
          </div>
        ))}
        <Button
          disabled={disabled}
          onClick={handleAdd}
          size="xs"
          type="button"
          variant="outline"
        >
          <IconPlus className="h-3 w-3" />
          {addLabel}
        </Button>
      </div>
    );
  }

  if (!elementFields) return null;

  const fieldEntries = Object.entries(elementFields);

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No {meta?.label?.toLowerCase() ?? "items"} added yet
        </p>
      )}
      {fields.map((item, index) => (
        <div className="flex items-start gap-2" key={item.id}>
          {fieldEntries.map(([key, def]) => (
            <div className="flex-1" key={key}>
              <Input
                disabled={disabled}
                placeholder={def.meta?.placeholder ?? key}
                type={def.kind === "number" ? "number" : "text"}
                {...register(`${name}.${index}.${key}`)}
              />
            </div>
          ))}
          <Button
            className="mt-0"
            disabled={disabled}
            onClick={() => remove(index)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <IconTrash className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <Button
        disabled={
          disabled || (maxItems !== undefined && fields.length >= maxItems)
        }
        onClick={handleAdd}
        size="xs"
        type="button"
        variant="outline"
      >
        <IconPlus className="h-3 w-3" />
        {addLabel}
      </Button>
    </div>
  );
}

export type { FieldArrayConfig };
export { FieldArray };
