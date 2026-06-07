import type { RepairOrder } from '../types';

const DB_NAME = 'maybachtech_db';
const STORE_NAME = 'repairOrders';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadAllROs(): Promise<RepairOrder[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const saved = (req.result || []) as RepairOrder[];
        resolve(
          saved.map((ro) => {
            if (ro.vehicle && ro.vehicle.make === undefined) {
              ro.vehicle.make = '';
            }
            return ro;
          })
        );
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IDB load failed, falling back to empty', e);
    return [];
  }
}

export async function saveROToDB(ro: RepairOrder): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(ro);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IDB save failed', e);
  }
}

export async function deleteROFromDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IDB delete failed', e);
  }
}