import type {CatalogSnapshot, PreviewColor, SourceImage} from './catalog/types';
import {emptyCatalog,normalizeBrand,deduplicatePreview} from './catalog/types';
const DB='edithouse-catalog';
const STORES=['brands','collections','colors','sourceImages'] as const;
function openDB():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{
    const db=request.result;for(const name of STORES)db.createObjectStore(name,{keyPath:'id'});
    const colors=request.transaction!.objectStore('colors');
    for(const name of ['brandId','collectionId','code','name'])colors.createIndex(name,name,{unique:false});
  };
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Đóng tab EditHouse cũ để mở catalogue.'));
});}
export async function loadCatalog():Promise<CatalogSnapshot>{
  const db=await openDB();try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction([...STORES],'readonly'),result=emptyCatalog();
    for(const store of STORES){const request=tx.objectStore(store).getAll();request.onsuccess=()=>{(result[store] as unknown[])=request.result;};}
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
export async function saveCatalogImport(rows:PreviewColor[],images:SourceImage[]):Promise<CatalogSnapshot>{
  const selected=deduplicatePreview(rows.filter(c=>c.selected));
  if(!selected.length)throw new Error('Chọn ít nhất một màu.');
  for(const row of selected){if(!row.brand.trim())throw new Error('Nhập tên hãng trước khi lưu.');if(!row.code.trim())throw new Error('Nhập mã đúng như trên ảnh hoặc bỏ chọn dòng thiếu mã.');if(row.samplingError||!/^#[0-9A-F]{6}$/i.test(row.hex))throw new Error('Ô màu chưa có pixel hợp lệ.');}
  const db=await openDB();
  try {await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction([...STORES],'readwrite');
    const result=emptyCatalog();let pending=STORES.length;
    for(const store of STORES){const request=tx.objectStore(store).getAll();request.onsuccess=()=>{(result[store] as unknown[])=request.result;if(--pending===0)write();};}
    function write(){try{
      const now=new Date().toISOString();
      for(const row of selected){
        let brand=result.brands.find(b=>b.normalizedName===normalizeBrand(row.brand));
        if(!brand){brand={id:crypto.randomUUID(),name:row.brand.trim(),normalizedName:normalizeBrand(row.brand),createdAt:now,updatedAt:now};result.brands.push(brand);}else brand.updatedAt=now;
        let collection=result.collections.find(c=>c.brandId===brand!.id&&c.name.toLowerCase()===row.collection.trim().toLowerCase());
        if(!collection){collection={id:crypto.randomUUID(),brandId:brand.id,name:row.collection.trim(),createdAt:now,sourceImages:[]};result.collections.push(collection);}
        if(row.sourceImageId&&!collection.sourceImages.includes(row.sourceImageId))collection.sourceImages.push(row.sourceImageId);
        const previous=result.colors.find(c=>c.brandId===brand!.id&&c.collectionId===collection!.id&&c.code===row.code);
        if(!previous||row.confidence>previous.confidence){const color={id:previous?.id||crypto.randomUUID(),brandId:brand.id,collectionId:collection.id,code:row.code,name:row.name,hex:row.hex,rgb:row.rgb,sourceImageId:row.sourceImageId,sourceBox:row.sourceBox,confidence:row.confidence};tx.objectStore('colors').put(color);if(previous)Object.assign(previous,color);else result.colors.push(color);}
      }
      for(const brand of result.brands)tx.objectStore('brands').put(brand);
      for(const collection of result.collections)tx.objectStore('collections').put(collection);
      const used=new Set(selected.map(c=>c.sourceImageId));for(const image of images)if(used.has(image.id))tx.objectStore('sourceImages').put(image);
    }catch(e){tx.abort();reject(e);}}
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Không lưu được catalogue.'));
  });}finally{db.close();}
  return loadCatalog();
}
