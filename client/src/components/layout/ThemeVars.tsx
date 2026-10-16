import { getResolvedContent } from '@/lib/cms-resolve';

const HEADING_STACKS: Record<string, string> = {
  Lora: 'var(--font-lora), Georgia, "Times New Roman", serif',
  Georgia: 'Georgia, "Times New Roman", serif',
  'Playfair Display': '"Playfair Display", Georgia, serif',
};

/**
 * Phase 23 premium redesign: Source Sans 3 is no longer loaded via next/font
 * (see app/layout.tsx) — Inter replaced it sitewide as the new default body
 * typeface. The 'Source Sans 3' label stays valid here (admin settings/the
 * Supabase site_settings row are untouched — out of scope for a client-only
 * visual redesign) but now resolves to the same loaded --font-inter variable
 * as the 'Inter' option, rather than a variable that no longer exists.
 */
const BODY_STACKS: Record<string, string> = {
  'Source Sans 3': 'var(--font-inter), system-ui, -apple-system, "Segoe UI", sans-serif',
  Inter: 'var(--font-inter), system-ui, -apple-system, "Segoe UI", sans-serif',
  'system-ui': 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

export async function ThemeVars() {
  const { settings } = await getResolvedContent();
  const heading = HEADING_STACKS[settings.headingFont] || HEADING_STACKS.Lora;
  const body = BODY_STACKS[settings.bodyFont] || BODY_STACKS['Source Sans 3'];

  const css = `
:root {
  --lw-primary: ${settings.primaryColor};
  --lw-accent: ${settings.accentColor};
  --color-brand-primary: ${settings.primaryColor};
  --color-brand-accent: ${settings.accentColor};
  --font-heading: ${heading};
  --font-body: ${body};
}
`.trim();

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
