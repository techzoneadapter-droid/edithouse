"use client";
import { useEffect, useRef, useState, PointerEvent } from 'react';
import { drawMask, SurfaceMask, MaskStroke, Point } from '@/lib/masks';

type Props = { image: string; result: string; mask?: SurfaceMask; hoverMask?: SurfaceMask; onChange: (mask: SurfaceMask) => void; disabled: boolean };
export default function MaskEditor({ image, result, mask, hoverMask, onChange, disabled }: Props) {
  const overlay = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({width: 1, height: 1});
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [tool, setTool] = useState<'select' | 'brush' | 'erase' | 'pan'>('select');
  const [radius, setRadius] = useState(10);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [show, setShow] = useState(true);
  const [compare, setCompare] = useState(50);
  const stroke = useRef<MaskStroke | null>(null);
  const drag = useRef<{x: number; y: number} | null>(null);
  const paint = (current?: SurfaceMask) => {
    const canvas = overlay.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    drawMask(ctx, current || hoverMask || mask || { polygons: [], strokes: [] }, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = hoverMask ? '#ffca66' : '#5d8cff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = 'source-over';
  };
  useEffect(() => { paint(); }, [mask, hoverMask, size]);
  useEffect(() => { setZoom(1); setPan({x: 0,y: 0}); }, [image]);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => setViewportSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    observer.observe(viewport.current); return () => observer.disconnect();
  }, []);
  const fit = Math.min(viewportSize.width/size.width, viewportSize.height/size.height);
  const point = (e: PointerEvent<HTMLCanvasElement>): Point => { const r = e.currentTarget.getBoundingClientRect(); return [Math.max(0, Math.min(1000, (e.clientX-r.left)/r.width*1000)), Math.max(0, Math.min(1000, (e.clientY-r.top)/r.height*1000))]; };
  function start(e: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'pan') { drag.current = {x: e.clientX-pan.x,y: e.clientY-pan.y}; return; }
    if (!mask || (tool !== 'brush' && tool !== 'erase')) return;
    stroke.current = {points: [point(e)], radius, erase: tool === 'erase'};
    paint({...mask, strokes: [...mask.strokes, stroke.current]});
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (drag.current) { setPan({x:e.clientX-drag.current.x,y:e.clientY-drag.current.y}); return; }
    if (!stroke.current || !mask) return;
    stroke.current.points.push(point(e)); paint({...mask,strokes:[...mask.strokes,stroke.current]});
  }
  function finish() { drag.current = null; if (stroke.current && mask) onChange({...mask, strokes:[...mask.strokes,stroke.current]}); stroke.current = null; }
  return <div className="mask-workspace">
    <div className="mask-tools">
      {(['select','brush','erase','pan'] as const).map(t => <button key={t} disabled={disabled} className={tool===t?'active':''} onClick={()=>{setTool(t);setShow(true);}}>{({select:'Chọn',brush:'Brush +',erase:'Eraser −',pan:'Pan'})[t]}</button>)}
      <label>Cỡ <input aria-label="Cỡ brush" type="range" min="1" max="60" value={radius} onChange={e=>setRadius(+e.target.value)}/></label>
      <button onClick={()=>setShow(!show)}>{show?'Ẩn mask':'Hiện mask'}</button>
      <button onClick={()=>setZoom(Math.max(.25,zoom-.25))}>−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(Math.min(5,zoom+.25))}>+</button>
      <button onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>Vừa ảnh</button>
    </div>
    <div className="mask-viewport" ref={viewport}>
      <div className="mask-image" style={{width:size.width*fit,height:size.height*fit,flexShrink:0,transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>
        <img src={result || image} alt="Công trình" onLoad={e=>{const img=e.currentTarget;setSize({width:img.naturalWidth,height:img.naturalHeight});}} draggable={false}/>
        {result && <img src={image} alt="Trước phối màu" style={{position:'absolute',inset:0,clipPath:`inset(0 ${100-compare}% 0 0)`}}/>}
        <canvas ref={overlay} width={size.width} height={size.height} style={{opacity:show ? (hoverMask ? .25 : .4) : 0,cursor:tool==='pan'?'grab':tool==='select'?'default':'crosshair'}} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={()=>{stroke.current=null;drag.current=null;paint();}}/>
      </div>
    </div>
    {result && <label className="mask-compare">Trước <input aria-label="So sánh trước sau" type="range" min="0" max="100" value={compare} onChange={e=>setCompare(+e.target.value)}/> Sau</label>}
    <small>Mask AI cần được kiểm tra và sửa trước khi phối màu. Brush/Eraser áp dụng cho cấu kiện đang chọn.</small>
  </div>;
}
