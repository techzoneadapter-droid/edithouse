const DB = 'edithouse-projects';
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('projects');
    request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
  });
}
export async function saveProject<T>(project:T): Promise<void> {
  const db=await openDB();
  try { await new Promise<void>((resolve,reject)=>{ const tx=db.transaction('projects','readwrite'); tx.objectStore('projects').put(project,'current'); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error); }); } finally { db.close(); }
}
export async function loadProject<T>(): Promise<T | undefined> {
  const db=await openDB();
  try { return await new Promise<T | undefined>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get('current');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}); } finally { db.close(); }
}
