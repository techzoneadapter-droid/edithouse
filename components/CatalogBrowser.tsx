"use client";
import { useMemo, useState } from 'react';
import type { PaintColor } from '@/lib/catalog';
type Props={colors:PaintColor[];collection:string;onCollection:(collection:string)=>void;onManage:()=>void;onChoose:(color:PaintColor)=>void;favorites:string[];recent:string[];onFavorite:(id:string)=>void};
export default function CatalogBrowser({colors,collection,onCollection,onManage,onChoose,favorites,recent,onFavorite}:Props) {
  const [query,setQuery]=useState(''),[mode,setMode]=useState('all'),[page,setPage]=useState(0);
  const collections=useMemo(()=>[...new Set(colors.map(c=>c.collection||''))].filter(Boolean),[colors]);
  const visible=useMemo(()=>colors.filter(c=>(!collection||c.collection===collection)&&(mode!=='favorites'||favorites.includes(c.id))&&(mode!=='recent'||recent.includes(c.id))&&(`${c.code} ${c.name}`).toLowerCase().includes(query.toLowerCase())),[colors,collection,mode,favorites,recent,query]);
  return <div className="catalog-browser">
    <button className="tool-btn" onClick={onManage}>Mở quản lý bảng màu / thêm ảnh</button>
    <label>Collection<select aria-label="Collection" value={collection} onChange={e=>{onCollection(e.target.value);setPage(0);}}><option value="">Tất cả</option>{collections.map(c=><option key={c}>{c}</option>)}</select></label>
    <input aria-label="Search mã màu" placeholder="Tìm mã màu / tên màu" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
    <select aria-label="Loại danh sách" value={mode} onChange={e=>{setMode(e.target.value);setPage(0);}}><option value="all">Tất cả màu</option><option value="favorites">Yêu thích</option><option value="recent">Gần đây</option></select>
    <small>{visible.length.toLocaleString()} màu</small>
    <div className="color-grid">{visible.slice(page*60,(page+1)*60).map(c=><div key={c.id} className="catalog-color"><button className="color-card" title={`${c.brand||'EditHouse'} · ${c.code}`} onClick={()=>onChoose(c)}><span className="color-chip" style={{background:c.hex}}/><strong>{c.code}</strong><small>{c.name}</small></button><button className="favorite-color" aria-label={`Yêu thích ${c.code}`} onClick={()=>onFavorite(c.id)}>{favorites.includes(c.id)?'★':'☆'}</button></div>)}</div>
    {!visible.length&&<p>Chưa có màu phù hợp. Mở Bảng màu để thêm ảnh.</p>}
    <div className="catalog-pages"><button disabled={!page} onClick={()=>setPage(p=>p-1)}>←</button><span>{page+1} / {Math.max(1,Math.ceil(visible.length/60))}</span><button disabled={(page+1)*60>=visible.length} onClick={()=>setPage(p=>p+1)}>→</button></div>
  </div>;
}
