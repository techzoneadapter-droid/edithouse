import type { PaintMaterial } from "./catalog";
import type { SurfaceMask } from "./masks";
export type Structure = {
  id: string;
  name: string;
  type: string;
  description: string;
  recommendedMaterials: PaintMaterial[];
  confidence: number;
  mask: SurfaceMask;
};

export type SurfaceChoice = {
  enabled: boolean;
  material: PaintMaterial;
  colorId?: string;
  customHex?: string;
  customCode?: string;
  brand: string;
  finish?: string;
};

export type AnalyzeResult = {
  buildingType: string;
  summary: string;
  structures: Structure[];
};

