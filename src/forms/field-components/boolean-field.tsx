import type { ControllerRenderProps } from "react-hook-form";

import { Checkbox } from "#/components/ui/checkbox";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import type { FieldMeta } from "../use-form";

type BooleanFieldProps = {
	field: ControllerRenderProps;
	meta?: FieldMeta | undefined;
	disabled?: boolean | undefined;
	label: string;
};

function BooleanField({ field, meta, disabled, label }: BooleanFieldProps) {
	const Control = meta?.component === "checkbox" ? Checkbox : Switch;

	return (
		<div className="flex items-center gap-2">
			<Control
				checked={Boolean(field.value)}
				disabled={disabled}
				onCheckedChange={field.onChange}
				ref={field.ref}
			/>
			<Label className="font-normal">{label}</Label>
		</div>
	);
}

export { BooleanField };
