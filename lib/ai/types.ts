export const ROLES = ['VISION_ANALYZE', 'MASK_ANALYZE', 'CATALOG_OCR', 'IMAGE_RENDER', 'TEXT_HELPER'] as const;
export type Role = typeof ROLES[number];
export type Mode = 'economy' | 'balanced' | 'quality';
export type Model = {
  slug: string; name: string; provider: string; inputModalities: string[]; outputModalities: string[];
  supportedParameters: string[]; supportsStructuredOutput: boolean; supportsTools: boolean; reasoning: boolean;
  imageEditing: boolean; context: number | null; pricing: {input: number | null; output: number | null; cached: number | null};
  uptime: number | null; throughput: number | null; ttft: number | null; retention: string | null;
  promotional: boolean; preferred: number | null; callable: boolean; roles: Role[]; incompatibleRoles?: Role[];
  promotions?: {label: string; free: boolean; percentOff: number}[];
};
export type Config = {apiKey?: string; mode: Mode; overrides: Partial<Record<Role, string>>};
