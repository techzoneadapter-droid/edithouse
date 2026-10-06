import { readConfig, resolveKey } from './ai-config-store';
import { AIError, ExperientialProvider, loadModels, retryable } from './experiential-provider';
import { selectModels } from './model-selector';
import type { Role, Model } from './types';
export async function getAIProvider() {
  const config = await readConfig(), key = resolveKey(config);
  if (!key) throw new AIError('AI chưa cấu hình. Mở Settings → AI Provider để nhập key.',503,'not_configured');
  return {ai:new ExperientialProvider(key), config, models:await loadModels(key)};
}
export async function runRole<T>(role: Role, operation: (ai: ExperientialProvider, model: Model)=>Promise<T>) {
  const {ai,config,models} = await getAIProvider();
  const candidates = selectModels(models,config.mode,config.overrides)[role];
  if (!candidates.length) throw new AIError(`Không có model đủ capability cho ${role}.`,422,'no_compatible_model');
  let last: unknown;
  for (const model of candidates) {
    try { return {result:await operation(ai,model),model:model.slug}; }
    catch (e) { last=e; if (e instanceof AIError && e.code === 'unsupported_capability') {model.incompatibleRoles=[...(model.incompatibleRoles || []),role];model.roles=model.roles.filter(r=>r!==role);} if (!retryable(e)) throw e; }
  }
  throw last;
}
