import { TabModel } from './tab-model';

// Fixed accent palette offered in the context menu.
export const TAB_COLORS: string[] = [
  '#e06c75', '#e5c07b', '#98c379', '#56b6c2', '#61afef', '#c678dd',
];

export interface TabBarOpts {
  onSelect(id: string): void;
  onClose(id: string): void;
  onNew(): void;
  onRename(id: string, title: string): void;
  onColor(id: string, color: string | null): void;
}

// Renders the tab strip from a TabModel. Stateless beyond an open context menu;
// call render() after any model change.
export class TabBar {
  private doc: Document;
  private menuEl: HTMLElement | null = null;
  private menuCleanup: (() => void) | null = null;

  constructor(
    private root: HTMLElement,
    private model: TabModel,
    private opts: TabBarOpts,
  ) {
    this.doc = root.ownerDocument;
  }

  render(): void {
    const doc = this.doc;
    this.root.innerHTML = '';
    const activeId = this.model.activeId();

    for (const tab of this.model.list()) {
      const el = doc.createElement('div');
      el.className = 'term-tab' + (tab.id === activeId ? ' active' : '');

      const accent = doc.createElement('span');
      accent.className = 'accent';
      if (tab.color) { accent.style.background = tab.color; accent.style.borderColor = tab.color; }
      el.appendChild(accent);

      const title = doc.createElement('span');
      title.className = 'title';
      title.textContent = tab.title;
      el.appendChild(title);

      const close = doc.createElement('span');
      close.className = 'close';
      close.textContent = '✕';
      el.appendChild(close);

      el.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button === 1) { e.preventDefault(); this.opts.onClose(tab.id); } // middle click
      });
      el.addEventListener('click', (e: MouseEvent) => {
        if (e.target === close) { e.stopPropagation(); this.opts.onClose(tab.id); return; }
        this.opts.onSelect(tab.id);
      });
      el.addEventListener('dblclick', (e: MouseEvent) => {
        if (e.target === close) return;
        this.startRename(title, tab.id);
      });
      el.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        this.openMenu(tab.id, e.clientX, e.clientY, title);
      });

      this.root.appendChild(el);
    }

    const add = doc.createElement('button');
    add.className = 'term-tab-new';
    add.textContent = '＋';
    add.title = 'New terminal';
    add.addEventListener('click', () => this.opts.onNew());
    this.root.appendChild(add);
  }

  private startRename(titleEl: HTMLElement, id: string): void {
    const cur = this.model.get(id);
    if (!cur) return;
    const input = this.doc.createElement('input');
    input.className = 'title-input';
    input.value = cur.title;
    titleEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const commit = (save: boolean) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (save && v) this.opts.onRename(id, v);
      else this.render(); // discard: rebuild from model
    };
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
    });
    input.addEventListener('blur', () => commit(true));
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
  }

  private closeMenu(): void {
    if (this.menuCleanup) { this.menuCleanup(); this.menuCleanup = null; }
    if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; }
  }

  private openMenu(id: string, x: number, y: number, titleEl: HTMLElement): void {
    this.closeMenu();
    const doc = this.doc;
    // Host the menu inside the panel root so shadow-scoped CSS applies; fixed
    // positioning uses viewport coords from clientX/clientY.
    const host = this.root.parentElement || this.root;

    const menu = doc.createElement('div');
    menu.className = 'term-ctx';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    const rename = doc.createElement('div');
    rename.className = 'item';
    rename.textContent = 'Rename';
    rename.addEventListener('click', () => { this.closeMenu(); this.startRename(titleEl, id); });
    menu.appendChild(rename);

    const colors = doc.createElement('div');
    colors.className = 'colors';
    for (const c of TAB_COLORS) {
      const sw = doc.createElement('span');
      sw.className = 'swatch';
      sw.style.background = c;
      sw.title = c;
      sw.addEventListener('click', () => { this.closeMenu(); this.opts.onColor(id, c); });
      colors.appendChild(sw);
    }
    const none = doc.createElement('span');
    none.className = 'swatch none';
    none.title = 'No color';
    none.addEventListener('click', () => { this.closeMenu(); this.opts.onColor(id, null); });
    colors.appendChild(none);
    menu.appendChild(colors);

    const closeItem = doc.createElement('div');
    closeItem.className = 'item';
    closeItem.textContent = 'Close';
    closeItem.addEventListener('click', () => { this.closeMenu(); this.opts.onClose(id); });
    menu.appendChild(closeItem);

    host.appendChild(menu);
    this.menuEl = menu;

    const onDown = (e: MouseEvent) => {
      if (this.menuEl && !this.menuEl.contains(e.target as Node)) this.closeMenu();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') this.closeMenu(); };
    this.menuCleanup = () => {
      doc.removeEventListener('mousedown', onDown, true);
      doc.removeEventListener('keydown', onKey, true);
    };
    // Defer so the originating right-click doesn't immediately dismiss it.
    setTimeout(() => {
      doc.addEventListener('mousedown', onDown, true);
      doc.addEventListener('keydown', onKey, true);
    }, 0);
  }
}
