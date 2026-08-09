export class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

export function installMemoryStorage(
  { uiLanguage }: { uiLanguage?: string } = {}
): { localStorage: MemoryStorage; sessionStorage: MemoryStorage } {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorage
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: sessionStorage
  });
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value:
      uiLanguage === undefined
        ? undefined
        : {
            i18n: {
              getUILanguage: () => uiLanguage
            }
          }
  });

  return { localStorage, sessionStorage };
}

export function installStructuredCloneChromeStorage(
  { localWriteDelayMs = 0 }: { localWriteDelayMs?: number } = {}
): void {
  const local = createChromeStorageArea(localWriteDelayMs);
  const session = createChromeStorageArea();

  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        lastError: undefined
      },
      storage: {
        local,
        session
      }
    }
  });
}

function createChromeStorageArea(writeDelayMs = 0) {
  const values = new Map<string, unknown>();

  return {
    get(key: string, callback: (items: Record<string, unknown>) => void): void {
      callback({ [key]: values.get(key) });
    },
    set(items: Record<string, unknown>, callback: () => void): void {
      // Firefox extension storage structured-clones values and rejects proxies.
      const cloned = structuredClone(items) as Record<string, unknown>;
      const commit = () => {
        for (const [key, value] of Object.entries(cloned)) {
          values.set(key, value);
        }
        callback();
      };
      if (writeDelayMs > 0) {
        setTimeout(commit, writeDelayMs);
      } else {
        commit();
      }
    },
    remove(key: string, callback: () => void): void {
      values.delete(key);
      callback();
    }
  };
}
