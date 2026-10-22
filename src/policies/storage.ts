import { msg } from "../i18n/core";
import type { SavedPolicy } from "../types";
const db = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("microduck-policies", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("policies", { keyPath: "def.id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
async function transaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction("policies", mode);
    const r = work(tx.objectStore("policies"));
    tx.oncomplete = () => {
      d.close();
      resolve(r.result);
    };
    tx.onerror = () => {
      d.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      d.close();
      reject(tx.error ?? new Error(msg("浏览器存储不可用")));
    };
  });
}
export const listPolicies = () =>
  transaction("readonly", (s) => s.getAll()) as Promise<SavedPolicy[]>;
export const savePolicy = (p: SavedPolicy) =>
  transaction("readwrite", (s) => s.put(p));
export const deletePolicy = (id: string) =>
  transaction("readwrite", (s) => s.delete(id));
