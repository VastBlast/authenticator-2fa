type StorageCallback = () => void;

class MockStorageArea {
  readError = '';
  writeError = '';
  writeDelayMs = 0;
  writes = 0;

  constructor(
    readonly values: Record<string, unknown>,
    private readonly runtime: { lastError: { message: string } | undefined }
  ) {}

  get(keys: string | string[] | null, callback: (items: Record<string, unknown>) => void): void {
    const selected = keys === null ? Object.keys(this.values) : typeof keys === 'string' ? [keys] : keys;
    const values = structuredClone(Object.fromEntries(selected
      .filter((key) => Object.hasOwn(this.values, key))
      .map((key) => [key, this.values[key]])));
    this.complete(this.readError, () => callback(values));
  }

  set(items: Record<string, unknown>, callback: StorageCallback): void {
    const snapshot = structuredClone(items);
    const commit = () => {
      if (!this.writeError) {
        Object.assign(this.values, snapshot);
        this.writes++;
      }
      this.complete(this.writeError, callback);
    };
    if (this.writeDelayMs > 0) setTimeout(commit, this.writeDelayMs);
    else queueMicrotask(commit);
  }

  remove(keys: string | string[], callback: StorageCallback): void {
    for (const key of typeof keys === 'string' ? [keys] : keys) delete this.values[key];
    this.complete('', callback);
  }

  private complete(message: string, callback: StorageCallback): void {
    this.runtime.lastError = message ? { message } : undefined;
    try { callback(); }
    finally { this.runtime.lastError = undefined; }
  }
}

/** Device switching is sequential; each profile keeps independent local/session data. */
export function createBrowserSyncNetwork() {
  const cloud: Record<string, unknown> = {};
  return {
    cloud,
    createDevice({ os = 'linux' }: { os?: chrome.runtime.PlatformInfo['os'] } = {}) {
      const runtime = {
        lastError: undefined as { message: string } | undefined,
        getPlatformInfo: (callback: (info: Pick<chrome.runtime.PlatformInfo, 'os'>) => void) => callback({ os })
      };
      const local = new MockStorageArea({}, runtime);
      const session = new MockStorageArea({}, runtime);
      const sync = new MockStorageArea(cloud, runtime);
      return {
        local,
        session,
        sync,
        install() {
          Object.defineProperty(globalThis, 'chrome', {
            configurable: true,
            value: { runtime, storage: { local, session, sync } }
          });
        }
      };
    }
  };
}

export type BrowserSyncDevice = ReturnType<ReturnType<typeof createBrowserSyncNetwork>['createDevice']>;
