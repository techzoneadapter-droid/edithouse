"use client";
import { useMemo, useState } from 'react';
import type { PaintColor } from '@/lib/catalog';
import { importCatalog, importRows } from '@/lib/catalog-import';
import { fileToOptimizedDataUrl } from '@/lib/image-client';
type Props={colors:PaintColor[];onImport:(colors:PaintColor[])=>void;onChoose:(color:PaintColor)=>void;favorites:string[];recent:string[];onFavorite:(id:string)=>void;onError:(message:string)=>void};
export default function CatalogBrowser({colors,onImport,onChoose,favorites,recent,onFavorite,onError}:Props) {
  const [query,setQuery]=useState('');const [brand,setBrand]=useState('');const [collection,setCollection]=useState('');const [tone,setTone]=useState('');const [mode,setMode]=useState('all');const [page,setPage]=useState(0);const [busy,setBusy]=useState(false);
  const brands=useMemo(()=>[...new Set(colors.map(c=>c.brand||'EditHouse'))],[colors]);
  const collections=useMemo(()=>[...new Set(colors.filter(c=>!brand||(c.brand||'EditHouse')===brand).map(c=>c.collection||''))].filter(Boolean),[colors,brand]);
  const tones=useMemo(()=>[...new Set(colors.map(c=>c.family))].filter(Boolean),[colors]);
  const visible=useMemo(()=>colors.filter(c=>(!brand||(c.brand||'EditHouse')===brand)&&(!collection||c.collection===collection)&&(!tone||c.family===tone)&&(mode!=='favorites'||favorites.includes(c.id))&&(mode!=='recent'||recent.includes(c.id))&&(`${c.name} ${c.code} ${c.brand||'EditHouse'}`).toLowerCase().includes(query.toLowerCase())),[colors,brand,collection,tone,mode,favorites,recent,query]);
  const reset=()=>setPage(0);
  return <div className="catalog-browser">
    <label className="catalog-import">{busy?'Đang đọc…':'OCR ảnh bảng màu (HEX ước tính)'}<input type="file" disabled={busy} accept="image/png,image/jpeg,image/webp" onChange={async e=>{const input=e.currentTarget,file=input.files?.[0];if(!file)return;setBusy(true);try{const response=await fetch('/api/catalog/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl:await fileToOptimizedDataUrl(file)}),signal:AbortSignal.timeout(180000)});const result=await response.json();if(!response.ok)throw new Error(result.error);const rows=(result.swatches||[]).filter((s:any)=>s.name&&s.code&&/^#[0-9a-f]{6}$/i.test(s.hex));if(!rows.length)throw new Error('Không đọc được mã và màu hợp lệ. Có thể nhập CSV thủ công.');onImport(importRows([['brand','collection','color_name','color_code','hex'],...rows.map((s:any)=>[result.brand||'OCR chưa rõ hãng',result.collection||'',s.name,s.code,s.hex])]));reset();}catch(err){onError(err instanceof Error?err.message:'Không đọc được bảng màu.');}finally{setBusy(false);input.value='';}}}/></label>
    <label className="catalog-import">{busy?'Đang nhập…':'Import CSV / XLSX'}<input type="file" disabled={busy} accept=".csv,.xlsx" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);try{onImport(await importCatalog(file));reset();}catch(err){onError(err instanceof Error?err.message:'Không nhập được catalogue.');}finally{setBusy(false);e.target.value='';}}}/></label>
    <input aria-label="Tìm màu" placeholder="Tìm tên / mã / hãng" value={query} onChange={e=>{setQuery(e.target.value);reset();}}/>
    <select aria-label="Lọc hãng" value={brand} onChange={e=>{setBrand(e.target.value);setCollection('');reset();}}><option value="">Tất cả hãng</option>{brands.map(b=><option key={b}>{b}</option>)}</select>
    <select aria-label="Lọc collection" value={collection} onChange={e=>{setCollection(e.target.value);reset();}}><option value="">Tất cả collection</option>{collections.map(c=><option key={c}>{c}</option>)}</select>
    <select aria-label="Lọc tone" value={tone} onChange={e=>{setTone(e.target.value);reset();}}><option value="">Tất cả tone màu</option>{tones.map(t=><option key={t}>{t}</option>)}</select>
    <select aria-label="Loại danh sách" value={mode} onChange={e=>{setMode(e.target.value);reset();}}><option value="all">Tất cả màu</option><option value="favorites">Yêu thích</option><option value="recent">Gần đây</option></select>
    <small>{visible.length.toLocaleString()} màu · mã nhập từ catalogue của bạn</small>
    <div className="color-grid">{visible.slice(page*60,(page+1)*60).map(c=><div key={c.id} className="catalog-color"><button className="color-card" title={`${c.brand||'EditHouse'} · ${c.code}`} onClick={()=>onChoose(c)}><span className="color-chip" style={{background:c.hex}}/><span>{c.name}</span><small>{c.code}</small></button><button className="favorite-color" aria-label={`Yêu thích ${c.name}`} onClick={()=>onFavorite(c.id)}>{favorites.includes(c.id)?'★':'☆'}</button></div>)}</div>
    <div className="catalog-pages"><button disabled={!page} onClick={()=>setPage(page-1)}>←</button><span>{page+1} / {Math.max(1,Math.ceil(visible.length/60))}</span><button disabled={(page+1)*60>=visible.length} onClick={()=>setPage(page+1)}>→</button></div>
  </div>;
}
