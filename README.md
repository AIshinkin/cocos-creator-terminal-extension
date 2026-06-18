# Terminal — Cocos Creator 3.8 extension

In-editor dockable terminal. It runs a **real PTY** (via `@lydell/node-pty`, an N-API
prebuilt that loads in the editor's Electron with no compiler), so interactive programs
work: `claude`, `vim`, `ssh`, REPLs, prompts, colors, cursor control — like VS Code's
integrated terminal. If the native pty module can't load on a platform, it transparently
falls back to a **line mode** command runner (non-interactive commands only).

## Install (dev)

```bash
cd extensions/terminal
npm install
npm run build      # or: npm run watch
```

In Cocos Creator: **Extension → Extension Manager → reload** the `terminal` extension,
then open it from the top **Panel** menu → **Terminal**.

## Features

- Real PTY (raw mode): full interactive TUIs, ANSI colors, the shell's own prompt,
  resize, and **real Ctrl+C** (Stop button sends SIGINT to the foreground program).
- Shell selector: PowerShell (default) / cmd / Git Bash.
- Quick-command buttons (`git status`, `git pull`, `npm install`, `npm run build`),
  Clear, and Stop.
- Copy / paste: select with the mouse + **Ctrl+C** to copy (Ctrl+C with no selection
  passes through as interrupt), **Ctrl+V** to paste, or **right-click** (copies the
  selection if any, otherwise pastes).
- Line-mode fallback (if pty unavailable): in-panel line editing with command history
  (↑/↓) persisted to `<project>/temp/terminal-history.json`, plus a sentinel-based cwd /
  exit-code indicator.

## Architecture

- **Main process** (`dist/main.js`): owns shell processes via `SessionManager` behind the
  `ITerminalBackend` interface. `PtyBackend` (`@lydell/node-pty`, `mode: 'raw'`) is tried
  first; `SpawnBackend` (piped shell, `mode: 'line'`) is the fallback. Output is pushed to
  the panel with `Editor.Message.send('terminal', 'data'|'idle'|'exit', payload)`.
- **Panel** (`dist/panel.js`): xterm.js + `Toolbar` (+ `LineEditor` for fallback). In raw
  mode it pipes keystrokes straight to the pty via `input`/`resize` messages and writes pty
  output back. `open-session` returns the active mode so the panel adapts. Main→panel
  messages are declared in `contributions.messages` as `default.onData` etc.
- `@lydell/node-pty` is kept **external** in the esbuild bundle so its native `.node`
  binary loads from `node_modules` at runtime (it is never bundled).

## Known limitations

- Requires `npm install` in `extensions/terminal/` so the pty native module is present.
- cwd/exit indicator only updates in line-mode fallback (raw mode shows the shell's prompt).
- Windows x64 prebuilt is shipped by `@lydell/node-pty`; other platforms pull their own
  prebuilt automatically. If none loads, line mode is used.

## Develop / test

```bash
npm test          # node:test unit tests (sentinel, shells, spawn + pty backend, session, line editor, history)
npm run typecheck
npm run build
```

Unit tests cover the headless logic (pty backend tested with an injected fake module).
Panel DOM + `Editor` integration can only be verified inside the editor — see below.

## Manual test checklist (run inside Cocos Creator 3.8.8)

1. Panel opens from the **Panel → Terminal** menu; the shell's own prompt appears.
2. `git status` / `npm -v` run with correct colors.
3. `cd assets` then `dir` — directory persists (single shell session).
4. **Interactive:** run `claude` (or `node`, `python`) → the interactive UI works, accepts
   input, responds; arrow keys / editing behave.
5. Run a long command (e.g. `ping -t 127.0.0.1`) → click **Stop** (or Ctrl+C) → it interrupts.
6. Select output with the mouse + **Ctrl+C** copies; **Ctrl+V** pastes; right-click works.
7. Switch the shell dropdown to `cmd`; run `echo %CD%`.
8. Resize / re-dock the panel → xterm refits and the pty resizes (run `mode con` or a TUI
   to confirm it tracks the new size).
