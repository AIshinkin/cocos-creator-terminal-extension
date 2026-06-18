import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class HistoryStore {
  constructor(private file: string, private max = 200) {}

  load(): string[] {
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8'));
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x) => typeof x === 'string').slice(-this.max);
    } catch {
      return [];
    }
  }

  save(history: string[]): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(history.slice(-this.max)), 'utf8');
    } catch {
      /* best-effort persistence */
    }
  }
}
