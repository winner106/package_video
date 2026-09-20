# Appearance & Theming

Guidance for managing theme packs and extending the app's visual styles.

## Terminology

- **Color mode (`theme`)**: light / dark / system. Applied by `ThemeProvider` via `light` / `dark` classes on `<html>`.
- **Theme pack (`themePack` / `theme_palette`)**: visual palette (e.g., `default`, `business-blue`, `vscode`) mapped to `.theme-*` CSS classes that swap token values.

In code, `useTheme()` returns `{ colorMode, setColorMode, themePack, setThemePack }` to keep these concerns distinct.

## File layout

- `src/theme-variables.css` — entry point that imports all theme CSS modules.
- `src/themes/base.css` — shared `@theme inline` mapping and `:root` fallback values (applies when no theme class is present).
- `src/themes/default.css` — default theme tokens (`.theme-default` + `.dark.theme-default`).
- `src/themes/business-blue.css` — business blue theme tokens (`.theme-business-blue` + `.dark.theme-business-blue`).
- `src/themes/vscode.css` — VS Code-inspired palette (`.theme-vscode` + `.dark.theme-vscode`).

## Adding a new theme pack

1. Duplicate `src/themes/default.css` (or another theme file) into `src/themes/<your-theme>.css`.
2. Change the class names to `.theme-<id>` and `.dark.theme-<id>`.
3. Fill out **all** token values, including status colors (`success/info/warning` + their `-foreground`), sidebar, chart colors, and radius to avoid partial tokens.
4. Register the pack in `src/lib/themes.ts` with `id`, `labelKey`, `className` (must match the CSS class), and `previewColor`.
5. Add i18n labels for the new `labelKey` in the locale files.
6. The ThemeProvider will auto-apply the class from preferences; toast/status styling will adapt because it consumes the shared CSS variables.

## Notes

- Keep `base.css` focused on shared mapping and the `:root` fallback. Per-theme files should only override tokens.
- If you replace tokens wholesale from shadcn's theme builder, paste them into the per-theme file; ensure the status tokens remain present.
- Status tokens are used by toast icons/backgrounds; keep light/dark contrast in mind when defining new palettes.
