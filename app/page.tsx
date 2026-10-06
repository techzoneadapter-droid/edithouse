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

export default function HomePage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    setMaskPast(prev => [...prev.slice(-29), analysis]); setMaskFuture([]);
    setAnalysis({...analysis, structures: analysis.structures.map(s => s.id === selectedId ? {...s, mask} : s)});
    setRenderedImage("");
  }
  function undoMask() { if (!analysis || !maskPast.length) return; setMaskFuture(prev => [...prev, analysis]); setAnalysis(maskPast[maskPast.length-1]); setMaskPast(prev=>prev.slice(0,-1)); setRenderedImage(""); }
  function redoMask() { if (!analysis || !maskFuture.length) return; setMaskPast(prev => [...prev, analysis]); setAnalysis(maskFuture[maskFuture.length-1]); setMaskFuture(prev=>prev.slice(0,-1)); setRenderedImage(""); }
  const [variants, setVariants] = useState<Array<{id:string;name:string;choices:Record<string,SurfaceChoice>;analysis:AnalyzeResult|null;image:string}>>([]);
  const [catalog, setCatalog] = useState<PaintColor[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState("");
  useEffect(() => {
    loadProject<{version: number; originalImage: string; renderedImage: string; fileName: string; analysis: AnalyzeResult | null; choices: Record<string, SurfaceChoice>; selectedId: string; maskPast: AnalyzeResult[]; maskFuture: AnalyzeResult[]; catalog: PaintColor[]; favorites:string[]; recent:string[]; variants:typeof variants}>().then(p => {
      if (p?.version === 1) {setOriginalImage(p.originalImage);setRenderedImage(p.renderedImage);setFileName(p.fileName);setAnalysis(p.analysis);setChoices(p.choices);setSelectedId(p.selectedId);setMaskPast(p.maskPast);setMaskFuture(p.maskFuture);setCatalog(p.catalog||[]);setFavorites(p.favorites||[]);setRecent(p.recent||[]);setVariants(p.variants||[]);}
    }).catch(()=>setStorageStatus("Không đọc được dự án local")).finally(()=>setStorageReady(true));
  }, []);
  useEffect(() => {
    if (!storageReady || analyzing || rendering) return;
    const timer = setTimeout(()=>{saveProject({version:1, originalImage, renderedImage, fileName, analysis, choices, selectedId, maskPast, maskFuture, catalog, favorites, recent, variants}).then(()=>setStorageStatus("Đã lưu local")).catch(()=>setStorageStatus("Không lưu được: kiểm tra dung lượng trình duyệt"));},600);
    return ()=>clearTimeout(timer);
  }, [storageReady, originalImage, renderedImage, fileName, analysis, choices, selectedId, maskPast, maskFuture, analyzing, rendering, catalog, favorites, recent, variants]);
  const allColors = useMemo(()=>[...ALL_COLORS,...catalog], [catalog]);
  const structures = analysis?.structures || [];
  const selectedStructure =
    structures.find((item) => item.id === selectedId) || structures[0] || null;
  const selectedChoice = selectedStructure ? choices[selectedStructure.id] : undefined;

  async function analyzeImage(imageDataUrl: string) {
    setAnalyzing(true);
    setUploadStage(2);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể phân tích công trình.");

      const result = data as AnalyzeResult;
      setUploadStage(3);
      const nextChoices: Record<string, SurfaceChoice> = {};
      result.structures.forEach((structure) => {
        nextChoices[structure.id] = makeChoice(structure);
      });

      setMaskPast([]); setMaskFuture([]);
      setAnalysis(result);
      setChoices(nextChoices);
      setSelectedId(result.structures[0]?.id || "");
      setUploadStage(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể phân tích công trình.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (reading || analyzing || rendering) return;
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
      customHex: undefined,
      material: color.material
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
          colorCode: choice.customCode || color?.code || "",
          hex: color?.hex || choice.customHex || "#E6E1D8",
          materialName: system,
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
    if (reading || analyzing || rendering) return;
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
    const structure: Structure = {id:crypto.randomUUID(),name:"Vùng thủ công "+(structures.length+1),type:"other",description:"Dùng Brush để vẽ vùng sơn; Eraser để loại trừ vật thể.",recommendedMaterials:["exterior"],confidence:0,mask:{polygons:[],strokes:[]}};
    setAnalysis(prev=>({...prev,buildingType:prev?.buildingType||"Công trình",summary:prev?.summary||"",structures:[...(prev?.structures||[]),structure]}));
    setChoices(prev=>({...prev,[structure.id]:makeChoice(structure)}));setSelectedId(structure.id);
  }

  return (
    <main className="app-shell">
      {settingsOpen && <AISettings onClose={()=>setSettingsOpen(false)} onUpdate={setAIStatus}/>}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden-input"
        onChange={onFileChange}
      />

      <aside className="rail">
        <button className="brand-mark" title="EditHouse">EH</button>
        <div className="rail-group">
          <button className="rail-btn active" title="Trang chủ"><Home size={19} /></button>
          <button className="rail-btn" title="Tải ảnh" onClick={() => fileInput.current?.click()}><Upload size={19} /></button>
          <button className="rail-btn" title="Màu sơn"><Palette size={19} /></button>
          <button className="rail-btn" title="Kết cấu"><Layers3 size={19} /></button>
          <button className="rail-btn" onClick={()=>setSettingsOpen(true)} title={aiStatus?.connected ? `Experiential Labs · Connected\nVision: ${aiStatus.selected?.VISION_ANALYZE || "—"}\nRender: ${aiStatus.selected?.IMAGE_RENDER || "—"}` : "AI chưa kết nối"}><Sparkles size={19} /></button>
        </div>
        <div className="rail-spacer" />
        <button className="rail-btn" title="Cài đặt" onClick={()=>setSettingsOpen(true)}><Settings size={19} /></button>
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
        <button className="tool-btn" disabled={!originalImage || reading || analyzing || rendering} onClick={addManualSurface}>+ Thêm vùng thủ công</button>

        <VariantsPanel variants={variants} disabled={analyzing || rendering || !originalImage} onSave={()=>setVariants(prev=>[...prev,{id:crypto.randomUUID(),name:"Phuong an "+(prev.length+1),choices:structuredClone(choices),analysis:structuredClone(analysis),image:renderedImage}])} onLoad={v=>{setChoices(structuredClone(v.choices));setAnalysis(structuredClone(v.analysis));setRenderedImage(v.image);setSelectedId(v.analysis?.structures[0]?.id||"");setMaskPast([]);setMaskFuture([]);}} onChange={setVariants}/>
        <div className="structure-list">
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

          {!analyzing && structures.map((structure) => {
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
            <button className="tool-btn" disabled={!maskPast.length || rendering || analyzing} onClick={undoMask}>Undo mask</button>
            <button className="tool-btn" disabled={!maskFuture.length || rendering || analyzing} onClick={redoMask}>Redo mask</button>
            <button className="tool-btn" disabled={!renderedImage} onClick={downloadResult}><Download size={16} /> Xuất ảnh</button>
          </div>
        </header>

        <div className="canvas-wrap">
          {!originalImage ? (
            <button className="canvas-empty" onClick={() => fileInput.current?.click()}>
              <span className="big-upload"><Upload size={28} /></span>
              <strong>Thả ảnh công trình vào đây</strong>
              <p>AI sẽ tự nhận diện toàn bộ kết cấu để bạn chọn loại sơn, màu và hiệu ứng cho từng chi tiết.</p>
              <span className="primary-mini">Chọn ảnh</span>
            </button>
          ) : (
            <div className="image-stage">
              <MaskEditor image={originalImage} result={renderedImage} mask={selectedStructure?.mask} hoverMask={structures.find(s=>s.id===hoveredId)?.mask} onChange={changeMask} disabled={analyzing || rendering}/>
              {(analyzing || rendering) && <div className="working-overlay"><div className="working-card"><LoaderCircle className="spin" size={27}/><strong>{analyzing ? "Đang nhận diện kiến trúc và tách bề mặt…" : "Đang phối màu theo mask…"}</strong></div></div>}
            </div>
          )}

          {error && (
            <div className="error-toast">
              <X size={16} />
              <span>{error}</span>
              <button onClick={() => setError("")}><X size={14} /></button>
            </div>
          )}
        </div>

        <footer className="bottom-bar">
          <div className="quality-control">
            <span>AI · {aiStatus?.connected ? 'Experiential Labs · Connected' : 'Chưa kết nối'}</span>
            <div className="segment">
              <button onClick={() => setSettingsOpen(true)} title={`Vision: ${aiStatus?.selected?.vision || '—'} · Render: ${aiStatus?.selected?.render || '—'}`}>
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
            <button className="icon-btn" disabled={analyzing||rendering} onClick={async()=>{
              setAnalyzing(true);setError('');
              try {const response=await fetch('/api/mask/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl:originalImage,surface:selectedStructure.name}),signal:AbortSignal.timeout(180000)});const result=await response.json();if(!response.ok)throw new Error(result.error);changeMask({polygons:result.polygons,strokes:[]});}
              catch(e){setError(e instanceof Error?e.message:'Không phân tích được mask.');}finally{setAnalyzing(false);}
            }}>AI tìm lại mask vùng này</button>
            <div className="select-wrap">
              <select
                value={selectedChoice?.brand || MARKET_BRANDS[0]}
                onChange={(e) => updateChoice(selectedStructure.id, { brand: e.target.value })}
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

                <CatalogBrowser colors={allColors.filter(c=>materialFilter==='all'||c.material===materialFilter)} onImport={colors=>setCatalog(prev=>[...new Map([...prev,...colors].map(c=>[c.id,c])).values()])} onChoose={chooseColor} favorites={favorites} recent={recent} onFavorite={id=>setFavorites(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])} onError={setError}/>

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
