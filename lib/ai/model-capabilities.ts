import { ROLES, type Model, type Role } from './types';
export function rejectionReasons(model: Model, role: Role) {
  const reasons: string[] = [];
  if (model.incompatibleRoles?.includes(role)) reasons.push('Capability test không tương thích');
  if (!model.callable) reasons.push('Không khả dụng với key');
  if (!model.inputModalities.includes('text')) reasons.push('Thiếu text input');
  if (role !== 'TEXT_HELPER' && !model.inputModalities.includes('image')) reasons.push('Thiếu image input / UNKNOWN');
  if (role === 'IMAGE_RENDER') { if (!model.outputModalities.includes('image')) reasons.push('Thiếu image output / UNKNOWN'); }
  else {
    if (!model.outputModalities.includes('text')) reasons.push('Thiếu text output');
    if (role !== 'TEXT_HELPER' && !model.supportsStructuredOutput) reasons.push('Thiếu JSON schema');
    if (role === 'MASK_ANALYZE' && (model.context === null || model.context < 8192)) reasons.push('Context không đủ / UNKNOWN');
  }
  return reasons;
}
export function normalizeModel(row: any, callable: any): Model {
  const m = row.model || row;
  const providers = (row.providers || []).filter((p: any) => p.status === 'active' && p.routable !== false && p.available_to_org !== false);
  const caps = providers.map((p: any) => p.capabilities || {});
  const params = m.supported_params || {};
  const numbers = (field: string) => providers.map((p: any) => p[field]).filter((v: any) => typeof v === 'number' && Number.isFinite(v));
  const best = (field: string) => { const n = numbers(field); return n.length ? Math.max(...n) : null; };
  const price = (field: string) => { const v = callable?.pricing?.[field] ?? callable?.[field]; const n = typeof v === 'number' ? [v] : numbers(field); return n.length ? Math.min(...n) / 1e9 : null; };
  const model: Model = {
    slug: m.slug, name: m.display_name || m.slug, provider: m.maker || providers.map((p: any)=>p.provider).join(', '),
    inputModalities: m.input_modalities || [], outputModalities: m.output_modalities || [],
    supportedParameters: Object.keys(params).filter(k=>params[k] === true),
    supportsStructuredOutput: caps.some((c: any)=>c.supports_structured_output === true),
    supportsTools: caps.some((c: any)=>c.supports_tools === true), reasoning: caps.some((c: any)=>c.supports_reasoning === true),
    imageEditing: params.image_editing === true || caps.some((c: any)=>c.supports_image_editing === true),
    context: m.context_window ?? null, pricing: {input: price('input_nano_usd_per_million'), output: price('output_nano_usd_per_million'), cached: price('cached_input_nano_usd_per_million')},
    uptime: best('uptime_30d'), throughput: best('throughput_tps'), ttft: best('ttft_ms'), retention: row.retention ?? null,
    promotional: row.promotional_listed === true, preferred: m.preferred_rank ?? null, callable: !!callable, roles: []
  };
  model.roles = ROLES.filter(role=>!rejectionReasons(model, role).length);
  return model;
}
