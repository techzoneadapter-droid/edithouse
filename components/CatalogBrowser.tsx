"use client";

import { useMemo, useState } from "react";
import type { PaintColor } from "@/lib/catalog";

type Props = {
  colors: PaintColor[];
  collection: string;
  selectedColorId?: string;
  onCollection: (collection: string) => void;
  onManage: () => void;
  onChoose: (color: PaintColor) => void;
  favorites: string[];
  recent: string[];
  onFavorite: (id: string) => void;
};

type Tone = "all" | "light" | "neutral" | "warm" | "cool" | "dark";

function rgbFromHex(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return [128, 128, 128] as const;
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ] as const;
}

function toneOf(color: PaintColor): Exclude<Tone, "all"> {
  const [r, g, b] = rgbFromHex(color.hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (lightness >= 0.82) return "light";
  if (lightness <= 0.28) return "dark";
  if (delta < 0.08) return "neutral";

  let hue = 0;
  if (delta) {
    if (max === r / 255) hue = ((g - b) / 255 / delta) % 6;
    else if (max === g / 255) hue = (b - r) / 255 / delta + 2;
    else hue = (r - g) / 255 / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }

  return hue >= 35 && hue <= 85 || hue >= 330 || hue <= 25 ? "warm" : "cool";
}

function dedupeColors(colors: PaintColor[]) {
  const seen = new Map<string, PaintColor>();
  for (const color of colors) {
    const key = [
      (color.brand || "").trim().toLocaleLowerCase("vi"),
      (color.collection || "").trim().toLocaleLowerCase("vi"),
      color.code.trim().toLocaleUpperCase("vi")
    ].join("|");
    if (!seen.has(key)) seen.set(key, color);
  }
  return [...seen.values()];
}

export default function CatalogBrowser({
  colors,
  collection,
  selectedColorId,
  onCollection,
  onManage,
  onChoose,
  favorites,
  recent,
  onFavorite
}: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "favorites" | "recent">("all");
  const [tone, setTone] = useState<Tone>("all");
  const [page, setPage] = useState(0);

  const uniqueColors = useMemo(() => dedupeColors(colors), [colors]);
  const collections = useMemo(
    () => [...new Set(uniqueColors.map(c => c.collection || ""))].filter(Boolean),
    [uniqueColors]
  );

  const selected = useMemo(
    () => colors.find(c => c.id === selectedColorId),
    [colors, selectedColorId]
  );

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    let result = uniqueColors.filter(c =>
      (!collection || c.collection === collection) &&
      (mode !== "favorites" || favorites.includes(c.id)) &&
      (mode !== "recent" || recent.includes(c.id)) &&
      (tone === "all" || toneOf(c) === tone) &&
      (!normalizedQuery ||
        `${c.code} ${c.name} ${c.family || ""}`.toLocaleLowerCase("vi").includes(normalizedQuery))
    );

    if (mode === "recent") {
      const rank = new Map(recent.map((id, index) => [id, index]));
      result = [...result].sort(
        (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999)
      );
    }
    return result;
  }, [uniqueColors, collection, mode, favorites, recent, tone, query]);

  const pageSize = 36;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const selectTone = (value: Tone) => {
    setTone(value);
    setPage(0);
  };

  return (
    <div className="catalog-browser">
      {selected && (
        <div className="current-color">
          <span className="current-color-chip" style={{ background: selected.hex }} />
          <div>
            <small>Màu đang chọn</small>
            <strong>{selected.code}</strong>
            <span>{selected.name}</span>
          </div>
          <code>{selected.hex}</code>
        </div>
      )}

      <button className="catalog-manage-btn" onClick={onManage}>
        Quản lý / thêm bảng màu
      </button>

      <input
        className="catalog-search"
        aria-label="Tìm mã màu"
        placeholder="Tìm mã hoặc tên màu…"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setPage(0);
        }}
      />

      <div className="catalog-filter-row">
        <select
          aria-label="Collection"
          value={collection}
          onChange={e => {
            onCollection(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Tất cả collection</option>
          {collections.map(c => <option key={c}>{c}</option>)}
        </select>
        <select
          aria-label="Loại danh sách"
          value={mode}
          onChange={e => {
            setMode(e.target.value as "all" | "favorites" | "recent");
            setPage(0);
          }}
        >
          <option value="all">Tất cả</option>
          <option value="favorites">★ Yêu thích</option>
          <option value="recent">Gần đây</option>
        </select>
      </div>

      <div className="tone-filters" aria-label="Lọc theo tông màu">
        {([
          ["all", "Tất cả"],
          ["light", "Sáng"],
          ["neutral", "Trung tính"],
          ["warm", "Ấm"],
          ["cool", "Lạnh"],
          ["dark", "Đậm"]
        ] as Array<[Tone, string]>).map(([value, label]) => (
          <button
            key={value}
            className={tone === value ? "active" : ""}
            onClick={() => selectTone(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="catalog-count">
        <strong>{visible.length.toLocaleString()}</strong> màu
      </div>

      <div className="color-grid">
        {pageItems.map(c => {
          const active = selected
            ? selected.code === c.code &&
              (selected.brand || "") === (c.brand || "") &&
              (selected.collection || "") === (c.collection || "")
            : false;
          return (
            <div key={c.id} className={"catalog-color " + (active ? "active" : "")}>
              <button
                className={"color-card " + (active ? "active" : "")}
                title={`${c.brand || "EditHouse"} · ${c.code} · ${c.name}`}
                onClick={() => onChoose(c)}
              >
                <span className="color-chip" style={{ background: c.hex }} />
                <strong>{c.code}</strong>
                <small>{c.name}</small>
              </button>
              <button
                className="favorite-color"
                aria-label={`Yêu thích ${c.code}`}
                onClick={() => onFavorite(c.id)}
              >
                {favorites.includes(c.id) ? "★" : "☆"}
              </button>
            </div>
          );
        })}
      </div>

      {!visible.length && (
        <p className="catalog-empty">Không có màu phù hợp với bộ lọc hiện tại.</p>
      )}

      {pageCount > 1 && (
        <div className="catalog-pages">
          <button disabled={currentPage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
            ← Trước
          </button>
          <span>{currentPage + 1} / {pageCount}</span>
          <button
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}
