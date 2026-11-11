import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * WCAG AA (4.5:1) for small text in the tone colours, checked on the tokens as published: a tone's
 * text token on its own soft tint, laid over a card, the canvas and the background, in light and
 * dark. StatusPill (11px) and StatTile use these; so does the StatTile caption (muted on a card).
 */

const css = readFileSync(new URL('../../tokens/cbox.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
    const start = css.indexOf(`${selector} {`);
    const body = css.slice(start, css.indexOf('\n}', start));
    return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(match => [match[1]!, match[2]!.trim()]));
}

type Rgb = [number, number, number];

/** `oklch(L C H [/ A])` to sRGB (0–1) and alpha. */
function parse(value: string): { rgb: Rgb; alpha: number } {
    const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)/.exec(value);
    if (match === null) throw new Error(`Not an oklch colour: ${value}`);
    const [L, C, H] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const h = (H * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const linear = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    const encode = (x: number) => {
        const c = Math.min(1, Math.max(0, x));
        return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    };
    return { rgb: linear.map(encode) as Rgb, alpha: match[4] === undefined ? 1 : Number(match[4]) };
}

const over = (top: Rgb, alpha: number, below: Rgb): Rgb => top.map((c, i) => c * alpha + below[i]! * (1 - alpha)) as Rgb;
const luminance = (rgb: Rgb) => {
    const [r, g, b] = rgb.map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as Rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const light = block(':root');
const dark = { ...light, ...block(".dark,\n[data-theme='dark']") };

describe.each([['light', light], ['dark', dark]] as const)('%s', (_, tokens) => {
    const solid = (name: string) => parse(tokens[name]!).rgb;

    it.each(['success', 'info', 'warning', 'destructive'])('%s text reads at 4.5:1 on its soft tint', tone => {
        for (const surface of ['card', 'canvas', 'background']) {
            const soft = parse(tokens[`${tone}-soft`]!);
            const behind = over(soft.rgb, soft.alpha, solid(surface));
            expect(contrast(solid(`${tone}-text`), behind), `${tone}-text on ${tone}-soft over ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('muted text reads at 4.5:1 on a card and the canvas', () => {
        expect(contrast(solid('muted-foreground'), solid('card'))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(solid('muted-foreground'), solid('canvas'))).toBeGreaterThanOrEqual(4.5);
    });
});
