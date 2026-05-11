/**
 * URL-as-state — typed query-string parsing and serialization.
 *
 * The contract: anything that should survive a hard refresh, deep
 * link, or paste-share lives in the URL, not in React state. Tabs,
 * filters, search terms, pagination, sort order — every one of those
 * is a navigation, not a UI mutation. This module provides the typed
 * parsers and serializers; per-app adapters wire them to the host
 * router (Inertia's `router.get`, TanStack Router's `navigate`, etc.)
 * and shape the `[state, update]` ergonomics on top.
 *
 * Why not URLSearchParams directly? Because raw query strings throw
 * away types and have no notion of defaults. The schema declares both
 * once, and `buildUrlSearch` automatically elides values that match
 * their default so the URL stays human-readable. `?role=all&page=1`
 * collapses to `''` when `all` and `1` are the defaults. Going from
 * `state -> URL -> state` always round-trips.
 */

/**
 * A single field in a URL schema. Encapsulates the three operations
 * that make typed URL state work:
 *   - `parse(raw)`   — string|null from the query string → typed value
 *   - `serialize(v)` — typed value → string|null (null = drop the key)
 *   - `isDefault(v)` — does this value equal the field's default? If
 *                     so, `buildUrlSearch` elides it to keep URLs short.
 */
export type UrlField<T> = {
    parse: (raw: string | null) => T;
    serialize: (value: T) => string | null;
    isDefault: (value: T) => boolean;
};

// `UrlField<unknown>` would block assignment from concrete fields
// (variance: T appears in both contravariant and covariant positions).
// `UrlField<any>` is the standard escape hatch; safety lives in
// `InferUrlState` which keeps the value-side fully typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UrlSchema = Record<string, UrlField<any>>;

/**
 * Map a UrlSchema to its inferred state shape — `urlString('')` →
 * `string`, `urlEnum(['a', 'b'], 'a')` → `'a' | 'b'`, etc.
 */
export type InferUrlState<S extends UrlSchema> = {
    [K in keyof S]: S[K] extends UrlField<infer T> ? T : never;
};

/**
 * String field. The empty string is the conventional "absent" value
 * — it's what an HTML input gives you when the user clears it — so
 * we treat `'' === default` as "drop the param" by default. Pass an
 * explicit non-empty default if you genuinely want to persist `''`.
 */
export function urlString(defaultValue: string = ''): UrlField<string> {
    return {
        parse: (raw) => raw ?? defaultValue,
        serialize: (value) => (value === '' ? null : value),
        isDefault: (value) => value === defaultValue,
    };
}

/**
 * Integer field with optional clamping. Non-numeric input falls back
 * to the default rather than NaN; out-of-range input clamps to the
 * boundary. Both behaviours are belt-and-braces against URL tampering.
 */
export function urlNumber(
    defaultValue: number,
    options: { min?: number; max?: number } = {},
): UrlField<number> {
    const clamp = (n: number): number => {
        if (options.min !== undefined && n < options.min) return options.min;
        if (options.max !== undefined && n > options.max) return options.max;

        return n;
    };

    return {
        parse: (raw) => {
            if (raw === null) return defaultValue;
            const parsed = Number.parseInt(raw, 10);
            if (Number.isNaN(parsed)) return defaultValue;

            return clamp(parsed);
        },
        serialize: (value) => String(value),
        isDefault: (value) => value === defaultValue,
    };
}

/**
 * Enum field — restrict to a fixed set of strings. Unknown values
 * fall back to the default rather than poisoning typed downstream
 * code with arbitrary user input. The `as const` on the values array
 * is what lets TS narrow the field type to the union.
 */
export function urlEnum<T extends string>(
    values: readonly T[],
    defaultValue: T,
): UrlField<T> {
    const allowed = new Set<string>(values);

    return {
        parse: (raw) =>
            raw !== null && allowed.has(raw) ? (raw as T) : defaultValue,
        serialize: (value) => value,
        isDefault: (value) => value === defaultValue,
    };
}

/**
 * Boolean field. Only the literal string `'true'` parses to true so
 * we don't accidentally interpret `?flag=0` or `?flag=false` as truthy.
 */
export function urlBoolean(defaultValue: boolean = false): UrlField<boolean> {
    return {
        parse: (raw) => (raw === null ? defaultValue : raw === 'true'),
        serialize: (value) => (value ? 'true' : 'false'),
        isDefault: (value) => value === defaultValue,
    };
}

/**
 * Array-of-strings field — comma-joined in the URL. Useful for
 * multi-select filters (`?tags=foo,bar,baz`). Empty arrays drop the
 * param. Per-item parsing isn't customisable on purpose; if you need
 * a typed array of enums or numbers, build a thin wrapper.
 */
export function urlStringArray(
    defaultValue: readonly string[] = [],
): UrlField<string[]> {
    const defaultKey = [...defaultValue].sort().join(',');

    return {
        parse: (raw) => {
            if (raw === null || raw === '') return [...defaultValue];

            return raw.split(',').filter((item) => item !== '');
        },
        serialize: (value) => (value.length === 0 ? null : value.join(',')),
        isDefault: (value) => [...value].sort().join(',') === defaultKey,
    };
}

/**
 * Convenience: declare a schema. Pure passthrough — exists to give
 * call sites a single, named import that reads like a definition
 * rather than a bare object literal.
 */
export function defineUrlSchema<S extends UrlSchema>(schema: S): S {
    return schema;
}

/**
 * Parse a query string into a typed state object. Accepts both
 * leading-`?` and bare forms. Unknown keys are silently dropped —
 * the schema is the closed allow-list, which keeps server- and
 * client-readable surface area bounded.
 */
export function parseUrlSearch<S extends UrlSchema>(
    search: string,
    schema: S,
): InferUrlState<S> {
    const normalised = search.startsWith('?') ? search.slice(1) : search;
    const params = new URLSearchParams(normalised);
    const state = {} as InferUrlState<S>;

    for (const key of Object.keys(schema)) {
        const field = schema[key];
        if (field === undefined) continue;
        (state as Record<string, unknown>)[key] = field.parse(params.get(key));
    }

    return state;
}

/**
 * Serialize a typed state back to a query string. Default-valued
 * fields are elided so URLs stay short and bookmarks stay portable
 * across schema changes (a URL with `?page=1` keeps working when
 * `page` later stops being serialised because it's the default).
 *
 * Returns the serialised query without a leading `?`. The host
 * adapter is responsible for prepending or stitching it onto a path.
 */
export function buildUrlSearch<S extends UrlSchema>(
    state: InferUrlState<S>,
    schema: S,
): string {
    const params = new URLSearchParams();

    for (const key of Object.keys(schema)) {
        const field = schema[key];
        if (field === undefined) continue;
        const value = (state as Record<string, unknown>)[key];

        if (field.isDefault(value)) continue;

        const serialized = field.serialize(value);
        if (serialized !== null) {
            params.set(key, serialized);
        }
    }

    return params.toString();
}
