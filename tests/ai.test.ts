import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeModel } from '../lib/ai/model-capabilities';
import { selectModels } from '../lib/ai/model-selector';
import { ROLES } from '../lib/ai/types';
import { ExperientialProvider, AIError, retryable, loadModels, invalidateModels } from '../lib/ai/experiential-provider';
import { readConfig, writeConfig, resolveKey } from '../lib/ai/ai-config-store';
import { runRole } from '../lib/ai/provider';
function row(slug:string,input=['text'],output=['text'],structured=false,price=1) {
  return {model:{slug,display_name:slug,input_modalities:input,output_modalities:output,context_window:128000,supported_params:{}},providers:[{status:'active',routable:true,input_nano_usd_per_million:price*1e9,output_nano_usd_per_million:price*1e9,capabilities:{supports_structured_output:structured},uptime_30d:99}]};
}
test('capability gates, unknown metadata, manual override and three fallback candidates',()=>{
  const models=[normalizeModel(row('free-text',undefined,undefined,false,0),{}),normalizeModel(row('vision',['text','image'],['text'],true),{}),normalizeModel(row('render',['text','image'],['image']),{}),normalizeModel(row('vision-2',['text','image'],['text'],true,2),{}),normalizeModel(row('vision-3',['text','image'],['text'],true,3),{}),normalizeModel(row('image-in-name'),{}),normalizeModel(row('unavailable',['text','image'],['image']),null)];
  for(const mode of ['economy','balanced','quality'] as const) {
    const selected=selectModels(models,mode,{});
    for(const role of ROLES) assert.ok(selected[role].length);
    assert.equal(selected.IMAGE_RENDER[0].slug,'render');
    assert.ok(!selected.VISION_ANALYZE.some(m=>m.slug==='free-text'));
    assert.equal(selected.VISION_ANALYZE.length,3);
  }
  assert.equal(selectModels(models,'economy',{VISION_ANALYZE:'vision-3'}).VISION_ANALYZE[0].slug,'vision-3');
  assert.notEqual(selectModels(models,'economy',{VISION_ANALYZE:'free-text'}).VISION_ANALYZE[0].slug,'free-text');
  assert.equal(models[5].roles.includes('IMAGE_RENDER'),false);
});
test('authenticated model/catalog intersection, pagination, key-specific cache and refresh',async()=>{
  const original=global.fetch; const calls:string[]=[];
  global.fetch=async(url,init)=>{
    calls.push(String(url));assert.match(String((init?.headers as any).Authorization),/^Bearer /);
    if(String(url).endsWith('/v1/models'))return Response.json({data:[{id:'vision'}]});
    const offset=new URL(String(url)).searchParams.get('offset');
    return Response.json({models:offset==='0'?[row('not-granted'),row('vision',['text','image'],['text'],true)]:[row('also-not-granted')],total:3,limit:2});
  };
  try {
    invalidateModels();const models=await loadModels('synthetic-key');assert.equal(models.length,1);assert.equal(models[0].slug,'vision');assert.equal(calls.length,3);
    await loadModels('synthetic-key');assert.equal(calls.length,3);
    await loadModels('synthetic-key',true);assert.equal(calls.length,6);
  }finally{global.fetch=original;invalidateModels();}
});
test('auth, payment and location errors never fall back; capability and temporary errors do',async()=>{
  for(const [status,code] of [[401,'invalid_api_key'],[403,'model_location_not_supported'],[429,'insufficient_quota'],[429,'card_required'],[400,'invalid_parameter']] as const)assert.equal(retryable(new AIError('failure',status,code)),false);
  for(const [status,code] of [[429,'rate_limit'],[504,'timeout'],[503,'capacity'],[400,'unsupported_capability']] as const)assert.equal(retryable(new AIError('failure',status,code)),true);
  const original=global.fetch;global.fetch=async()=>Response.json({error:{message:'bad key'}},{status:401});
  try{await assert.rejects(new ExperientialProvider('synthetic-key').models(),/không hợp lệ/);}finally{global.fetch=original;}
});
test('encrypted server settings survive reload with no plaintext key on disk',async()=>{
  const cwd=process.cwd(),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'edithouse-ai-'));
  process.chdir(temporary);
  try {
    assert.equal(resolveKey(await readConfig()),process.env.EXPLABS_API_KEY||'');
    const key='synthetic-secret-not-a-real-api-key';
    await writeConfig({apiKey:key,mode:'quality',overrides:{TEXT_HELPER:'manual-model'}});
    const bytes=await fs.readFile(path.join(temporary,'.edithouse/settings.enc'));assert.equal(bytes.includes(Buffer.from(key)),false);
    const loaded=await readConfig();assert.equal(loaded.apiKey,key);assert.equal(loaded.overrides.TEXT_HELPER,'manual-model');
  }finally{process.chdir(cwd);await fs.rm(temporary,{recursive:true,force:true});}
});
test('role execution falls back on unsupported capability and stops on exhausted credit',async()=>{
  const cwd=process.cwd(),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'edithouse-fallback-')),original=global.fetch;
  process.chdir(temporary);
  global.fetch=async(url)=>Response.json(String(url).endsWith('/v1/models')?{data:[{id:'a'},{id:'b'}]}:{models:[row('a',['text','image'],['text'],true),row('b',['text','image'],['text'],true,2)],total:2});
  try {
    await writeConfig({apiKey:'synthetic-fallback-key',mode:'economy',overrides:{}});invalidateModels();
    const called:string[]=[];
    const result=await runRole('VISION_ANALYZE',async(_ai,m)=>{called.push(m.slug);if(m.slug==='a')throw new AIError('unsupported',400,'unsupported_capability');return 'valid';});
    assert.deepEqual(called,['a','b']);assert.equal(result.model,'b');
    let attempts=0;
    await assert.rejects(runRole('VISION_ANALYZE',async()=>{attempts++;throw new AIError('No credits',429,'insufficient_quota');}),/No credits/);
    assert.equal(attempts,1);
    assert.equal((await loadModels('synthetic-fallback-key'))[0].roles.includes('VISION_ANALYZE'),false);
    assert.equal((await loadModels('synthetic-fallback-key',true))[0].roles.includes('VISION_ANALYZE'),true);
  }finally{global.fetch=original;invalidateModels();process.chdir(cwd);await fs.rm(temporary,{recursive:true,force:true});}
});
