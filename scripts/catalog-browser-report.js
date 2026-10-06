(async()=>{
  const read=async(name,stores)=>new Promise((resolve,reject)=>{
    const request=indexedDB.open(name);request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const db=request.result,tx=db.transaction(stores,'readonly'),result={};
      for(const store of stores){const query=tx.objectStore(store).getAll();query.onsuccess=()=>{result[store]=query.result;};}
      tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>reject(tx.error);
    };
  });
  const catalog=await read('edithouse-catalog',['brands','collections','colors','sourceImages']);
  const project=await read('edithouse-projects',['projects']);
  return {brands:catalog.brands.map(b=>({name:b.name,count:catalog.colors.filter(c=>c.brandId===b.id).length})),colors:catalog.colors.map(c=>({code:c.code,name:c.name,hex:c.hex,collectionId:c.collectionId})),sourceImages:catalog.sourceImages.length,projectContainsCatalog:project.projects.some(p=>Object.hasOwn(p,'catalog'))};
})();
