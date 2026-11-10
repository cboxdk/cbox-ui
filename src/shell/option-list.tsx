import { Check, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { canAutofocus } from './media';
import { revealInList } from './popover';
import { useShell } from './context';
import type { ShellOption } from './types';

/**
 * Roving focus for a `role="menu"`: ↑↓ (and ←→ inside a `role="group"` row) move between the
 * items, Home and End jump. The items are the menu's `menuitem`, `menuitemradio` and links.
 */
export function rovingKeyDown(event: KeyboardEvent<HTMLElement>, container: HTMLElement | null): void {
    if (container === null) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemradio"]')).filter(el => !el.closest('[hidden]'));
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const inGroup = (document.activeElement as HTMLElement | null)?.closest('[role="group"]') !== null;
    let next = -1;
    switch (event.key) {
        case 'ArrowDown':
            next = index < 0 ? 0 : (index + 1) % items.length;
            if (inGroup) {
                // Leave the segmented row downwards in one step.
                const group = (document.activeElement as HTMLElement).closest('[role="group"]')!;
                const after = items.findIndex((item, i) => i > index && !group.contains(item));
                next = after >= 0 ? after : 0;
            }
            break;
        case 'ArrowUp':
            next = index <= 0 ? items.length - 1 : index - 1;
            if (inGroup) {
                const group = (document.activeElement as HTMLElement).closest('[role="group"]')!;
                const before = items.map((item, i) => (i < index && !group.contains(item) ? i : -1)).filter(i => i >= 0).pop();
                next = before ?? items.length - 1;
            }
            break;
        case 'ArrowRight':
            if (inGroup) next = Math.min(items.length - 1, index + 1);
            break;
        case 'ArrowLeft':
            if (inGroup) next = Math.max(0, index - 1);
            break;
        case 'Home':
            next = 0;
            break;
        case 'End':
            next = items.length - 1;
            break;
    }
    if (next >= 0) {
        event.preventDefault();
        items[next]!.focus();
    }
}

/**
 * A searchable list of choices (language, regional format, time zone): the same search, row
 * density and keys as the context menus.
 */
export function OptionList({ label, options, current, onPick, autoFocus = true }: { label: string; options: ShellOption[]; current?: string; onPick: (code: string) => void; autoFocus?: boolean }) {
    const { t } = useShell();
    const [q, setQ] = useState('');
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return needle === '' ? options : options.filter(option => option.label.toLowerCase().includes(needle) || option.code.toLowerCase().includes(needle));
    }, [options, q]);
    const [active, setActive] = useState(() => Math.max(0, options.findIndex(option => option.code === current)));

    useEffect(() => {
        if (autoFocus && canAutofocus()) input.current?.focus();
    }, [autoFocus]);
    useEffect(() => {
        if (q !== '') setActive(0);
    }, [q]);
    useEffect(() => {
        revealInList(`${id}-${active}`);
    }, [active, id]);

    const onKeyDown = (event: KeyboardEvent) => {
        const last = shown.length - 1;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(index => (index >= last ? 0 : index + 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(index => (index <= 0 ? last : index - 1));
        } else if (event.key === 'Home' && q === '') {
            event.preventDefault();
            setActive(0);
        } else if (event.key === 'End' && q === '') {
            event.preventDefault();
            setActive(last);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const option = shown[active];
            if (option !== undefined) onPick(option.code);
        }
    };

    return (
        <div className="cbx-pane" onKeyDown={onKeyDown}>
            <div className="cbx-pane-search">
                <Search size={16} strokeWidth={1.8} aria-hidden />
                <input
                    ref={input}
                    type="search"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls={`${id}-list`}
                    aria-activedescendant={shown[active] !== undefined ? `${id}-${active}` : undefined}
                    aria-label={t('Search {things}', { things: label.toLowerCase() })}
                    placeholder={t('Search…')}
                    value={q}
                    onChange={event => setQ(event.target.value)}
                    autoComplete="off"
                />
            </div>
            <div id={`${id}-list`} role="listbox" aria-label={label} className="cbx-list cbx-list-tall">
                {shown.map((option, index) => (
                    <div key={option.code} className={`cbx-row ${index === active ? 'is-active' : ''}`} onMouseEnter={() => setActive(index)}>
                        <div id={`${id}-${index}`} role="option" aria-selected={index === active} aria-current={option.code === current ? 'true' : undefined} className="cbx-row-main" onClick={() => onPick(option.code)}>
                            <span className="cbx-row-name" title={option.label}>{option.label}</span>
                            {option.code === current && <Check className="cbx-row-check" size={16} strokeWidth={2} aria-label={t('Current')} />}
                        </div>
                    </div>
                ))}
                {shown.length === 0 && <div className="cbx-list-note">{t('Nothing matches “{query}”.', { query: q.trim() })}</div>}
            </div>
        </div>
    );
}
