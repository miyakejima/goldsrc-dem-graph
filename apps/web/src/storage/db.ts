import type { GraphViewerDataset } from "@kz-rebuild/shared-types";

export interface SavedDemoRecord {
  id: string;
  filename: string;
  mapname: string;
  frames: number;
  duration: number; // in seconds
  createdAt: number; // timestamp
  isFavorite: boolean;
  tags?: string[];
  dataset: GraphViewerDataset;
}

const DB_NAME = "kz_demo_graph_db";
const DB_VERSION = 1;
const STORE_NAME = "demos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("isFavorite", "isFavorite", { unique: false });
        store.createIndex("mapname", "mapname", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllDemos(): Promise<SavedDemoRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = (request.result as SavedDemoRecord[]) || [];
      // Sort favorites first, then newest first
      records.sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return b.createdAt - a.createdAt;
      });
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getDemoRecord(id: string): Promise<SavedDemoRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as SavedDemoRecord) || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDemoRecord(record: SavedDemoRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDemoRecord(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function toggleDemoFavorite(id: string): Promise<boolean> {
  const demo = await getDemoRecord(id);
  if (!demo) return false;
  demo.isFavorite = !demo.isFavorite;
  await saveDemoRecord(demo);
  return demo.isFavorite;
}
