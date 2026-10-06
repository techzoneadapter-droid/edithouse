import { NextResponse } from 'next/server';
import { status } from '@/lib/ai/status';
import { failure, localRequest } from '@/lib/ai/http';
export const runtime = 'nodejs';
export async function GET(request: Request) { try { localRequest(request); const s = await status(new URL(request.url).searchParams.has('refresh')); return NextResponse.json(s,{headers:{'Cache-Control':'no-store'}}); } catch(e) { return failure(e); } }
export async function POST(request: Request) { try { localRequest(request); return NextResponse.json(await status(true,true)); } catch(e) { return failure(e); } }
