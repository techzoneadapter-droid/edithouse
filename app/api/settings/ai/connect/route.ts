import { NextResponse } from 'next/server';
import { readConfig, writeConfig } from '@/lib/ai/ai-config-store';
import { AIError, loadModels } from '@/lib/ai/experiential-provider';
import { status } from '@/lib/ai/status';
import { failure, localRequest } from '@/lib/ai/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    localRequest(request); const body = await request.json();
    if (body.provider !== 'experiential' || typeof body.apiKey !== 'string' || !/^xpl_[A-Za-z0-9_-]{8,}$/.test(body.apiKey.trim())) throw new AIError('API key Experiential Labs không hợp lệ hoặc đã bị thu hồi.',401);
    const key = body.apiKey.trim(); await loadModels(key,true);
    await writeConfig({...await readConfig(),apiKey:key});
    return NextResponse.json(await status());
  } catch(e) { return failure(e); }
}
