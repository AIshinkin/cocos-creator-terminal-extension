import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import xtermCss from '@xterm/xterm/css/xterm.css';
import ownCss from '../../static/style.css';
import { LineEditor } from './line-editor';
import { HistoryStore } from './history-store';
import { Toolbar } from './toolbar';
import {
  type FontSettings, toCssFamily, loadFontSettings, saveFontSettings,
} from './settings';
import {
  PKG, MSG, type ShellKind, type BackendMode,
  type DataPayload, type IdlePayload, type ExitPayload,
} from '../shared/messages';

const DEFAULT_SHELL: ShellKind = 'powershell';
const PROMPT = '\x1b[32m›\x1b[0m ';
const HINT = '\x1b[90mCocos Terminal · Ctrl+C copy (when selected) / Ctrl+V paste / right-click\x1b[0m';

function newId(): string {
  return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

interface Controller {
  sessionId: string;
  onData(p: DataPayload): void;
  onIdle(p: IdlePayload): void;
  onExit(p: ExitPayload): void;
  fit(): void;
  destroy(): void;
}

function createController(view: HTMLElement, toolbarRoot: HTMLElement, fontSettings: FontSettings): Controller {
  const sessionId = newId();
  let shell: ShellKind = DEFAULT_SHELL;
  let mode: BackendMode | null = null; // resolved after open-session
  let running = false;                 // line mode only
  let cwd: string = (Editor.Project && Editor.Project.path) || '.';

  const historyFile = `${cwd}/temp/terminal-history.json`;
  const store = new HistoryStore(historyFile);
  const editor = new LineEditor(store.load());

  const term = new Terminal({
    fontSize: fontSettings.size,
    fontFamily: toCssFamily(fontSettings.family),
    theme: { background: '#1e1e1e' },
    cursorBlink: true,
    scrollback: 5000,
    convertEol: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(view);
  fit.fit();

  // ── line-mode helpers (used only when the pty is unavailable) ─────────────
  const prompt = () => term.write('\r\n' + PROMPT);
  const submitLine = (line: string) => {
    term.write('\r\n');
    if (line.trim()) {
      running = true;
      toolbar.setRunning(true);
      Editor.Message.request(PKG, MSG.RUN, sessionId, line);
    } else {
      prompt();
    }
  };

  // ── clipboard ────────────────────────────────────────────────────────────
  const clipboard: any = (() => {
    try { return require('electron').clipboard; } catch { return null; }
  })();
  const copySelection = (): boolean => {
    const sel = term.getSelection();
    if (sel && clipboard) { clipboard.writeText(sel); return true; }
    return false;
  };
  const pasteClipboard = (): void => {
    if (!clipboard) return;
    const text = clipboard.readText();
    if (!text) return;
    if (mode === 'raw') { Editor.Message.send(PKG, MSG.INPUT, sessionId, text); return; }
    if (mode === 'line' && !running) { const w = editor.insertText(text); if (w) term.write(w); }
  };

  // ── toolbar ──────────────────────────────────────────────────────────────
  const toolbar = new Toolbar(toolbarRoot, {
    font: fontSettings.family,
    fontSize: fontSettings.size,
    onFont: (family) => {
      fontSettings.family = family;
      term.options.fontFamily = toCssFamily(family);
      fit.fit();
      saveFontSettings(fontSettings);
    },
    onFontSize: (px) => {
      fontSettings.size = px;
      term.options.fontSize = px;
      fit.fit();
      saveFontSettings(fontSettings);
    },
    onClear: () => term.clear(),
    onStop: () => {
      Editor.Message.request(PKG, MSG.SIGNAL, sessionId, 'stop');
      if (mode === 'line') {
        running = false;
        toolbar.setRunning(false);
        term.writeln('\r\n\x1b[90m[stopped — shell restarted]\x1b[0m');
        prompt();
      }
    },
  });
  toolbar.setCwd(cwd);

  // ── input: raw → straight to pty; line → local line editor ───────────────
  term.onData((data: string) => {
    if (mode === 'raw') { Editor.Message.send(PKG, MSG.INPUT, sessionId, data); return; }
    if (mode !== 'line' || running) return;
    const r = editor.handleKey(data);
    if (r.write) term.write(r.write);
    if (r.submit !== undefined) {
      const line = r.submit;
      submitLine(line);
      if (line.trim()) store.save(editor.getHistory());
    }
  });

  term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
    Editor.Message.send(PKG, MSG.RESIZE, sessionId, cols, rows);
  });

  term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
    if (e.type !== 'keydown') return true;
    if (!(e.ctrlKey || e.metaKey)) return true;
    const key = e.key.toLowerCase();
    if (key === 'c') return !copySelection(); // copied → swallow; else pass through (raw: → SIGINT)
    if (key === 'v') { pasteClipboard(); return false; }
    return true;
  });

  view.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    if (!copySelection()) pasteClipboard();
  });

  // ── start session, then adapt to the resolved mode ───────────────────────
  term.writeln(HINT);
  Editor.Message.request(PKG, MSG.OPEN_SESSION, sessionId, shell, cwd).then((m: string) => {
    mode = m === 'raw' ? 'raw' : 'line';
    if (mode === 'raw') {
      fit.fit();
      Editor.Message.send(PKG, MSG.RESIZE, sessionId, term.cols, term.rows);
    } else {
      term.writeln('\x1b[33m[PTY unavailable — line mode: non-interactive commands only]\x1b[0m');
      prompt();
    }
  }).catch(() => { mode = 'line'; prompt(); });

  return {
    sessionId,
    onData(p) { if (p.sessionId === sessionId) term.write(p.chunk); },
    onIdle(p) {
      if (p.sessionId !== sessionId || mode !== 'line') return;
      running = false;
      toolbar.setRunning(false);
      if (p.cwd) { cwd = p.cwd; toolbar.setCwd(cwd); }
      prompt();
    },
    onExit(p) {
      if (p.sessionId !== sessionId) return;
      term.writeln(`\r\n\x1b[90m[shell exited: ${p.code}]\x1b[0m`);
    },
    fit() { fit.fit(); },
    destroy() {
      store.save(editor.getHistory());
      Editor.Message.request(PKG, MSG.CLOSE_SESSION, sessionId);
      term.dispose();
    },
  };
}

export default Editor.Panel.define({
  template: `
    <div class="term-root">
      <div class="term-toolbar" id="toolbar"></div>
      <div class="term-view" id="view"></div>
    </div>`,
  style: `${xtermCss}\n${ownCss}`,
  $: { root: '.term-root', toolbar: '#toolbar', view: '#view' },

  listeners: {
    resize() { (this as any)._ctrl?.fit(); },
  },

  methods: {
    onData(p: DataPayload) { (this as any)._ctrl?.onData(p); },
    onIdle(p: IdlePayload) { (this as any)._ctrl?.onIdle(p); },
    onExit(p: ExitPayload) { (this as any)._ctrl?.onExit(p); },
  },

  async ready() {
    const self = this as any;
    const fontSettings = await loadFontSettings();
    self._ctrl = createController(self.$.view, self.$.toolbar, fontSettings);
  },

  close() {
    const self = this as any;
    self._ctrl?.destroy();
    self._ctrl = null;
  },
});
