import { NextResponse } from 'next/server';
import { runRole } from '@/lib/ai/provider';
import { AIError } from '@/lib/ai/experiential-provider';
import { failure, localRequest } from '@/lib/ai/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    localRequest(request); const {prompt} = await request.json();
    if(typeof prompt!=='string'||!prompt.trim()||prompt.length>10000)throw new AIError('Prompt không hợp lệ.',400);
    const response=await runRole('TEXT_HELPER',async(ai,m)=>{const r=await ai.chat(m.slug,prompt,[],undefined,1024);return r.choices[0].message.content;});
    return NextResponse.json({text:response.result,model:response.model});
  }catch(e){return failure(e);}
}
