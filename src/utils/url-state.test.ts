import { describe, expect, test } from 'vitest';
import {
    buildUrlSearch,
    defineUrlSchema,
    parseUrlSearch,
    urlBoolean,
    urlEnum,
    urlNumber,
    urlString,
    urlStringArray,
} from './url-state';

describe('urlString', () => {
    const schema = defineUrlSchema({ q: urlString('') });

    test('parses missing key as default', () => {
        expect(parseUrlSearch('', schema)).toEqual({ q: '' });
    });

    test('parses present key', () => {
        expect(parseUrlSearch('q=hello', schema)).toEqual({ q: 'hello' });
    });

    test('elides default value when serialising', () => {
        expect(buildUrlSearch({ q: '' }, schema)).toBe('');
    });

    test('serialises non-default value', () => {
        expect(buildUrlSearch({ q: 'hello' }, schema)).toBe('q=hello');
    });

    test('round-trips spaces and special chars', () => {
        const state = { q: 'foo bar & baz' };
        expect(parseUrlSearch(buildUrlSearch(state, schema), schema)).toEqual(
            state,
        );
    });
});

describe('urlNumber', () => {
    test('parses integer', () => {
        const schema = defineUrlSchema({ page: urlNumber(1) });
        expect(parseUrlSearch('page=5', schema)).toEqual({ page: 5 });
    });

    test('falls back to default when missing', () => {
        const schema = defineUrlSchema({ page: urlNumber(1) });
        expect(parseUrlSearch('', schema)).toEqual({ page: 1 });
    });

    test('falls back to default when non-numeric', () => {
        const schema = defineUrlSchema({ page: urlNumber(1) });
        expect(parseUrlSearch('page=abc', schema)).toEqual({ page: 1 });
    });

    test('clamps to min', () => {
        const schema = defineUrlSchema({
            page: urlNumber(1, { min: 1 }),
        });
        expect(parseUrlSearch('page=-5', schema)).toEqual({ page: 1 });
    });

    test('clamps to max', () => {
        const schema = defineUrlSchema({
            n: urlNumber(0, { max: 100 }),
        });
        expect(parseUrlSearch('n=999', schema)).toEqual({ n: 100 });
    });

    test('elides default in build', () => {
        const schema = defineUrlSchema({ page: urlNumber(1) });
        expect(buildUrlSearch({ page: 1 }, schema)).toBe('');
    });

    test('serialises non-default', () => {
        const schema = defineUrlSchema({ page: urlNumber(1) });
        expect(buildUrlSearch({ page: 3 }, schema)).toBe('page=3');
    });
});

describe('urlEnum', () => {
    const roles = ['all', 'owner', 'admin'] as const;
    const schema = defineUrlSchema({ role: urlEnum(roles, 'all') });

    test('parses allowed value', () => {
        expect(parseUrlSearch('role=admin', schema)).toEqual({ role: 'admin' });
    });

    test('rejects unknown value back to default', () => {
        expect(parseUrlSearch('role=hacker', schema)).toEqual({ role: 'all' });
    });

    test('falls back when missing', () => {
        expect(parseUrlSearch('', schema)).toEqual({ role: 'all' });
    });

    test('elides default', () => {
        expect(buildUrlSearch({ role: 'all' as const }, schema)).toBe('');
    });

    test('serialises non-default', () => {
        expect(buildUrlSearch({ role: 'owner' as const }, schema)).toBe(
            'role=owner',
        );
    });
});

describe('urlBoolean', () => {
    const schema = defineUrlSchema({ archived: urlBoolean(false) });

    test('parses "true" as true', () => {
        expect(parseUrlSearch('archived=true', schema)).toEqual({
            archived: true,
        });
    });

    test('parses anything-not-true as false', () => {
        expect(parseUrlSearch('archived=1', schema)).toEqual({
            archived: false,
        });
        expect(parseUrlSearch('archived=yes', schema)).toEqual({
            archived: false,
        });
        expect(parseUrlSearch('archived=false', schema)).toEqual({
            archived: false,
        });
    });

    test('falls back to default when missing', () => {
        expect(parseUrlSearch('', schema)).toEqual({ archived: false });
    });

    test('elides default', () => {
        expect(buildUrlSearch({ archived: false }, schema)).toBe('');
    });

    test('serialises non-default', () => {
        expect(buildUrlSearch({ archived: true }, schema)).toBe(
            'archived=true',
        );
    });
});

describe('urlStringArray', () => {
    const schema = defineUrlSchema({ tags: urlStringArray() });

    test('parses comma-separated list', () => {
        expect(parseUrlSearch('tags=foo,bar,baz', schema)).toEqual({
            tags: ['foo', 'bar', 'baz'],
        });
    });

    test('skips empty entries from sloppy URLs', () => {
        expect(parseUrlSearch('tags=foo,,bar', schema)).toEqual({
            tags: ['foo', 'bar'],
        });
    });

    test('parses missing key as empty array', () => {
        expect(parseUrlSearch('', schema)).toEqual({ tags: [] });
    });

    test('elides empty default', () => {
        expect(buildUrlSearch({ tags: [] }, schema)).toBe('');
    });

    test('serialises non-empty', () => {
        expect(buildUrlSearch({ tags: ['a', 'b'] }, schema)).toBe('tags=a%2Cb');
    });

    test('respects custom default and elides matching value (order-insensitive)', () => {
        const s = defineUrlSchema({ tags: urlStringArray(['a', 'b']) });
        expect(buildUrlSearch({ tags: ['b', 'a'] }, s)).toBe('');
    });
});

describe('parseUrlSearch behaviour', () => {
    const schema = defineUrlSchema({
        q: urlString(''),
        page: urlNumber(1),
    });

    test('strips leading ?', () => {
        expect(parseUrlSearch('?q=hello&page=2', schema)).toEqual({
            q: 'hello',
            page: 2,
        });
    });

    test('ignores keys not in schema', () => {
        const result = parseUrlSearch('q=hi&undeclared=evil', schema);
        expect(result).toEqual({ q: 'hi', page: 1 });
        expect((result as Record<string, unknown>).undeclared).toBeUndefined();
    });
});

describe('buildUrlSearch behaviour', () => {
    const schema = defineUrlSchema({
        q: urlString(''),
        page: urlNumber(1),
        role: urlEnum(['all', 'owner'] as const, 'all'),
    });

    test('omits all fields when everything is default', () => {
        expect(
            buildUrlSearch(
                { q: '', page: 1, role: 'all' as const },
                schema,
            ),
        ).toBe('');
    });

    test('serialises only non-default fields', () => {
        expect(
            buildUrlSearch(
                { q: 'cat', page: 1, role: 'owner' as const },
                schema,
            ),
        ).toBe('q=cat&role=owner');
    });
});

describe('round-trip', () => {
    const schema = defineUrlSchema({
        q: urlString(''),
        page: urlNumber(1, { min: 1 }),
        role: urlEnum(['all', 'owner', 'admin'] as const, 'all'),
        archived: urlBoolean(false),
    });

    test('mixed state survives parse → build → parse', () => {
        const state = {
            q: 'sylvester',
            page: 4,
            role: 'admin' as const,
            archived: true,
        };
        const search = buildUrlSearch(state, schema);
        expect(parseUrlSearch(search, schema)).toEqual(state);
    });

    test('default state round-trips to empty string', () => {
        const state = parseUrlSearch('', schema);
        const search = buildUrlSearch(state, schema);
        expect(search).toBe('');
        expect(parseUrlSearch(search, schema)).toEqual(state);
    });
});
