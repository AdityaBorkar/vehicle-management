import type { ChangeEvent } from "react";
import type { ControllerRenderProps } from "react-hook-form";

import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import type { FieldMeta } from "../use-form";

type StringFieldProps = {
	field: ControllerRenderProps;
	meta?: FieldMeta | undefined;
	disabled?: boolean | undefined;
	checks?: string[] | undefined;
};

function StringField({ field, meta, disabled, checks }: StringFieldProps) {
	const component = meta?.component;

	const shared = {
		disabled,
		onBlur: field.onBlur,
		placeholder: meta?.placeholder,
		ref: field.ref,
		value: field.value ?? "",
	};

	if (component === "textarea") {
		return (
			<Textarea
				{...shared}
				onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
					field.onChange(e.target.value)
				}
			/>
		);
	}

	return (
		<Input
			{...shared}
			onChange={(e) => field.onChange(e.target.value)}
			type={resolveInputType(component, checks)}
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
