import { createContext, useContext } from "react";

import type { FieldMap } from "./use-form";

type FormContextValue = {
	fieldMap: FieldMap;
};

const FormContext = createContext<FormContextValue | null>(null);

function useFormContext(): FormContextValue {
	const ctx = useContext(FormContext);
	if (!ctx) {
		throw new Error("Field must be used within a Form");
	}
	return ctx;
}

export { FormContext, type FormContextValue, useFormContext };
