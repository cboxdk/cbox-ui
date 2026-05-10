import {
    Combobox as HeadlessCombobox,
    ComboboxButton,
    ComboboxInput,
    ComboboxOption,
    ComboboxOptions,
} from '@headlessui/react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../utils/cn';

export type ComboboxOption = {
    value: string;
    label: string;
    description?: string;
};

export type ComboboxProps = {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    options: ComboboxOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
};

/**
 * Searchable single-select. Filters options by `label` substring.
 * Emits the selected option's `value` on change. Keyboard nav via
 * Headless UI primitive.
 */
export function Combobox({
    id,
    value,
    onChange,
    options,
    placeholder = 'Select…',
    disabled,
    className,
}: ComboboxProps) {
    const [query, setQuery] = useState('');

    const filtered =
        query === ''
            ? options
            : options.filter((o) =>
                  o.label.toLowerCase().includes(query.toLowerCase()),
              );

    const selected = options.find((o) => o.value === value) ?? null;

    return (
        <HeadlessCombobox
            value={selected}
            onChange={(opt: ComboboxOption | null) => onChange(opt?.value ?? '')}
            disabled={disabled}
        >
            <div className={cn('relative', className)}>
                <ComboboxInput
                    id={id}
                    className={cn(
                        'w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-ring',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                    )}
                    displayValue={(opt: ComboboxOption | null) => opt?.label ?? ''}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                />
                <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronsUpDown className="size-4 text-muted-foreground" />
                </ComboboxButton>

                <ComboboxOptions
                    className={cn(
                        'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md',
                        'text-popover-foreground',
                    )}
                >
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                            No matches
                        </div>
                    ) : (
                        filtered.map((option) => (
                            <ComboboxOption
                                key={option.value}
                                value={option}
                                className={({ focus }) =>
                                    cn(
                                        'flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm',
                                        focus && 'bg-accent text-accent-foreground',
                                    )
                                }
                            >
                                {({ selected }) => (
                                    <>
                                        <div>
                                            <div>{option.label}</div>
                                            {option.description && (
                                                <div className="text-xs text-muted-foreground">
                                                    {option.description}
                                                </div>
                                            )}
                                        </div>
                                        {selected && <Check className="size-4" />}
                                    </>
                                )}
                            </ComboboxOption>
                        ))
                    )}
                </ComboboxOptions>
            </div>
        </HeadlessCombobox>
    );
}
