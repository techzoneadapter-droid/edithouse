export type PaintMaterial =
  | "exterior"
  | "interior"
  | "waterproof"
  | "stone"
  | "concrete"
  | "stucco"
  | "metal"
  | "wood";

export type PaintColor = {
  brandId?: string;
  collectionId?: string;
  id: string;
  name: string;
  code: string;
  hex: string;
  family: string;
  material: PaintMaterial;
  finish: string;
  brand?: string;
  collection?: string;
};

export const MARKET_BRANDS = [
  "Dulux",
  "Jotun",
  "Nippon Paint",
  "KOVA",
  "Mykolor",
  "SPEC",
  "Kansai Paint",
  "TOA",
  "Joton",
  "Expo",
  "TNANO",
  "Khác / màu tùy chỉnh"
];

export const PAINT_SYSTEMS: Array<{
  id: PaintMaterial;
  name: string;
  description: string;
}> = [
  { id: "exterior", name: "Sơn ngoại thất", description: "Mờ, satin, bóng; chống UV và thời tiết" },
  { id: "interior", name: "Sơn nội thất", description: "Mờ, lau chùi, kháng khuẩn và cao cấp" },
  { id: "waterproof", name: "Chống thấm", description: "Màng màu, trong suốt, xi măng polymer" },
  { id: "stone", name: "Giả đá", description: "Granite, marble, đá hạt, đá hoa cương" },
  { id: "concrete", name: "Hiệu ứng bê tông", description: "Bê tông thô, microcement, xi măng" },
  { id: "stucco", name: "Hiệu ứng nghệ thuật", description: "Stucco, Venetian, metallic, cát, nhung" },
  { id: "metal", name: "Sơn kim loại", description: "Sắt thép, chống gỉ, metallic, nhôm" },
  { id: "wood", name: "Sơn gỗ", description: "PU, stain, màu gỗ, phủ bảo vệ" }
];

const base = [
  ["EH-001","Trắng tinh","#F5F5F2","Trắng"],
  ["EH-002","Trắng ấm","#EEE9DF","Trắng"],
  ["EH-003","Kem sữa","#E9DFC8","Kem"],
  ["EH-004","Ivory","#E4D7BC","Kem"],
  ["EH-005","Be cát","#D6C3A4","Be"],
  ["EH-006","Greige sáng","#C9C2B5","Be"],
  ["EH-007","Xám sương","#C9CBC8","Xám"],
  ["EH-008","Xám xi măng","#9B9D99","Xám"],
  ["EH-009","Xám graphite","#575C5E","Xám"],
  ["EH-010","Đen than","#25292B","Đen"],
  ["EH-011","Nâu đất","#8C654D","Nâu"],
  ["EH-012","Nâu chocolate","#5D4035","Nâu"],
  ["EH-013","Đỏ gạch","#A95545","Đỏ"],
  ["EH-014","Đỏ rượu","#6F3138","Đỏ"],
  ["EH-015","Cam đất","#C77A4A","Cam"],
  ["EH-016","Vàng cát","#D8B86A","Vàng"],
  ["EH-017","Vàng kem","#E7D49B","Vàng"],
  ["EH-018","Xanh sage","#A8B39C","Xanh lá"],
  ["EH-019","Xanh olive","#77805D","Xanh lá"],
  ["EH-020","Xanh rêu","#56624A","Xanh lá"],
  ["EH-021","Xanh mint","#B9D8CB","Xanh lá"],
  ["EH-022","Xanh trời nhạt","#B8D4E4","Xanh dương"],
  ["EH-023","Xanh slate","#738A9C","Xanh dương"],
  ["EH-024","Xanh navy","#33485F","Xanh dương"],
  ["EH-025","Xanh petrol","#2F6265","Xanh dương"],
  ["EH-026","Tím khói","#A39AAA","Tím"],
  ["EH-027","Hồng đất","#C99C92","Hồng"],
  ["EH-028","Champagne","#D2B98E","Kim loại"]
] as const;

export const STARTER_COLORS: PaintColor[] = base.flatMap(([code,name,hex,family], index) => {
  const materials: PaintMaterial[] =
    index < 24 ? ["exterior", "interior"] :
    index < 26 ? ["concrete", "stucco"] :
    ["stucco", "metal"];
  return materials.map((material, m) => ({
    id: `${code.toLowerCase()}-${material}-${m}`,
    name,
    code,
    hex,
    family,
    material,
    finish:
      material === "stucco" ? "Hiệu ứng" :
      material === "concrete" ? "Mờ khoáng" :
      material === "metal" ? "Metallic" :
      "Satin"
  }));
});

export const SPECIAL_FINISHES: PaintColor[] = [
  { id:"stone-granite-light", name:"Granite sáng", code:"STONE-G01", hex:"#C8C1B3", family:"Giả đá", material:"stone", finish:"Granite hạt mịn" },
  { id:"stone-granite-dark", name:"Granite tối", code:"STONE-G02", hex:"#676A68", family:"Giả đá", material:"stone", finish:"Granite hạt mịn" },
  { id:"stone-marble-cream", name:"Marble kem", code:"STONE-M01", hex:"#DDD1BB", family:"Giả đá", material:"stone", finish:"Vân marble" },
  { id:"stone-marble-white", name:"Marble trắng", code:"STONE-M02", hex:"#E8E7E1", family:"Giả đá", material:"stone", finish:"Vân marble" },
  { id:"concrete-raw", name:"Bê tông thô", code:"FX-C01", hex:"#9B9992", family:"Hiệu ứng", material:"concrete", finish:"Bê tông loang" },
  { id:"concrete-warm", name:"Microcement ấm", code:"FX-C02", hex:"#B9AB98", family:"Hiệu ứng", material:"concrete", finish:"Microcement" },
  { id:"stucco-pearl", name:"Venetian ngọc trai", code:"FX-S01", hex:"#D8D2C6", family:"Hiệu ứng", material:"stucco", finish:"Venetian bóng" },
  { id:"stucco-gold", name:"Metallic gold", code:"FX-S02", hex:"#B79B61", family:"Hiệu ứng", material:"stucco", finish:"Metallic" },
  { id:"waterproof-gray", name:"Chống thấm xám", code:"WP-G01", hex:"#8D9192", family:"Chống thấm", material:"waterproof", finish:"Màng mờ" },
  { id:"waterproof-clear", name:"Chống thấm trong", code:"WP-CLEAR", hex:"#DDE7E9", family:"Chống thấm", material:"waterproof", finish:"Trong suốt" },
  { id:"wood-oak", name:"Oak tự nhiên", code:"WOOD-01", hex:"#B88A5A", family:"Gỗ", material:"wood", finish:"Stain satin" },
  { id:"wood-walnut", name:"Walnut", code:"WOOD-02", hex:"#6E4B35", family:"Gỗ", material:"wood", finish:"Stain satin" },
  { id:"metal-black", name:"Đen kim loại", code:"METAL-01", hex:"#323638", family:"Kim loại", material:"metal", finish:"Satin" },
  { id:"metal-silver", name:"Bạc nhôm", code:"METAL-02", hex:"#AAB0B2", family:"Kim loại", material:"metal", finish:"Metallic" }
];

export const ALL_COLORS = [...STARTER_COLORS, ...SPECIAL_FINISHES];
