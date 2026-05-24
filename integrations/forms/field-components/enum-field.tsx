import type { ControllerRenderProps } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { FieldMeta } from "../use-form";

type EnumFieldProps = {
  field: ControllerRenderProps;
  meta: FieldMeta | undefined;
  disabled: boolean | undefined;
  entries: Record<string, string> | undefined;
};

function EnumField({ field, meta, disabled, entries }: EnumFieldProps) {
  const options = entries ? Object.entries(entries) : [];

  return (
    <Select
      disabled={disabled}
      onValueChange={field.onChange}
      value={field.value}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={meta?.placeholder ?? "Select..."} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { EnumField };
