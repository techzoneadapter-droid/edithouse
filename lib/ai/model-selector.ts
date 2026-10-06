import { rejectionReasons } from './model-capabilities';
import { ROLES, type Model, type Mode, type Role } from './types';
export function scoreModel(m: Model, role: Role, mode: Mode) {
  const reasons = rejectionReasons(m, role);
  if (reasons.length) return {score: -1, reasons};
  const cost = m.pricing.input === null || m.pricing.output === null ? null : m.pricing.input + m.pricing.output * 2;
  const price = cost === null ? 0 : 1 / (1 + cost);
  const preferred = m.preferred === null ? 0 : 1 / (1 + m.preferred);
  const reliability = (m.uptime ?? 0) / 100;
  const speed = Math.min(1,(m.throughput ?? 0)/150);
  const latency = m.ttft === null ? 0 : 1/(1+m.ttft/1000);
  const capability = role === 'IMAGE_RENDER' ? (m.imageEditing ? 1 : 0.15) : role === 'TEXT_HELPER' ? 1 : Math.min(1,(m.context ?? 0)/(role === 'CATALOG_OCR' ? 32000 : role === 'MASK_ANALYZE' ? 200000 : 128000));
  const weights = mode === 'economy' ? [10,5,10,3,70,2] : mode === 'quality' ? [45,25,20,5,2,3] : [40,15,10,10,20,5];
  const score = [capability,preferred,reliability,speed,price,latency].reduce((sum,v,i)=>sum+v*weights[i],0);
  return {score, reasons: ['Capability hợp lệ', `Context ${m.context ?? 'UNKNOWN'}`, `Uptime ${m.uptime ?? 'UNKNOWN'}`, `Giá ${cost ?? 'UNKNOWN'}`, m.imageEditing ? 'Image editing xác nhận' : ''] .filter(Boolean)};
}
export function selectModels(models: Model[], mode: Mode, overrides: Partial<Record<Role,string>>) {
  return Object.fromEntries(ROLES.map(role=> {
    const ranked = models.filter(m=>!rejectionReasons(m,role).length).sort((a,b)=>scoreModel(b,role,mode).score-scoreModel(a,role,mode).score || a.slug.localeCompare(b.slug));
    const manual = ranked.find(m=>m.slug === overrides[role]);
    return [role, (manual ? [manual,...ranked.filter(m=>m!==manual)] : ranked).slice(0,3)];
  })) as Record<Role, Model[]>;
}
