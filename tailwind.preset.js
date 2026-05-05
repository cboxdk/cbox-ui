/**
 * Tailwind v3-compatible preset for consumers still on v3.
 *
 * Tailwind v4 apps should `@import '@cboxdk/cbox-ui/tokens'` directly
 * in their CSS instead of using this preset — v4's @theme directive
 * is the canonical token surface and supersedes this file.
 */
module.exports = {
    theme: {
        extend: {
            fontFamily: {
                sans: [
                    'Plus Jakarta Sans',
                    'Instrument Sans',
                    'ui-sans-serif',
                    'system-ui',
                    'sans-serif',
                ],
                display: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui'],
                mono: [
                    'JetBrains Mono',
                    'ui-monospace',
                    'SFMono-Regular',
                    'Menlo',
                    'Monaco',
                    'monospace',
                ],
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            colors: {
                background: 'var(--background)',
                foreground: 'var(--foreground)',
                canvas: 'var(--canvas)',
                card: {
                    DEFAULT: 'var(--card)',
                    foreground: 'var(--card-foreground)',
                },
                popover: {
                    DEFAULT: 'var(--popover)',
                    foreground: 'var(--popover-foreground)',
                },
                primary: {
                    DEFAULT: 'var(--primary)',
                    foreground: 'var(--primary-foreground)',
                },
                secondary: {
                    DEFAULT: 'var(--secondary)',
                    foreground: 'var(--secondary-foreground)',
                },
                muted: {
                    DEFAULT: 'var(--muted)',
                    foreground: 'var(--muted-foreground)',
                },
                accent: {
                    DEFAULT: 'var(--accent)',
                    foreground: 'var(--accent-foreground)',
                    soft: 'var(--accent-soft)',
                    edge: 'var(--accent-edge)',
                },
                success: {
                    DEFAULT: 'var(--success)',
                    foreground: 'var(--success-foreground)',
                    soft: 'var(--success-soft)',
                },
                warning: {
                    DEFAULT: 'var(--warning)',
                    foreground: 'var(--warning-foreground)',
                    soft: 'var(--warning-soft)',
                },
                info: {
                    DEFAULT: 'var(--info)',
                    soft: 'var(--info-soft)',
                },
                destructive: {
                    DEFAULT: 'var(--destructive)',
                    foreground: 'var(--destructive-foreground)',
                    soft: 'var(--destructive-soft)',
                },
                border: 'var(--border)',
                input: 'var(--input)',
                ring: 'var(--ring)',
                sidebar: {
                    DEFAULT: 'var(--sidebar)',
                    foreground: 'var(--sidebar-foreground)',
                    muted: 'var(--sidebar-muted)',
                    accent: 'var(--sidebar-accent)',
                    'accent-foreground': 'var(--sidebar-accent-foreground)',
                    border: 'var(--sidebar-border)',
                    ring: 'var(--sidebar-ring)',
                },
            },
        },
    },
};
