import type { DemoListItem } from "@kz-rebuild/shared-types";

export interface StoredDemo extends DemoListItem {
  uploadedAtIso: string;
}

export class InMemoryDemoStore {
  private readonly demos = new Map<string, StoredDemo>();

  put(demo: StoredDemo): void {
    this.demos.set(demo.id, demo);
  }

  list(): StoredDemo[] {
    return Array.from(this.demos.values());
  }

  get(id: string): StoredDemo | undefined {
    return this.demos.get(id);
  }
}