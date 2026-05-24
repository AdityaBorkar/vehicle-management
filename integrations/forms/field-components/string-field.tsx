import type { ControllerRenderProps } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { FieldMeta } from "../use-form";

type StringFieldProps = {
  field: ControllerRenderProps;
  meta: FieldMeta | undefined;
  disabled: boolean | undefined;
  checks?: string[];
};

function StringField({ field, meta, disabled, checks }: StringFieldProps) {
  const component = meta?.component;

  if (component === "textarea") {
    return (
      <Textarea
        disabled={disabled}
        onBlur={field.onBlur}
        onChange={(e) => field.onChange(e.target.value)}
        placeholder={meta?.placeholder}
        ref={field.ref}
        value={field.value ?? ""}
      />
    );
  }

  const inputType = resolveInputType(component, checks);

  return (
    <Input
      disabled={disabled}
      onBlur={field.onBlur}
      onChange={(e) => field.onChange(e.target.value)}
      placeholder={meta?.placeholder}
      ref={field.ref}
      type={inputType}
      value={field.value ?? ""}
    />
  );
}

function resolveInputType(
  component: string | undefined,
  checks?: string[],
): React.HTMLInputTypeAttribute {
  if (component === "password") return "password";
  if (checks?.includes("email")) return "email";
  if (checks?.includes("url")) return "url";
  return "text";
}

export { StringField };
