const DATABASE='filacero-offline-v1',STORE='tickets';
function connect(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('IndexedDB no disponible'));return;}
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function saveOfflineTicket(ticket){
  const db=await connect();
  return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({ ...ticket, savedAt:new Date().toISOString() },'current');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});
}
export async function loadOfflineTicket(){
  const db=await connect();
  return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const request=tx.objectStore(STORE).get('current');request.onsuccess=()=>{db.close();resolve(request.result??null);};request.onerror=()=>{db.close();reject(request.error);};});
}
export async function deleteOfflineTicket(){
  const db=await connect();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete('current');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});
}
