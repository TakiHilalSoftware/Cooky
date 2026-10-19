"use client";

// THE IndexedDB exception (AGENT_RULES §2, PRD §4): the person's own active
// shopping list and today's cooking-mode recipe, keyed to the signed-in user,
// wiped on logout or a user switch. public/offline.js reads the same store
// (database "cooky-offline", object store "kv"); keep the two in step.

const DB = "cooky-offline";
const STORE = "kv";
/** Per-device switch in Settings; off means nothing is kept. A UI preference, so localStorage. */
export const OFFLINE_SETTING_KEY = "cooky.offline";

export type OfflineStrings = Record<string, string> & { dir: "ltr" | "rtl"; lang: string };

export type ShoppingSnapshot = {
  owner: string;
  version: number;
  savedAt: string;
  groups: { label: string; items: { id: string; name: string; amount: string | null; checked: boolean }[] }[];
};

export type RecipeSnapshot = {
  owner: string;
  day: string;
  name: string;
  ingredients: string[];
  steps: string[];
};

export type QueuedTick = { itemId: string; checked: boolean; at: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Every call is best effort: a private window or blocked storage just means no offline copy. */
async function safe<T>(fallback: T, work: () => Promise<T>): Promise<T> {
  try {
    if (typeof indexedDB === "undefined") return fallback;
    return await work();
  } catch {
    return fallback;
  }
}

export const offlineEnabled = () => {
  try {
    return localStorage.getItem(OFFLINE_SETTING_KEY) !== "off";
  } catch {
    return true;
  }
};

export const readValue = <T>(key: string) =>
  safe<T | undefined>(undefined, () => run<T | undefined>("readonly", (s) => s.get(key)));
export const writeValue = (key: string, value: unknown) =>
  safe(undefined, () => run("readwrite", (s) => s.put(value, key)).then(() => undefined));

export const readQueue = async () => (await readValue<QueuedTick[]>("queue")) ?? [];

export async function queueTick(tick: QueuedTick) {
  const queue = await readQueue();
  await writeValue("queue", [...queue.filter((q) => q.itemId !== tick.itemId), tick]);
}

/** Removes everything this device kept (logout, another account, or the setting turned off). */
export const wipeOffline = () => safe(undefined, () => run("readwrite", (s) => s.clear()).then(() => undefined));
