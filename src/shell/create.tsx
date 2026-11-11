import { ChevronDown, ChevronRight, Plus, Search } from 'lucide-react';
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { hueFor } from './app-grid';
import { ToneSquare } from './context-menus';
import { useShell } from './context';
import { environmentLevel, isLive } from './data';
import { resolveIcon } from './icons';
import { matchScore } from './palette';
import { Sheet } from './sheet';
import type { ContextItem, Shell, ShellCreatable } from './types';

/** What a create form hands back: the new thing, for the form below it (or the page). */
export type ShellCreated = { id: string; label: string; url?: string };

/**
 * What `renderCreate` gets for one form in the create sheet. The shell owns the sheet, the
 * stack and the words around the form; the app owns the fields and the request.
 */
export type ShellCreateForm = {
    creatable: ShellCreatable;
    /** The form this one feeds, when it was stacked from a reference field. Null at the bottom. */
    parent: ShellCreatable | null;
    /** "Create invoice", or "Create and use in invoice" for a stacked form. */
    submitLabel: string;
    /**
     * Stack the form for another creatable (a reference field's "+ New customer"). When it is
     * created, `onCreated` gets it and this form shows again, with its state kept.
     */
    createRef: (key: string, onCreated: (created: ShellCreated) => void) => void;
    /**
     * The thing was created. A stacked form goes back to the one below and hands it `created`;
     * the bottom form closes the sheet.
     */
    done: (created?: ShellCreated) => void;
    /** Close the whole sheet without creating anything. */
    close: () => void;
    /** The current environment, when the app has one. */
    environment: ContextItem | null;
};

/** The app's create forms: one per creatable key. Return null for a key it has no form for. */
export type ShellRenderCreate = (form: ShellCreateForm) => ReactNode;

type Entry = { kind: 'tree' } | { kind: 'form'; key: string; onCreated?: (created: ShellCreated) => void };

export function findCreatable(shell: Shell, key: string | undefined | null): ShellCreatable | undefined {
    if (key === undefined || key === null) return undefined;
    return shell.create?.items.find(item => item.key === key);
}

/** The creatable "+" opens on this page: the page's own, else the app's default, else none (the tree). */
export function pageCreateKey(shell: Shell): string | null {
    return findCreatable(shell, shell.page?.create)?.key ?? findCreatable(shell, shell.create?.default)?.key ?? null;
}

/** "+"'s accessible name: "New invoice" on a page that creates invoices, else "Create". */
export function createLabel(shell: Shell, t: (key: string, replace?: Record<string, string | number>) => string): string {
    const own = findCreatable(shell, shell.page?.create);
    return own !== undefined ? t('New {thing}', { thing: own.label.toLowerCase() }) : t('Create');
}

/**
 * The create sheet (V7): a bottom sheet on the phone, a panel from the right on a desktop. It
 * opens on a form, with "‹ Create" leading up to the searchable tree of everything the app can
 * create, grouped by area. A reference field stacks the form for the thing it refers to; its
 * submit says "Create and use in …", goes back and fills the field. Every form in the stack stays
 * mounted, so what the person typed below is kept.
 */
export function CreateSheet({ onClose }: { onClose: () => void }) {
    const { shell, t, mobile, createKey, renderCreate } = useShell();
    const [stack, setStack] = useState<Entry[]>(() => (findCreatable(shell, createKey) !== undefined ? [{ kind: 'tree' }, { kind: 'form', key: createKey! }] : [{ kind: 'tree' }]));
    const top = stack[stack.length - 1]!;
    const below = stack.length > 1 ? stack[stack.length - 2]! : null;
    const environmentLevelItem = environmentLevel(shell.context.levels)?.current ?? null;
    const notLive = environmentLevelItem !== null && isLive(environmentLevelItem) === false;
    const name = (entry: Entry | null) => (entry === null ? '' : entry.kind === 'tree' ? t('Create') : (findCreatable(shell, entry.key)?.label ?? entry.key));

    const pop = () => setStack(current => (current.length > 1 ? current.slice(0, -1) : current));
    const title = top.kind === 'tree' ? t('Create') : t('New {thing}', { thing: name(top).toLowerCase() });

    return (
        <Sheet
            label={title}
            side={mobile ? 'bottom' : 'right'}
            size="tall"
            onClose={onClose}
            className="cbx-create-sheet"
            back={below !== null ? { label: t('Back to {thing}', { thing: name(below) }), text: name(below), onBack: pop } : undefined}
        >
            {top.kind === 'tree' && <CreateTree onPick={key => setStack([{ kind: 'tree' }, { kind: 'form', key }])} />}
            {notLive && top.kind === 'form' && (
                <p className="cbx-create-env" role="note">
                    <ToneSquare tone={environmentLevelItem.tone} />
                    {t('Creating in {environment}, not production', { environment: environmentLevelItem.name })}
                </p>
            )}
            {stack.map((entry, index) => {
                if (entry.kind !== 'form') return null;
                const creatable = findCreatable(shell, entry.key);
                if (creatable === undefined) return null;
                const under = stack[index - 1];
                const parent = under?.kind === 'form' ? (findCreatable(shell, under.key) ?? null) : null;
                const form: ShellCreateForm = {
                    creatable,
                    parent,
                    submitLabel: parent !== null ? t('Create and use in {thing}', { thing: parent.label.toLowerCase() }) : (creatable.submitLabel ?? t('Create {thing}', { thing: creatable.label.toLowerCase() })),
                    createRef: (key, onCreated) => {
                        if (findCreatable(shell, key) === undefined) return;
                        setStack(current => [...current.slice(0, index + 1), { kind: 'form', key, onCreated }]);
                    },
                    done: created => {
                        if (parent === null) {
                            onClose();
                            return;
                        }
                        setStack(current => current.slice(0, index));
                        if (created !== undefined) entry.onCreated?.(created);
                    },
                    close: onClose,
                    environment: environmentLevelItem,
                };
                const body = renderCreate?.(form) ?? null;
                return (
                    <div key={`${index}:${entry.key}`} className="cbx-create-form" hidden={entry !== top}>
                        {body ?? <p className="cbx-list-note">{t('{thing} cannot be created here yet.', { thing: creatable.label })}</p>}
                    </div>
                );
            })}
        </Sheet>
    );
}

/** "What do you want to create?": every creatable, by area (the current one first, then the nav's order), with search. */
function CreateTree({ onPick }: { onPick: (key: string) => void }) {
    const { shell, t, icons } = useShell();
    const [q, setQ] = useState('');
    const groups = useMemo(() => {
        const items = (shell.create?.items ?? []).filter(item => matchScore(`${item.label} ${(item.keywords ?? []).join(' ')}`, q) > 0);
        // The area the person is in first, then the nav's order.
        const order = [shell.nav.activeArea, ...shell.nav.areas.map(area => area.key).filter(key => key !== shell.nav.activeArea)];
        const keys = Array.from(new Set(items.map(item => item.area))).sort((a, b) => {
            const ia = order.indexOf(a);
            const ib = order.indexOf(b);
            return (ia < 0 ? order.length : ia) - (ib < 0 ? order.length : ib);
        });
        return keys.map(key => ({ area: shell.nav.areas.find(area => area.key === key), key, items: items.filter(item => item.area === key) }));
    }, [shell, q]);
    return (
        <div className="cbx-create-tree">
            <label className="cbx-field-search">
                <Search size={18} strokeWidth={1.8} aria-hidden />
                <input type="search" value={q} onChange={event => setQ(event.target.value)} placeholder={t('What do you want to create?')} aria-label={t('Search what to create')} autoComplete="off" />
            </label>
            {groups.map(group => {
                const Icon = resolveIcon(group.area?.icon, icons);
                return (
                    <section key={group.key} aria-label={group.area?.label ?? group.key}>
                        <h2 className="cbx-eyebrow">{group.area?.label ?? group.key}</h2>
                        <div className="cbx-group">
                            {group.items.map(item => (
                                <button key={item.key} type="button" className="cbx-grow" onClick={() => onPick(item.key)}>
                                    <span className="cbx-tile" style={{ '--cbx-hue': String(hueFor(group.key)) } as Record<string, string>} aria-hidden="true">
                                        <Icon size={16} strokeWidth={1.8} aria-hidden />
                                    </span>
                                    <span className="cbx-grow-label">{item.label}</span>
                                    <ChevronRight className="cbx-grow-trail" size={16} strokeWidth={1.8} aria-hidden />
                                </button>
                            ))}
                        </div>
                    </section>
                );
            })}
            {groups.length === 0 && <p className="cbx-list-note">{t('Nothing matches “{query}”.', { query: q.trim() })}</p>}
        </div>
    );
}

/** A labelled field in a create form. */
export function CreateField({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
    return (
        <div className="cbx-cfield">
            {htmlFor !== undefined ? <label className="cbx-cfield-label" htmlFor={htmlFor}>{label}</label> : <span className="cbx-cfield-label">{label}</span>}
            {children}
        </div>
    );
}

/**
 * A reference field (Customer on an invoice): the chosen value or a placeholder, a chooser, and
 * "+ New {thing}", which stacks that thing's form and fills the field when it is created.
 */
export function CreateRefField({ label, value, placeholder, thing, onChoose, onCreate }: { label: string; value?: string | null; placeholder: string; thing: string; onChoose?: () => void; onCreate: () => void }) {
    const { t } = useShell();
    const id = useId();
    return (
        <div className="cbx-cfield" role="group" aria-labelledby={id}>
            <span id={id} className="cbx-cfield-label">{label}</span>
            <div className="cbx-group">
                <button type="button" className={`cbx-grow ${value ? '' : 'is-empty'}`} onClick={onChoose} aria-haspopup={onChoose !== undefined ? 'dialog' : undefined}>
                    <span className="cbx-grow-label">{value || placeholder}</span>
                    <ChevronDown className="cbx-grow-trail" size={14} strokeWidth={2} aria-hidden />
                </button>
                <button type="button" className="cbx-grow is-accent" onClick={onCreate}>
                    <Plus size={16} strokeWidth={1.8} aria-hidden />
                    <span className="cbx-grow-label">{t('New {thing}', { thing: thing.toLowerCase() })}</span>
                </button>
            </div>
        </div>
    );
}

/** The form's submit button, with the shell's label ("Create and use in invoice"). */
export function CreateSubmit({ form, busy = false, disabled = false }: { form: Pick<ShellCreateForm, 'submitLabel'>; busy?: boolean; disabled?: boolean }) {
    const { t } = useShell();
    return (
        <button type="submit" className="cbx-button cbx-button-primary cbx-create-submit" disabled={busy || disabled}>
            {busy ? t('Creating…') : form.submitLabel}
        </button>
    );
}

/** A plain `<form>` laid out for the create sheet: the fields, then the submit at the bottom. */
export function CreateForm({ onSubmit, children }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode }) {
    return (
        <form className="cbx-cform" onSubmit={event => { event.preventDefault(); onSubmit(event); }}>
            {children}
        </form>
    );
}
