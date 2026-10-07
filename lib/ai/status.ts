import { readConfig, resolveKey, keyPreview, writeConfig, resolveOpenAIKey, openaiKeyPreview, resolveOpenAIModel } from './ai-config-store';
import { loadModels } from './experiential-provider';
import { selectModels, scoreModel } from './model-selector';
import { ROLES } from './types';
export async function status(refresh = false, optimize = false) {
  const config = await readConfig(), key = resolveKey(config), openaiKey = resolveOpenAIKey(config);
  if (optimize) config.overrides = {};
  const models = key ? await loadModels(key,refresh) : [];
  const warnings: string[] = [];
  for (const role of ROLES) { if (config.overrides[role] && !models.some(m=>m.slug===config.overrides[role] && m.roles.includes(role))) { delete config.overrides[role]; warnings.push(`${role}: model thủ công không còn khả dụng, đã chuyển Auto.`); } }
  if (warnings.length || optimize) await writeConfig(config);
  const ranked = selectModels(models,config.mode,config.overrides);
  const selected = Object.fromEntries(ROLES.map(r=>[r,ranked[r][0]?.slug || null]));
  return {
    configured:!!key,
    provider:'experiential',
    connected:!!key,
    keyPreview:keyPreview(key),
    openaiConfigured:!!openaiKey,
    openaiConnected:!!openaiKey,
    openaiKeyPreview:openaiKeyPreview(openaiKey),
    openaiModel:resolveOpenAIModel(config),
    architectureEngine:openaiKey?'openai':'experiential',
    modelCount:models.length,
    mode:config.mode,
    overrides:config.overrides,
    selected:{...selected,vision:selected.VISION_ANALYZE,mask:selected.MASK_ANALYZE,catalogOcr:selected.CATALOG_OCR,render:selected.IMAGE_RENDER,text:selected.TEXT_HELPER},
    models,warnings,
    fallbacks:Object.fromEntries(ROLES.map(r=>[r,ranked[r].map(m=>m.slug)])),
    ...(process.env.NODE_ENV === 'development' ? {debug:Object.fromEntries(ROLES.map(r=>[r,models.map(m=>({slug:m.slug,...scoreModel(m,r,config.mode)}))]))} : {})
  };
}
