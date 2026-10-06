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
  Eye,
  Home,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Palette,
  PaintBucket,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Upload,
  WandSparkles,
  X,
  Zap
} from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";

type Structure = {
  id: string;
  name: string;
  type: string;
  description: string;
  recommendedMaterials: PaintMaterial[];
  confidence: number;
};

type SurfaceChoice = {
  enabled: boolean;
  material: PaintMaterial;
  colorId?: string;
  customHex?: string;
  customCode?: string;
  brand: string;
};

type AnalyzeResult = {
  buildingType: string;
  summary: string;
  structures: Structure[];
};

function fileToOptimizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được ảnh."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Ảnh không hợp lệ."));
      img.onload = () => {
        const maxSide = 2200;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Trình duyệt không hỗ trợ canvas."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function makeChoice(structure: Structure): SurfaceChoice {
  const recommended = structure.recommendedMaterials?.[0] || "exterior";
  return {
    enabled: true,
    material: recommended,
    brand: MARKET_BRANDS[0]
  };
}

function normalizeHex(hex: string) {
  const value = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toUpperCase();
  return "#E6E1D8";
}

export default function HomePage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [originalImage, setOriginalImage] = useState("");
  const [renderedImage, setRenderedImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [choices, setChoices] = useState<Record<string, SurfaceChoice>>({});
  const [selectedId, setSelectedId] = useState("");
  const [paintSearch, setPaintSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState<PaintMaterial | "all">("all");
  const [analyzing, setAnalyzing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [quality, setQuality] = useState<"fast" | "pro">("fast");
  const [preserveArchitecture, setPreserveArchitecture] = useState(true);
  const [customInstruction, setCustomInstruction] = useState("");
  const [compareValue, setCompareValue] = useState(50);
  const [rightTab, setRightTab] = useState<"colors" | "materials">("colors");

  const structures = analysis?.structures || [];
  const selectedStructure =
    structures.find((item) => item.id === selectedId) || structures[0] || null;
  const selectedChoice = selectedStructure ? choices[selectedStructure.id] : undefined;

  const visibleColors = useMemo(() => {
    const q = paintSearch.trim().toLowerCase();
    return ALL_COLORS.filter((color) => {
      const materialOk = materialFilter === "all" || color.material === materialFilter;
      const searchOk =
        !q ||
        color.name.toLowerCase().includes(q) ||
        color.code.toLowerCase().includes(q) ||
        color.family.toLowerCase().includes(q);
      return materialOk && searchOk;
    });
  }, [paintSearch, materialFilter]);

  async function analyzeImage(imageDataUrl: string) {
    setAnalyzing(true);
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
      const nextChoices: Record<string, SurfaceChoice> = {};
      result.structures.forEach((structure) => {
        nextChoices[structure.id] = makeChoice(structure);
      });

      setAnalysis(result);
      setChoices(nextChoices);
      setSelectedId(result.structures[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể phân tích công trình.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
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
    setFileName(file.name);
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      setOriginalImage(dataUrl);
      await analyzeImage(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải ảnh.");
    }
  }

  function updateChoice(id: string, patch: Partial<SurfaceChoice>) {
    setChoices((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || makeChoice(structures.find((x) => x.id === id)!)), ...patch }
    }));
  }

  function chooseColor(color: PaintColor) {
    if (!selectedStructure) return;
    updateChoice(selectedStructure.id, {
      enabled: true,
      colorId: color.id,
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
          ? ALL_COLORS.find((item) => item.id === choice.colorId)
          : undefined;
        const system =
          PAINT_SYSTEMS.find((item) => item.id === choice.material)?.name || "Sơn";
        return {
          structureName: structure.name,
          structureDescription: structure.description,
          colorName: color?.name || "Màu tùy chỉnh",
          colorCode: choice.customCode || color?.code || "",
          hex: color?.hex || choice.customHex || "#E6E1D8",
          materialName: system,
          finish: color?.finish || ""
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
          assignments,
          quality,
          preserveArchitecture,
          customInstruction
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể phối màu.");
      setRenderedImage(data.imageDataUrl);
      setCompareValue(50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể phối màu.");
    } finally {
      setRendering(false);
    }
  }

  function resetProject() {
    setOriginalImage("");
    setRenderedImage("");
    setFileName("");
    setAnalysis(null);
    setChoices({});
    setSelectedId("");
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  function downloadResult() {
    if (!renderedImage) return;
    const anchor = document.createElement("a");
    anchor.href = renderedImage;
    anchor.download = "edithouse-phoi-mau.jpg";
    anchor.click();
  }

  const activeCount = structures.filter((item) => choices[item.id]?.enabled).length;

  return (
    <main className="app-shell">
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
          <button className="rail-btn" title="AI"><Sparkles size={19} /></button>
        </div>
        <div className="rail-spacer" />
        <button className="rail-btn" title="Cài đặt"><Settings size={19} /></button>
      </aside>

      <aside className="left-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">EDIT HOUSE</p>
            <h1>Phối màu công trình</h1>
          </div>
          <button className="icon-btn" onClick={resetProject} title="Dự án mới"><RotateCcw size={16} /></button>
        </div>

        <button className="upload-card" onClick={() => fileInput.current?.click()}>
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
              ? ALL_COLORS.find((item) => item.id === choice.colorId)
              : undefined;
            const chipColor = color?.hex || choice?.customHex || "#E6E1D8";

            return (
              <button
                key={structure.id}
                className={"structure-item " + (selectedStructure?.id === structure.id ? "selected" : "")}
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
            <button className="tool-btn"><Eye size={16} /> Xem trước</button>
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
              {!renderedImage && <img src={originalImage} alt="Công trình gốc" className="stage-image" />}

              {renderedImage && (
                <>
                  <img src={renderedImage} alt="Ảnh đã phối màu" className="stage-image" />
                  <div
                    className="compare-original"
                    style={{ width: compareValue + "%" }}
                  >
                    <img src={originalImage} alt="Ảnh gốc" className="compare-image" />
                  </div>
                  <div className="compare-line" style={{ left: compareValue + "%" }}>
                    <span className="compare-handle">↔</span>
                  </div>
                  <input
                    aria-label="So sánh trước sau"
                    className="compare-range"
                    type="range"
                    min="0"
                    max="100"
                    value={compareValue}
                    onChange={(e) => setCompareValue(Number(e.target.value))}
                  />
                  <span className="before-label">TRƯỚC</span>
                  <span className="after-label">SAU</span>
                </>
              )}

              {(analyzing || rendering) && (
                <div className="working-overlay">
                  <div className="working-card">
                    <LoaderCircle className="spin" size={27} />
                    <strong>{analyzing ? "Đang nhận diện kết cấu..." : "Đang phối màu siêu thực..."}</strong>
                    <span>{analyzing ? "AI đang đọc các bề mặt của công trình" : "Giữ nguyên kiến trúc, ánh sáng và phối cảnh gốc"}</span>
                  </div>
                </div>
              )}
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
            <span>Chất lượng</span>
            <div className="segment">
              <button className={quality === "fast" ? "active" : ""} onClick={() => setQuality("fast")}>
                <Zap size={13} /> Nhanh
              </button>
              <button className={quality === "pro" ? "active" : ""} onClick={() => setQuality("pro")}>
                <Sparkles size={13} /> Pro 2K
              </button>
            </div>
          </div>

          <label className="lock-toggle">
            <input
              type="checkbox"
              checked={preserveArchitecture}
              onChange={(e) => setPreserveArchitecture(e.target.checked)}
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
            <div className="select-wrap">
              <select
                value={selectedChoice?.brand || MARKET_BRANDS[0]}
                onChange={(e) => updateChoice(selectedStructure.id, { brand: e.target.value })}
              >
                {MARKET_BRANDS.map((brand) => <option key={brand}>{brand}</option>)}
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

                <div className="search-box">
                  <Search size={15} />
                  <input
                    value={paintSearch}
                    onChange={(e) => setPaintSearch(e.target.value)}
                    placeholder="Tìm tên, mã màu..."
                  />
                </div>

                <div className="color-grid">
                  {visibleColors.slice(0, 80).map((color) => {
                    const active = selectedChoice?.colorId === color.id;
                    return (
                      <button
                        key={color.id}
                        className={"color-card " + (active ? "active" : "")}
                        onClick={() => chooseColor(color)}
                        title={color.name + " · " + color.code + " · " + color.finish}
                      >
                        <span className="color-chip" style={{ background: color.hex }}>
                          {active && <Check size={14} />}
                        </span>
                        <span>{color.name}</span>
                        <small>{color.code}</small>
                      </button>
                    );
                  })}
                </div>

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
