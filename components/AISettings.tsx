"use client";
import { useCallback, useEffect, useState } from 'react';
import { ROLES, type Role, type Model, type Mode } from '@/lib/ai/types';
const labels: Record<Role,string> = {VISION_ANALYZE:'Nhận diện công trình',MASK_ANALYZE:'Phân tích mask',CATALOG_OCR:'OCR bảng màu',IMAGE_RENDER:'Phối màu ảnh',TEXT_HELPER:'Trợ giúp text'};
const modes = {economy:'Tiết kiệm nhất',balanced:'Cân bằng',quality:'Chất lượng cao nhất'};
export default function AISettings({onClose,onUpdate}:{onClose:()=>void;onUpdate:(s:any)=>void}) {
  const [data,setData] = useState<any>(null), [key,setKey] = useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[mode,setMode]=useState<Mode>('balanced'),[overrides,setOverrides]=useState<Partial<Record<Role,string>>>({});
  const call = useCallback(async (url:string,body?:object) => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});
      const result = await response.json(); if(!response.ok) throw new Error(result.error || 'Không thể kết nối.');
      if (result.provider) {setData(result);setMode(result.mode);setOverrides(result.overrides || {});onUpdate(result);setMessage(result.error || (result.warnings || []).join('\n') || 'Đã cập nhật cấu hình.');}
      else setMessage(`Kiểm tra PASS · ${result.model}`);
      return true;
    } catch(e) {setMessage(e instanceof Error?e.message:'Không thể kết nối.');return false;} finally {setBusy(false);}
  },[onUpdate]);
  useEffect(()=>{void call('/api/ai/status');},[call]);
  return <div className="ai-settings-backdrop"><section className="ai-settings" role="dialog" aria-modal="true" aria-label="AI Provider">
    <header><h2>AI PROVIDER</h2><button onClick={onClose} aria-label="Đóng">✕</button></header>
    <label>Provider<select disabled><option>Experiential Labs</option></select></label>
    <label>Base URL<input readOnly value="https://api.experientiallabs.ai/v1"/></label>
    <p>{data?.connected?'● Đã kết nối Experiential Labs':data?.configured?'● Mất kết nối Experiential Labs':'● Chưa cấu hình'} · Model khả dụng: {data?.modelCount || 0}</p>
    <label>API Key {data?.keyPreview && <small>{data.keyPreview}</small>}<input autoComplete="off" type={show?'text':'password'} placeholder="xpl_…" value={key} onChange={e=>setKey(e.target.value)}/></label>
    <div className="ai-actions"><button onClick={()=>setShow(!show)}>{show?'Ẩn key':'Hiện key'}</button><button disabled={busy||!key.startsWith('xpl_')} onClick={async()=>{if(await call('/api/settings/ai/connect',{provider:'experiential',apiKey:key})) {setKey('');setMessage('Đã xác thực API và lưu key mã hóa.');}}}>Kiểm tra kết nối & lưu key</button></div>
    <label>Tối ưu AI<select value={mode} onChange={e=>setMode(e.target.value as Mode)}>{Object.entries(modes).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
    <div className="ai-actions"><button disabled={busy} onClick={()=>call('/api/settings/ai',{mode,overrides})}>Lưu</button><button disabled={busy||!data?.configured} onClick={()=>call('/api/ai/models?refresh=1')}>↻ Làm mới models</button><button disabled={busy||!data?.configured} onClick={async()=>{if(await call('/api/settings/ai',{mode,overrides:{}})) await call('/api/ai/models',{});}}>✨ Tự chọn model tối ưu</button></div>
    <p role="status" style={{whiteSpace:'pre-wrap'}}>{busy?'Đang kết nối / tải metadata…':message}</p>
    {ROLES.map(role=>{const models:Model[]=data?.models||[], m=models.find(m=>m.slug === (overrides[role] || data?.selected?.[role]));return <article key={role} className="ai-model-card">
      <h3>{labels[role]}</h3><small>{overrides[role]?'MANUAL':'AUTO'} · {modes[mode]}</small>
      <select aria-label={labels[role]} value={overrides[role]||''} onChange={e=>setOverrides({...overrides,[role]:e.target.value})}><option value="">AUTO</option>{models.filter(m=>m.roles.includes(role)).map(m=><option key={m.slug} value={m.slug}>{m.name}</option>)}</select>
      <strong>{m?.name || 'Chưa có model đủ capability'}</strong>
      {m && <><p>{m.provider} · {m.slug}</p><p>Input: {m.pricing.input===null?'UNKNOWN':`$${m.pricing.input} / 1M`} · Output: {m.pricing.output===null?'UNKNOWN':`$${m.pricing.output} / 1M`}</p><p>Image input {m.inputModalities.includes('image')?'✓':'—'} · Image output {m.outputModalities.includes('image')?'✓':'—'} · JSON schema {m.supportsStructuredOutput?'✓':'—'}</p><p>Uptime {m.uptime??'UNKNOWN'}% · Throughput {m.throughput??'UNKNOWN'} · TTFT {m.ttft??'UNKNOWN'} · Context {m.context??'UNKNOWN'}</p><p>Retention {m.retention??'UNKNOWN'} · {m.promotional?'Có khuyến mãi (giá theo key)':''}</p></>}
      <small>Fallback: {(data?.fallbacks?.[role]||[]).slice(1).join(', ') || '—'}</small>
      {m?.promotions?.map(p=><p key={p.label}>{p.label} · {p.free?'Free theo điều kiện chương trình':`${p.percentOff}% OFF`} · Điều kiện và hạn mức do gateway kiểm tra; giá ưu tiên metadata của key.</p>)}
      {role==='IMAGE_RENDER' && <p>Thao tác test render có thể sử dụng credit.</p>}
      <button disabled={busy||!m} onClick={async()=>{if(role==='IMAGE_RENDER'&&!window.confirm('Thao tác có thể sử dụng credit. Test render model?'))return; if(await call('/api/settings/ai',{mode,overrides}))await call('/api/ai/test',{role,confirmCredit:role==='IMAGE_RENDER'});}}>{role==='IMAGE_RENDER'?'Test render model':'Kiểm tra'}</button>
      {data?.debug && <details><summary>Tại sao model được chọn?</summary>{data.debug[role].map((d:any)=><p key={d.slug}>{d.slug}: {d.score<0?'REJECTED':`${d.score.toFixed(1)}/100`} · {d.reasons.join(' · ')}</p>)}</details>}
    </article>;})}
  </section></div>;
}
