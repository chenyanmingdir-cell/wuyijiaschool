import type { AppData, BackupFile } from './types';

const DB_NAME = 'wuyijiaschool-pwa';
const STORE_NAME = 'kv';
const STATE_KEY = 'app-state';
const LS_KEY = 'wuyijiaschool-pwa:app-state';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getItem<T>(key: string): Promise<T | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function setItem<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadAppState<T extends AppData>(): Promise<T | null> {
  try {
    const stored = await getItem<T>(STATE_KEY);
    if (stored) return stored;
  } catch {
    // Fallback below.
  }

  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function saveAppState<T extends AppData>(state: T): Promise<void> {
  try {
    await setItem(STATE_KEY, state);
  } catch {
    // Ignore IndexedDB failures and use localStorage fallback.
  }

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // Last resort: nothing else to do.
  }
}

export function createBackupPayload(data: AppData): BackupFile {
  return {
    app: 'wuyijiaschool-pwa',
    exportedAt: new Date().toISOString(),
    data
  };
}

export function parseBackupPayload(input: string): BackupFile {
  const parsed = JSON.parse(input) as BackupFile;

  if (parsed.app !== 'wuyijiaschool-pwa') {
    throw new Error('备份文件不是舞艺嘉学校 PWA 数据');
  }

  if (!parsed.data || parsed.data.version !== 1) {
    throw new Error('备份文件版本不正确');
  }

  return parsed;
}

export async function exportBackup(data: AppData): Promise<string> {
  return JSON.stringify(createBackupPayload(data), null, 2);
}

export async function importBackup(file: File): Promise<AppData> {
  const text = await file.text();
  return parseBackupPayload(text).data;
}
