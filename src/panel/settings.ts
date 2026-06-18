import { PKG } from '../shared/messages';

// Monospace presets offered in the toolbar dropdown. Each is applied with a
// `, monospace` fallback so a missing font degrades gracefully.
export const FONT_PRESETS = [
  'Consolas',
  'Cascadia Code',
  'Cascadia Mono',
  'JetBrains Mono',
  'Fira Code',
  'Courier New',
  'Lucida Console',
  'monospace',
];

export const DEFAULT_FONT = 'Consolas';
export const DEFAULT_FONT_SIZE = 13;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 32;

export interface FontSettings {
  family: string; // primary family name, e.g. "Consolas"
  size: number;   // px
}

// Build the CSS font-family string xterm expects from a primary family name.
export function toCssFamily(primary: string): string {
  const p = (primary || '').trim();
  if (!p || p === 'monospace') return 'monospace';
  return `"${p}", monospace`;
}

function clampSize(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(n)));
}

// Load font preferences from the user-global editor profile (shared across
// projects). Falls back to defaults if unset or unavailable.
export async function loadFontSettings(): Promise<FontSettings> {
  let family = DEFAULT_FONT;
  let size = DEFAULT_FONT_SIZE;
  try {
    const f = await Editor.Profile.getConfig(PKG, 'fontFamily', 'global');
    if (typeof f === 'string' && f.trim()) family = f.trim();
    const s = await Editor.Profile.getConfig(PKG, 'fontSize', 'global');
    if (typeof s === 'number') size = clampSize(s);
  } catch { /* keep defaults */ }
  return { family, size: clampSize(size) };
}

export function saveFontSettings(s: FontSettings): void {
  try {
    Editor.Profile.setConfig(PKG, 'fontFamily', s.family, 'global');
    Editor.Profile.setConfig(PKG, 'fontSize', clampSize(s.size), 'global');
  } catch { /* ignore — preferences are best-effort */ }
}
