import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataPanel } from './data-panel';
import { RowLink } from './row-link';

describe('rows inside a rounded panel', () => {
    it('marks the panel and its rows so edge rows follow the corner', () => {
        const html = renderToStaticMarkup(
            <DataPanel>
                <RowLink href="/a">A</RowLink>
                <RowLink href="/b">B</RowLink>
            </DataPanel>,
        );
        expect(html).toMatch(/<section class="cbx-panel /);
        expect(html.match(/<a href="\/[ab]" class="cbx-row /g)).toHaveLength(2);
    });

    it('rounds edge rows in the tokens without clipping the panel', () => {
        const css = readFileSync(new URL('../../tokens/cbox.css', import.meta.url), 'utf8');
        expect(css).toContain('--cbx-row-radius: calc(var(--cbx-panel-radius) - 1px)');
        expect(css).toContain(':where(.cbx-panel) > .cbx-row:first-child');
        expect(css).toContain(':where(.cbx-panel) > .cbx-row:last-child');
        expect(css).not.toMatch(/\.cbx-panel\s*\{[^}]*overflow/);
    });
});
