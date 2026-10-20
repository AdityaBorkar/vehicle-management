import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Fragment } from "react";
import type { Control } from "react-hook-form";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import type { FieldMap, FieldMeta } from "../use-form";
import { deriveDefault } from "../use-form";

type FieldArrayConfig = {
	addLabel?: string;
	maxItems?: number;
	renderRow?: (props: {
		fields: Record<string, unknown>;
		index: number;
		remove: () => void;
	}) => React.ReactNode;
};

type FieldArrayProps = {
	meta?: FieldMeta | undefined;
	disabled?: boolean | undefined;
	elementFields: FieldMap | undefined;
	config: FieldArrayConfig | undefined;
	control: Control;
	name: string;
};

function AddButton({
	disabled,
	onAdd,
	label,
}: {
	disabled?: boolean | undefined;
	onAdd: () => void;
	label: string;
}): ReactNode {
	return (
		<Button
			disabled={disabled}
			onClick={onAdd}
			size="xs"
			type="button"
			variant="outline"
		>
			<IconPlus className="h-3 w-3" />
			{label}
		</Button>
	);
}

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
	const addDisabled =
		disabled || (maxItems !== undefined && fields.length >= maxItems);

	function handleAdd(): void {
		if (addDisabled) return;
		const defaults: Record<string, unknown> = {};
		if (elementFields) {
			for (const [key, def] of Object.entries(elementFields)) {
				defaults[key] = deriveDefault(def);
			}
		}
		append(defaults);
	}

	if (config?.renderRow) {
		const renderRow = config.renderRow;
		return (
			<div className="space-y-3">
				{fields.map((item, index) => (
					<Fragment key={item.id}>
						{renderRow({
							fields: item as Record<string, unknown>,
							index,
							remove: () => remove(index),
						})}
					</Fragment>
				))}
				<AddButton disabled={disabled} label={addLabel} onAdd={handleAdd} />
			</div>
		);
	}

	if (!elementFields) return null;

	const fieldEntries = Object.entries(elementFields);

	return (
		<div className="space-y-3">
			{fields.length === 0 && (
				<p className="text-muted-foreground text-sm">No items added yet</p>
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
			<AddButton disabled={addDisabled} label={addLabel} onAdd={handleAdd} />
		</div>
	);
}

// biome-ignore lint/style/useComponentExportOnlyModules: type-only export co-located with component
export type { FieldArrayConfig };
export { FieldArray };
