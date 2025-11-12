import React, { useEffect, useRef, useState } from "react";

/* ---------- Tipos ---------- */
type ShapeType = "rect" | "square" | "line" | "circle" | "polyline";
type Material = "Ninguno" | "Block" | "Tabique" | "Tablaroca" | "Madera" | "Concreto";

type ShapeBase = {
  id: string;
  type: "rect" | "square" | "line" | "circle";
  x: number; y: number;
  w: number; h: number;
  rot?: number;
  selected?: boolean;
  stroke?: number;
  material?: Material;
};

type Polyline = {
  id: string;
  type: "polyline";
  points: {x:number,y:number}[];
  closed?: boolean;
  selected?: boolean;
  stroke?: number;
  material?: Material;
};

type AnyShape = ShapeBase | Polyline;

type Tool =
  | "select"
  | "draw-rect"
  | "draw-square"
  | "draw-line"
  | "draw-circle"
  | "draw-polyline"
  | "pencil";

type Props = { width?: number; height?: number; gridSize?: number; background?: string; onOpen3D?: (shapes: AnyShape[]) => void };

/* ---------- Escala/unidades ---------- */
const PIXELS_PER_METER = 100;
const MM_PER_M = 1000;
const MM_PER_PX = MM_PER_M / PIXELS_PER_METER; // 10mm/px

const pxToMm = (px:number)=> Math.max(0, Math.round(px*MM_PER_PX));
const mmToPx = (mm:number)=> (mm/MM_PER_M)*PIXELS_PER_METER;

function toUnitString(px:number, flags:{m:boolean, cm:boolean, mm:boolean}) {
  const totalMm = pxToMm(Math.abs(px));
  const m  = Math.floor(totalMm/1000);
  const cm = Math.floor((totalMm%1000)/10);
  const mm = totalMm%10;
  const out:string[] = [];
  if (flags.m)  out.push(`${m} m`);
  if (flags.cm) out.push(`${cm} cm`);
  if (flags.mm) out.push(`${mm} mm`);
  return out.join(" ");
}

/* ---------- Utilidades dibujo ---------- */
function drawGrid(ctx:CanvasRenderingContext2D,w:number,h:number,grid=10){
  ctx.save();
  ctx.strokeStyle="rgba(255,255,255,0.08)"; ctx.lineWidth=1;
  for(let x=0;x<w;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.restore();
}
const deg2rad=(d:number)=>d*Math.PI/180, rad2deg=(r:number)=>r*180/Math.PI;

/* ---------- 3D 2D-like (para sombreado en 2D) ---------- */
function drawRectLike(ctx:CanvasRenderingContext2D,s:ShapeBase,view3d:boolean){
  const {x,y,w,h,rot=0,selected,stroke=1.5}=s;
  if(view3d){
    const d=18,dx=d,dy=-d;
    ctx.save();
    ctx.strokeStyle="rgba(255,255,255,0.25)"; ctx.lineWidth=stroke;
    ctx.strokeRect(x+dx,y+dy,w,h);
    ctx.beginPath();
    ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);
    ctx.moveTo(x+w,y);ctx.lineTo(x+w+dx,y+dy);
    ctx.moveTo(x,y+h);ctx.lineTo(x+dx,y+h+dy);
    ctx.moveTo(x+w,y+h);ctx.lineTo(x+w+dx,y+h+dy);
    ctx.stroke(); ctx.restore();
  }
  ctx.save();
  ctx.translate(x+w/2,y+h/2); ctx.rotate(deg2rad(rot)); ctx.translate(-w/2,-h/2);
  ctx.strokeStyle=selected?"#00e5ff":"#cccccc"; ctx.lineWidth=selected?Math.max(stroke,2):stroke;
  ctx.strokeRect(0,0,w,h); ctx.restore();
}
function drawLine(ctx:CanvasRenderingContext2D,s:ShapeBase,view3d=false){
  const {x,y,w,h,selected,stroke=1.5}=s;
  ctx.save(); ctx.strokeStyle=selected?"#00e5ff":"#cccccc"; ctx.lineWidth=selected?Math.max(stroke,2):stroke;
  if(view3d){const d=18,dx=d,dy=-d; ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.moveTo(x+dx,y+dy); ctx.lineTo(x+w+dx,y+h+dy); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+dx,y+dy);
    ctx.moveTo(x+w,y+h); ctx.lineTo(x+w+dx,y+h+dy); ctx.stroke();}
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+w,y+h); ctx.stroke(); ctx.restore();
}
function drawCircle(ctx:CanvasRenderingContext2D,s:ShapeBase,view3d=false){
  const {x,y,w,selected,stroke=1.5}=s; const r=Math.max(w,0)/2;
  ctx.save(); ctx.strokeStyle=selected?"#00e5ff":"#cccccc"; ctx.lineWidth=selected?Math.max(stroke,2):stroke;
  if(view3d){const d=18,dx=d,dy=-d; ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.arc(x+dx,y+dy,r,0,Math.PI*2); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+r+dx,y+dy);
    ctx.moveTo(x-r,y); ctx.lineTo(x-r+dx,y+dy); ctx.stroke();}
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); ctx.restore();
}
function drawPolyline(ctx:CanvasRenderingContext2D,s:Polyline,view3d=false){
  const pts=s.points; if(pts.length<2)return;
  ctx.save(); ctx.strokeStyle=s.selected?"#00e5ff":"#cccccc"; ctx.lineWidth=s.selected?Math.max(s.stroke??1.5,2):(s.stroke??1.5);
  if(view3d){const d=18,dx=d,dy=-d; ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.moveTo(pts[0].x+dx,pts[0].y+dy); for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x+dx,pts[i].y+dy);
    if(s.closed)ctx.closePath(); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); ctx.lineTo(pts[0].x+dx,pts[0].y+dy);
    ctx.moveTo(pts[pts.length-1].x,pts[pts.length-1].y); ctx.lineTo(pts[pts.length-1].x+dx,pts[pts.length-1].y+dy); ctx.stroke();}
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
  if(s.closed)ctx.closePath(); ctx.stroke(); ctx.restore();
}

/* ---------- Etiquetas & anticolisión ---------- */
type Box={x:number,y:number,w:number,h:number}; const collide=(a:Box,b:Box)=>!(a.x+a.w<b.x||b.x+b.w<a.x||a.y+a.h<b.y||b.y+b.h<a.y);
function placeLabel(boxes:Box[],x:number,y:number,text:string,ctx:CanvasRenderingContext2D){
  const pad=4; let bx=x,by=y,bw=ctx.measureText(text).width+pad*2,bh=16+pad*2, tries=0;
  while(boxes.some(b=>collide({x:bx-bw/2,y:by-bh/2,w:bw,h:bh},b))&&tries<10){by-=18;tries++;}
  boxes.push({x:bx-bw/2,y:by-bh/2,w:bw,h:bh}); return {tx:bx,ty:by};
}

/* ---------- Snap & Ortho ---------- */
const SNAP_JOIN_PX=12;
type Vertex={x:number,y:number};
function rectCorners(s:ShapeBase){const {x,y,w,h,rot=0}=s,cx=x+w/2,cy=y+h/2,pts=[{lx:-w/2,ly:-h/2},{lx:w/2,ly:-h/2},{lx:w/2,ly:h/2},{lx:-w/2,ly:h/2}];
  return pts.map(p=>({x:cx+(p.lx*Math.cos(deg2rad(rot))-p.ly*Math.sin(deg2rad(rot))), y:cy+(p.lx*Math.sin(deg2rad(rot))+p.ly*Math.cos(deg2rad(rot)))}));}
function collectVertices(shapes:AnyShape[]):Vertex[]{const vs:Vertex[]=[]; for(const s of shapes){if(s.type==="line"){const L=s as ShapeBase;vs.push({x:L.x,y:L.y},{x:L.x+L.w,y:L.y+L.h});}
  else if(s.type==="rect"||s.type==="square"){vs.push(...rectCorners(s as ShapeBase));} else if(s.type==="polyline"){vs.push(...(s as Polyline).points);} } return vs;}
function nearestVertex(x:number,y:number,shapes:AnyShape[]){let best:Vertex|null=null,b=Infinity;for(const v of collectVertices(shapes)){const d=Math.hypot(v.x-x,v.y-y); if(d<b&&d<=SNAP_JOIN_PX){b=d;best=v;}}return best;}

export const CanvasEditor:React.FC<Props>=({width=1000,height=600,gridSize=10,background="#101418",onOpen3D})=>{
  const ref=useRef<HTMLCanvasElement|null>(null);
  const wrapperRef=useRef<HTMLDivElement|null>(null);

  const [shapes,setShapes]=useState<AnyShape[]>([]);
  const [tool,setTool]=useState<Tool>("draw-rect");
  const [showDims,setShowDims]=useState(true);
  const [view3d,setView3d]=useState(false);
  const [snapVertices,setSnapVertices]=useState(true);
  const [ortho,setOrtho]=useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // visibilidad de unidades (por defecto solo cm)
  const [units,setUnits]=useState({m:false, cm:true, mm:false, ang:false});

  const sel=shapes.find(s=>(s as any).selected) as AnyShape|undefined;

  /* ----- picker de figuras (desplegable) ----- */
  const [shapePicker, setShapePicker] = useState<"rect"|"square"|"circle">("rect");

  /* ----- estados para polilínea, lápiz y drag ----- */
  const [polyTemp,setPolyTemp]=useState<{points:{x:number,y:number}[],active:boolean}>({points:[],active:false});
  const [pencilPts, setPencilPts] = useState<{x:number,y:number}[] | null>(null);
  const drawing = useRef<{ startX: number; startY: number } | null>(null);
  const [dragId,setDragId]=useState<string|null>(null);
  const dragOffset=useRef({dx:0,dy:0});
  const handleDrag=useRef<{kind:"corner"|"rotate"|"endpoint"|"radius"|null,index?:number}>({kind:null});

  /* ----- menú contextual (long-press/clic derecho) ----- */
  const [ctxMenu,setCtxMenu]=useState<{open:boolean,x:number,y:number}|null>(null);
  const longTimer=useRef<number|undefined>(undefined);
  function openCtx(x:number,y:number){setCtxMenu({open:true,x,y});}
  function closeCtx(){setCtxMenu(null);}

  /* ----- modal redimensionar ----- */
  const [resizeOpen,setResizeOpen]=useState(false);

  /* ----- Hotkeys ----- */
  useEffect(()=>{const w=wrapperRef.current; if(!w) return;
    const onKey=(e:KeyboardEvent)=>{ if(e.key==="Delete"&&sel){setShapes(p=>p.filter(s=>s.id!==sel.id));}
      if(e.key==="Escape"&&polyTemp.active){setPolyTemp({points:[],active:false});}};
    w.addEventListener("keydown",onKey); return()=>w.removeEventListener("keydown",onKey);
  },[sel,polyTemp.active]);

  /* ----- Render principal ----- */
  useEffect(()=>{
    const c=ref.current; if(!c) return; const ctx=c.getContext("2d"); if(!ctx) return;
    ctx.fillStyle=background; ctx.fillRect(0,0,c.width,c.height); drawGrid(ctx,c.width,c.height,gridSize);
    const boxes:Box[]=[];
    shapes.forEach(s=>{
      if(s.type==="rect"||s.type==="square") drawRectLike(ctx,s as ShapeBase,view3d);
      else if(s.type==="line") drawLine(ctx,s as ShapeBase,view3d);
      else if(s.type==="circle") drawCircle(ctx,s as ShapeBase,view3d);
      else drawPolyline(ctx,s as Polyline,view3d);

      // etiquetas
      if(showDims){
        ctx.save(); ctx.fillStyle="#9dcfe0"; ctx.font="12px sans-serif"; ctx.textAlign="center";
        if(s.type==="rect"||s.type==="square"){
          const R=s as ShapeBase; const midx=R.x+R.w/2, midy=R.y-8;
          const label=`${toUnitString(R.w,units)} × ${toUnitString(R.h,units)}${units.ang?` · ${Math.round(R.rot||0)}°`:``}`;
          const pos=placeLabel(boxes,midx,midy,label,ctx); ctx.fillText(label,pos.tx,pos.ty);
        } else if(s.type==="line"){
          const L=s as ShapeBase; const len=Math.hypot(L.w,L.h); const a=Math.round(rad2deg(Math.atan2(L.h,L.w)));
          const mx=L.x+L.w/2,my=L.y+L.h/2; const nx=-L.h/Math.max(1,len),ny=L.w/Math.max(1,len);
          const text=`${toUnitString(len,units)}${units.ang?` · ${a}°`:``}`; const pos=placeLabel(boxes,mx+nx*14,my+ny*14,text,ctx);
          ctx.fillText(text,pos.tx,pos.ty);
        } else if(s.type==="circle"){
          const C=s as ShapeBase; const r=C.w/2; const label=`r = ${toUnitString(r,units)}`;
          const pos=placeLabel(boxes,C.x,C.y-(r+10),label,ctx); ctx.fillText(label,pos.tx,pos.ty);
        } else {
          const P=s as Polyline;
          for(let i=0;i<P.points.length-1;i++){
            const a=P.points[i], b=P.points[i+1]; const dx=b.x-a.x, dy=b.y-a.y;
            const len=Math.hypot(dx,dy); const ang=Math.round(rad2deg(Math.atan2(dy,dx)));
            const mx=(a.x+b.x)/2, my=(a.y+b.y)/2; const nx=-dy/Math.max(1,len), ny=dx/Math.max(1,len);
            const text=`${toUnitString(len,units)}${units.ang?` · ${ang}°`:``}`;
            const pos=placeLabel(boxes,mx+nx*14,my+ny*14,text,ctx); ctx.fillText(text,pos.tx,pos.ty);
          }
        }
        ctx.restore();
      }
      if((s as any).material && (s as any).material!=="Ninguno"){
        ctx.save(); ctx.fillStyle="rgba(200,240,255,0.75)"; ctx.font="12px sans-serif"; ctx.textAlign="center";
        let tx=0,ty=0; if(s.type==="line"){const L=s as ShapeBase; tx=L.x+L.w/2; ty=L.y+L.h/2+16;}
        else if(s.type==="circle"){const C=s as ShapeBase; tx=C.x; ty=C.y+(C.w/2)+14;}
        else if(s.type==="polyline"){const P=s as Polyline; const last=P.points[P.points.length-1]; tx=last.x; ty=last.y+14;}
        else {const R=s as ShapeBase; tx=R.x+R.w/2; ty=R.y+R.h+14;}
        ctx.fillText(`${(s as any).material}`,tx,ty); ctx.restore();
      }
      if((s as any).selected && s.type!=="polyline") drawHandles(ctx,s as ShapeBase);
    });
  },[background,gridSize,shapes,showDims,view3d,units]);

  /* ----- Selección/Herramientas ----- */
  const snap=(v:number)=>Math.round(v/(gridSize||1))*(gridSize||1);

  function pointInShape(s:AnyShape,px:number,py:number){
    if(s.type==="rect"||s.type==="square"){const R=s as ShapeBase; const {x,y,w,h,rot=0}=R;
      const cx=x+w/2,cy=y+h/2; const lx=(px-cx)*Math.cos(-deg2rad(rot))-(py-cy)*Math.sin(-deg2rad(rot));
      const ly=(px-cx)*Math.sin(-deg2rad(rot))+(py-cy)*Math.cos(-deg2rad(rot)); return (lx>=-w/2&&lx<=w/2&&ly>=-h/2&&ly<=h/2);}
    if(s.type==="line"){const L=s as ShapeBase; const x1=L.x,y1=L.y,x2=L.x+L.w,y2=L.y+L.h;
      const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy||1; const t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/len2));
      const cx=x1+t*dx,cy=y1+t*dy; return Math.hypot(px-cx,py-cy)<=6;}
    if(s.type==="circle"){const C=s as ShapeBase; const r=C.w/2; const d=Math.hypot(px-C.x,py-C.y); return Math.abs(d-r)<=6||d<r;}
    if(s.type==="polyline"){const P=s as Polyline; for(let i=0;i<P.points.length-1;i++){const a=P.points[i],b=P.points[i+1];
      const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy||1; const t=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/len2));
      const cx=a.x+t*dx,cy=a.y+t*dy; if(Math.hypot(px-cx,py-cy)<=6)return true;} return false;}
    return false;
  }
  function pick(x:number,y:number){for(let i=shapes.length-1;i>=0;i--) if(pointInShape(shapes[i],x,y)) return shapes[i]; return null;}

  function hitHandle(s:ShapeBase,px:number,py:number){const size=8;const hit=(hx:number,hy:number)=>px>=hx-size/2&&px<=hx+size/2&&py>=hy-size/2&&py<=hy+size/2;
    if(s.type==="rect"||s.type==="square"){const {x,y,w,h,rot=0}=s,cx=x+w/2,cy=y+h/2;
      const corners=[{lx:-w/2,ly:-h/2},{lx:w/2,ly:-h/2},{lx:w/2,ly:h/2},{lx:-w/2,ly:h/2}];
      for(let i=0;i<corners.length;i++){const p=corners[i];const gx=cx+(p.lx*Math.cos(deg2rad(rot))-p.ly*Math.sin(deg2rad(rot)));
        const gy=cy+(p.lx*Math.sin(deg2rad(rot))+p.ly*Math.cos(deg2rad(rot))); if(hit(gx,gy)) return {kind:"corner",index:i};}
      const rgx=cx-( -h/2-20)*Math.sin(deg2rad(rot)), rgy=cy+( -h/2-20)*Math.cos(deg2rad(rot)); if(hit(rgx,rgy)) return {kind:"rotate"}; }
    if(s.type==="line"){const x1=s.x,y1=s.y,x2=s.x+s.w,y2=s.y+s.h; if(hit(x1,y1))return {kind:"endpoint",index:0}; if(hit(x2,y2))return {kind:"endpoint",index:1};}
    if(s.type==="circle"){const r=s.w/2; const hx=s.x+r,hy=s.y; if(hit(hx,hy)) return {kind:"radius"};}
    return {kind:null}; }

  /* ----- Eventos ratón (incluye long press) ----- */
  function handleDown(e:React.MouseEvent<HTMLCanvasElement>){
    const rect=(e.target as HTMLCanvasElement).getBoundingClientRect(); const x=e.clientX-rect.left, y=e.clientY-rect.top;

    // long-press timer
    window.clearTimeout(longTimer.current); longTimer.current=window.setTimeout(()=>{ if(sel) openCtx(x+6,y+6); }, 500);

    if(tool==="pencil"){
      setPencilPts([{x:snap(x),y:snap(y)}]);
      return;
    }

    if(tool==="draw-polyline"){
      if(!polyTemp.active){ setPolyTemp({active:true,points:[{x:snap(x),y:snap(y)}]}); }
      else{
        let nx=snap(x), ny=snap(y);
        if(snapVertices){const v=nearestVertex(nx,ny,shapes); if(v){nx=snap(v.x); ny=snap(v.y);}}
        if(ortho){const last=polyTemp.points[polyTemp.points.length-1]; const w2=nx-last.x, h2=ny-last.y;
          const deg=Math.round(rad2deg(Math.atan2(h2,w2))/45)*45, len=Math.hypot(w2,h2); nx=last.x+Math.cos(deg2rad(deg))*len; ny=last.y+Math.sin(deg2rad(deg))*len;}
        setPolyTemp(p=>({...p,points:[...p.points,{x:nx,y:ny}]}));
      }
      return;
    }

    if(tool==="select"){
      const current=shapes.find(s=>(s as any).selected);
      if(current && current.type!=="polyline"){ const h=hitHandle(current as ShapeBase,x,y);
        if(h.kind && ["corner", "rotate", "endpoint", "radius"].includes(h.kind)) {
          handleDrag.current = h as { kind: "corner" | "rotate" | "endpoint" | "radius"; index?: number };
          setDragId(current.id);
          return;
        }
      }
      const hit=pick(x,y);
      setShapes(prev=>prev.map(s=>({...s as any, selected:s.id===(hit?.id??"")})));
      if(hit && hit.type!=="polyline"){ const H=hit as ShapeBase; setDragId(H.id); dragOffset.current={dx:x-H.x,dy:y-H.y}; }
      return;
    }

    drawing.current={startX:x,startY:y};
    setShapes(prev=>prev.map(s=>({...s as any, selected:false})));
  }

  function handleMove(e:React.MouseEvent<HTMLCanvasElement>){
    const c=ref.current; if(!c) return; const rect=c.getBoundingClientRect(); const x=e.clientX-rect.left, y=e.clientY-rect.top;

    if(tool==="pencil" && pencilPts){ const nx=snap(x), ny=snap(y); setPencilPts(prev=> (prev? [...prev, {x:nx,y:ny}] : [{x:nx,y:ny}])); return; }

    if(polyTemp.active && tool==="draw-polyline"){
      const ctx=c.getContext("2d")!; const last=polyTemp.points[polyTemp.points.length-1];
      let nx=snap(x), ny=snap(y);
      if(snapVertices){const v=nearestVertex(nx,ny,shapes); if(v){nx=snap(v.x); ny=snap(v.y);}}
      if(ortho){const w2=nx-last.x,h2=ny-last.y,deg=Math.round(rad2deg(Math.atan2(h2,w2))/45)*45,len=Math.hypot(w2,h2);
        nx=last.x+Math.cos(deg2rad(deg))*len; ny=last.y+Math.sin(deg2rad(deg))*len;}
      ctx.save(); ctx.strokeStyle="#00e5ff"; ctx.lineWidth=1; ctx.setLineDash([6,6]);
      ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(nx,ny); ctx.stroke(); ctx.restore(); return;
    }

    if(dragId && tool==="select"){
      const s=shapes.find(q=>q.id===dragId) as ShapeBase|undefined; if(!s) return;
      const h=handleDrag.current;
      if(h.kind){
        if(s.type==="rect"||s.type==="square"){
          if(h.kind==="rotate"){const cx=s.x+s.w/2, cy=s.y+s.h/2; const a=Math.atan2(y-cy,x-cx)*180/Math.PI;
            setShapes(p=>p.map(q=>q.id===s.id?({...q as ShapeBase, rot:a}):q)); return;}
          if(h.kind==="corner"){const corners=[{ix:0,iy:0},{ix:1,iy:0},{ix:1,iy:1},{ix:0,iy:1}], idx=h.index??0, c0=corners[idx];
            const ox=s.x+(1-c0.ix)*s.w, oy=s.y+(1-c0.iy)*s.h; const nx=snap(x), ny=snap(y);
            const nw=c0.ix?nx-s.x:ox-nx, nh=c0.iy?ny-s.y:oy-ny; let nx0=c0.ix?s.x:nx, ny0=c0.iy?s.y:ny;
            if(s.type==="square"){const size=Math.max(Math.abs(nw),Math.abs(nh)); nx0=c0.ix?s.x:ox-size; ny0=c0.iy?s.y:oy-size;
              setShapes(p=>p.map(q=>q.id===s.id?({...q as ShapeBase,x:nx0,y:ny0,w:size,h:size}):q));}
            else{setShapes(p=>p.map(q=>q.id===s.id?({...q as ShapeBase,x:Math.min(nx0,ox),y:Math.min(ny0,oy),w:Math.abs(ox-nx0),h:Math.abs(oy-ny0)}):q));}
            return;}
        } else if(s.type==="line" && h.kind==="endpoint"){const nx=snap(x), ny=snap(y);
          if(h.index===0){setShapes(p=>p.map(q=>q.id===s.id?({...q as ShapeBase, w:(q as ShapeBase).x+(q as ShapeBase).w-nx, h:(q as ShapeBase).y+(q as ShapeBase).h-ny, x:nx, y:ny}):q));}
          else{setShapes(p=>p.map(q=>q.id===s.id?({...q as ShapeBase, w:nx-(q as ShapeBase).x, h:ny-(q as ShapeBase).y}):q));}
          return;}
        else if(s.type==="circle" && h.kind==="radius"){const nx=snap(x), ny=snap(y); const r=Math.hypot(nx-s.x,ny-s.y);
          setShapes(p=>p.map(q=>q.id===s.id?({...q as ShapeBase, w:r*2,h:r*2}):q)); return;}
      } else { setShapes(p=>p.map(q=>q.id===dragId?({...q as ShapeBase, x:snap(x-dragOffset.current.dx), y:snap(y-dragOffset.current.dy)}):q)); }
      return;
    }

    if(drawing.current && tool!=="select"){
      const {startX,startY}=drawing.current;
      if(tool==="draw-rect"||tool==="draw-square"){let w=snap(x-startX), h=snap(y-startY);
        if(tool==="draw-square"){const size=Math.max(Math.abs(w),Math.abs(h)); w=(w<0?-size:size); h=(h<0?-size:size);}
        const tmp:ShapeBase={id:"__preview__",type:tool==="draw-square"?"square":"rect",x:startX,y:startY,w,h,selected:true,rot:0,stroke:1.5,material:"Ninguno"};
        setShapes(prev=>[...prev.filter(s=>s.id!=="__preview__"),tmp]);
      } else if(tool==="draw-line"){let w2=snap(x-startX), h2=snap(y-startY);
        if(ortho){const ang=Math.atan2(h2,w2); const deg=Math.round(rad2deg(ang)/45)*45; const len=Math.hypot(w2,h2); const a=deg2rad(deg); w2=Math.cos(a)*len; h2=Math.sin(a)*len;}
        if(snapVertices){const end=nearestVertex(startX+w2,startY+h2,shapes); if(end){w2=snap(end.x-startX); h2=snap(end.y-startY);}}
        const tmp:ShapeBase={id:"__preview__",type:"line",x:startX,y:startY,w:w2,h:h2,selected:true,stroke:1.5,material:"Ninguno"};
        setShapes(prev=>[...prev.filter(s=>s.id!=="__preview__"),tmp]);
      } else if(tool==="draw-circle"){const r=snap(Math.hypot(x-startX,y-startY));
        const tmp:ShapeBase={id:"__preview__",type:"circle",x:startX,y:startY,w:r*2,h:r*2,selected:true,stroke:1.5,material:"Ninguno"};
        setShapes(prev=>[...prev.filter(s=>s.id!=="__preview__"),tmp]);}
    }
  }

  const lastClickRef=useRef<number>(0);
  function handleUp(e:React.MouseEvent<HTMLCanvasElement>){
    window.clearTimeout(longTimer.current);
    const c=ref.current; if(!c) return;
    const now=Date.now(); const dbl=now-(lastClickRef.current||0)<300; lastClickRef.current=now;

    if(dragId){setDragId(null); handleDrag.current={kind:null}; return;}

    if(tool==="pencil" && pencilPts){
      const poly: Polyline = { id: "sketch_"+Date.now(), type: "polyline", points: pencilPts, closed: false, selected: true, stroke: 1.5, material: "Ninguno" } as any;
      setShapes(prev => prev.map(s=>({...s as any, selected:false})).concat(poly));
      setPencilPts(null); return;
    }

    if(tool==="draw-polyline" && polyTemp.active){
      const pts=polyTemp.points; if(dbl && pts.length>=3){
        const end=pts[pts.length-1], start=pts[0];
        const close=Math.hypot(end.x-start.x,end.y-start.y)<=SNAP_JOIN_PX;
        const finalPts=close?pts.slice(0,-1).concat(start):pts;
        const poly:Polyline={id:"p_"+Date.now(),type:"polyline",points:finalPts,closed:true,selected:true,stroke:1.5,material:"Ninguno"};
        setShapes(prev=>prev.map(s=>({...s as any,selected:false})).concat(poly)); setPolyTemp({points:[],active:false});
      }
      return;
    }

    if(!drawing.current) return;
    const rect=c.getBoundingClientRect(); let x=e.clientX-rect.left, y=e.clientY-rect.top;
    const {startX,startY}=drawing.current; drawing.current=null;

    let newShape:ShapeBase|null=null;
    if(tool==="draw-rect"||tool==="draw-square"){let w=snap(x-startX), h=snap(y-startY);
      if(tool==="draw-square"){const size=Math.max(Math.abs(w),Math.abs(h)); w=(w<0?-size:size); h=(h<0?-size:size);}
      newShape={id:"r_"+Date.now(),type:tool==="draw-square"?"square":"rect",x:startX,y:startY,w,h,rot:0,selected:true,stroke:1.5,material:"Ninguno"};
    } else if(tool==="draw-line"){let ex=snap(x), ey=snap(y);
      if(snapVertices){const end=nearestVertex(ex,ey,shapes); if(end){ex=snap(end.x); ey=snap(end.y);}}
      if(Math.hypot(ex-startX,ey-startY)<=SNAP_JOIN_PX){ex=startX; ey=startY;}
      newShape={
        id: "l_" + Date.now(),
        type: "line",
        x: startX,
        y: startY,
        w: ex - startX,
        h: ey - startY,
        selected: true,
        stroke: 1.5,
        material: "Ninguno",
      };
    } else if(tool==="draw-circle"){const r=snap(Math.hypot(x-startX,y-startY));
      newShape={id:"c_"+Date.now(),type:"circle",x:startX,y:startY,w:r*2,h:r*2,selected:true,stroke:1.5,material:"Ninguno"};}
    if(newShape){setShapes(prev=>[...prev.filter(s=>s.id!=="__preview__").map(s=>({...s as any,selected:false})), newShape]);}
  }

  /* ----- acciones del menú contextual ----- */
  function doDuplicate(){ if(!sel) return; const copy:AnyShape = sel.type==="polyline"
      ? {...(sel as Polyline), id:sel.id+"_copy_"+Date.now(), selected:true, points:(sel as Polyline).points.map(p=>({x:p.x+20,y:p.y+20}))}
      : {...(sel as ShapeBase), id:sel.id+"_copy_"+Date.now(), selected:true, x:(sel as ShapeBase).x+20, y:(sel as ShapeBase).y+20};
    setShapes(prev=>prev.map(s=>({...s as any,selected:false})).concat(copy)); closeCtx(); }
  function doDelete(){ if(!sel) return; setShapes(prev=>prev.filter(s=>s.id!==sel.id)); closeCtx(); }
  function doResize(){ if(!sel) return; setResizeOpen(true); closeCtx(); }

  /* ----- helpers UI ----- */
  const icon = {
    eye:     showDims? "👁️" : "🚫",
    three:   "🧊",
    settings:"⚙️",
  };

  /* ---------- Lógica para convertir boceto a líneas ---------- */
  function simplifyRDP(pts: { x: number; y: number }[], eps = 3): { x: number; y: number }[] {
    if (pts.length <= 2) return pts;
    const a = pts[0], b = pts[pts.length - 1];
    const A = { x: b.x - a.x, y: b.y - a.y }, L = A.x * A.x + A.y * A.y || 1;
    let imax = 0, dmax = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const t = ((p.x - a.x) * A.x + (p.y - a.y) * A.y) / L;
      const cx = a.x + A.x * t, cy = a.y + A.y * t;
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d > dmax) {
        dmax = d;
        imax = i;
      }
    }
    if (dmax < eps) return [a, b];
    const left = simplifyRDP(pts.slice(0, imax + 1), eps);
    const right = simplifyRDP(pts.slice(imax), eps);
    return left.slice(0, -1).concat(right);
  }
  function quantizeAngle(dx:number, dy:number){ const ang=Math.atan2(dy,dx); const step=Math.PI/12; const q=Math.round(ang/step)*step; const len=Math.hypot(dx,dy); return {dx:Math.cos(q)*len, dy:Math.sin(q)*len}; }
  function convertSketchToStraight(){ setShapes(prev=>{ const out:AnyShape[]=[]; for(const s of prev){ if(s.type==="polyline" && !(s as any).closed){ const pts=simplifyRDP((s as Polyline).points,4); for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1]; const q=quantizeAngle(b.x-a.x,b.y-a.y); out.push({ id:"l_"+Date.now()+"_"+i, type:"line", x:a.x, y:a.y, w:q.dx, h:q.dy, selected:false, stroke:(s as any).stroke||1.5, material:"Ninguno" } as any);} } else out.push({...s,selected:false} as any);} return out; }); }

  /* ---------- Modal Redimensionar ---------- */
  const [form,setForm]=useState<{w?:number;h?:number;len?:number;angle?:number;radius?:number;stroke?:number}>({});
  useEffect(()=>{ if(!sel){setForm({}); return;}
    if(sel.type==="rect"||sel.type==="square"){ setForm({w:pxToMm((sel as ShapeBase).w), h:pxToMm((sel as ShapeBase).h), angle:Math.round((sel as ShapeBase).rot||0), stroke:(sel as any).stroke||1.5}); }
    else if(sel.type==="line"){ const L=sel as ShapeBase; setForm({len:pxToMm(Math.hypot(L.w,L.h)), angle:Math.round(rad2deg(Math.atan2(L.h,L.w))), stroke:(sel as any).stroke||1.5}); }
    else if(sel.type==="circle"){ setForm({radius:pxToMm((sel as ShapeBase).w/2), stroke:(sel as any).stroke||1.5}); }
    else { setForm({stroke:(sel as any).stroke||1.5}); }
  },[sel]);

  function applyResize(){
    if(!sel){setResizeOpen(false);return;}
    if(sel.type==="rect"||sel.type==="square"){
      const pxW=Math.max(0,Math.round(mmToPx(form.w||0)));
      const pxH=Math.max(0,Math.round(mmToPx(form.h||0)));
      setShapes(p=>p.map(s=>s.id===sel.id?({...s as ShapeBase, w:pxW, h:pxH, rot:form.angle||0, stroke:form.stroke||1.5}):s));
    } else if(sel.type==="line"){
      const L=sel as ShapeBase; const lenPx=Math.max(0,Math.round(mmToPx(form.len||0))); const a=deg2rad(form.angle||0);
      setShapes(p=>p.map(s=>s.id===sel.id?({...s as ShapeBase, w:Math.cos(a)*lenPx, h:Math.sin(a)*lenPx, stroke:form.stroke||1.5}):s));
    } else if(sel.type==="circle"){
      const rPx=Math.max(0,Math.round(mmToPx(form.radius||0))); setShapes(p=>p.map(s=>s.id===sel.id?({...s as ShapeBase, w:rPx*2, h:rPx*2, stroke:form.stroke||1.5}):s));
    } else {
      setShapes(p=>p.map(s=>s.id===sel.id?({...s as any, stroke:form.stroke||1.5}):s));
    }
    setResizeOpen(false);
  }

  /* ---------- Menú Archivo ---------- */
  function newProject(){ if (confirm("¿Deseas limpiar el lienzo?")) setShapes([]); }
  function saveProject(){ const data = JSON.stringify({ shapes }, null, 2); localStorage.setItem("archiflow:project", data); const blob = new Blob([data], {type:"application/json"}); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "archiflow_proyecto.json"; a.click(); URL.revokeObjectURL(a.href); alert("Proyecto guardado."); }
  function openProject(){ const input = document.getElementById("openfile") as HTMLInputElement; input.onchange = async () => { const file = input.files?.[0]; if (!file) return; const txt = await file.text(); try{ const json = JSON.parse(txt); if (json?.shapes) setShapes(json.shapes); }catch{ alert("Archivo inválido"); } input.value = ""; }; input.click(); }

  /* ---------- UI ---------- */
  return (
    <div ref={wrapperRef} tabIndex={0} style={{background:"#0b0f13",color:"#e3f7ff",padding:12}}>
      {/* Barra superior */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {/* Picker de figuras */}
        <select
          value={shapePicker}
          onChange={(e) => setShapePicker(e.target.value as any)}
          style={{ background: "#0f1a22", color: "#e3f7ff", border: "1px solid #1b2a34", borderRadius: 10, padding: "8px 12px" }}
          title="Elegir figura"
        >
          <option value="rect">▭ Rectángulo</option>
          <option value="square">▢ Cuadrado</option>
          <option value="circle">◯ Círculo</option>
        </select>
        <button
          style={btn(tool==="draw-rect"||tool==="draw-square"||tool==="draw-circle")}
          onClick={()=>{ const t = shapePicker==="circle" ? "draw-circle" : shapePicker==="square" ? "draw-square" : "draw-rect"; setTool(t as any); }}
        >
          Usar figura
        </button>

        <button style={btn(tool==="draw-line")} onClick={()=>setTool("draw-line")} title="Línea">Línea</button>
        <button style={btn(tool==="pencil")} onClick={()=>setTool("pencil")} title="Lápiz">✏️</button>
        <button style={btn(tool==="select")} onClick={()=>setTool("select")} title="Seleccionar/Mover">🖱️</button>

        <div style={{flex:1}} />
        <button style={btn(false)} onClick={()=>setShowDims(v=>!v)} title="Mostrar/Ocultar cotas">{icon.eye}</button>
        <button style={btn(false)} onClick={()=>onOpen3D?.(shapes)} title="Vista 3D">{icon.three}</button>
        <button style={btn(false)} onClick={()=>setSettingsOpen(true)} title="Ajustes">{icon.settings}</button>
      </div>

      {/* Canvas */}
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ cursor: "default", border: "1px solid #1b2630", borderRadius: 8, background: "#101418" }}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onContextMenu={(e)=>{e.preventDefault(); if(sel) openCtx(e.clientX,e.clientY);}}
      />

      {/* Botonera inferior: boceto->líneas y Archivo */}
      <div style={{marginTop:8, display:"flex", gap:8, flexWrap:"wrap"}}>
        <button style={btn(false)} onClick={convertSketchToStraight}>Convertir a líneas</button>
        <button style={btn(false)} onClick={newProject}>Nuevo</button>
        <button style={btn(false)} onClick={saveProject}>Guardar</button>
        <button style={btn(false)} onClick={openProject}>Abrir</button>
        <button style={btn(false)} onClick={()=>window.print()}>Imprimir</button>
        <input type="file" accept="application/json" id="openfile" style={{display:"none"}} />
      </div>

      {/* Menú contextual */}
      {ctxMenu?.open && sel && (
        <div style={{position:"fixed",left:ctxMenu.x,top:ctxMenu.y,background:"#0f1a22",border:"1px solid #1b2a34",borderRadius:10,padding:8,zIndex:50}}>
          <MenuItem onClick={doResize}>✏️ Redimensionar…</MenuItem>
          <MenuItem onClick={doDuplicate}>📄 Duplicar</MenuItem>
          <MenuItem onClick={doDelete}>🗑️ Borrar</MenuItem>
          <div style={{height:6}}/>
          <MenuItem onClick={()=>{setCtxMenu(null); setSettingsOpen(true);}}>⚙️ Ajustes…</MenuItem>
        </div>
      )}

      {/* Modal Redimensionar */}
      {resizeOpen && sel && (
        <div style={modalBackdrop()}>
          <div style={modalCard()}>
            <div style={{fontWeight:700,marginBottom:8}}>Redimensionar</div>
            {sel.type==="rect"||sel.type==="square" ? <>
              <Field label="Ancho (mm)"  value={form.w} onChange={v=>setForm(f=>({...f,w:v}))}/>
              <Field label="Alto (mm)"   value={form.h} onChange={v=>setForm(f=>({...f,h:v}))}/>
              <Field label="Ángulo (°)"  value={form.angle} onChange={v=>setForm(f=>({...f,angle:v}))}/>
            </> : sel.type==="line" ? <>
              <Field label="Longitud (mm)" value={form.len} onChange={v=>setForm(f=>({...f,len:v}))}/>
              <Field label="Ángulo (°)"    value={form.angle} onChange={v=>setForm(f=>({...f,angle:v}))}/>
            </> : sel.type==="circle" ? <>
              <Field label="Radio (mm)"    value={form.radius} onChange={v=>setForm(f=>({...f,radius:v}))}/>
            </> : <div style={{opacity:.8,fontSize:12}}>Para polilínea, sólo grosor.</div>}
            <Field label="Grosor (px)" value={form.stroke} onChange={v=>setForm(f=>({...f,stroke:v}))}/>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button style={btn(true)} onClick={applyResize}>Aplicar</button>
              <button style={btn(false)} onClick={()=>setResizeOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Ajustes */}
      {settingsOpen && (
        <div style={modalBackdrop()}>
          <div style={modalCard()}>
            <div style={{fontWeight:700,marginBottom:8}}>Ajustes</div>
            <Check label="Imán a vértices" checked={snapVertices} onChange={setSnapVertices}/>
            <Check label="Ortho 0/45/90°" checked={ortho} onChange={setOrtho}/>
            <Check label="Mostrar cotas" checked={showDims} onChange={setShowDims}/>
            <div style={{height:8}}/>
            <div style={{fontWeight:700,marginBottom:4}}>Mostrar medida</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(90px,1fr))",gap:6}}>
              <Check label="m"  checked={units.m}  onChange={v=>setUnits(u=>({...u,m:v}))}/>
              <Check label="cm" checked={units.cm} onChange={v=>setUnits(u=>({...u,cm:v}))}/>
              <Check label="mm" checked={units.mm} onChange={v=>setUnits(u=>({...u,mm:v}))}/>
              <Check label="°"  checked={units.ang}onChange={v=>setUnits(u=>({...u,ang:v}))}/>
            </div>
            <div style={{height:10}}/>
            <button style={btn(false)} onClick={()=>setShapes([])}>Limpiar todo</button>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
              <button style={btn(true)} onClick={()=>setSettingsOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- UI helpers ---------- */
function btn(active:boolean){return{background:active?"#00bcd4":"#0f1a22",border:"1px solid #1b2a34",color:active?"#0b0f13":"#e3f7ff",padding:"8px 12px",borderRadius:10,cursor:"pointer"} as React.CSSProperties;}
const MenuItem: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <div
    onClick={onClick}
    style={{
      padding: "6px 10px",
      borderRadius: 8,
      cursor: "pointer",
      whiteSpace: "nowrap",
    }}
    onMouseEnter={(e) => ((e.target as HTMLDivElement).style.background = "#11212b")}
    onMouseLeave={(e) => ((e.target as HTMLDivElement).style.background = "transparent")}
  >
    {children}
  </div>
);
const modalBackdrop = (): React.CSSProperties => ({
  position: "fixed" as "fixed",
  inset: 0,
  background: "rgba(0,0,0,.5)",
  display: "grid",
  placeItems: "center",
  zIndex: 60,
});
const modalCard=()=>({background:"#0f1a22",border:"1px solid #1b2a34",borderRadius:12,padding:14,minWidth:320,maxWidth:420});
const Field:React.FC<{label:string,value:number|undefined,onChange:(n:number)=>void}>=({label,value,onChange})=>(
  <label style={{display:"grid",gap:4,marginTop:6}}>
    <span style={{fontSize:12,opacity:.9}}>{label}</span>
    <input type="number" value={value ?? 0} onChange={(e)=>onChange(parseFloat(e.target.value)||0)}
           style={{background:"#0b0f13",color:"#e3f7ff",border:"1px solid #1b2a34",borderRadius:8,padding:"6px 8px"}}/>
  </label>
);
const Check:React.FC<{label:string,checked:boolean,onChange:(b:boolean)=>void}>=({label,checked,onChange})=>(
  <label style={{display:"flex",alignItems:"center",gap:8}}>
    <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)}/>
    <span>{label}</span>
  </label>
);

/* ---------- Handles visuales ---------- */
function drawHandles(ctx:CanvasRenderingContext2D,s:ShapeBase){
  ctx.save(); ctx.fillStyle="#00e5ff"; const size=6;
  if(s.type==="rect"||s.type==="square"){const {x,y,w,h,rot=0}=s,cx=x+w/2,cy=y+h/2;
    const pts=[{lx:-w/2,ly:-h/2},{lx:w/2,ly:-h/2},{lx:w/2,ly:h/2},{lx:-w/2,ly:h/2}];
    pts.forEach(p=>{const gx=cx+(p.lx*Math.cos(deg2rad(rot))-p.ly*Math.sin(deg2rad(rot))); const gy=cy+(p.lx*Math.sin(deg2rad(rot))+p.ly*Math.cos(deg2rad(rot))); ctx.fillRect(gx-size/2,gy-size/2,size,size);});
    const rgx=cx-( -h/2-20)*Math.sin(deg2rad(rot)), rgy=cy+( -h/2-20)*Math.cos(deg2rad(rot));
    ctx.strokeStyle="#00e5ff"; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(rgx,rgy); ctx.stroke(); ctx.fillRect(rgx-size/2,rgy-size/2,size,size);
  } else if(s.type==="line"){const x1=s.x,y1=s.y,x2=s.x+s.w,y2=s.y+s.h; ctx.fillRect(x1-size/2,y1-size/2,size,size); ctx.fillRect(x2-size/2,y2-size/2,size,size);
  } else if(s.type==="circle"){const r=s.w/2, hx=s.x+r, hy=s.y; ctx.fillRect(hx-size/2,hy-size/2,size,size);} ctx.restore();
}