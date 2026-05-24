import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import type { FieldErrors } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import type { z } from "zod";

import { FormContext } from "./context";
import { buildDefaults, buildFieldMap } from "./use-form";

export type ValidationMode = "onBlur" | "onChange" | "onSubmit" | "all";

type FormRenderMethods = ReturnType<typeof useForm>;

export type FormProps<T extends z.ZodObject<any>> = {
  schema: T;
  onSubmit: (values: z.infer<T>) => void;
  onInvalid?: (errors: FieldErrors) => void;
  defaultValues?: Partial<z.infer<T>>;
  validationMode?: ValidationMode;
  className?: string;
  children: React.ReactNode | ((methods: FormRenderMethods) => React.ReactNode);
  ref?: React.Ref<any>;
};

export function Form<T extends z.ZodObject<any>>({
  schema,
  onSubmit,
  onInvalid,
  defaultValues: defaultValuesProp,
  validationMode = "onBlur",
  className,
  children,
  ref,
}: FormProps<T>) {
  const uid = useId();
  const fieldMap = buildFieldMap(schema);
  const schemaDefaults = buildDefaults(schema, defaultValuesProp);

  const methods = useForm({
    defaultValues: schemaDefaults,
    mode: validationMode,
    resolver: zodResolver(schema) as any,
    reValidateMode: "onChange",
  });

  if (ref) {
    (ref as React.MutableRefObject<any>).current = methods;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    methods.handleSubmit((values) => {
      const parsed = schema.parse(values);
      onSubmit(parsed as z.infer<T>);
    }, onInvalid as any)();
  }

  return (
    <FormContext value={{ fieldMap, formId: uid }}>
      <FormProvider {...methods}>
        <form className={className} onSubmit={handleSubmit}>
          {typeof children === "function" ? children(methods) : children}
        </form>
      </FormProvider>
    </FormContext>
  );
}
