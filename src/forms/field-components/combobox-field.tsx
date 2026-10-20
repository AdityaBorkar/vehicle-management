import { IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";
import type { ControllerRenderProps } from "react-hook-form";

import { Button } from "#/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "#/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import type { FieldMeta } from "../use-form";

type ComboboxOption = {
	label?: string;
	name?: string;
	value?: string | number;
	id?: string | number;
};

type ComboboxConfig<TOption extends ComboboxOption = ComboboxOption> = {
	options?: TOption[];
	getOptionLabel?: (option: TOption) => string;
	getOptionValue?: (option: TOption) => string | number;
	searchPlaceholder?: string;
	emptyMessage?: string;
};

type ComboboxFieldProps = {
	field: ControllerRenderProps;
	meta?: FieldMeta | undefined;
	disabled?: boolean | undefined;
	config: ComboboxConfig<ComboboxOption> | undefined;
};

function defaultGetOptionLabel(o: ComboboxOption): string {
	return o.label ?? o.name ?? "";
}

function defaultGetOptionValue(o: ComboboxOption): string | number {
	return o.value ?? o.id ?? "";
}

function ComboboxField({ field, meta, disabled, config }: ComboboxFieldProps) {
	const [open, setOpen] = useState(false);

	const options = config?.options ?? [];
	const getLabel = config?.getOptionLabel ?? defaultGetOptionLabel;
	const getValue = config?.getOptionValue ?? defaultGetOptionValue;
	const searchPlaceholder = config?.searchPlaceholder ?? "Search...";
	const emptyMessage = config?.emptyMessage ?? "No items found";

	const selected = options.find(
		(o) => String(getValue(o)) === String(field.value),
	);

	function handleOpenChange(next: boolean): void {
		setOpen(next);
	}

	return (
		<Popover onOpenChange={handleOpenChange} open={open}>
			<PopoverTrigger
				disabled={disabled}
				render={
					<Button
						className="w-full justify-between font-normal"
						role="combobox"
						variant="outline"
					/>
				}
			>
				{selected ? (
					<span className="truncate">{getLabel(selected)}</span>
				) : (
					<span className="font-normal text-muted-foreground">
						{meta?.placeholder ?? "Select..."}
					</span>
				)}
				<IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
			</PopoverTrigger>
			<PopoverContent align="start" className="p-0" sideOffset={4}>
				<Command>
					<CommandInput placeholder={searchPlaceholder} />
					<CommandList>
						<CommandEmpty>{emptyMessage}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => {
								const val = getValue(option);
								return (
									<CommandItem
										key={`${getLabel(option)}-${String(val)}`}
										onSelect={() => {
											field.onChange(val);
											setOpen(false);
										}}
										value={getLabel(option)}
									>
										<span className="truncate">{getLabel(option)}</span>
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

// biome-ignore lint/style/useComponentExportOnlyModules: type-only exports co-located with component
export type { ComboboxConfig, ComboboxOption };
export { ComboboxField };
