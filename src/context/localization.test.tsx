import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CboxLocalizationProvider, interpolate } from './localization';
import { Combobox } from '../primitives/combobox';

function Controls() {
    return <Combobox items={[]} value="" onChange={() => {}} ariaLabel="Choice" />;
}

describe('host localization', () => {
    it('preserves English for existing consumers without a provider', () => {
        const html = renderToStaticMarkup(<Controls />);
        expect(html).toContain('Select…');
    });

    it('translates visible copy and accessible labels without changing consumer content', () => {
        const messages: Record<string, string> = { 'Select…': 'Vælg…' };
        const html = renderToStaticMarkup(<CboxLocalizationProvider locale="da" translate={(message, values) => interpolate(messages[message] ?? message, values)}><Controls /></CboxLocalizationProvider>);
        expect(html).toContain('Vælg…');
        expect(html).toContain('aria-label="Choice"');
        expect(html).not.toContain('Select…');
    });

    it('uses named placeholders without interpreting caller values as markup', () => {
        expect(interpolate('Switch {name}', {name: '<script>alert(1)</script>'})).toBe('Switch <script>alert(1)</script>');
        expect(interpolate('{missing} / {count}', {count: 3})).toBe('{missing} / 3');
    });
});
