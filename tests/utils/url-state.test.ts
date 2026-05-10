import { describe, expect, it } from 'bun:test';
import {
    buildUrlSearch,
    defineUrlSchema,
    parseUrlSearch,
    urlEnum,
    urlString,
} from '../../src/utils/url-state';

describe('url-state', () => {
    const schema = defineUrlSchema({
        q: urlString(''),
        tier: urlEnum(['all', 'low', 'high'] as const, 'all'),
    });

    it('parses missing keys to defaults', () => {
        expect(parseUrlSearch('', schema)).toEqual({ q: '', tier: 'all' });
    });

    it('parses present keys to typed values', () => {
        expect(parseUrlSearch('?q=foo&tier=high', schema)).toEqual({
            q: 'foo',
            tier: 'high',
        });
    });

    it('drops invalid enum values back to default', () => {
        expect(parseUrlSearch('?tier=bogus', schema)).toEqual({
            q: '',
            tier: 'all',
        });
    });

    it('serialises non-default values, omits defaults', () => {
        expect(buildUrlSearch({ q: 'hi', tier: 'all' }, schema)).toBe('q=hi');
        expect(buildUrlSearch({ q: '', tier: 'high' }, schema)).toBe('tier=high');
        expect(buildUrlSearch({ q: '', tier: 'all' }, schema)).toBe('');
    });
});
