import { NextResponse } from 'next/server';
import { readConfig, writeConfig } from '@/lib/ai/ai-config-store';
import { getAIProvider } from '@/lib/ai/provider';
import { AIError } from '@/lib/ai/experiential-provider';
import { ROLES } from '@/lib/ai/types';
import { status } from '@/lib/ai/status';
import { failure, localRequest } from '@/lib/ai/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    localRequest(request); const body = await request.json(), config = await readConfig();
    if (!['economy','balanced','quality'].includes(body.mode)) throw new AIError('Chế độ không hợp lệ.',400);
    const overrides: typeof config.overrides = {};
    if (Object.values(body.overrides || {}).some(Boolean)) {
      const {models} = await getAIProvider();
      for (const role of ROLES) if (body.overrides?.[role]) { if (!models.some(m=>m.slug===body.overrides[role] && m.roles.includes(role))) throw new AIError(`Model không đủ capability: ${role}`,400); overrides[role]=body.overrides[role]; }
    }
    await writeConfig({...config,mode:body.mode,overrides}); return NextResponse.json(await status());
  } catch(e) { return failure(e); }
}
