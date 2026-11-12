// Identity context — every Cbox-family app wraps with this.
export {
    CboxIdProvider,
    useCboxId,
    useCboxIdOptional,
    type CboxAppKey,
    type CboxAppLink,
    type CboxIdContextValue,
    type CboxNotificationPreviewItem,
    type CboxNotificationsState,
    type CboxOrganization,
    type CboxUser,
} from './context/cbox-id';

// The shell: one for every Cbox app, rendered from the shared `shell` prop (spec 2026-11-10).
export * from './shell';

// Layout helpers kept for apps without the shell (a launcher page, a public page).
export { AppContent } from './layout/app-content';
export { AppShell } from './layout/app-shell';
export { CboxBrand, type CboxBrandProps } from './layout/cbox-brand';

// App catalog: the framework-free `<cbox-app-switcher>` element (kept for apps still migrating)
// and the app icons from Cbox ID's catalog.
export {
    CboxAppCatalog,
    authorizeHref,
    parseAppCatalog,
    signInTarget,
    type CboxAppCatalogProps,
    type CboxAppCatalogState,
    type CboxCatalogApp,
} from './components/app-catalog';
export {
    CboxAppIcon,
    CboxServiceMark,
    readKnownAppCatalog,
    rememberAppCatalog,
    secureIconUrl,
    useKnownAppCatalog,
    type CboxAppIconProps,
    type CboxKnownApp,
    type CboxServiceMarkProps,
} from './components/app-icon';

// Page primitives.
export {
    Combobox,
    type ComboboxAvatar,
    type ComboboxGroup,
    type ComboboxOption,
    type ComboboxProps,
} from './primitives/combobox';
export { DataPanel, PanelBody, SectionHeader } from './primitives/data-panel';
export { EmptyState } from './primitives/empty-state';
export { default as Heading } from './primitives/heading';
export { KeyValue, KeyValueList } from './primitives/key-value';
export { PageHeader } from './primitives/page-header';
export { PageShell, type PageWidth } from './primitives/page-shell';
export {
    PageTabs,
    type PageTabSpec,
    type PageTabsProps,
} from './primitives/page-tabs';
export { RowLink, type RowLinkProps } from './primitives/row-link';
export { StatTile } from './primitives/stat-tile';
export { StatusPill } from './primitives/status-pill';

// Form controls and the dialog. Styled by `tokens/controls.css`, which the tokens import brings.
export {
    Button,
    buttonClassName,
    type ButtonProps,
    type ButtonSize,
    type ButtonVariant,
} from './primitives/button';
export { Checkbox, type CheckboxProps } from './primitives/checkbox';
export {
    Dialog,
    DialogClose,
    useDialogClose,
    type DialogProps,
    type DialogSize,
} from './primitives/dialog';
export {
    Field,
    useFieldControl,
    type FieldControlProps,
    type FieldProps,
} from './primitives/field';
export {
    Input,
    Textarea,
    type InputProps,
    type TextareaProps,
} from './primitives/input';
export {
    RadioGroup,
    type RadioGroupProps,
    type RadioOption,
} from './primitives/radio-group';
export { Spinner, type SpinnerProps } from './primitives/spinner';
export { Switch, type SwitchProps } from './primitives/switch';

// Cross-app surface runtime — single overlay layer (modal/drawer) that
// every Cbox app mounts so chrome controls (bell, search trigger) can
// open inbox/search/etc without route navigation. Surfaces are a closed
// set defined here; adding one is a cbox-ui PR.
export {
    CboxSurfaces,
    useCboxSurfaces,
    useCboxSurfacesOptional,
} from './surfaces/surface-state';
export type {
    CboxSurfacesProps,
    InboxState,
    RealtimeState,
    RealtimeStatus,
    SurfaceArgs,
    SurfaceConfig,
    SurfaceController,
    SurfaceId,
    Transport,
} from './surfaces/types';

// Utilities.
export { cn } from './utils/cn';
export {
    buildUrlSearch,
    defineUrlSchema,
    parseUrlSearch,
    urlBoolean,
    urlEnum,
    urlNumber,
    urlString,
    urlStringArray,
    type InferUrlState,
    type UrlField,
    type UrlSchema,
} from './utils/url-state';

// Host-owned language and formatting, shared by all chrome and primitives.
export { CboxLocalizationProvider, interpolate, useCboxLocalization, type CboxTranslator, type CboxTranslationValues } from './context/localization';
export { CHART_PALETTE, Sparkline } from './charts/sparkline';
export { niceTicks, timeTicks, type TimePoint } from './charts/scale';
// TimeChart and Chart (ECharts) live in '@cboxdk/cbox-ui/charts' so apps without charts never need echarts.
