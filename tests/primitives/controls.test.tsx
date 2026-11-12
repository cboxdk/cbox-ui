// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CboxLocalizationProvider } from '../../src/context/localization';
import { Button } from '../../src/primitives/button';
import { Checkbox } from '../../src/primitives/checkbox';
import { Dialog, DialogClose } from '../../src/primitives/dialog';
import { Field } from '../../src/primitives/field';
import { Input, Textarea } from '../../src/primitives/input';
import { RadioGroup } from '../../src/primitives/radio-group';
import { Switch } from '../../src/primitives/switch';
import { scrollLockCount } from '../../src/shell/scroll-lock';

afterEach(cleanup);

describe('Button', () => {
    it('is a plain button by default, so it never submits the form it sits in', () => {
        render(<Button>Cancel</Button>);
        const button = screen.getByRole('button', { name: 'Cancel' });
        expect(button.getAttribute('type')).toBe('button');
        expect(button.className).toContain('cbx-ui-btn--ghost');
    });

    it('carries the variant and size classes', () => {
        render(
            <Button variant="primary" size="sm" type="submit">
                Save
            </Button>,
        );
        const button = screen.getByRole('button', { name: 'Save' });
        expect(button.className.split(' ')).toEqual(expect.arrayContaining(['cbx-ui-btn', 'cbx-ui-btn--primary', 'cbx-ui-btn--sm']));
        expect(button.getAttribute('type')).toBe('submit');
    });

    it('while loading: disabled, busy, a spinner instead of the glyph, and the same label', () => {
        const onClick = vi.fn();
        render(
            <Button loading icon={<svg data-testid="glyph" />} onClick={onClick}>
                Save
            </Button>,
        );
        const button = screen.getByRole('button', { name: 'Save' });
        expect(button).toHaveProperty('disabled', true);
        expect(button.getAttribute('aria-busy')).toBe('true');
        expect(button.querySelector('.cbx-ui-spinner')).not.toBeNull();
        expect(screen.queryByTestId('glyph')).toBeNull();
        fireEvent.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });

    it('keeps a glyph out of the accessible name', () => {
        render(<Button icon={<svg />}>Add</Button>);
        expect(screen.getByRole('button', { name: 'Add' }).querySelector('.cbx-ui-btn-glyph')!.getAttribute('aria-hidden')).toBe('true');
    });

    it('asChild styles a link as the button, with the glyph inside it', () => {
        render(
            <Button asChild variant="primary" icon={<svg data-testid="glyph" />}>
                <a href="/projects/new" className="own">
                    New project
                </a>
            </Button>,
        );
        const link = screen.getByRole('link', { name: 'New project' });
        expect(link.className.split(' ')).toEqual(expect.arrayContaining(['cbx-ui-btn', 'cbx-ui-btn--primary', 'own']));
        expect(link.contains(screen.getByTestId('glyph'))).toBe(true);
        expect(link.hasAttribute('type')).toBe(false);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('a disabled link stays focusable but goes nowhere', () => {
        const onClick = vi.fn();
        render(
            <Button asChild disabled>
                <a href="/x" onClick={onClick}>
                    Go
                </a>
            </Button>,
        );
        const link = screen.getByRole('link', { name: 'Go' });
        expect(link.getAttribute('aria-disabled')).toBe('true');
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(onClick).not.toHaveBeenCalled();
    });
});

describe('Field', () => {
    it('labels its control and describes it with the hint', () => {
        render(
            <Field label="Name" hint="Shown to your team.">
                <Input />
            </Field>,
        );
        const input = screen.getByLabelText('Name');
        expect(input.tagName).toBe('INPUT');
        const hint = screen.getByText('Shown to your team.');
        expect(input.getAttribute('aria-describedby')).toBe(hint.id);
        expect(input.hasAttribute('aria-invalid')).toBe(false);
    });

    it('marks the control invalid and announces the error, from a region that was already there', () => {
        const { rerender } = render(
            <Field label="Email">
                <Input />
            </Field>,
        );
        const region = screen.getByRole('alert', { hidden: true });
        expect(region.hidden).toBe(true);
        rerender(
            <Field label="Email" error="Enter an email address.">
                <Input />
            </Field>,
        );
        expect(screen.getByRole('alert')).toBe(region);
        expect(region.textContent).toBe('Enter an email address.');
        const input = screen.getByLabelText('Email');
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toBe(region.id);
    });

    it('says required in words through the host translator, and marks the control required', () => {
        render(
            <CboxLocalizationProvider locale="da" translate={(message) => ({ '(required)': '(påkrævet)', '(optional)': '(valgfri)' })[message] ?? message}>
                <Field label="Name" required>
                    <Input />
                </Field>
                <Field label="Note" optional>
                    <Textarea />
                </Field>
            </CboxLocalizationProvider>,
        );
        expect(screen.getByText('(påkrævet)').className).toContain('cbx-ui-sr-only');
        expect(screen.getByText('(valgfri)')).toBeTruthy();
        expect(screen.getByRole('textbox', { name: /Name/ })).toHaveProperty('required', true);
        expect(screen.getByRole('textbox', { name: /Note/ }).tagName).toBe('TEXTAREA');
    });

    it('uses a stated id and keeps a label action on the label row', () => {
        render(
            <Field label="Password" id="password" labelAction={<a href="/forgot">Forgot password?</a>}>
                <Input type="password" />
            </Field>,
        );
        expect(document.getElementById('password')!.tagName).toBe('INPUT');
        expect(screen.getByRole('link', { name: 'Forgot password?' }).parentElement!.className).toContain('cbx-ui-field-head');
    });

    it('an Input outside a Field is bare and props given win', () => {
        render(<Input aria-label="Search" scale="lg" />);
        const input = screen.getByRole('textbox', { name: 'Search' });
        expect(input.className.split(' ')).toEqual(['cbx-ui-input', 'cbx-ui-input--lg']);
        expect(input.hasAttribute('id')).toBe(false);
    });
});

describe('fields on a phone', () => {
    const css = readFileSync(join(process.cwd(), 'tokens/controls.css'), 'utf8');

    it('inputs and textareas are 16px below 768px, so iOS does not zoom into them', () => {
        expect(css).toMatch(/@media \(max-width: 767px\) \{ \.cbx-ui-input, \.cbx-ui-input--lg \{ font-size: 16px; \} \}/);
    });

    it('the tokens import brings the controls', () => {
        expect(readFileSync(join(process.cwd(), 'tokens/cbox.css'), 'utf8')).toContain("@import './controls.css';");
    });
});

describe('Checkbox', () => {
    function Harness({ initial = false as boolean | 'indeterminate', onChange = (_: boolean) => undefined }) {
        const [checked, setChecked] = useState(initial);
        return (
            <Checkbox
                checked={checked}
                onCheckedChange={(next) => {
                    setChecked(next);
                    onChange(next);
                }}
                label="Send me the weekly summary"
                hint="Every Monday."
            />
        );
    }

    it('toggles from its label and is described by its hint', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        const box = screen.getByRole('checkbox', { name: 'Send me the weekly summary' });
        expect(box.getAttribute('aria-describedby')).toBe(screen.getByText('Every Monday.').id);
        fireEvent.click(screen.getByText('Send me the weekly summary'));
        expect(onChange).toHaveBeenLastCalledWith(true);
        expect(box).toHaveProperty('checked', true);
    });

    it('indeterminate is mixed, and a click checks it', () => {
        const onChange = vi.fn();
        render(<Harness initial="indeterminate" onChange={onChange} />);
        const box = screen.getByRole('checkbox') as HTMLInputElement;
        expect(box.indeterminate).toBe(true);
        expect(box.getAttribute('aria-checked')).toBe('mixed');
        fireEvent.click(box);
        expect(onChange).toHaveBeenLastCalledWith(true);
        expect(box.indeterminate).toBe(false);
    });
});

describe('RadioGroup', () => {
    it('is a labelled group of native radios sharing one name', () => {
        const onValueChange = vi.fn();
        render(
            <RadioGroup
                label="Region"
                value="hel1"
                onValueChange={onValueChange}
                options={[
                    { value: 'hel1', label: 'Helsinki' },
                    { value: 'fra1', label: 'Frankfurt', hint: 'Closest to Denmark.' },
                    { value: 'nyc1', label: 'New York', disabled: true },
                ]}
            />,
        );
        const group = screen.getByRole('radiogroup', { name: 'Region' });
        const radios = screen.getAllByRole('radio') as HTMLInputElement[];
        expect(group.contains(radios[0]!)).toBe(true);
        expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
        expect(radios[0]!.checked).toBe(true);
        expect(radios[2]!.disabled).toBe(true);
        expect(screen.getByRole('radio', { name: 'Frankfurt' }).getAttribute('aria-describedby')).toBe(screen.getByText('Closest to Denmark.').id);
        fireEvent.click(screen.getByText('Frankfurt'));
        expect(onValueChange).toHaveBeenCalledWith('fra1');
    });
});

describe('Switch', () => {
    it('is a switch that toggles, named by its Field', () => {
        const onCheckedChange = vi.fn();
        render(
            <Field label="Maintenance mode">
                <Switch checked={false} onCheckedChange={onCheckedChange} />
            </Field>,
        );
        const toggle = screen.getByRole('switch', { name: 'Maintenance mode' });
        expect(toggle.getAttribute('aria-checked')).toBe('false');
        expect(toggle.hasAttribute('required')).toBe(false);
        fireEvent.click(toggle);
        expect(onCheckedChange).toHaveBeenCalledWith(true);
    });
});

describe('Dialog', () => {
    function Harness({ children, footer }: { children?: ReactNode; footer?: ReactNode }) {
        const [open, setOpen] = useState(false);
        return (
            <>
                <button type="button" onClick={() => setOpen(true)}>
                    Open
                </button>
                <Dialog open={open} onOpenChange={setOpen} title="Delete project" description="This removes every environment." footer={footer}>
                    {children}
                </Dialog>
            </>
        );
    }

    function openIt() {
        const opener = screen.getByRole('button', { name: 'Open' });
        opener.focus();
        fireEvent.click(opener);
        return opener;
    }

    it('is a modal dialog named by its title and described by its description', () => {
        render(<Harness />);
        openIt();
        const dialog = screen.getByRole('dialog', { name: 'Delete project' });
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.getAttribute('aria-describedby')).toBe(screen.getByText('This removes every environment.').id);
    });

    it('moves focus to the first field, or to the close button and never a footer action', () => {
        const { unmount } = render(
            <Harness footer={<Button variant="danger">Delete</Button>}>
                <Input aria-label="Type the name" />
            </Harness>,
        );
        openIt();
        expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Type the name' }));
        unmount();

        render(<Harness footer={<Button variant="danger">Delete</Button>} />);
        openIt();
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    });

    it('keeps Tab inside, both ways', () => {
        render(
            <Harness footer={<Button>Delete</Button>}>
                <Input aria-label="Name" />
            </Harness>,
        );
        openIt();
        const close = screen.getByRole('button', { name: 'Close' });
        const last = screen.getByRole('button', { name: 'Delete' });
        last.focus();
        fireEvent.keyDown(last, { key: 'Tab' });
        expect(document.activeElement).toBe(close);
        fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(last);
    });

    it('makes the page behind inert and holds its scroll while open', () => {
        render(<Harness />);
        openIt();
        const page = screen.getByRole('button', { name: 'Open', hidden: true }).closest('body > div')!;
        expect(page.hasAttribute('inert')).toBe(true);
        expect(scrollLockCount()).toBe(1);
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(page.hasAttribute('inert')).toBe(false);
        expect(scrollLockCount()).toBe(0);
    });

    it('closes on Escape and gives focus back to what opened it', () => {
        render(<Harness />);
        const opener = openIt();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(opener);
    });

    it('leaves Escape to a control inside that handled it', () => {
        render(
            <Harness>
                <input aria-label="Picker" onKeyDown={(event) => event.key === 'Escape' && event.preventDefault()} />
            </Harness>,
        );
        openIt();
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Picker' }), { key: 'Escape' });
        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('closes from the close button, DialogClose and a click on the scrim', () => {
        render(<Harness footer={<DialogClose>Cancel</DialogClose>} />);
        openIt();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).toBeNull();

        openIt();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).toBeNull();

        openIt();
        const scrim = document.querySelector('.cbx-ui-overlay')!;
        act(() => {
            fireEvent.mouseDown(scrim);
            fireEvent.click(scrim);
        });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('a scrim click does not close a dialog that is not dismissible', () => {
        const onOpenChange = vi.fn();
        render(<Dialog open onOpenChange={onOpenChange} title="Edit" dismissible={false} />);
        const scrim = document.querySelector('.cbx-ui-overlay')!;
        fireEvent.mouseDown(scrim);
        fireEvent.click(scrim);
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('translates the close button through the host', () => {
        render(
            <CboxLocalizationProvider locale="da" translate={(message) => (message === 'Close' ? 'Luk' : message)}>
                <Dialog open onOpenChange={() => undefined} title="Rediger" />
            </CboxLocalizationProvider>,
        );
        expect(screen.getByRole('button', { name: 'Luk' })).toBeTruthy();
    });
});
