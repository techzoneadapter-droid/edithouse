(async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('edithouse-projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const project=await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
 return {structures:project.analysis?.structures.map(s=>({name:s.name,strokes:s.mask?.strokes?.length})),choices:project.choices,catalogInProject:Object.hasOwn(project,'catalog'),focused:document.activeElement?.className};
})();
