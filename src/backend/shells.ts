import type { ShellKind } from '../shared/messages';
import { sentinelToken } from '../shared/sentinel';

const T = sentinelToken();

export interface ShellSpec {
  kind: ShellKind;
  file: string;
  args: string[];      // SpawnBackend: stdin-pipe mode
  ptyArgs: string[];   // PtyBackend: interactive mode (real TTY)
  eol: string;
  sentinelSuffix(): string;
}

export const SHELLS: Record<ShellKind, ShellSpec> = {
  powershell: {
    kind: 'powershell',
    file: 'powershell.exe',
    args: ['-NoLogo', '-NoProfile', '-Command', '-'],
    ptyArgs: ['-NoLogo'],
    eol: '\n',
    sentinelSuffix: () => `; Write-Output "${T}$LASTEXITCODE|$((Get-Location).Path)"`,
  },
  cmd: {
    kind: 'cmd',
    file: 'cmd.exe',
    args: ['/Q', '/K'],
    ptyArgs: [],
    eol: '\r\n',
    sentinelSuffix: () => ` & echo ${T}%ERRORLEVEL%^|%CD%`,
  },
  bash: {
    kind: 'bash',
    file: 'bash.exe',
    args: ['-i'],
    ptyArgs: ['-i'],
    eol: '\n',
    sentinelSuffix: () => `; echo "${T}$?|$PWD"`,
  },
};

export function buildCommand(spec: ShellSpec, line: string): string {
  return `${line}${spec.sentinelSuffix()}${spec.eol}`;
}
