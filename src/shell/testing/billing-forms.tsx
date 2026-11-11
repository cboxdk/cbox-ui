import { useId, useState } from 'react';
import { CreateField, CreateForm, CreateRefField, CreateSubmit, type ShellCreateForm } from '../create';

/**
 * Stand-in create forms for the Billing fixture (V7's `forms`): reference fields that stack
 * "+ New customer", and plain fields. What an app's `renderCreate` would return.
 */

type Field = { label: string; ref?: string; placeholder?: string };

const FORMS: Record<string, Field[]> = {
    invoice: [{ label: 'Customer', ref: 'customer' }, { label: 'Lines', placeholder: 'Add a product or a line' }, { label: 'Due', placeholder: 'Net 14 days' }],
    credit: [{ label: 'Invoice', placeholder: 'Choose an invoice' }, { label: 'Amount', placeholder: 'Full or partial' }],
    subscription: [{ label: 'Customer', ref: 'customer' }, { label: 'Plan', ref: 'plan' }, { label: 'Start', placeholder: 'Today' }],
    quote: [{ label: 'Customer', ref: 'customer' }, { label: 'Lines', placeholder: 'Add a product or a line' }],
    customer: [{ label: 'Name', placeholder: 'Company or person' }, { label: 'Email', placeholder: 'billing@…' }, { label: 'Country', placeholder: 'Denmark' }],
    plan: [{ label: 'Product', ref: 'product' }, { label: 'Price', placeholder: 'DKK per month' }],
    product: [{ label: 'Name', placeholder: 'Product name' }, { label: 'Price', placeholder: 'Optional first price' }],
};

const LABELS: Record<string, string> = { customer: 'Customer', plan: 'Plan', product: 'Product' };
const SAMPLE: Record<string, string> = { customer: 'Hubhus ApS', plan: 'Pro monthly', product: 'Cbox Pro' };

export function BillingCreateForm({ form }: { form: ShellCreateForm }) {
    const fields = FORMS[form.creatable.key] ?? [{ label: 'Name', placeholder: `${form.creatable.label} name` }];
    const [refs, setRefs] = useState<Record<string, string>>({});
    const [values, setValues] = useState<Record<string, string>>({});
    const id = useId();
    return (
        <CreateForm onSubmit={() => form.done({ id: `${form.creatable.key}_new`, label: values.Name || SAMPLE[form.creatable.key] || `New ${form.creatable.label.toLowerCase()}` })}>
            {fields.map((field, index) =>
                field.ref !== undefined ? (
                    <CreateRefField
                        key={field.label}
                        label={field.label}
                        value={refs[field.ref]}
                        placeholder={`Choose ${LABELS[field.ref]!.toLowerCase()}`}
                        thing={LABELS[field.ref]!}
                        onCreate={() => form.createRef(field.ref!, created => setRefs(current => ({ ...current, [field.ref!]: created.label })))}
                    />
                ) : (
                    <CreateField key={field.label} label={field.label} htmlFor={`${id}-${index}`}>
                        <input id={`${id}-${index}`} className="cbx-cinput" placeholder={field.placeholder} value={values[field.label] ?? ''} onChange={event => setValues(current => ({ ...current, [field.label]: event.target.value }))} />
                    </CreateField>
                ),
            )}
            <CreateSubmit form={form} />
        </CreateForm>
    );
}

export const renderBillingCreate = (form: ShellCreateForm) => <BillingCreateForm form={form} />;
