# Changelog

## 0.7.0 — unreleased on npm until published

- Charts on ECharts in `@cboxdk/cbox-ui/charts`: `TimeChart` (events, per-series lines, zoom) and the `Chart` wrapper; `echarts` ^6 is an optional peer dependency. `Sparkline`, `niceTicks` and `timeTicks` stay in the root entry without ECharts.
- Included from main since 0.6.0: aligned core tokens and two-tier workspace navigation (`CboxWorkspaceShell`), host-owned localization for shared chrome (`CboxLocalizationProvider`), compact context and service branding on mobile, organization breadcrumb avatar geometry. Token values changed, so this is a minor release.
