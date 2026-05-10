export type UrlField<T> = {
    parse: (raw: string | null) => T;
    serialize: (value: T) => string | null;
    default: T;
};

export type UrlSchema = Record<string, UrlField<unknown>>;

export type InferUrlState<S extends UrlSchema> = {
    [K in keyof S]: S[K] extends UrlField<infer T> ? T : never;
};

/**
 * String field for URL state.
 *
 * Parse contract:
 *  - missing param (`null` from `URLSearchParams.get`) → default value
 *  - explicit empty (`?q=`) → empty string
 *
 * When the default is `''`, both forms collapse to `''` — equivalent.
 * When the default is non-empty (e.g. `urlString('all')`), `?q=` gives
 * you `''` (not `'all'`), and a missing `q` gives you `'all'`. The
 * serializer omits any value equal to the default, so non-default
 * values round-trip stably regardless.
 */
export function urlString(defaultValue = ''): UrlField<string> {
    return {
        parse: (raw) => (raw ?? defaultValue),
        serialize: (value) => (value === defaultValue ? null : value),
        default: defaultValue,
    };
}

/**
 * Enum field. Values outside the allowed set fall back to the
 * default; the URL is the wire — be defensive.
 */
export function urlEnum<const T extends readonly string[]>(
    values: T,
    defaultValue: T[number],
): UrlField<T[number]> {
    return {
        parse: (raw) => {
            if (raw === null) return defaultValue;
            return (values as readonly string[]).includes(raw)
                ? (raw as T[number])
                : defaultValue;
        },
        serialize: (value) => (value === defaultValue ? null : value),
        default: defaultValue,
    };
}

export function defineUrlSchema<S extends UrlSchema>(schema: S): S {
    return schema;
}

export function parseUrlSearch<S extends UrlSchema>(
    search: string,
    schema: S,
): InferUrlState<S> {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const out = {} as InferUrlState<S>;
    for (const key of Object.keys(schema)) {
        const field = schema[key]!;
        (out as Record<string, unknown>)[key] = field.parse(params.get(key));
    }
    return out;
}

export function buildUrlSearch<S extends UrlSchema>(
    state: InferUrlState<S>,
    schema: S,
): string {
    const out = new URLSearchParams();
    for (const key of Object.keys(schema)) {
        const field = schema[key]!;
        const value = (state as Record<string, unknown>)[key];
        const serialised = field.serialize(value);
        if (serialised !== null) {
            out.set(key, serialised);
        }
    }
    return out.toString();
}
