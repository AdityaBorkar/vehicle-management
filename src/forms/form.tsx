import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode, Ref } from "react";
import { useEffect } from "react";
import type { FieldErrors, UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import type { z } from "zod";

import { FormContext } from "./context";
import { buildDefaults, buildFieldMap } from "./use-form";

export type ValidationMode = "onBlur" | "onChange" | "onSubmit" | "all";

type FormRenderMethods = UseFormReturn;

export type FormProps<T extends z.ZodType> = {
	schema: T;
	onSubmit: (values: z.infer<T>) => void;
	onInvalid?: (errors: FieldErrors) => void;
	defaultValues?: Partial<z.infer<T>>;
	validationMode?: ValidationMode;
	className?: string;
	children: ReactNode | ((methods: FormRenderMethods) => ReactNode);
	ref?: Ref<unknown>;
};

export function Form<T extends z.ZodType>({
	schema,
	onSubmit,
	onInvalid,
	defaultValues: defaultValuesProp,
	validationMode = "onBlur",
	className,
	children,
	ref,
}: FormProps<T>): ReactNode {
	const fieldMap = buildFieldMap(schema);
	const schemaDefaults = buildDefaults(fieldMap, defaultValuesProp);

	const methods = useForm({
		defaultValues: schemaDefaults,
		mode: validationMode,
		// biome-ignore lint/suspicious/noExplicitAny: react-hook-form resolver type mismatch with zodResolver (exactOptionalPropertyTypes)
		resolver: zodResolver(schema as any) as any,
		reValidateMode: "onChange",
	});

	useEffect(() => {
		if (ref) {
			(ref as { current: unknown }).current = methods;
		}
	}, [ref, methods]);

	function handleSubmit(e: React.FormEvent): void {
		e.preventDefault();
		methods.handleSubmit((values) => {
			onSubmit(values as z.infer<T>);
			// biome-ignore lint/suspicious/noExplicitAny: react-hook-form handleSubmit callback signature mismatch
		}, onInvalid as any)();
	}

	return (
		<FormContext value={{ fieldMap }}>
			<FormProvider {...methods}>
				<form className={className} onSubmit={handleSubmit}>
					{typeof children === "function" ? children(methods) : children}
				</form>
			</FormProvider>
		</FormContext>
	);
}
