import {
  FONT_PRESETS, MIN_FONT_SIZE, MAX_FONT_SIZE,
} from './settings';

export interface ToolbarOpts {
  font: string;       // primary family name
  fontSize: number;   // px
  onFont(family: string): void;
  onFontSize(px: number): void;
  onClear(): void;
  onStop(): void;
}

const CUSTOM = '__custom__';

export class Toolbar {
  private cwdEl: HTMLSpanElement;
  private runningEl: HTMLSpanElement;

  constructor(root: HTMLElement, opts: ToolbarOpts) {
    const doc = root.ownerDocument;

    // ── font family: preset dropdown + custom text input ───────────────────
    const isPreset = FONT_PRESETS.includes(opts.font);

    const fontSel = doc.createElement('select');
    fontSel.title = 'Font family';
    FONT_PRESETS.forEach((name) => {
      const o = doc.createElement('option');
      o.value = name; o.textContent = name;
      if (isPreset && name === opts.font) o.selected = true;
      fontSel.appendChild(o);
    });
    const customOpt = doc.createElement('option');
    customOpt.value = CUSTOM; customOpt.textContent = 'Custom…';
    if (!isPreset) customOpt.selected = true;
    fontSel.appendChild(customOpt);
    root.appendChild(fontSel);

    const customInput = doc.createElement('input');
    customInput.type = 'text';
    customInput.className = 'font-custom';
    customInput.placeholder = 'Font name';
    customInput.title = 'Custom font family';
    customInput.value = isPreset ? '' : opts.font;
    customInput.style.display = isPreset ? 'none' : '';
    root.appendChild(customInput);

    const commitCustom = () => {
      const v = customInput.value.trim();
      if (v) opts.onFont(v);
    };
    fontSel.addEventListener('change', () => {
      if (fontSel.value === CUSTOM) {
        customInput.style.display = '';
        customInput.focus();
        commitCustom();
      } else {
        customInput.style.display = 'none';
        opts.onFont(fontSel.value);
      }
    });
    customInput.addEventListener('change', commitCustom);

    // ── font size ──────────────────────────────────────────────────────────
    const sizeInput = doc.createElement('input');
    sizeInput.type = 'number';
    sizeInput.className = 'font-size';
    sizeInput.title = 'Font size (px)';
    sizeInput.min = String(MIN_FONT_SIZE);
    sizeInput.max = String(MAX_FONT_SIZE);
    sizeInput.value = String(opts.fontSize);
    const commitSize = () => {
      const n = parseInt(sizeInput.value, 10);
      if (Number.isFinite(n)) opts.onFontSize(n);
    };
    sizeInput.addEventListener('change', commitSize);
    root.appendChild(sizeInput);

    // ── spacer + status ────────────────────────────────────────────────────
    const spacer = doc.createElement('span');
    spacer.className = 'spacer';
    root.appendChild(spacer);

    this.runningEl = doc.createElement('span');
    this.runningEl.className = 'running';
    root.appendChild(this.runningEl);

    this.cwdEl = doc.createElement('span');
    this.cwdEl.className = 'cwd';
    root.appendChild(this.cwdEl);

    const stop = doc.createElement('button');
    stop.textContent = 'Stop';
    stop.addEventListener('click', () => opts.onStop());
    root.appendChild(stop);

    const clear = doc.createElement('button');
    clear.textContent = 'Clear';
    clear.addEventListener('click', () => opts.onClear());
    root.appendChild(clear);
  }

  setCwd(cwd: string): void { this.cwdEl.textContent = cwd; this.cwdEl.title = cwd; }
  setRunning(running: boolean): void { this.runningEl.textContent = running ? '● running' : ''; }
}
