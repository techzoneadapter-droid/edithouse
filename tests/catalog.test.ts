import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {sampleSwatchColor,rgbToHex,type RGB} from '../lib/catalog/color-sampler';
import {deduplicatePreview,type PreviewColor} from '../lib/catalog/types';
import {loadCatalog,saveCatalogImport} from '../lib/catalog-store';
function image(color:RGB){const width=160,height=160,data=new Uint8Array(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const border=x<16||x>144||y<16||y>144;const text=y>68&&y<82&&x>40&&x<120;const outlier=x%17===0&&y%13===0;
  const rgb:RGB=border?[255,255,255]:text?[0,0,0]:outlier?[255,0,255]:color;data.set([...rgb,255],(y*width+x)*4);
}return {width,height,data};}
test('sampling removes border, lettering and colored outliers while preserving true white/black swatches',()=>{
  for(const color of [[231,229,220],[34,67,89],[250,250,250],[5,5,5]] as RGB[]){const result=sampleSwatchColor(image(color),[0,0,1000,1000]);assert.deepEqual(result.rgb,color);assert.equal(result.hex,rgbToHex(color));assert.ok(result.sampleCount>300);}
  assert.throws(()=>sampleSwatchColor(image([1,2,3]),[990,0,200,1000]),/box/);
  assert.throws(()=>sampleSwatchColor(image([1,2,3]),[0,0,1,1]),/nhỏ/);
});
function row(code:string,brand='Jotun',confidence=.8):PreviewColor{return {id:crypto.randomUUID(),brand,collection:'Majestic',code,name:'',hex:'#E7E5DC',rgb:[231,229,220],sourceImageId:'source-1',sourceBox:[0,0,1000,1000],confidence,selected:true};}
test('preview dedupe preserves manufacturer codes exactly and prefers higher OCR confidence',()=>{
  const rows=deduplicatePreview([row('9918','Jotun',.4),row('9918','JOTUN',.9),row('30YY 83/029','Dulux'),row('A-02 / B','Nippon Paint')]);
  assert.equal(rows.length,3);assert.equal(rows[0].confidence,.9);assert.equal(rows[0].code,'9918');assert.equal(rows[1].code,'30YY 83/029');assert.equal(rows[2].code,'A-02 / B');
});
test('independent catalog persists blank names, sources, brand separation and atomic deduplication',async()=>{
  await assert.rejects(saveCatalogImport([row('9918','')],[]),/hãng/);
  const source={id:'source-1',name:'page1.png',dataUrl:'data:image/png;base64,test',createdAt:new Date().toISOString(),pageTitle:'Color card'};
  await saveCatalogImport([row('9918'),row('30YY 83/029','Dulux')],[source]);
  let saved=await loadCatalog();assert.equal(saved.brands.length,2);assert.equal(saved.colors.length,2);assert.equal(saved.sourceImages.length,1);
  assert.equal(saved.colors[0].name,'');assert.equal(saved.colors[0].code,'9918');
  const firstId=saved.colors[0].id;
  await saveCatalogImport([{...row('9918','jotun',.3),name:'less certain'},row('1024')],[]);
  saved=await loadCatalog();assert.equal(saved.colors.length,3);assert.equal(saved.colors.find(c=>c.code==='9918')?.id,firstId);assert.equal(saved.colors.find(c=>c.code==='9918')?.name,'');
  await saveCatalogImport([{...row('9918','Jotun',.95),name:'Classic White'}],[]);
  saved=await loadCatalog();assert.equal(saved.colors.find(c=>c.code==='9918')?.name,'Classic White');
});
