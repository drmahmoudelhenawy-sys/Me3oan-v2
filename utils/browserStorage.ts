type StorageKind = "localStorage" | "sessionStorage";

const memoryStores: Record<StorageKind, Map<string, string>> = {
  localStorage: new Map(),
  sessionStorage: new Map(),
};

const getStorage = (kind: StorageKind): Storage | null => {
  try {
    const storage = window[kind];
    const probeKey = `ma3wan_${kind}_probe`;
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
};

export const safeStorage = {
  get(kind: StorageKind, key: string): string | null {
    const storage = getStorage(kind);
    if (storage) {
      try {
        return storage.getItem(key);
      } catch {
        return memoryStores[kind].get(key) ?? null;
      }
    }
    return memoryStores[kind].get(key) ?? null;
  },

  set(kind: StorageKind, key: string, value: string) {
    const storage = getStorage(kind);
    if (storage) {
      try {
        storage.setItem(key, value);
        return;
      } catch {
        // Fall through to the in-memory store for restricted WebViews.
      }
    }
    memoryStores[kind].set(key, value);
  },

  remove(kind: StorageKind, key: string) {
    const storage = getStorage(kind);
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        // Keep cleanup best-effort in restrictive embedded browsers.
      }
    }
    memoryStores[kind].delete(key);
  },
};
