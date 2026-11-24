import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type CboxTranslationValues = Record<string, string | number>;
export type CboxTranslator = (message: string, values?: CboxTranslationValues) => string;

/** Hosts own catalogs; the shared components never guess a person's language. */
const Localization = createContext<{ locale: string; t: CboxTranslator; formatDate: (value: string) => string }>({
    locale: 'en',
    t: interpolate,
    formatDate: (value) => new Date(value).toLocaleString(),
});

export function interpolate(message: string, values: CboxTranslationValues = {}): string {
    return message.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, key: string) =>
        Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
    );
}

/** Optional and additive: without a provider existing consumers retain English. */
export function CboxLocalizationProvider({ locale, translate, formatDate = defaultDate, children }: {
    locale: string;
    translate: CboxTranslator;
    formatDate?: (value: string) => string;
    children: ReactNode;
}) {
    const value = useMemo(() => ({ locale, t: translate, formatDate }), [locale, translate, formatDate]);
    return <Localization.Provider value={value}>{children}</Localization.Provider>;
}

export function useCboxLocalization() {
    return useContext(Localization);
}

function defaultDate(value: string): string {
    return new Date(value).toLocaleString();
}

/**
 * A label as a word inside a sentence ("New {thing}", "Discard {thing}?"): its first letter in
 * lower case, nothing else. A label that starts with an acronym ("API key", "DNS record") keeps
 * it, and German keeps every capital because its nouns are written with one. Lowercasing the whole
 * label broke a catalog's own capitals ("Domæne, I ejer" became "domæne, i ejer").
 */
export function inSentence(label: string, locale: string): string {
    const language = locale.toLowerCase().split(/[-_]/)[0];
    if (language === 'de' || language === 'lb') return label;
    const [first = '', second = ''] = Array.from(label);
    if (second !== '' && second !== second.toLowerCase()) return label;
    return first.toLocaleLowerCase(locale) + label.slice(first.length);
}
