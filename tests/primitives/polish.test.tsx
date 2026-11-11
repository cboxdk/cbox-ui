// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Activity } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { Combobox } from '../../src/primitives/combobox';
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
