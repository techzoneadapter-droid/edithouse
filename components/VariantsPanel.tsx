"use client";
import { useState } from 'react';
type Variant={id:string;name:string;image:string};
type Props<T extends Variant>={variants:T[];disabled:boolean;onSave:()=>void;onLoad:(v:T)=>void;onChange:(variants:T[])=>void};
export default function VariantsPanel<T extends Variant>({variants,disabled,onSave,onLoad,onChange}:Props<T>) {
  const [first,setFirst]=useState('');const [second,setSecond]=useState('');const [compare,setCompare]=useState(false);
  return <div className="variants-panel">
    <button disabled={disabled} onClick={onSave}>+ Lưu phương án hiện tại</button>
    <div className="variant-list">{variants.map(v=><div key={v.id} className="variant-row"><input aria-label="Tên phương án" disabled={disabled} value={v.name} onChange={e=>onChange(variants.map(x=>x.id===v.id?{...x,name:e.target.value}:x))}/><button disabled={disabled} onClick={()=>onLoad(v)}>Mở</button><button disabled={disabled} title="Nhân bản" onClick={()=>onChange([...variants,{...structuredClone(v),id:crypto.randomUUID(),name:v.name+' (bản sao)'}])}>⧉</button><button disabled={disabled} title="Xóa phương án" onClick={()=>onChange(variants.filter(x=>x.id!==v.id))}>×</button></div>)}</div>
    {variants.length>1 && <div className="variant-compare"><select aria-label="Phương án A" value={first} onChange={e=>setFirst(e.target.value)}><option value="">Phương án A</option>{variants.filter(v=>v.image).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><select aria-label="Phương án B" value={second} onChange={e=>setSecond(e.target.value)}><option value="">Phương án B</option>{variants.filter(v=>v.image).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><button disabled={!first||!second||first===second} onClick={()=>setCompare(true)}>So sánh</button></div>}
    {compare && <div className="variants-modal"><button onClick={()=>setCompare(false)}>Đóng</button><div>{[first,second].map(id=>{const v=variants.find(x=>x.id===id);return <figure key={id}><figcaption>{v?.name}</figcaption><img src={v?.image} alt={v?.name}/></figure>;})}</div></div>}
  </div>;
}
