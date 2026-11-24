import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CboxLocalizationProvider, inSentence, interpolate } from './localization';
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

describe('a label inside a sentence', () => {
    it('lowers only the first letter and keeps the catalog’s own capitals', () => {
        expect(inSentence('Domain you own', 'en')).toBe('domain you own');
        expect(inSentence('Domæne, I ejer', 'da')).toBe('domæne, I ejer');
        expect(inSentence('Status page', 'en-GB')).toBe('status page');
    });

    it('keeps a leading acronym and every German capital', () => {
        expect(inSentence('API key', 'en')).toBe('API key');
        expect(inSentence('DNS record', 'da')).toBe('DNS record');
        expect(inSentence('Eigene Domain', 'de')).toBe('Eigene Domain');
        expect(inSentence('Organisation', 'de-AT')).toBe('Organisation');
    });

    it('takes the locale as the app writes it, so a Laravel locale or none never breaks the shell', () => {
        expect(inSentence('Domæne, I ejer', 'da_DK')).toBe('domæne, I ejer');
        expect(inSentence('Chave de API', 'pt_BR')).toBe('chave de API');
        expect(inSentence('Eigene Domain', 'de_CH')).toBe('Eigene Domain');
        expect(inSentence('Status page', '')).toBe('status page');
    });
});
