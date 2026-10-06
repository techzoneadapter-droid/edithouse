import { NextResponse } from 'next/server';
import { runRole } from '@/lib/ai/provider';
import { AIError } from '@/lib/ai/experiential-provider';
import { ROLES, type Role } from '@/lib/ai/types';
import { failure, localRequest } from '@/lib/ai/http';
import sharp from 'sharp';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    localRequest(request); const {role,confirmCredit} = await request.json();
    if (!ROLES.includes(role)) throw new AIError('Role không hợp lệ.',400);
    if (role === 'IMAGE_RENDER' && confirmCredit !== true) throw new AIError('Thao tác có thể sử dụng credit. Cần xác nhận test render.',400);
    const image = 'data:image/png;base64,'+(await sharp({create:{width:32,height:32,channels:3,background:'#ffffff'}}).png().toBuffer()).toString('base64');
    const schema = {type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false};
    const response = await runRole(role as Role,async (ai,m)=> {
      const data = await ai.chat(m.slug, role==='IMAGE_RENDER' ? 'Return an edited version of this image with a small blue square.' : role==='TEXT_HELPER' ? 'reply exactly: OK' : 'Inspect this image. Return JSON {"ok":true}.',[...(role==='TEXT_HELPER'?[]:[image])], role==='TEXT_HELPER'||role==='IMAGE_RENDER'?undefined:schema,512);
      if (role==='IMAGE_RENDER' && !data.choices?.[0]?.message?.images?.length) throw new AIError('Route không trả ảnh; model chưa tương thích render.',400,'unsupported_capability');
      if (role!=='IMAGE_RENDER' && !data.choices?.[0]?.message?.content) throw new AIError('Model không trả nội dung test.',502);
      return true;
    });
    return NextResponse.json({ok:true,model:response.model});
  } catch(e) { return failure(e); }
}
