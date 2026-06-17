// ============================================================
// Orion Engine – Persistence (IndexedDB)
// ============================================================

import type { Scene } from '../ecs/types';

const DB_NAME = 'OrionEngine';
const DB_VERSION = 1;
const SCENES_STORE = 'scenes';
const ASSETS_STORE = 'gltf_assets'; // ArrayBuffer por fileName

export interface SceneMetadata {
  id: string;
  name: string;
  savedAt: number;
  entityCount: number;
  thumbnail?: string;
}

export interface SavedSceneRecord {
  id: string;
  name: string;
  savedAt: number;
  entityCount: number;
  scene: Scene;
}

// ── DB Bootstrap ─────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SCENES_STORE)) {
        db.createObjectStore(SCENES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        db.createObjectStore(ASSETS_STORE, { keyPath: 'fileName' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Scene CRUD ───────────────────────────────────────────────

export async function saveScene(scene: Scene): Promise<void> {
  const db = await openDB();
  const record: SavedSceneRecord = {
    id: scene.id,
    name: scene.name,
    savedAt: Date.now(),
    entityCount: Object.keys(scene.entities).length,
    scene,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCENES_STORE, 'readwrite');
    tx.objectStore(SCENES_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadScene(id: string): Promise<SavedSceneRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCENES_STORE, 'readonly');
    const req = tx.objectStore(SCENES_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listScenes(): Promise<SceneMetadata[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCENES_STORE, 'readonly');
    const req = tx.objectStore(SCENES_STORE).getAll();
    req.onsuccess = () => {
      const records = (req.result as SavedSceneRecord[]).map((r) => ({
        id: r.id,
        name: r.name,
        savedAt: r.savedAt,
        entityCount: r.entityCount,
      }));
      // Mais recentes primeiro
      records.sort((a, b) => b.savedAt - a.savedAt);
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteScene(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCENES_STORE, 'readwrite');
    tx.objectStore(SCENES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── GLTF Asset Storage ───────────────────────────────────────

export interface StoredAsset {
  fileName: string;
  buffer: ArrayBuffer;
  size: number;
  savedAt: number;
}

export async function saveGLTFAsset(fileName: string, buffer: ArrayBuffer): Promise<void> {
  const db = await openDB();
  const record: StoredAsset = { fileName, buffer, size: buffer.byteLength, savedAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSETS_STORE, 'readwrite');
    tx.objectStore(ASSETS_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadGLTFAsset(fileName: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSETS_STORE, 'readonly');
    const req = tx.objectStore(ASSETS_STORE).get(fileName);
    req.onsuccess = () => {
      const record = req.result as StoredAsset | undefined;
      if (!record) { resolve(null); return; }
      fetch('/api/asset/' + encodeURIComponent(fileName), { method: 'POST', body: record.buffer }).catch(() => {});
      resolve('/api/asset/' + encodeURIComponent(fileName));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function listAssets(): Promise<Omit<StoredAsset, 'buffer'>[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSETS_STORE, 'readonly');
    const req = tx.objectStore(ASSETS_STORE).getAll();
    req.onsuccess = () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      resolve((req.result as StoredAsset[]).map(({ buffer, ...rest }) => rest));
    };
    req.onerror = () => reject(req.error);
  });
}


