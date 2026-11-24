export const DASHBOARD_THEME_STORAGE_KEY = 'dashboard-theme'

// TanStack Router recommends ScriptOnce for theme detection that must run before
// Start hydrates, preventing FOUC/theme flicker.
// Source: https://tanstack.com/router/latest/docs/guide/document-head-management#inline-scripts-with-scriptonce
export const dashboardThemeScript = `(() => {
  try {
    const stored = localStorage.getItem(${JSON.stringify(DASHBOARD_THEME_STORAGE_KEY)});
    const theme = stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
    const resolved = theme === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch (_) {}
})();`
