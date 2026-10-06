"use client";

import {
  ALL_COLORS,
  MARKET_BRANDS,
  PAINT_SYSTEMS,
  PaintColor,
  PaintMaterial
} from "@/lib/catalog";
import {
  Check,
  ChevronDown,
  Download,
  Home,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Palette,
  PaintBucket,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Upload,
  WandSparkles,
  X,
  Zap
} from "lucide-react";
import type { Structure, SurfaceChoice, AnalyzeResult } from "@/lib/project-types";
import { fileToOptimizedDataUrl } from "@/lib/image-client";
import { loadProject, saveProject } from "@/lib/project-store";
import CatalogBrowser from "@/components/CatalogBrowser";
import CatalogManager from "@/components/catalog/CatalogManager";
import {loadCatalog, saveCatalogImport} from "@/lib/catalog-store";
import {emptyCatalog, type CatalogSnapshot} from "@/lib/catalog/types";
import VariantsPanel from "@/components/VariantsPanel";
import AISettings from "@/components/AISettings";
import MaskEditor from "@/components/MaskEditor";
import { SurfaceMask, rasterizeMask } from "@/lib/masks";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

function makeChoice(structure: Structure): SurfaceChoice {
  const recommended = structure.recommendedMaterials?.[0] || "exterior";
  return {
    enabled: false,
    material: recommended,
    brand: "EditHouse"
  };
}

function normalizeHex(hex: string) {
  const value = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toUpperCase();
  return "#E6E1D8";
}

type AppView = "editor" | "catalog" | "layers" | "ai" | "settings";
export default function HomePage() {
  const [appView,setAppView]=useState<AppView>("editor");
  const analyzeAbortRef=useRef<AbortController|null>(null);
  const layerListRef=useRef<HTMLDivElement>(null);
  const manualRevisionRef=useRef(0);
  const [catalogData,setCatalogData]=useState<CatalogSnapshot>(emptyCatalog);
  const [catalogReady,setCatalogReady]=useState(false);
  useEffect(()=>{loadCatalog().then(setCatalogData).catch(e=>setError(e.message)).finally(()=>setCatalogReady(true));},[]);
  useEffect(()=>{if(appView==='layers')layerListRef.current?.focus();},[appView]);
  useEffect(()=>()=>analyzeAbortRef.current?.abort(),[]);

  const [aiStatus, setAIStatus] = useState<any>(null);
  useEffect(()=>{fetch("/api/ai/status").then(r=>r.json()).then(setAIStatus).catch(()=>{});},[]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [originalImage, setOriginalImage] = useState("");
  const [renderedImage, setRenderedImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [choices, setChoices] = useState<Record<string, SurfaceChoice>>({});
  const [selectedId, setSelectedId] = useState("");
  const [materialFilter, setMaterialFilter] = useState<PaintMaterial | "all">("all");
  const [analyzing, setAnalyzing] = useState(false);
  const [reading, setReading] = useState(false);
  const [uploadStage, setUploadStage] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [rightTab, setRightTab] = useState<"colors" | "materials">("colors");

  const [hoveredId, setHoveredId] = useState("");
  const [maskPast, setMaskPast] = useState<AnalyzeResult[]>([]);
  const [maskFuture, setMaskFuture] = useState<AnalyzeResult[]>([]);
  function changeMask(mask: SurfaceMask) {
    if (!analysis || !selectedId) return;
    manualRevisionRef.current++;
    setMaskPast(prev => [...prev.slice(-29), analysis]); setMaskFuture([]);
    setAnalysis({...analysis, structures: analysis.structures.map(s => s.id === selectedId ? {...s, mask} : s)});
    setRenderedImage("");
  }
  function undoMask() { if (!analysis || !maskPast.length) return; manualRevisionRef.current++; setMaskFuture(prev => [...prev, analysis]); setAnalysis(maskPast[maskPast.length-1]); setMaskPast(prev=>prev.slice(0,-1)); setRenderedImage(""); }
  function redoMask() { if (!analysis || !maskFuture.length) return; manualRevisionRef.current++; setMaskPast(prev => [...prev, analysis]); setAnalysis(maskFuture[maskFuture.length-1]); setMaskFuture(prev=>prev.slice(0,-1)); setRenderedImage(""); }
  const [variants, setVariants] = useState<Array<{id:string;name:string;choices:Record<string,SurfaceChoice>;analysis:AnalyzeResult|null;image:string}>>([]);
  const catalog = useMemo<PaintColor[]>(()=>catalogData.colors.map(c=>({...c,brand:catalogData.brands.find(b=>b.id===c.brandId)?.name||'',collection:catalogData.collections.find(x=>x.id===c.collectionId)?.name||'',material:'exterior',family:'',finish:''})),[catalogData]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState("");
  useEffect(() => {
    loadProject<{version: number; originalImage: string; renderedImage: string; fileName: string; analysis: AnalyzeResult | null; choices: Record<string, SurfaceChoice>; selectedId: string; maskPast: AnalyzeResult[]; maskFuture: AnalyzeResult[]; catalog: PaintColor[]; favorites:string[]; recent:string[]; variants:typeof variants}>().then(p => {
      if (p?.version === 1) {setOriginalImage(p.originalImage);setRenderedImage(p.renderedImage);setFileName(p.fileName);setAnalysis(p.analysis);setChoices(p.choices);setSelectedId(p.selectedId);setMaskPast(p.maskPast);setMaskFuture(p.maskFuture);if(p.catalog?.length) { void saveCatalogImport(p.catalog.filter(c=>c.brand&&c.code).map(c=>({id:c.id,brand:c.brand!,collection:c.collection||"",code:c.code,name:c.name,hex:c.hex,rgb:[parseInt(c.hex.slice(1,3),16),parseInt(c.hex.slice(3,5),16),parseInt(c.hex.slice(5,7),16)],sourceImageId:"",sourceBox:[0,0,0,0],confidence:0,selected:true})),[]).then(setCatalogData).catch(e=>setError(e.message)); }setFavorites(p.favorites||[]);setRecent(p.recent||[]);setVariants(p.variants||[]);}
    }).catch(()=>setStorageStatus("Không đọc được dự án local")).finally(()=>setStorageReady(true));
  }, []);
  useEffect(() => {
    if (!storageReady || rendering) return;
    const timer = setTimeout(()=>{saveProject({version:1, originalImage, renderedImage, fileName, analysis, choices, selectedId, maskPast, maskFuture, favorites, recent, variants}).then(()=>setStorageStatus("Đã lưu local")).catch(()=>setStorageStatus("Không lưu được: kiểm tra dung lượng trình duyệt"));},600);
    return ()=>clearTimeout(timer);
  }, [storageReady, originalImage, renderedImage, fileName, analysis, choices, selectedId, maskPast, maskFuture, analyzing, rendering, favorites, recent, variants]);
  const allColors = useMemo(()=>[...ALL_COLORS,...catalog], [catalog]);
  const structures = analysis?.structures || [];
  const selectedStructure =
    structures.find((item) => item.id === selectedId) || structures[0] || null;
  const selectedChoice = selectedStructure ? choices[selectedStructure.id] : undefined;

  function cancelAnalyze(){analyzeAbortRef.current?.abort();analyzeAbortRef.current=null;setAnalyzing(false);setUploadStage(0);}
  async function analyzeImage(imageDataUrl: string) {
    analyzeAbortRef.current?.abort();
    const controller=new AbortController();analyzeAbortRef.current=controller;
    let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},60000);
    setAnalyzing(true);setUploadStage(2);setError('');
    try{
      const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl}),signal:controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Không thể phân tích công trình.');
      if(controller.signal.aborted||analyzeAbortRef.current!==controller)return;
      const result=data as AnalyzeResult;
      setAnalysis(previous=>({...result,structures:[...result.structures.map(surface=>previous?.structures.find(s=>s.id===surface.id)||surface),...(previous?.structures||[]).filter(surface=>!result.structures.some(s=>s.id===surface.id))]}));
      setChoices(previous=>{const next={...previous};for(const surface of result.structures)next[surface.id]??=makeChoice(surface);return next;});
      setSelectedId(previous=>previous||result.structures[0]?.id||'');setUploadStage(4);
    }catch(e){if(analyzeAbortRef.current===controller){if(timedOut)setError('AI nhận diện quá thời gian.');else if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Không thể phân tích công trình.');}}
    finally{clearTimeout(timer);if(analyzeAbortRef.current===controller){analyzeAbortRef.current=null;setAnalyzing(false);}}
  }
  async function analyzeSurface(){
    if(!selectedStructure||analyzing||rendering)return;
    const target=selectedStructure,revision=manualRevisionRef.current,controller=new AbortController();analyzeAbortRef.current=controller;
    let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},60000);setAnalyzing(true);setError('');
    try{const response=await fetch('/api/mask/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl:originalImage,surface:target.name}),signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(controller.signal.aborted||analyzeAbortRef.current!==controller)return;
      if(revision!==manualRevisionRef.current){setError('Đã giữ mask bạn vừa chỉnh; bỏ qua kết quả AI cũ.');return;}
      setAnalysis(previous=>previous?{...previous,structures:previous.structures.map(s=>s.id===target.id?{...s,mask:{polygons:result.polygons,strokes:[]}}:s)}:previous);setRenderedImage('');
    }catch(e){if(analyzeAbortRef.current===controller){if(timedOut)setError('AI nhận diện quá thời gian.');else if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Không phân tích được mask.');}}
    finally{clearTimeout(timer);if(analyzeAbortRef.current===controller){analyzeAbortRef.current=null;setAnalyzing(false);}}
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (reading || rendering) return;
    cancelAnalyze();setAppView("editor");
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Hãy chọn file ảnh JPG, PNG hoặc WEBP.");
      return;
    }
    setError("");
    setRenderedImage("");
    setAnalysis(null);
    setChoices({});
    setMaskPast([]); setMaskFuture([]);
    setVariants([]);
    setFileName(file.name);
    setReading(true); setUploadStage(1);
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      setOriginalImage(dataUrl);
      setReading(false);
      await analyzeImage(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải ảnh.");
    } finally {
      setReading(false);
      event.target.value = "";
    }
  }

  function updateChoice(id: string, patch: Partial<SurfaceChoice>) {
    setChoices((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || makeChoice(structures.find((x) => x.id === id)!)), ...patch }
    }));
  }

  function chooseColor(color: PaintColor) {
    setRecent(prev=>[color.id,...prev.filter(id=>id!==color.id)].slice(0,30));
    if (!selectedStructure) return;
    updateChoice(selectedStructure.id, {
      enabled: true,
      colorId: color.id,
      brand: color.brand || "EditHouse",
      collection: color.collection || "",
      colorCode: color.code,
      hex: color.hex,
      customCode: undefined,
      customHex: undefined,
      material: selectedChoice?.material || color.material
    });
  }

  function chooseCustomColor(hex: string) {
    if (!selectedStructure) return;
    updateChoice(selectedStructure.id, {
      enabled: true,
      colorId: undefined,
      customHex: normalizeHex(hex)
    });
  }

  function applySuggestedPalette() {
    if (!structures.length) return;
    const suggestions = ["#E9E4D8", "#C7C0B3", "#4F5557", "#A98968"];
    setChoices((prev) => {
      const next = { ...prev };
      structures.forEach((structure, index) => {
        next[structure.id] = {
          ...(next[structure.id] || makeChoice(structure)),
          enabled: index < 8,
          colorId: undefined,
          customHex: suggestions[index % suggestions.length]
        };
      });
      return next;
    });
  }

  async function renderDesign() {
    if (!originalImage) {
      setError("Hãy tải ảnh công trình trước.");
      return;
    }

    const assignments = structures
      .filter((structure) => choices[structure.id]?.enabled)
      .map((structure) => {
        const choice = choices[structure.id];
        const color = choice.colorId
          ? allColors.find((item) => item.id === choice.colorId)
          : undefined;
        const system =
          PAINT_SYSTEMS.find((item) => item.id === choice.material)?.name || "Sơn";
        return {
          mask: structure.mask,
          structureName: structure.name,
          structureDescription: structure.description,
          colorName: color?.name || "Màu tùy chỉnh",
          colorCode: choice.customCode || color?.code || choice.colorCode || "",
          hex: choice.customHex || color?.hex || choice.hex || "#E6E1D8",
          materialName: system,
          materialId: choice.material,
          finish: choice.finish || (color?.material === choice.material ? color.finish : "")
        };
      });

    if (!assignments.length) {
      setError("Hãy bật ít nhất một chi tiết cần phối màu.");
      return;
    }

    setRendering(true);
    setError("");
    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: originalImage,
          assignments: await Promise.all(assignments.map(async ({mask, ...assignment}) => ({...assignment, maskDataUrl: await rasterizeMask(mask, originalImage)}))),
          preserveArchitecture: true,
          customInstruction
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể phối màu.");
      setRenderedImage(data.imageDataUrl);
      setVariants(prev=>[...prev,{id:crypto.randomUUID(),name:"Render "+(prev.length+1),choices:structuredClone(choices),analysis:structuredClone(analysis),image:data.imageDataUrl}]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể phối màu.");
    } finally {
      setRendering(false);
    }
  }

  function resetProject() {
    if (reading || rendering) return;
    cancelAnalyze();
    setMaskPast([]); setMaskFuture([]);
    setVariants([]);
    setOriginalImage("");
    setRenderedImage("");
    setFileName("");
    setAnalysis(null);
    setChoices({});
    setSelectedId("");
    setError("");
    setUploadStage(0);
    if (fileInput.current) fileInput.current.value = "";
  }

  function downloadResult() {
    if (!renderedImage) return;
    const anchor = document.createElement("a");
    anchor.href = renderedImage;
    anchor.download = "edithouse-phoi-mau.png";
    anchor.click();
  }

  const activeCount = structures.filter((item) => choices[item.id]?.enabled).length;

  function addManualSurface() {
    manualRevisionRef.current++;
    const structure: Structure = {id:crypto.randomUUID(),name:"Vùng thủ công "+(structures.length+1),type:"other",description:"Dùng Brush để vẽ vùng sơn; Eraser để loại trừ vật thể.",recommendedMaterials:["exterior"],confidence:0,mask:{polygons:[],strokes:[]}};
    setAnalysis(prev=>({...prev,buildingType:prev?.buildingType||"Công trình",summary:prev?.summary||"",structures:[...(prev?.structures||[]),structure]}));
    setChoices(prev=>({...prev,[structure.id]:makeChoice(structure)}));setSelectedId(structure.id);
  }

  return (
    <main className="app-shell">
      {(appView === "settings" || appView === "ai") && <AISettings onClose={()=>setAppView("editor")} onUpdate={setAIStatus}/>}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden-input"
        onChange={onFileChange}
      />

      <aside className="rail">
        <button className="brand-mark" title="EditHouse" onClick={()=>setAppView("editor")}>EH</button>
        <div className="rail-group">
          <button className={"rail-btn " + (appView === "editor" ? "active" : "")} title="Trang chủ" aria-label="Home" onClick={()=>setAppView("editor")}><Home size={19} /></button>
          <button className="rail-btn" title="Tải ảnh" aria-label="Upload" onClick={() => fileInput.current?.click()}><Upload size={19} /></button>
          <button className={"rail-btn " + (appView === "catalog" ? "active" : "")} title="Màu sơn" aria-label="Palette" onClick={()=>setAppView("catalog")}><Palette size={19} /></button>
          <button className={"rail-btn " + (appView === "layers" ? "active" : "")} title="Kết cấu" aria-label="Layers" onClick={()=>setAppView("layers")}><Layers3 size={19} /></button>
          <button className={"rail-btn " + (appView === "ai" ? "active" : "")} aria-label="AI" onClick={()=>setAppView("ai")} title={aiStatus?.connected ? `Experiential Labs · Connected\nVision: ${aiStatus.selected?.VISION_ANALYZE || "—"}\nRender: ${aiStatus.selected?.IMAGE_RENDER || "—"}` : "AI chưa kết nối"}><Sparkles size={19} /></button>
        </div>
        <div className="rail-spacer" />
        <button className={"rail-btn " + (appView === "settings" ? "active" : "")} title="Cài đặt" aria-label="Settings" onClick={()=>setAppView("settings")}><Settings size={19} /></button>
      </aside>

      <aside className="left-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">EDIT HOUSE</p>
            <h1>Phối màu công trình</h1>
          </div>
          <button className="icon-btn" onClick={resetProject} title="Dự án mới"><RotateCcw size={16} /></button>
        </div>

        <button className="upload-card" disabled={reading || analyzing || rendering || !storageReady} onClick={() => fileInput.current?.click()}>
          <span className="upload-icon"><ImagePlus size={22} /></span>
          <span className="upload-copy">
            <strong>{fileName || "Tải ảnh công trình"}</strong>
            <small>JPG, PNG, WEBP · tự nhận diện cấu kiện</small>
          </span>
          <Plus size={18} />
        </button>

        <div className="section-head">
          <div>
            <span>Kết cấu nhận diện</span>
            <b>{structures.length}</b>
          </div>
          <button
            className="text-action"
            disabled={!originalImage || analyzing}
            onClick={() => originalImage && analyzeImage(originalImage)}
          >
            {analyzing ? <LoaderCircle className="spin" size={14} /> : <WandSparkles size={14} />}
            Phân tích lại
          </button>
        </div>

        {analysis?.summary && <p className="analysis-summary">{analysis.summary}</p>}
        {uploadStage>0 && <ol className="upload-progress">{["Đang đọc ảnh","Đang nhận diện kiến trúc","Đang tách bề mặt","Hoàn tất"].map((label,i)=><li key={label} className={uploadStage===i+1?'active':''}>{uploadStage>i+1?'✓ ':''}{label}</li>)}</ol>}
        <button className="tool-btn" disabled={!originalImage || rendering} onClick={addManualSurface}>+ Thêm vùng thủ công</button>

        <VariantsPanel variants={variants} disabled={analyzing || rendering || !originalImage} onSave={()=>setVariants(prev=>[...prev,{id:crypto.randomUUID(),name:"Phuong an "+(prev.length+1),choices:structuredClone(choices),analysis:structuredClone(analysis),image:renderedImage}])} onLoad={v=>{setChoices(structuredClone(v.choices));setAnalysis(structuredClone(v.analysis));setRenderedImage(v.image);setSelectedId(v.analysis?.structures[0]?.id||"");setMaskPast([]);setMaskFuture([]);}} onChange={setVariants}/>
        <div className="structure-list" ref={layerListRef} tabIndex={-1}>
          {!originalImage && (
            <div className="empty-list">
              <Layers3 size={22} />
              <p>Tải ảnh lên để AI tách tường, chỉ, phào, trần, cột, cửa, mái và các bề mặt khác.</p>
            </div>
          )}

          {analyzing && (
            <div className="empty-list">
              <LoaderCircle className="spin" size={24} />
              <p>Đang đọc kiến trúc và liệt kê toàn bộ bề mặt có thể sơn...</p>
            </div>
          )}

          {structures.map((structure) => {
            const choice = choices[structure.id];
            const color = choice?.colorId
              ? allColors.find((item) => item.id === choice.colorId)
              : undefined;
            const chipColor = color?.hex || choice?.customHex || "#E6E1D8";

            return (
              <button
                key={structure.id}
                className={"structure-item " + (selectedStructure?.id === structure.id ? "selected" : "")}
                onMouseEnter={() => setHoveredId(structure.id)}
                onMouseLeave={() => setHoveredId("")}
                onClick={() => setSelectedId(structure.id)}
              >
                <span
                  className={"check-box " + (choice?.enabled ? "checked" : "")}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateChoice(structure.id, { enabled: !choice?.enabled });
                  }}
                >
                  {choice?.enabled && <Check size={12} />}
                </span>
                <span className="structure-copy">
                  <strong>{structure.name}</strong>
                  <small>{structure.description}</small>
                </span>
                <span className="surface-color" style={{ background: chipColor }} />
              </button>
            );
          })}
        </div>

        {structures.length > 0 && (
          <button className="smart-palette" onClick={applySuggestedPalette}>
            <Sparkles size={15} />
            Gợi ý bảng màu nhanh
          </button>
        )}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="project-info">
            <span className="status-dot" />
            <div>
              <strong>{analysis?.buildingType || "Dự án mới"}</strong>
              <small>{originalImage ? activeCount + " bề mặt đang bật" : "Chưa có ảnh công trình"}</small>
            </div>
          </div>

          <div className="toolbar">
            <button className="tool-btn" disabled={!maskPast.length || rendering} onClick={undoMask}>Undo mask</button>
            <button className="tool-btn" disabled={!maskFuture.length || rendering} onClick={redoMask}>Redo mask</button>
            <button className="tool-btn" disabled={!renderedImage} onClick={downloadResult}><Download size={16} /> Xuất ảnh</button>
          </div>
        </header>

        <div className="catalog-view" hidden={appView !== 'catalog'}><CatalogManager catalog={catalogData} ready={catalogReady} onChange={setCatalogData}/></div>
        <div className="layers-view" hidden={appView !== 'layers'}><h1>{structures.length?'KẾT CẤU CÔNG TRÌNH':'CHƯA CÓ KẾT CẤU'}</h1>
          <button disabled={!originalImage||analyzing||rendering} onClick={()=>analyzeImage(originalImage)}>AI nhận diện</button>
          <button disabled={!originalImage||rendering} onClick={addManualSurface}>+ Thêm vùng thủ công</button>
          {!originalImage&&<button onClick={()=>fileInput.current?.click()}>Tải ảnh công trình</button>}
          {structures.map(s=><button key={s.id} onClick={()=>{setSelectedId(s.id);setAppView('editor');}}>{s.name}</button>)}
        </div>
        <div className="canvas-wrap" hidden={appView === 'catalog' || appView === 'layers'}>
          {!originalImage ? (
            <button className="canvas-empty" onClick={() => fileInput.current?.click()}>
              <span className="big-upload"><Upload size={28} /></span>
              <strong>Thả ảnh công trình vào đây</strong>
              <p>AI sẽ tự nhận diện toàn bộ kết cấu để bạn chọn loại sơn, màu và hiệu ứng cho từng chi tiết.</p>
              <span className="primary-mini">Chọn ảnh</span>
            </button>
          ) : (
            <div className="image-stage">
              <MaskEditor image={originalImage} result={renderedImage} mask={selectedStructure?.mask} hoverMask={structures.find(s=>s.id===hoveredId)?.mask} onChange={changeMask} disabled={rendering}/>
              {rendering && <div className="working-overlay"><div className="working-card"><LoaderCircle className="spin" size={27}/><strong>Đang phối màu theo mask…</strong></div></div>}
              {analyzing && <div className="analyze-floating" role="status"><LoaderCircle className="spin" size={16}/><span>AI đang nhận diện công trình…</span><button onClick={cancelAnalyze}>Hủy nhận diện</button></div>}
            </div>
          )}

          {error && (
            <div className="error-toast">
              <X size={16} />
              <span>{error}</span>
              {error === "AI nhận diện quá thời gian." && <button disabled={analyzing||rendering||!originalImage} onClick={()=>analyzeImage(originalImage)}>Thử lại</button>}
              <button onClick={() => setError("")}><X size={14} /></button>
            </div>
          )}
        </div>

        <footer className="bottom-bar">
          <div className="quality-control">
            <span>AI · {aiStatus?.connected ? 'Experiential Labs · Connected' : 'Chưa kết nối'}</span>
            <div className="segment">
              <button onClick={() => setAppView("settings")} title={`Vision: ${aiStatus?.selected?.vision || '—'} · Render: ${aiStatus?.selected?.render || '—'}`}>
                <Settings size={13} /> {aiStatus?.mode === 'economy' ? 'Tiết kiệm' : aiStatus?.mode === 'quality' ? 'Chất lượng cao' : 'Cân bằng'}
              </button>
            </div>
          </div>

          <label className="lock-toggle">
            <input
              type="checkbox"
              checked={true}
              disabled
            />
            <span />
            Khóa kiến trúc
          </label>

          <input
            className="instruction-input"
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="Ghi chú thêm, ví dụ: phào trắng hơn 10%, mảng cột dùng giả đá..."
          />

          <button
            className="render-btn"
            disabled={!originalImage || rendering || analyzing}
            onClick={renderDesign}
          >
            {rendering ? <LoaderCircle className="spin" size={18} /> : <PaintBucket size={18} />}
            {rendering ? "Đang phối..." : "Phối màu AI"}
          </button>
        </footer>
      </section>

      <aside className="right-panel">
        <div className="right-tabs">
          <button className={rightTab === "colors" ? "active" : ""} onClick={() => setRightTab("colors")}>Màu sơn</button>
          <button className={rightTab === "materials" ? "active" : ""} onClick={() => setRightTab("materials")}>Vật liệu</button>
        </div>

        {selectedStructure ? (
          <>
            <div className="selected-surface">
              <span className="selected-icon"><Layers3 size={17} /></span>
              <div>
                <small>Đang chỉnh</small>
                <strong>{selectedStructure.name}</strong>
              </div>
              <span className="confidence">{Math.round(selectedStructure.confidence * 100)}%</span>
            </div>

            <label className="field-label">Thương hiệu / catalogue</label>
            <button className="icon-btn" disabled={analyzing||rendering} onClick={analyzeSurface}>AI tìm lại mask vùng này</button>
            <div className="select-wrap">
              <select
                aria-label="Hãng sơn"
                value={selectedChoice?.brand || MARKET_BRANDS[0]}
                onChange={(e) => updateChoice(selectedStructure.id, { brand: e.target.value, collection: "" })}
              >
                {["EditHouse",...MARKET_BRANDS,...new Set(catalog.map(c=>c.brand).filter((b): b is string=>!!b && !MARKET_BRANDS.includes(b)))].map((brand) => <option key={brand}>{brand}</option>)}
              </select>
              <ChevronDown size={15} />
            </div>

            {rightTab === "materials" ? (
              <div className="materials-grid">
                {PAINT_SYSTEMS.map((system) => (
                  <button
                    key={system.id}
                    className={"material-card " + (selectedChoice?.material === system.id ? "active" : "")}
                    onClick={() => {
                      updateChoice(selectedStructure.id, { material: system.id });
                      setMaterialFilter(system.id);
                      setRightTab("colors");
                    }}
                  >
                    <span>{system.name}</span>
                    <small>{system.description}</small>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <label className="field-label">Vật liệu / hiệu ứng của bề mặt</label>
                <select className="finish-select" value={selectedChoice?.finish || ""} onChange={e=>updateChoice(selectedStructure.id,{finish:e.target.value})}>
                  <option value="">Hoàn thiện theo hệ sơn</option>
                  {["Mờ","Satin","Bóng","Granite hạt mịn","Marble","Đá hạt","Bê tông thô","Microcement","Stucco","Venetian plaster","Metallic","Hiệu ứng cát","Hiệu ứng nhung","Sơn kim loại","Stain gỗ"].map(f=><option key={f}>{f}</option>)}
                </select>
                <label className="field-label">Hệ sơn / hiệu ứng</label>
                <div className="material-pills">
                  <button className={materialFilter === "all" ? "active" : ""} onClick={() => setMaterialFilter("all")}>Tất cả</button>
                  {PAINT_SYSTEMS.map((system) => (
                    <button
                      key={system.id}
                      className={materialFilter === system.id ? "active" : ""}
                      onClick={() => setMaterialFilter(system.id)}
                    >
                      {system.name.replace("Sơn ", "")}
                    </button>
                  ))}
                </div>

                <CatalogBrowser colors={allColors.filter(c=>(c.brand||'EditHouse')===(selectedChoice?.brand||'EditHouse')&&(materialFilter==='all'||!!c.brandId||c.material===materialFilter))} collection={selectedChoice?.collection||''} onCollection={collection=>updateChoice(selectedStructure.id,{collection})} onManage={()=>setAppView('catalog')} onChoose={chooseColor} favorites={favorites} recent={recent} onFavorite={id=>setFavorites(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}/>

                <div className="custom-color">
                  <div>
                    <strong>Màu tùy chỉnh</strong>
                    <small>Nhập HEX hoặc dùng bảng màu hãng</small>
                  </div>
                  <div className="custom-row">
                    <input
                      type="color"
                      value={selectedChoice?.customHex || "#E6E1D8"}
                      onChange={(e) => chooseCustomColor(e.target.value)}
                    />
                    <input
                      value={selectedChoice?.customHex || ""}
                      onChange={(e) => chooseCustomColor(e.target.value)}
                      placeholder="#E6E1D8"
                    />
                    <input
                      value={selectedChoice?.customCode || ""}
                      onChange={(e) => updateChoice(selectedStructure.id, { customCode: e.target.value })}
                      placeholder="Mã hãng"
                    />
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="empty-right">
            <Palette size={28} />
            <strong>Chưa chọn bề mặt</strong>
            <p>Tải ảnh và chọn một cấu kiện bên trái để bắt đầu phối màu.</p>
          </div>
        )}
      </aside>
    </main>
  );
}
