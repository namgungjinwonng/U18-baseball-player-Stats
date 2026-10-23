// AI 분석 결과 전용 IndexedDB — API 키 DB와 분리하고 트랜잭션 완료 후에만 저장 성공을 반환한다.
const DB_NAME = "u18-ai-analysis-v2";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("entries", { keyPath: "id" });
      req.result.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("분석 저장소를 열 수 없습니다."));
  });
}

export const dbRequest = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export async function cacheTransaction<T>(mode: IDBTransactionMode, run: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(["entries", "meta"], mode);
    const completed = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("분석 저장이 취소됐습니다."));
      tx.onerror = () => reject(tx.error);
    });
    const running = run(tx).catch((error) => {
      try { tx.abort(); } catch { /* 이미 끝난 트랜잭션은 원래 오류를 그대로 전달한다. */ }
      throw error;
    });
    const [value] = await Promise.all([running, completed]);
    return value;
  } finally {
    db.close();
  }
}
