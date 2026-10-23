// 사용자 API 키를 기기 안에서 암호화해 보관 — AES-GCM, 암호 키는 꺼낼 수 없는(non-extractable) 형태로 IndexedDB에 둔다.
// 저장 파일·백업을 들여다보거나 값을 복사해 가는 것은 막지만, 같은 사이트에서 실행되는 스크립트는 막지 못한다(설정 화면 안내 참고).
import type { KeySlot } from "./config";

export interface Sealed {
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

export function newMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function seal(key: CryptoKey, text: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { iv, data };
}

export async function unseal(key: CryptoKey, box: Sealed): Promise<string> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: box.iv }, key, box.data);
  return new TextDecoder().decode(plain);
}

const DB_NAME = "u18-ai";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function masterKey(): Promise<CryptoKey> {
  const saved = await tx<CryptoKey | undefined>("readonly", (s) => s.get("master"));
  if (saved) return saved;
  const key = await newMasterKey();
  await tx("readwrite", (s) => s.put(key, "master"));
  return key;
}

export async function saveApiKey(slot: KeySlot, apiKey: string) {
  const box = await seal(await masterKey(), apiKey.trim());
  await tx("readwrite", (s) => s.put(box, `key:${slot}`));
  // 저장소가 브라우저 정리 대상에서 빠지도록 요청한다(허용 여부는 브라우저가 정함).
  navigator.storage?.persist?.().catch(() => undefined);
}

export async function loadApiKey(slot: KeySlot): Promise<string | null> {
  try {
    const box = await tx<Sealed | undefined>("readonly", (s) => s.get(`key:${slot}`));
    return box ? await unseal(await masterKey(), box) : null;
  } catch {
    return null; // 저장소 차단·암호 키 분실이면 키가 없는 것으로 본다
  }
}

export async function deleteApiKey(slot: KeySlot) {
  await tx("readwrite", (s) => s.delete(`key:${slot}`));
}

// 화면 표시용 — 앞 4자와 끝 4자만 남긴다.
export const maskKey = (k: string) => (k.length > 10 ? `${k.slice(0, 4)}…${k.slice(-4)}` : "••••");
