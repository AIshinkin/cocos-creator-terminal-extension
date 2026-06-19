export interface Tab {
  id: string;
  title: string;
  color: string | null;
}

// Pure, DOM-free tab state. The panel owns ids (== controller sessionIds) and
// titles; this only tracks order, the active tab, and per-tab metadata.
export class TabModel {
  private tabs: Tab[] = [];
  private active: string | null = null;

  list(): Tab[] { return this.tabs.slice(); }
  activeId(): string | null { return this.active; }
  get(id: string): Tab | undefined { return this.tabs.find((t) => t.id === id); }

  add(id: string, title: string): void {
    this.tabs.push({ id, title, color: null });
    this.active = id;
  }

  select(id: string): void {
    if (this.tabs.some((t) => t.id === id)) this.active = id;
  }

  rename(id: string, title: string): void {
    const t = this.get(id);
    if (t) t.title = title;
  }

  setColor(id: string, color: string | null): void {
    const t = this.get(id);
    if (t) t.color = color;
  }

  // Removes the tab. If it was active, selects a neighbor — the right one if
  // present, else the left. Returns true when no tabs remain.
  close(id: string): boolean {
    const i = this.tabs.findIndex((t) => t.id === id);
    if (i === -1) return this.tabs.length === 0;
    const wasActive = this.active === id;
    this.tabs.splice(i, 1);
    if (wasActive) {
      const next = this.tabs[i] || this.tabs[i - 1];
      this.active = next ? next.id : null;
    }
    return this.tabs.length === 0;
  }
}
