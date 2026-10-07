import { NextResponse } from 'next/server';
import { status } from '@/lib/ai/status';
import { failure, localRequest } from '@/lib/ai/http';
import { readConfig, resolveKey, keyPreview, resolveOpenAIKey, openaiKeyPreview, resolveOpenAIModel } from '@/lib/ai/ai-config-store';
import { ROLES } from '@/lib/ai/types';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    localRequest(request);
    try { return NextResponse.json(await status(),{headers:{'Cache-Control':'no-store'}}); }
    catch(e) {
      const config=await readConfig(),key=resolveKey(config),openaiKey=resolveOpenAIKey(config);
      return NextResponse.json({
        configured:!!key,
        provider:'experiential',
        connected:false,
        keyPreview:keyPreview(key),
        openaiConfigured:!!openaiKey,
        openaiConnected:!!openaiKey,
        openaiKeyPreview:openaiKeyPreview(openaiKey),
        openaiModel:resolveOpenAIModel(config),
        architectureEngine:openaiKey?'openai':'experiential',
        modelCount:0,
        mode:config.mode,
        overrides:config.overrides,
        selected:Object.fromEntries(ROLES.map(role=>[role,null])),
        models:[],
        error:e instanceof Error?e.message:'Không thể kết nối Experiential Labs.'
      },{headers:{'Cache-Control':'no-store'}});
    }
  } catch(e) { return failure(e); }
}
