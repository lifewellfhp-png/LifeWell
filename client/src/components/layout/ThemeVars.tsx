import { getResolvedContent } from '@/lib/cms-resolve';

const HEADING_STACKS: Record<string, string> = {
  Lora: 'var(--font-lora), Georgia, "Times New Roman", serif',
  Georgia: 'Georgia, "Times New Roman", serif',
  'Playfair Display': '"Playfair Display", Georgia, serif',
};

const BODY_STACKS: Record<string, string> = {
  'Source Sans 3': 'var(--font-source-sans), system-ui, -apple-system, "Segoe UI", sans-serif',
  Inter: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  'system-ui': 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

export async function ThemeVars() {
  const { settings } = await getResolvedContent();
  const heading = HEADING_STACKS[settings.headingFont] || HEADING_STACKS.Lora;
  const body = BODY_STACKS[settings.bodyFont] || BODY_STACKS['Source Sans 3'];

  // Phase 24 homepage reorg: primary/accent color injection removed —
  // the live Admin Appearance settings had a custom primary_color
  // (#3e7698, not even the original #3E7FB1 default) stored in Supabase,
  // which was silently overriding globals.css's new logo-matched navy/
  // green tokens (--lw-primary/--lw-accent) on every page load. Per
  // explicit instruction, the new brand colors must win regardless of
  // what's stored there — this stops reading settings.primaryColor/
  // accentColor into CSS entirely, rather than relying on database state
  // this code has no way to verify or control. Font injection (heading/
  // body) is untouched; only the two color lines are gone.
  const css = `
:root {
  --font-heading: ${heading};
  --font-body: ${body};
}
`.trim();

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
