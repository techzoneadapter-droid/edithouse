import { createHash } from 'node:crypto';
import { normalizeModel } from './model-capabilities';
import type { Model } from './types';
export const BASE_URL = 'https://api.experientiallabs.ai/v1';
export class AIError extends Error {
  constructor(message: string, public status = 500, public code = '') { super(message); }
}
export function retryable(e: unknown) { return e instanceof AIError && (e.code === 'unsupported_capability' || (![401,402,403].includes(e.status) && !/quota|credit|payment|purchase|card_required|free_limit|location|invalid|billing|spend|budget|fund|balance/.test(e.code) && (e.status === 429 || e.status === 408 || e.status >= 500))); }
export class ExperientialProvider {
  constructor(private key: string) {}
  async request(path: string, body?: unknown, timeout = 15000) {
    let response: Response;
    try { response = await fetch(`https://api.experientiallabs.ai${path}`, {method: body ? 'POST' : 'GET', headers: {Authorization: `Bearer ${this.key}`, 'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout), cache:'no-store'}); }
    catch { throw new AIError('Không thể kết nối Experiential Labs.',504,'timeout'); }
    const data = await response.json().catch(()=>({}));
    if (!response.ok) {
      const code = data.error?.code || '';
      const message = response.status === 401 ? 'API key Experiential Labs không hợp lệ hoặc đã bị thu hồi.' : String(data.error?.message || `Experiential HTTP ${response.status}`).replaceAll(this.key,'[REDACTED]');
      throw new AIError(message,response.status,code);
    }
    return data;
  }
  async models(): Promise<Model[]> {
    const available = await this.request('/v1/models');
    if (!Array.isArray(available.data)) throw new AIError('Danh sách model không hợp lệ.');
    const slugs = new Map(available.data.map((m: any)=>[m.id || m.slug,m]));
    const rows: any[] = [];
    const promotions = new Map<string,any>();
    const deadline = Date.now() + 90000;
    for (let offset = 0; ; ) {
      if (Date.now() > deadline) throw new AIError('Không thể tải catalog Experiential Labs trong thời gian cho phép.',504,'timeout');
      const page = await this.request(`/api/models?limit=100&offset=${offset}`);
      if (!Array.isArray(page.models)) throw new AIError('Catalog metadata không hợp lệ.');
      for (const promotion of page.promotions || []) if (promotion.display_only !== true) promotions.set(promotion.id,promotion);
      rows.push(...page.models); offset += page.models.length;
      if (!page.models.length || offset >= page.total || (page.total === undefined && page.models.length < (page.limit || 100))) break;
      if (offset > 20000) throw new AIError('Catalog vượt giới hạn an toàn.');
    }
    return rows.filter(row=>slugs.has((row.model || row).slug)).map(row=>{
      const model = normalizeModel(row,slugs.get((row.model || row).slug));
      model.promotions = [...promotions.values()].filter(p=>(p.slugs || []).includes(model.slug)).map(p=>({label:String(p.label || ''),free:p.free===true,percentOff:Number(p.percent_off || 0)}));
      model.promotional ||= model.promotions.length > 0;
      return model;
    });
  }
  async chat(model: string, prompt: string, images: string[] = [], schema?: object, maxTokens = 8192) {
    return this.request('/v1/chat/completions', {model, messages:[{role:'user',content:[{type:'text',text:prompt},...images.map(url=>({type:'image_url',image_url:{url}}))]}], max_tokens:maxTokens, ...(schema ? {response_format:{type:'json_schema',json_schema:{name:'edithouse',strict:true,schema}}} : {})}, 45000);
  }
}
const cache = new Map<string,{expires:number; models: Model[]}>();
export function invalidateModels() { cache.clear(); }
export async function loadModels(key: string, refresh = false) {
  const id = createHash('sha256').update(key).digest('hex');
  const entry = cache.get(id);
  if (!refresh && entry && entry.expires > Date.now()) return entry.models;
  const models = await new ExperientialProvider(key).models();
  cache.set(id,{expires:Date.now()+20*60*1000,models}); return models;
}
