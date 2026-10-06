"use client";
import { useMemo, useState } from 'react';
import type { PaintColor } from '@/lib/catalog';
import { importCatalog } from '@/lib/catalog-import';
type Props={colors:PaintColor[];onImport:(colors:PaintColor[])=>void;onChoose:(color:PaintColor)=>void;favorites:string[];recent:string[];onFavorite:(id:string)=>void;onError:(message:string)=>void};
export default function CatalogBrowser({colors,onImport,onChoose,favorites,recent,onFavorite,onError}:Props) {
  const [query,setQuery]=useState('');const [brand,setBrand]=useState('');const [collection,setCollection]=useState('');const [tone,setTone]=useState('');const [mode,setMode]=useState('all');const [page,setPage]=useState(0);const [busy,setBusy]=useState(false);
  const brands=useMemo(()=>[...new Set(colors.map(c=>c.brand||'EditHouse'))],[colors]);
  const collections=useMemo(()=>[...new Set(colors.filter(c=>!brand||(c.brand||'EditHouse')===brand).map(c=>c.collection||''))].filter(Boolean),[colors,brand]);
  const tones=useMemo(()=>[...new Set(colors.map(c=>c.family))].filter(Boolean),[colors]);
  const visible=useMemo(()=>colors.filter(c=>(!brand||(c.brand||'EditHouse')===brand)&&(!collection||c.collection===collection)&&(!tone||c.family===tone)&&(mode!=='favorites'||favorites.includes(c.id))&&(mode!=='recent'||recent.includes(c.id))&&(`${c.name} ${c.code} ${c.brand||'EditHouse'}`).toLowerCase().includes(query.toLowerCase())),[colors,brand,collection,tone,mode,favorites,recent,query]);
  const reset=()=>setPage(0);
  return <div className="catalog-browser">
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
