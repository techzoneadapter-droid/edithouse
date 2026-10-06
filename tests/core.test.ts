import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { compositeMasked } from '../lib/composite';
import { importRows, parseCSV, importCatalog } from '../lib/catalog-import';
import { validatePolygons } from '../lib/masks';
import ExcelJS from 'exceljs';

test('masked composition preserves every channel outside mask and combines multiple surfaces',async()=>{
  const pixels=Buffer.from([20,30,40,255, 50,60,70,255, 80,90,100,255]);
  const original=await sharp(pixels,{raw:{width:3,height:1,channels:4}}).png().toBuffer();
  const generated=await sharp({create:{width:3,height:1,channels:4,background:'#ffffff'}}).png().toBuffer();
  const mask=async(values:number[])=>'data:image/png;base64,'+(await sharp(Buffer.from(values.flatMap(a=>[255,255,255,a])),{raw:{width:3,height:1,channels:4}}).png().toBuffer()).toString('base64');
  const output=await compositeMasked(original,generated,[await mask([255,0,0]),await mask([0,0,255])]);
  const decoded=await sharp(output).raw().toBuffer();
  assert.deepEqual([...decoded.subarray(4,8)],[50,60,70,255]);
  assert.deepEqual([...decoded.subarray(0,4)],[255,255,255,255]);
  assert.deepEqual([...decoded.subarray(8,12)],[255,255,255,255]);
  await assert.rejects(compositeMasked(original,generated,[await mask([0,0,0])]),/trống/);
});
test('CSV handles BOM, quoted commas, escaped quotes and RGB without inventing codes',()=>{
  const colors=importRows(parseCSV('\uFEFFbrand,collection,color_name,color_code,hex,rgb,category,finish,material\r\nMy brand,Official,"Warm, \"\"cream\"\"",CODE-42,,"12,34,56",Warm,Satin,exterior'));
  assert.equal(colors[0].name,'Warm, "cream"');assert.equal(colors[0].code,'CODE-42');assert.equal(colors[0].hex,'#0C2238');
  assert.throws(()=>importRows(parseCSV('brand,color_name,color_code,hex\nTest,Name,Code,INVALID')),/Dòng/);
  assert.throws(()=>parseCSV('"unclosed'),/CSV/);
});
test('XLSX import uses actual worksheet values',async()=>{
  const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Colors');sheet.addRow(['brand','color_name','color_code','hex']);sheet.addRow(['Imported','Blue','B-12','#123ABC']);
  const data=await book.xlsx.writeBuffer();const file=new File([new Uint8Array(data)],'colors.xlsx');const colors=await importCatalog(file);
  assert.equal(colors[0].code,'B-12');assert.equal(colors[0].hex,'#123ABC');
});
test('invalid geometry is rejected instead of painting a guessed bounding box',()=>{
  assert.deepEqual(validatePolygons([[[0,0],[1000,0],[500,1000]],[[0,0],[Infinity,4],[2,3]],[[0,0],[1,2]]]),[[[0,0],[1000,0],[500,1000]]]);
});
