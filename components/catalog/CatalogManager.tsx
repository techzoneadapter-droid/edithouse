"use client";
import {useRef,useState} from 'react';
import {readCatalogImage} from '@/lib/catalog/image-input';
import {saveCatalogImport} from '@/lib/catalog-store';
import {deduplicatePreview,type CatalogSnapshot,type PreviewColor,type SourceImage,type CatalogColor} from '@/lib/catalog/types';
import {importCatalog} from '@/lib/catalog-import';
type Props={catalog:CatalogSnapshot;ready:boolean;onChange:(catalog:CatalogSnapshot)=>void};
export default function CatalogManager({catalog,ready,onChange}:Props){
  const picker=useRef<HTMLInputElement>(null),cancel=useRef<AbortController|null>(null);
  const [brandId,setBrandId]=useState(''),[collectionId,setCollectionId]=useState(''),[query,setQuery]=useState('');
  const [rows,setRows]=useState<PreviewColor[]>([]),[images,setImages]=useState<SourceImage[]>([]);
  const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[preview,setPreview]=useState(false),[detail,setDetail]=useState<CatalogColor|null>(null);
  const [mergeBrand,setMergeBrand]=useState(''),[mergeCollection,setMergeCollection]=useState('');
  const [page,setPage]=useState(0);
  const brand=catalog.brands.find(b=>b.id===brandId);
  const visible=catalog.colors.filter(c=>(!brandId||c.brandId===brandId)&&(!collectionId||c.collectionId===collectionId)&&(`${c.code} ${c.name} ${catalog.brands.find(b=>b.id===c.brandId)?.name}`).toLowerCase().includes(query.toLowerCase()));
  async function recognize(files:File[]){
    if(!files.length)return;setBusy(true);setError('');setRows([]);setImages([]);setPreview(false);
    const controller=new AbortController();cancel.current=controller;const incoming:PreviewColor[]=[],sources:SourceImage[]=[],failures:string[]=[];
    try{
      for(let index=0;index<files.length;index++){
        if(controller.signal.aborted)break;
        const file=files[index];setStatus(`Đang đọc ảnh ${index+1}/${files.length} · ${file.name}`);
        try{
          const dataUrl=await readCatalogImage(file);setStatus(`Đang đọc ảnh ${index+1}/${files.length} · Đang nhận diện mã màu và lấy màu swatch`);
          const response=await fetch('/api/catalog/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl:dataUrl}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(180000)])});
          const result=await response.json();if(!response.ok)throw new Error(result.error||'Không đọc được bảng màu.');
          const source:SourceImage={id:crypto.randomUUID(),name:file.name,dataUrl,createdAt:new Date().toISOString(),pageTitle:result.pageTitle||''};sources.push(source);
          for(const swatch of result.swatches){incoming.push({id:crypto.randomUUID(),brand:result.brand||'',collection:result.collection||'',code:swatch.code,name:swatch.name,sourceImageId:source.id,sourceBox:swatch.box,confidence:swatch.confidence,rgb:swatch.rgb||[0,0,0],hex:swatch.hex||'',samplingError:swatch.samplingError||undefined,selected:!!swatch.code&&!swatch.samplingError});}
          setStatus(`Ảnh ${index+1}/${files.length} · Đã lấy pixel ${result.swatches.length} swatch`);
        }catch(e){if(controller.signal.aborted)break;failures.push(`${file.name}: ${e instanceof Error?e.message:'Không đọc được ảnh.'}`);}
      }
      if(controller.signal.aborted){setStatus('Đã hủy đọc bảng màu.');return;}
      const merged=deduplicatePreview(incoming);setRows(merged);setImages(sources);setPreview(merged.length>0);
      const brands=new Set(merged.map(c=>c.brand)),collections=new Set(merged.map(c=>c.collection));
      setMergeBrand(brands.size===1?merged[0]?.brand||'':'');setMergeCollection(collections.size===1?merged[0]?.collection||'':'');
      setError(failures.join('\n'));setStatus(`Đã nhận diện ${merged.length} màu từ ${sources.length} ảnh. Kiểm tra trước khi lưu.`);
    }finally{if(cancel.current===controller)cancel.current=null;setBusy(false);}
  }
  function patch(id:string,change:Partial<PreviewColor>){setRows(current=>current.map(row=>row.id===id?{...row,...change}:row));}
  async function save(){setBusy(true);setError('');try{const result=await saveCatalogImport(rows,images);onChange(result);setPreview(false);setRows([]);setImages([]);setStatus('Đã lưu bảng màu độc lập với project.');}catch(e){setError(e instanceof Error?e.message:'Không lưu được bảng màu.');}finally{setBusy(false);}}
  return <section className="catalog-manager" aria-label="Bảng màu sơn">
    <header><div><p className="eyebrow">CATALOGUE</p><h1>{preview?'NHẬN DIỆN BẢNG MÀU':'BẢNG MÀU SƠN'}</h1><p>AI tự đọc hãng, mã màu và màu sắc từ bảng màu</p></div>
      <button className="catalog-primary" disabled={!ready||busy||preview} onClick={()=>picker.current?.click()}>+ THÊM BẢNG MÀU BẰNG ẢNH</button></header>
    <input ref={picker} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden-input" onChange={e=>{const files=Array.from(e.currentTarget.files||[]);e.currentTarget.value='';void recognize(files);}}/>
    <p role="status">{!ready?'Đang mở catalogue…':status}</p>{error&&<p role="alert" className="catalog-error">{error}</p>}
    {busy&&cancel.current&&<button onClick={()=>cancel.current?.abort()}>Hủy đọc ảnh</button>}
    {preview?<>
      <div className="catalog-merge"><label>Hãng (áp dụng tất cả)<input value={mergeBrand} onChange={e=>{setMergeBrand(e.target.value);setRows(r=>r.map(c=>({...c,brand:e.target.value})));}} placeholder="Nhập tên hãng nếu chưa rõ"/></label><label>Collection (gom tất cả ảnh)<input value={mergeCollection} onChange={e=>{setMergeCollection(e.target.value);setRows(r=>r.map(c=>({...c,collection:e.target.value})));}}/></label></div>
      <p>Đã nhận diện: {rows.length} màu · {rows.filter(r=>r.selected).length} đã chọn. Màu lấy từ pixel ảnh; kiểm tra mã trên ảnh gốc.</p>
      <div className="catalog-actions"><button disabled={busy} onClick={()=>setRows(r=>r.map(c=>({...c,selected:!c.samplingError})))}>Chọn tất cả</button><button disabled={busy} onClick={()=>setRows(r=>r.map(c=>({...c,selected:false})))}>Bỏ chọn tất cả</button></div>
      <div className="catalog-preview">{rows.map(row=><article key={row.id} className="catalog-preview-row">
        <input aria-label={`Chọn mã ${row.code}`} type="checkbox" checked={row.selected} disabled={busy||!!row.samplingError} onChange={e=>patch(row.id,{selected:e.target.checked})}/>
        <span className="catalog-swatch" style={{background:row.hex||'transparent'}}/><div className="catalog-preview-fields">
          <label>Hãng<input value={row.brand} disabled={busy} onChange={e=>patch(row.id,{brand:e.target.value})}/></label><label>Collection<input value={row.collection} disabled={busy} onChange={e=>patch(row.id,{collection:e.target.value})}/></label>
          <label>Code<input value={row.code} disabled={busy} onChange={e=>patch(row.id,{code:e.target.value})}/></label><label>Name<input value={row.name} disabled={busy} onChange={e=>patch(row.id,{name:e.target.value})}/></label>
          <small>{row.hex||'Không lấy được màu'} · Tin cậy {Math.round(row.confidence*100)}%{row.confidence<.7?' · Cần kiểm tra OCR':''} · {images.find(i=>i.id===row.sourceImageId)?.name}</small>
          {row.samplingError&&<small className="catalog-error">{row.samplingError}</small>}
          <details><summary>Đối chiếu ảnh gốc</summary><div className="catalog-source-image"><img src={images.find(i=>i.id===row.sourceImageId)?.dataUrl} alt="Ảnh bảng màu để kiểm tra mã OCR" loading="lazy"/>{row.sourceBox?.length===4&&<span className="catalog-source-box" style={{left:row.sourceBox[0]/10+'%',top:row.sourceBox[1]/10+'%',width:row.sourceBox[2]/10+'%',height:row.sourceBox[3]/10+'%'}}/>}</div><small>Bbox lấy pixel: {row.sourceBox?.join(', ')}</small></details>
        </div>
      </article>)}</div>
      <div className="catalog-actions"><button disabled={busy} onClick={()=>{setPreview(false);setRows([]);setImages([]);setError('');}}>Hủy</button><button className="catalog-primary" disabled={busy||!rows.some(r=>r.selected)} onClick={save}>Lưu bảng màu</button></div>
    </>:<>
      <input aria-label="Tìm hãng / mã màu" placeholder="Tìm hãng / mã màu / tên màu…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
      <div className="catalog-brands"><button className={!brandId?'active':''} onClick={()=>{setBrandId('');setCollectionId('');setPage(0);}}>Tất cả · {catalog.colors.length} màu</button>{catalog.brands.filter(b=>!query||b.name.toLowerCase().includes(query.toLowerCase())||visible.some(c=>c.brandId===b.id)).map(b=><button key={b.id} className={brandId===b.id?'active':''} onClick={()=>{setBrandId(b.id);setCollectionId('');setQuery('');setPage(0);}}>{b.name} <span>{catalog.colors.filter(c=>c.brandId===b.id).length.toLocaleString()} màu</span></button>)}</div>
      <h2>{brand?.name||'HÃNG SƠN'}</h2><div className="catalog-actions"><button className={!collectionId?'active':''} onClick={()=>{setCollectionId('');setPage(0);}}>Tất cả collections</button>{catalog.collections.filter(c=>!brandId||c.brandId===brandId).map(c=><button className={collectionId===c.id?'active':''} key={c.id} onClick={()=>{setCollectionId(c.id);setPage(0);}}>{c.name||'Chưa đặt collection'}</button>)}</div>
      {!catalog.colors.length&&<p>Chưa có bảng màu. Thêm ảnh bảng màu để bắt đầu; không cần ảnh công trình.</p>}
      <div className="catalog-color-list">{visible.slice(page*100,(page+1)*100).map(color=><button className="catalog-color-info" key={color.id} onClick={()=>setDetail(color)}><span className="catalog-swatch" style={{background:color.hex}}/><span><strong>{color.code}</strong><small>{color.name}</small></span></button>)}</div>
      {visible.length>100&&<div className="catalog-actions"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>←</button><span>{page+1} / {Math.ceil(visible.length/100)}</span><button disabled={(page+1)*100>=visible.length} onClick={()=>setPage(p=>p+1)}>→</button></div>}
      <label className="catalog-secondary-import">Nhập CSV / XLSX (tùy chọn)<input type="file" accept=".csv,.xlsx" disabled={!ready||busy} onChange={async e=>{const input=e.currentTarget,file=input.files?.[0];if(!file)return;setBusy(true);setError('');try{const colors=await importCatalog(file);setRows(colors.map(c=>({id:crypto.randomUUID(),brand:c.brand||'',collection:c.collection||'',code:c.code,name:c.name,hex:c.hex,rgb:[parseInt(c.hex.slice(1,3),16),parseInt(c.hex.slice(3,5),16),parseInt(c.hex.slice(5,7),16)],sourceImageId:'',sourceBox:[0,0,0,0],confidence:1,selected:true})));setImages([]);setMergeBrand('');setMergeCollection('');setPreview(true);}catch(e){setError(e instanceof Error?e.message:'Không nhập được CSV.');}finally{input.value='';setBusy(false);}}}/></label>
    </>}
    {detail&&<div className="catalog-detail" role="dialog" aria-label="Thông tin màu"><button onClick={()=>setDetail(null)}>Đóng</button><span className="catalog-swatch" style={{background:detail.hex}}/><h2>{detail.code}</h2><p>{detail.name}</p><p>{catalog.brands.find(b=>b.id===detail.brandId)?.name} · {catalog.collections.find(c=>c.id===detail.collectionId)?.name}</p><p>{detail.hex} · RGB {detail.rgb.join(', ')}</p><small>Tin cậy OCR {Math.round(detail.confidence*100)}% · Màu đọc từ ảnh, không phải chuẩn đo màu vật lý.</small></div>}
  </section>;
}
