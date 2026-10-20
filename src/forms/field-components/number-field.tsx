import type { ControllerRenderProps } from "react-hook-form";

import { Input } from "#/components/ui/input";
import type { FieldMeta } from "../use-form";

type NumberFieldProps = {
	field: ControllerRenderProps;
	meta?: FieldMeta | undefined;
	disabled?: boolean | undefined;
};

function NumberField({ field, meta, disabled }: NumberFieldProps) {
	return (
		<Input
			disabled={disabled}
			inputMode="numeric"
			onBlur={field.onBlur}
			onChange={(e) => {
				const val = e.target.value;
				if (val === "") {
					field.onChange(undefined);
					return;
				}
				const next = Number(val);
				field.onChange(Number.isNaN(next) ? undefined : next);
			}}
			placeholder={meta?.placeholder}
			ref={field.ref}
			type="number"
			value={field.value ?? ""}
		/>
	);
}

export { NumberField };
