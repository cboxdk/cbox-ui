/**
 * The elements' own styles. They live in each element's shadow root, so no host stylesheet
 * reaches them (no reset, no `button` rule, no `img` rule, no missing preflight), and they
 * never reach the host page. The only thing taken from the host is its Cbox colour tokens,
 * which inherit into the shadow root as custom properties; every token has a fallback, so an
 * app without them still draws the same control.
 */
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', ui-sans-serif, system-ui, Arial, sans-serif";

const PALETTE = `
.root {
    --fg: var(--foreground, #1f1d1a);
    --muted-fg: var(--muted-foreground, #6b665e);
    --surface: var(--popover, #ffffff);
    --line: var(--border, #e6e3dd);
    --hover: var(--secondary, #f2f0ec);
    --tile: var(--muted, #f2f0ec);
    --current: var(--accent-soft, #eef2ff);
    --accent: var(--accent-strong, var(--primary, #2f5bd3));
    --focus: var(--ring, #2f5bd3);
    --shadow: var(--shadow-popover, 0 10px 30px -8px rgb(0 0 0 / 0.18), 0 2px 6px rgb(0 0 0 / 0.06));
}
.root.dark {
    --fg: var(--foreground, #f3f2ef);
    --muted-fg: var(--muted-foreground, #a29d94);
    --surface: var(--popover, #24221f);
    --line: var(--border, #3a3733);
    --hover: var(--secondary, #312e2a);
    --tile: var(--muted, #312e2a);
    --current: var(--accent-soft, #26304a);
    --accent: var(--accent-strong, var(--primary, #8aa6ff));
    --focus: var(--ring, #8aa6ff);
    --shadow: var(--shadow-popover, 0 10px 30px -8px rgb(0 0 0 / 0.6), 0 2px 6px rgb(0 0 0 / 0.3));
}`;

const ICON = `
.icon { position: relative; display: inline-flex; flex: none; align-items: center; justify-content: center; width: var(--size, 24px); height: var(--size, 24px); }
.icon img { display: block; width: 100%; height: 100%; max-width: none; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none; object-fit: contain; }
.icon img.on-dark { display: none; }
.root.dark .icon img.on-light { display: none; }
.root.dark .icon img.on-dark { display: block; }
.icon.initials { border-radius: 6px; background: var(--tile); color: var(--fg); font: 600 10px/1 ${FONT}; letter-spacing: 0; text-transform: none; }`;

export const SWITCHER_CSS = `
:host { all: initial; display: inline-flex; flex: none; vertical-align: middle; }
:host([hidden]) { display: none; }
*, *::before, *::after { box-sizing: border-box; }
${PALETTE}
.root { display: inline-flex; color: var(--fg); font: 400 13px/1.4 ${FONT}; }
.trigger {
    all: unset; box-sizing: border-box; display: inline-grid; place-items: center;
    width: 32px; height: 32px; border-radius: 8px; color: var(--fg); background: transparent; cursor: pointer;
    transition: background-color 150ms cubic-bezier(.4, 0, .2, 1);
}
.trigger svg { display: block; width: 18px; height: 18px; fill: currentColor; }
.trigger:hover, .trigger[aria-expanded='true'] { background: var(--hover); }
.trigger:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.trigger:disabled { cursor: default; opacity: .6; background: transparent; }
.panel {
    position: fixed; inset: auto; top: 0; left: 0; margin: 0; z-index: 2147483000;
    width: min(292px, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow-y: auto;
    padding: 12px; border: 1px solid var(--line); border-radius: 12px;
    background: var(--surface); color: var(--fg); box-shadow: var(--shadow);
    font: 400 13px/1.4 ${FONT}; text-align: left; outline: none;
}
.panel[hidden] { display: none; }
.panel h2 { margin: 0 4px 8px; padding: 0; color: var(--fg); font: 600 14px/1.4 ${FONT}; letter-spacing: 0; text-transform: none; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; margin: 0; padding: 0; }
.tile {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
    min-width: 0; min-height: 60px; padding: 8px 4px; border-radius: 8px;
    color: var(--fg); background: transparent; font: 500 13px/1.25 ${FONT}; text-align: center; text-decoration: none; overflow-wrap: anywhere;
}
.tile:hover { background: var(--hover); }
.tile[aria-current='true'] { background: var(--current); }
.tile:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.tile .label { max-width: 100%; }
.check { position: absolute; top: 5px; right: 8px; width: 12px; height: 12px; color: var(--accent); }
.check svg { display: block; width: 12px; height: 12px; }
.message { margin: 0; padding: 8px 4px; color: var(--muted-fg); font: 400 13px/1.4 ${FONT}; }
${ICON}
@media (prefers-reduced-motion: reduce) { .trigger { transition: none; } }`;

export const MARK_CSS = `
:host { all: initial; display: inline-flex; flex: none; align-items: center; justify-content: center; vertical-align: middle; }
:host([hidden]) { display: none; }
${PALETTE}
.root { display: inline-flex; --size: var(--cbox-service-mark-size, 24px); }
${ICON}`;

const sheets = new Map<string, CSSStyleSheet | null>();

/**
 * Attach `css` to a shadow root. A constructed stylesheet is shared by every element and is not
 * subject to the page's `style-src` CSP; a `<style>` element is the fallback for engines without one.
 */
export function adopt(root: ShadowRoot, css: string): void {
    if (!sheets.has(css)) {
        let sheet: CSSStyleSheet | null = null;
        try {
            if ('adoptedStyleSheets' in Document.prototype && typeof CSSStyleSheet === 'function') {
                sheet = new CSSStyleSheet();
                sheet.replaceSync(css);
            }
        } catch {
            sheet = null;
        }
        sheets.set(css, sheet);
    }
    const sheet = sheets.get(css);
    if (sheet) {
        root.adoptedStyleSheets = [sheet];
        return;
    }
    const style = document.createElement('style');
    style.textContent = css;
    root.append(style);
}
