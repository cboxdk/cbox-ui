import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CboxLocalizationProvider, interpolate } from './localization';
import { SearchTrigger } from '../components/search-trigger';
import { Combobox } from '../primitives/combobox';
import { ContextBar } from '../primitives/context-bar';

function Controls() {
    return <>
        <SearchTrigger />
        <Combobox items={[]} value="" onChange={() => {}} ariaLabel="Choice" />
        <ContextBar crumbs={[{ id: 'workspace', label: 'Workspace', items: [] }]} />
    </>;
}

describe('host localization', () => {
    it('preserves English for existing consumers without a provider', () => {
        const html = renderToStaticMarkup(<Controls />);
        expect(html).toContain('Open command palette');
        expect(html).toContain('Select…');
        expect(html).toContain('aria-label="Context"');
    });

    it('translates visible copy and accessible labels without changing consumer content', () => {
        const messages: Record<string, string> = {
            Search: 'Søg', 'Open command palette': 'Åbn søgning',
            'Select…': 'Vælg…', Context: 'Kontekst',
        };
        const html = renderToStaticMarkup(<CboxLocalizationProvider locale="da" translate={(message, values) => interpolate(messages[message] ?? message, values)}><Controls /></CboxLocalizationProvider>);
        expect(html).toContain('Åbn søgning');
        expect(html).toContain('Søg');
        expect(html).toContain('Vælg…');
        expect(html).toContain('aria-label="Kontekst"');
        expect(html).toContain('aria-label="Choice"');
        expect(html).not.toContain('Open command palette');
    });

    it('uses named placeholders without interpreting caller values as markup', () => {
        expect(interpolate('Switch {name}', {name: '<script>alert(1)</script>'})).toBe('Switch <script>alert(1)</script>');
        expect(interpolate('{missing} / {count}', {count: 3})).toBe('{missing} / 3');
    });
});
