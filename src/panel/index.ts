import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import xtermCss from '@xterm/xterm/css/xterm.css';
import ownCss from '../../static/style.css';
import { LineEditor } from './line-editor';
import { HistoryStore } from './history-store';
import { Toolbar } from './toolbar';
import { TabModel } from './tab-model';
import { TabBar } from './tab-bar';
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

interface ControllerHooks {
  onCwd(cwd: string): void;
  onRunning(running: boolean): void;
}

interface Controller {
  sessionId: string;
  onData(p: DataPayload): void;
  onIdle(p: IdlePayload): void;
  onExit(p: ExitPayload): void;
  clear(): void;
  stop(): void;
  getCwd(): string;
  isRunning(): boolean;
  setFont(cssFamily: string): void;
  setFontSize(px: number): void;
  show(): void;
  hide(): void;
  fit(): void;
  focus(): void;
  destroy(): void;
}

// One shell session bound to its own xterm view. The id is supplied by the
// panel and used verbatim as the backend sessionId, so message routing and the
// panel's controller map share one key. Toolbar-facing state (cwd, running) is
// reported through hooks; the panel forwards it to the shared toolbar only when
// this controller is the active tab.
function createController(
  sessionId: string,
  view: HTMLElement,
  fontSettings: FontSettings,
  hooks: ControllerHooks,
): Controller {
  const shell: ShellKind = DEFAULT_SHELL;
  let mode: BackendMode | null = null; // resolved after open-session
  let running = false;                 // line mode only
  let cwd: string = (Editor.Project && Editor.Project.path) || '.';

  const historyFile = `${cwd}/temp/terminal-history.json`;
  const store = new HistoryStore(historyFile);
  const editor = new LineEditor(store.load());

  const setRunning = (r: boolean) => { running = r; hooks.onRunning(r); };

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
      setRunning(true);
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
      setRunning(false);
      if (p.cwd) { cwd = p.cwd; hooks.onCwd(cwd); }
      prompt();
    },
    onExit(p) {
      if (p.sessionId !== sessionId) return;
      term.writeln(`\r\n\x1b[90m[shell exited: ${p.code}]\x1b[0m`);
    },
    clear() { term.clear(); },
    stop() {
      Editor.Message.request(PKG, MSG.SIGNAL, sessionId, 'stop');
      if (mode === 'line') {
        setRunning(false);
        term.writeln('\r\n\x1b[90m[stopped — shell restarted]\x1b[0m');
        prompt();
      }
    },
    getCwd() { return cwd; },
    isRunning() { return running; },
    setFont(cssFamily) { term.options.fontFamily = cssFamily; fit.fit(); },
    setFontSize(px) { term.options.fontSize = px; fit.fit(); },
    show() { view.classList.remove('hidden'); fit.fit(); term.focus(); },
    hide() { view.classList.add('hidden'); },
    fit() { fit.fit(); },
    focus() { term.focus(); },
    destroy() {
      store.save(editor.getHistory());
      Editor.Message.request(PKG, MSG.CLOSE_SESSION, sessionId);
      term.dispose();
      view.remove();
    },
  };
}

export default Editor.Panel.define({
  template: `
    <div class="term-root">
      <div class="term-tabs" id="tabs"></div>
      <div class="term-toolbar" id="toolbar"></div>
      <div class="term-views" id="views"></div>
    </div>`,
  style: `${xtermCss}\n${ownCss}`,
  $: { root: '.term-root', tabs: '#tabs', toolbar: '#toolbar', views: '#views' },

  listeners: {
    resize() { (this as any)._active()?.fit(); },
  },

  methods: {
    onData(p: DataPayload) { (this as any)._controllers?.get(p.sessionId)?.onData(p); },
    onIdle(p: IdlePayload) { (this as any)._controllers?.get(p.sessionId)?.onIdle(p); },
    onExit(p: ExitPayload) { (this as any)._controllers?.get(p.sessionId)?.onExit(p); },

    _active(): Controller | null {
      const self = this as any;
      const id = self._model?.activeId();
      return id ? (self._controllers.get(id) || null) : null;
    },

    _syncToolbar(ctrl: Controller) {
      const self = this as any;
      self._toolbar.setCwd(ctrl.getCwd());
      self._toolbar.setRunning(ctrl.isRunning());
    },

    _newTab() {
      const self = this as any;
      const prev = self._active();
      if (prev) prev.hide();

      const id = newId();
      self._counter += 1;
      const title = `Terminal ${self._counter}`;
      const view = self.$.views.ownerDocument.createElement('div');
      view.className = 'term-view hidden';
      self.$.views.appendChild(view);

      const ctrl: Controller = createController(id, view, self._fontSettings, {
        onCwd: (cwd: string) => { if (self._model.activeId() === id) self._toolbar.setCwd(cwd); },
        onRunning: (r: boolean) => { if (self._model.activeId() === id) self._toolbar.setRunning(r); },
      });
      self._controllers.set(id, ctrl);
      self._model.add(id, title);
      self._bar.render();
      ctrl.show();
      self._syncToolbar(ctrl);
    },

    _switchTo(id: string) {
      const self = this as any;
      if (self._model.activeId() === id) return;
      const prev = self._active();
      if (prev) prev.hide();
      self._model.select(id);
      self._bar.render();
      const ctrl: Controller | undefined = self._controllers.get(id);
      if (ctrl) { ctrl.show(); self._syncToolbar(ctrl); }
    },

    _closeTab(id: string) {
      const self = this as any;
      const wasActive = self._model.activeId() === id;
      const ctrl: Controller | undefined = self._controllers.get(id);
      if (ctrl) { ctrl.destroy(); self._controllers.delete(id); }
      const emptied = self._model.close(id);
      if (emptied) { self._newTab(); return; }
      self._bar.render();
      if (wasActive) {
        const next: Controller | undefined = self._controllers.get(self._model.activeId());
        if (next) { next.show(); self._syncToolbar(next); }
      }
    },
  },

  async ready() {
    const self = this as any;
    const fontSettings = await loadFontSettings();
    self._fontSettings = fontSettings;
    self._controllers = new Map<string, Controller>();
    self._model = new TabModel();
    self._counter = 0;

    self._toolbar = new Toolbar(self.$.toolbar, {
      font: fontSettings.family,
      fontSize: fontSettings.size,
      onFont: (family: string) => {
        fontSettings.family = family;
        const css = toCssFamily(family);
        for (const c of self._controllers.values() as Iterable<Controller>) c.setFont(css);
        saveFontSettings(fontSettings);
      },
      onFontSize: (px: number) => {
        fontSettings.size = px;
        for (const c of self._controllers.values() as Iterable<Controller>) c.setFontSize(px);
        saveFontSettings(fontSettings);
      },
      onClear: () => self._active()?.clear(),
      onStop: () => self._active()?.stop(),
    });

    self._bar = new TabBar(self.$.tabs, self._model, {
      onSelect: (id: string) => self._switchTo(id),
      onClose: (id: string) => self._closeTab(id),
      onNew: () => self._newTab(),
      onRename: (id: string, title: string) => { self._model.rename(id, title); self._bar.render(); },
      onColor: (id: string, color: string | null) => { self._model.setColor(id, color); self._bar.render(); },
    });

    self._newTab(); // first tab
  },

  close() {
    const self = this as any;
    if (self._controllers) {
      for (const c of self._controllers.values() as Iterable<Controller>) c.destroy();
      self._controllers.clear();
    }
  },
});
