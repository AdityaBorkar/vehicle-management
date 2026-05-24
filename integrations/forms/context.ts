import { createContext, useContext } from "react";

import type { FieldMap } from "./use-form";

type FormContextValue = {
  fieldMap: FieldMap;
  formId: string;
};

const FormContext = createContext<FormContextValue | null>(null);

function useFormContext(): FormContextValue {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("SmartField must be used within a SchemaForm");
  }
  return ctx;
}

export type { FormContextValue };
export { FormContext, useFormContext };
