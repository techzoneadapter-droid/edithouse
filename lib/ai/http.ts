import { NextResponse } from 'next/server';
import { AIError } from './experiential-provider';
export function localRequest(request: Request) {
  const url = new URL(request.url), origin = request.headers.get('origin');
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || (origin && origin !== url.origin)) throw new AIError('Settings AI chỉ khả dụng trên localhost cùng origin.',403);
}
export function failure(error: unknown) { return NextResponse.json({error:error instanceof Error ? error.message : 'Lỗi AI.'}, {status:error instanceof AIError ? error.status : 500,headers:{'Cache-Control':'no-store'}}); }
