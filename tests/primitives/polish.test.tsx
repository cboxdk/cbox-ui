// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Activity } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { Combobox } from '../../src/primitives/combobox';
import { Field } from '../../src/primitives/field';
import { SectionHeader } from '../../src/primitives/data-panel';
import { StatTile } from '../../src/primitives/stat-tile';
import { StatusPill } from '../../src/primitives/status-pill';

afterEach(cleanup);

describe('contrast (tokens checked in tests/tokens/contrast.test.ts)', () => {
    it.each(['success', 'info', 'warning', 'destructive'] as const)('a %s pill writes in the tone text token', tone => {
        render(<StatusPill tone={tone}>Label</StatusPill>);
        expect(screen.getByText('Label').className).toContain(`text-${tone}-text`);
    });

    it('a stat tile caption is full muted text, not a faded one', () => {
        render(<StatTile label="MRR" value="31k" suffix="EUR, this month" icon={Activity} tone="warning" />);
        const caption = screen.getByText('EUR, this month');
        expect(caption.className).toContain('text-muted-foreground');
        expect(caption.className).not.toContain('text-muted-foreground/');
    });
});

describe('StatTile', () => {
    it('wraps a long label and caption instead of cutting them off with an ellipsis', () => {
        render(<StatTile label="Handed to humans this month" value="10" suffix="live in this organization" icon={Activity} />);
        for (const text of ['Handed to humans this month', 'live in this organization']) {
            expect(screen.getByText(text).className.split(' ')).not.toContain('truncate');
            expect(screen.getByText(text).className.split(' ')).toContain('break-words');
        }
    });
});

describe('SectionHeader', () => {
    it('keeps the actions in the title row and lets them wrap under it when there is no room', () => {
        render(<SectionHeader title="Invoices" actions={<a href="#all">View all</a>} />);
        const header = screen.getByRole('banner');
        expect(header.className).toContain('flex-wrap');
        expect(header.className).not.toContain('flex-col');
        const actions = screen.getByRole('link', { name: 'View all' }).parentElement!;
        expect(actions.className).toContain('flex-wrap');
        expect(screen.getByRole('heading', { name: 'Invoices' }).parentElement!.className).toContain('min-w-0');
    });
});

describe('Combobox on a phone', () => {
    it('renders its search field at 16px below 768px, so iOS does not zoom into it', () => {
        render(<Combobox items={[{ value: 'a', label: 'Alpha' }]} value={null} onChange={() => undefined} ariaLabel="Customer" />);
        fireEvent.click(screen.getByRole('combobox', { name: 'Customer' }));
        const field = document.querySelector('input')!;
        expect(field.className.split(' ')).toEqual(expect.arrayContaining(['text-base', 'md:text-[13px]']));
        expect(field.className).not.toMatch(/(^|\s)text-\[13px\]/);
    });
});

describe('Combobox field and focus', () => {
    it('inherits its label, description and validation state from Field', () => {
        const { rerender } = render(<Field label="Customer" required hint="Choose the account" error="Customer is required"><Combobox items={[]} value={null} onChange={() => undefined} /></Field>);
        const trigger = screen.getByRole('combobox', { name: 'Customer (required)' });
        expect(trigger.getAttribute('aria-required')).toBe('true');
        expect(trigger.getAttribute('aria-invalid')).toBe('true');
        const descriptions = trigger.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent);
        expect(descriptions).toEqual(['Choose the account', 'Customer is required']);
        rerender(<Field label="Customer" error="Inherited error"><Combobox id="explicit" ariaLabel="Account" aria-describedby="external-hint" aria-invalid={false} required={false} items={[]} value={null} onChange={() => undefined} /></Field>);
        const overridden = screen.getByRole('combobox', { name: 'Account' });
        expect(overridden.id).toBe('explicit');
        expect(overridden.getAttribute('aria-describedby')).toBe('external-hint');
        expect(overridden.getAttribute('aria-invalid')).toBe('false');
        expect(overridden.getAttribute('aria-required')).toBe('false');
    });

    it('returns focus on Escape and selection, but not when clicking away', async () => {
        const user = userEvent.setup();
        render(<><Combobox items={[{ value: 'a', label: 'Alpha' }]} value={null} onChange={() => undefined} ariaLabel="Customer" /><button>Next</button></>);
        const trigger = screen.getByRole('combobox', { name: 'Customer' });
        await user.click(trigger);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        await user.click(trigger);
        await user.click(screen.getByRole('button', { name: 'Alpha' }));
        expect(document.activeElement).toBe(trigger);
        await user.click(trigger);
        screen.getByRole('button', { name: 'Alpha' }).focus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        await user.click(trigger);
        await user.click(screen.getByRole('button', { name: 'Next' }));
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }));
    });
});
