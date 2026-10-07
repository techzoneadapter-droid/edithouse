"use client";

import { useCallback, useEffect, useState } from "react";
import { ROLES, type Role, type Model, type Mode } from "@/lib/ai/types";

const labels: Record<Role,string> = {
  VISION_ANALYZE:"Nhận diện công trình",
  MASK_ANALYZE:"Phân tích mask",
  CATALOG_OCR:"OCR bảng màu",
  IMAGE_RENDER:"Hiệu ứng vật liệu",
  TEXT_HELPER:"Trợ giúp text"
};

const modes: Record<Mode,string> = {
  economy:"Tiết kiệm nhất",
  balanced:"Cân bằng",
  quality:"Chất lượng cao nhất"
};

const OPENAI_MODELS = [
  ["gpt-5.6-terra","GPT-5.6 Terra · tiết kiệm/cân bằng"],
  ["gpt-5.6","GPT-5.6 Sol · khuyến nghị"],
  ["gpt-6-astra","GPT-6 Astra · chính xác cao nhất"]
] as const;

export default function AISettings({
  onClose,
  onUpdate
}:{onClose:()=>void;onUpdate:(s:any)=>void}) {
  const [data,setData]=useState<any>(null);
  const [key,setKey]=useState("");
  const [openaiKey,setOpenaiKey]=useState("");
  const [openaiModel,setOpenaiModel]=useState("gpt-5.6");
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [mode,setMode]=useState<Mode>("balanced");
  const [overrides,setOverrides]=useState<Partial<Record<Role,string>>>({});

  const call=useCallback(async(url:string,body?:object)=>{
    setBusy(true);
    setMessage("");
    try{
      const response=await fetch(url,{
        method:body?"POST":"GET",
        headers:{"Content-Type":"application/json"},
        body:body?JSON.stringify(body):undefined,
        signal:AbortSignal.timeout(120000)
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Không thể kết nối.");
      if(result.provider){
        setData(result);
        setMode(result.mode);
        setOverrides(result.overrides||{});
        setOpenaiModel(result.openaiModel||"gpt-5.6");
        onUpdate(result);
      }
      setMessage(result.error||(result.warnings||[]).join("\n")||"Đã cập nhật cấu hình.");
      return result;
    }catch(e){
      setMessage(e instanceof Error?e.message:"Không thể kết nối.");
      return null;
    }finally{
      setBusy(false);
    }
  },[onUpdate]);

  useEffect(()=>{void call("/api/ai/status");},[call]);

  return (
    <div className="ai-settings-backdrop">
      <section className="ai-settings" role="dialog" aria-modal="true" aria-label="AI Provider">
        <header>
          <div>
            <h2>AI / CHATGPT</h2>
            <small>Bộ não phân tích kiến trúc của EditHouse</small>
          </div>
          <button onClick={onClose} aria-label="Đóng">✕</button>
        </header>

        <article className="ai-model-card">
          <h3>ChatGPT / OpenAI · Tách thành phần nhà</h3>
          <small>Ưu tiên cho phân tích ảnh kiến trúc và tinh chỉnh vùng chọn</small>
          <p>
            {data?.openaiConfigured
              ? "● Đã kết nối OpenAI"
              : "○ Chưa cấu hình OpenAI"}
            {data?.openaiKeyPreview ? " · "+data.openaiKeyPreview : ""}
          </p>

          <label>
            OpenAI model
            <select value={openaiModel} onChange={e=>setOpenaiModel(e.target.value)}>
              {OPENAI_MODELS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>
            OpenAI API Key
            <input
              autoComplete="off"
              type={show?"text":"password"}
              placeholder="sk-..."
              value={openaiKey}
              onChange={e=>setOpenaiKey(e.target.value)}
            />
          </label>

          <div className="ai-actions">
            <button onClick={()=>setShow(!show)}>{show?"Ẩn key":"Hiện key"}</button>
            <button
              disabled={busy||!openaiKey.startsWith("sk-")}
              onClick={async()=>{
                const result=await call("/api/settings/ai/connect",{
                  provider:"openai",
                  apiKey:openaiKey,
                  model:openaiModel
                });
                if(result){
                  setOpenaiKey("");
                  setMessage("Đã kết nối ChatGPT/OpenAI. Nút “Tách thành phần nhà” sẽ ưu tiên OpenAI.");
                }
              }}
            >
              Kết nối ChatGPT
            </button>
          </div>

          <p>
            Engine kiến trúc hiện tại: <strong>{data?.architectureEngine==="openai"?"ChatGPT / OpenAI":"Experiential Labs fallback"}</strong>
          </p>
        </article>

        <article className="ai-model-card">
          <h3>Experiential Labs · Fallback / hiệu ứng vật liệu</h3>
          <small>Giữ nguyên provider cũ để OCR bảng màu và các tác vụ phụ khi cần.</small>
          <p>{data?.connected?"● Đã kết nối Experiential Labs":data?.configured?"● Mất kết nối Experiential Labs":"○ Chưa cấu hình"}</p>
          <label>
            API Key {data?.keyPreview&&<small>{data.keyPreview}</small>}
            <input
              autoComplete="off"
              type={show?"text":"password"}
              placeholder="xpl_…"
              value={key}
              onChange={e=>setKey(e.target.value)}
            />
          </label>
          <div className="ai-actions">
            <button
              disabled={busy||!key.startsWith("xpl_")}
              onClick={async()=>{
                const result=await call("/api/settings/ai/connect",{provider:"experiential",apiKey:key});
                if(result)setKey("");
              }}
            >
              Kết nối Experiential
            </button>
          </div>
        </article>

        <label>
          Mức xử lý
          <select value={mode} onChange={e=>setMode(e.target.value as Mode)}>
            {Object.entries(modes).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <div className="ai-actions">
          <button disabled={busy} onClick={()=>call("/api/settings/ai",{mode,overrides})}>Lưu cấu hình</button>
          <button disabled={busy||!data?.configured} onClick={()=>call("/api/ai/models?refresh=1")}>↻ Làm mới model fallback</button>
          <button disabled={busy||!data?.configured} onClick={()=>call("/api/ai/models",{})}>✨ Tự chọn fallback</button>
        </div>

        <p role="status" style={{whiteSpace:"pre-wrap"}}>
          {busy?"Đang kết nối / kiểm tra…":message}
        </p>

        {data?.configured&&ROLES.map(role=>{
          const models:Model[]=data?.models||[];
          const model=models.find(m=>m.slug===(overrides[role]||data?.selected?.[role]));
          return (
            <article key={role} className="ai-model-card">
              <h3>{labels[role]}</h3>
              <small>{overrides[role]?"MANUAL":"AUTO"} · fallback Experiential</small>
              <select
                aria-label={labels[role]}
                value={overrides[role]||""}
                onChange={e=>setOverrides({...overrides,[role]:e.target.value})}
              >
                <option value="">AUTO</option>
                {models.filter(m=>m.roles.includes(role)).map(m=>
                  <option key={m.slug} value={m.slug}>{m.name}</option>
                )}
              </select>
              <strong>{model?.name||"Chưa có model đủ capability"}</strong>
              {model&&<p>{model.provider} · {model.slug}</p>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
