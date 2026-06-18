import type { ShellKind } from '../shared/messages';

export interface ToolbarOpts {
  shell: ShellKind;
  quickCommands: string[];
  onShell(shell: ShellKind): void;
  onQuick(cmd: string): void;
  onClear(): void;
  onStop(): void;
}

const SHELL_LABELS: Record<ShellKind, string> = {
  powershell: 'PowerShell',
  cmd: 'cmd',
  bash: 'Git Bash',
};

export class Toolbar {
  private cwdEl: HTMLSpanElement;
  private runningEl: HTMLSpanElement;

  constructor(root: HTMLElement, opts: ToolbarOpts) {
    const doc = root.ownerDocument;

    const shellSel = doc.createElement('select');
    (['powershell', 'cmd', 'bash'] as ShellKind[]).forEach((k) => {
      const o = doc.createElement('option');
      o.value = k; o.textContent = SHELL_LABELS[k];
      if (k === opts.shell) o.selected = true;
      shellSel.appendChild(o);
    });
    shellSel.addEventListener('change', () => opts.onShell(shellSel.value as ShellKind));
    root.appendChild(shellSel);

    opts.quickCommands.forEach((cmd) => {
      const b = doc.createElement('button');
      b.textContent = cmd;
      b.title = `Run: ${cmd}`;
      b.addEventListener('click', () => opts.onQuick(cmd));
      root.appendChild(b);
    });

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
