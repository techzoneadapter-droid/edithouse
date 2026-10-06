import type { PaintColor, PaintMaterial } from './catalog';
const materials: PaintMaterial[] = ['exterior','interior','waterproof','stone','concrete','stucco','metal','wood'];
export function parseCSV(text: string): string[][] {
  const rows: string[][]=[]; let row: string[]=[]; let cell=''; let quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"') {cell+='"';i++;} else quoted=!quoted; }
    else if(c===',' && !quoted) {row.push(cell);cell='';}
    else if((c==='\n'||c==='\r') && !quoted) {if(c==='\r' && text[i+1]==='\n') i++;row.push(cell);if(row.some(v=>v.trim())) rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted) throw new Error('CSV thiếu dấu đóng ngoặc kép.');
  row.push(cell);if(row.some(v=>v.trim())) rows.push(row);
  return rows;
}
export function importRows(rows: string[][]): PaintColor[] {
  const headers=(rows.shift()||[]).map(h=>h.replace(/^\uFEFF/,'').trim().toLowerCase());
  for(const header of ['brand','color_name','color_code']) if(!headers.includes(header)) throw new Error('Thiếu cột '+header);
  const colors: PaintColor[]=[];
  if(rows.length>100000) throw new Error('Tối đa 100.000 màu mỗi lần nhập.');
  rows.forEach((row,index)=>{
    if(!row.some(v=>v.trim())) return;
    const get=(key:string)=>String(row[headers.indexOf(key)]||'').trim();
    const code=String(row[headers.indexOf('color_code')]||'');
    let hex=get('hex'); if(hex && !hex.startsWith('#')) hex='#'+hex;
    if(!hex && get('rgb')) { const rgb=get('rgb').replace(/rgb|[()]/gi,'').split(/[,;\s]+/).filter(Boolean).map(Number); if(rgb.length===3 && rgb.every(n=>Number.isInteger(n)&&n>=0&&n<=255)) hex='#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join(''); }
    if(!/^#[0-9a-f]{6}$/i.test(hex) || !get('brand') || !code.trim()) throw new Error('Dòng '+(index+2)+': cần hãng, mã và HEX/RGB hợp lệ.');
    const material=get('material')||'exterior'; if(!materials.includes(material as PaintMaterial)) throw new Error('Dòng '+(index+2)+': material không hợp lệ.');
    colors.push({id:JSON.stringify([get('brand'),get('collection'),code,material]),brand:get('brand'),collection:get('collection'),name:get('color_name'),code,hex:hex.toUpperCase(),family:get('category'),finish:get('finish'),material:material as PaintMaterial});
  });
  return [...new Map(colors.map(c=>[c.id,c])).values()];
}
export async function importCatalog(file: File): Promise<PaintColor[]> {
  if(file.size>25*1024*1024) throw new Error('Catalogue tối đa 25 MB.');
  if(file.name.toLowerCase().endsWith('.csv')) return importRows(parseCSV(await file.text()));
  if(!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Chọn CSV hoặc XLSX.');
  const module=await import('exceljs');
  const ExcelJS=module.default || module;
  const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(await file.arrayBuffer());
  const sheet=workbook.worksheets[0]; if(!sheet) throw new Error('Không có worksheet.');
  const rows: string[][]=[]; sheet.eachRow(row=>{const cells:string[]=[];row.eachCell({includeEmpty:true},(cell,i)=>{cells[i-1]=cell.text;});rows.push(cells);});
  return importRows(rows);
}
