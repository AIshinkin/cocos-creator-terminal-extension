export interface KeyResult { write?: string; submit?: string; }

const CSI = '\x1b[';

export class LineEditor {
  private buf = '';
  private cursor = 0;
  private history: string[];
  private hist: number; // index into history; === history.length means "live line"
  private stash = '';

  constructor(history: string[] = []) {
    this.history = history.slice();
    this.hist = this.history.length;
  }

  getLine(): string { return this.buf; }
  getCursor(): number { return this.cursor; }
  getHistory(): string[] { return this.history.slice(); }

  reset(): void { this.buf = ''; this.cursor = 0; this.hist = this.history.length; this.stash = ''; }

  // Insert a block of text (e.g. a paste) at the cursor. Newlines are flattened
  // to spaces so a pasted multi-line command does not auto-run. Returns the echo.
  insertText(text: string): string {
    const clean = text.replace(/\r?\n/g, ' ');
    if (!clean) return '';
    return this.insert(clean).write ?? '';
  }

  handleKey(data: string): KeyResult {
    switch (data) {
      case '\r': case '\n': return this.submit();
      case '\x7f': case '\b': return this.backspace();
      case CSI + 'D': return this.move(-1);
      case CSI + 'C': return this.move(1);
      case CSI + 'A': return this.historyPrev();
      case CSI + 'B': return this.historyNext();
      case CSI + 'H': case '\x01': return this.toStart();
      case CSI + 'F': case '\x05': return this.toEnd();
      default:
        if (data.length === 1 && (data >= ' ' || data === '\t')) return this.insert(data);
        return {};
    }
  }

  private insert(ch: string): KeyResult {
    const tail = this.buf.slice(this.cursor);
    this.buf = this.buf.slice(0, this.cursor) + ch + tail;
    this.cursor += ch.length;
    if (!tail) return { write: ch };
    // redraw tail, then move cursor back to just after the inserted char
    return { write: ch + tail + `${CSI}${tail.length}D` };
  }

  private backspace(): KeyResult {
    if (this.cursor === 0) return {};
    const tail = this.buf.slice(this.cursor);
    this.buf = this.buf.slice(0, this.cursor - 1) + tail;
    this.cursor -= 1;
    return { write: `\b${tail} ` + `${CSI}${tail.length + 1}D` };
  }

  private move(dir: number): KeyResult {
    const next = this.cursor + dir;
    if (next < 0 || next > this.buf.length) return {};
    this.cursor = next;
    return { write: dir < 0 ? `${CSI}D` : `${CSI}C` };
  }

  private toStart(): KeyResult {
    if (this.cursor === 0) return {};
    const n = this.cursor; this.cursor = 0; return { write: `${CSI}${n}D` };
  }

  private toEnd(): KeyResult {
    const n = this.buf.length - this.cursor;
    if (n === 0) return {};
    this.cursor = this.buf.length; return { write: `${CSI}${n}C` };
  }

  private replaceLine(next: string): KeyResult {
    // move to start, clear to end of line, write new content
    const back = this.cursor > 0 ? `${CSI}${this.cursor}D` : '';
    this.buf = next; this.cursor = next.length;
    return { write: `${back}${CSI}K${next}` };
  }

  private historyPrev(): KeyResult {
    if (this.hist === 0) return {};
    if (this.hist === this.history.length) this.stash = this.buf;
    this.hist -= 1;
    return this.replaceLine(this.history[this.hist]);
  }

  private historyNext(): KeyResult {
    if (this.hist >= this.history.length) return {};
    this.hist += 1;
    const next = this.hist === this.history.length ? this.stash : this.history[this.hist];
    return this.replaceLine(next);
  }

  private submit(): KeyResult {
    const line = this.buf;
    const trimmed = line.trim();
    if (trimmed && this.history[this.history.length - 1] !== trimmed) {
      this.history.push(trimmed);
    }
    this.buf = ''; this.cursor = 0; this.hist = this.history.length; this.stash = '';
    return { submit: line };
  }
}
