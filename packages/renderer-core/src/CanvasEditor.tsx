
import React, { useEffect, useRef, useState } from "react";

type ShapeBase = {
  id: string;
  type: "rect" | "square" | "line" | "circle";
  x: number; y: number;      // main position (top-left for rect/square; min(x1,x2),min(y1,y2) for line bbox; center for circle)
  w: number; h: number;      // size (for line: bbox; for circle: w=h=radius*2)
  rot?: number;              // rotation degrees (rect/square only)
  selected?: boolean;
};

type Props = {
  width?: number;
  height?: number;
  gridSize?: number;
  background?: string;
};

type Tool = "select" | "draw-rect" | "draw-square" | "draw-line" | "draw-circle";

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, grid=10) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let x=0; x<w; x+=grid) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for (let y=0; y<h; y+=grid) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  ctx.restore();
}

function deg2rad(d:number){ return d*Math.PI/180; }

function drawRectLike(ctx: CanvasRenderingContext2D, s: ShapeBase) {
  const {x,y,w,h,rot=0, selected} = s;
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(deg2rad(rot));
  ctx.translate(-w/2, -h/2);
  ctx.strokeStyle = selected ? "#00e5ff" : "#cccccc";
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.strokeRect(0,0,w,h);
  ctx.restore();
}

function drawLine(ctx: CanvasRenderingContext2D, s: ShapeBase) {
  const {x,y,w,h, selected} = s;
  // line endpoints from bbox: store as x1=x, y1=y, x2=x+w, y2=y+h
  ctx.save();
  ctx.strokeStyle = selected ? "#00e5ff" : "#cccccc";
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();
  ctx.restore();
}

function drawCircle(ctx: CanvasRenderingContext2D, s: ShapeBase) {
  const {x,y,w, selected} = s;
  const r = Math.max(w,0)/2;
  ctx.save();
  ctx.strokeStyle = selected ? "#00e5ff" : "#cccccc";
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();
}

function drawHandles(ctx: CanvasRenderingContext2D, s: ShapeBase) {
  ctx.save();
  ctx.fillStyle = "#00e5ff";
  const size = 6;
  if (s.type === "rect" || s.type === "square") {
    const {x,y,w,h,rot=0} = s;
    const cx = x + w/2, cy = y + h/2;
    // Four corners in local space
    const pts = [
      {lx:-w/2, ly:-h/2},
      {lx:w/2,  ly:-h/2},
      {lx:w/2,  ly:h/2},
      {lx:-w/2, ly:h/2}
    ];
    // rotation handle above top-center
    const rotHandleLocal = {lx:0, ly:-h/2 - 20};

    pts.forEach(p => {
      const gx = cx + (p.lx*Math.cos(deg2rad(rot)) - p.ly*Math.sin(deg2rad(rot)));
      const gy = cy + (p.lx*Math.sin(deg2rad(rot)) + p.ly*Math.cos(deg2rad(rot)));
      ctx.fillRect(gx - size/2, gy - size/2, size, size);
    });
    // rotation handle
    const rgx = cx + (rotHandleLocal.lx*Math.cos(deg2rad(rot)) - rotHandleLocal.ly*Math.sin(deg2rad(rot)));
    const rgy = cy + (rotHandleLocal.lx*Math.sin(deg2rad(rot)) + rotHandleLocal.ly*Math.cos(deg2rad(rot)));
    // stem line
    ctx.strokeStyle = "#00e5ff";
    ctx.beginPath(); ctx.moveTo(cx, cy - (h/2)*Math.cos(deg2rad(rot)) + (h/2)*0*Math.sin(deg2rad(rot)),
                               cy - (h/2)*Math.sin(deg2rad(rot)) - (h/2)*0*Math.cos(deg2rad(rot)));
    ctx.moveTo(cx, cy);
    ctx.lineTo(rgx, rgy); ctx.stroke();
    ctx.fillRect(rgx - size/2, rgy - size/2, size, size);
  } else if (s.type === "line") {
    // endpoints
    const x1 = s.x, y1 = s.y;
    const x2 = s.x + s.w, y2 = s.y + s.h;
    ctx.fillRect(x1 - size/2, y1 - size/2, size, size);
    ctx.fillRect(x2 - size/2, y2 - size/2, size, size);
  } else if (s.type === "circle") {
    // radius handle to the right
    const r = Math.max(s.w,0)/2;
    const hx = s.x + r;
    const hy = s.y;
    ctx.fillRect(hx - size/2, hy - size/2, size, size);
  }
  ctx.restore();
}

function drawDimension(ctx: CanvasRenderingContext2D, s: ShapeBase, show:boolean) {
  if (!show) return;
  ctx.save();
  ctx.fillStyle = "#9dcfe0";
  ctx.strokeStyle = "rgba(157,207,224,0.5)";
  ctx.lineWidth = 1;
  ctx.font = "12px sans-serif";
  if (s.type === "rect" || s.type === "square") {
    const text = `${Math.abs(s.w)} × ${Math.abs(s.h)}`;
    const tx = s.x + s.w/2; const ty = s.y - 6;
    ctx.textAlign = "center"; ctx.fillText(text, tx, ty);
  } else if (s.type === "line") {
    const len = Math.hypot(s.w, s.h).toFixed(0);
    const tx = s.x + s.w/2; const ty = s.y + s.h/2 - 6;
    ctx.textAlign = "center"; ctx.fillText(`${len}`, tx, ty);
  } else if (s.type === "circle") {
    const r = Math.max(s.w,0)/2;
    ctx.textAlign = "center"; ctx.fillText(`r=${r.toFixed(0)}`, s.x, s.y - 6);
  }
  ctx.restore();
}

export const CanvasEditor: React.FC<Props> = ({
  width=1000, height=600, gridSize=10, background="#101418"
}) => {
  const ref = useRef<HTMLCanvasElement|null>(null);
  const [shapes, setShapes] = useState<ShapeBase[]>([]);
  const [tool, setTool] = useState<Tool>("draw-rect");
  const [dragId, setDragId] = useState<string|null>(null);
  const dragOffset = useRef<{dx:number, dy:number}>({dx:0, dy:0});
  const drawing = useRef<{startX:number,startY:number}|null>(null);
  const handleDrag = useRef<{kind:"corner"|"rotate"|"endpoint"|"radius"|null, index?:number}>({kind:null});
  const [showDims, setShowDims] = useState<boolean>(true);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = background;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    drawGrid(ctx, canvas.width, canvas.height, gridSize);
    shapes.forEach(s => {
      if (s.type === "rect" || s.type === "square") drawRectLike(ctx, s);
      else if (s.type === "line") drawLine(ctx, s);
      else if (s.type === "circle") drawCircle(ctx, s);
      drawDimension(ctx, s, showDims);
      if (s.selected) drawHandles(ctx, s);
    });
  }, [background, gridSize, shapes, showDims]);

  function pick(x:number, y:number): ShapeBase | null {
    // check handles first for selected shape
    const sel = shapes.find(s => s.selected);
    if (sel) {
      const h = hitHandle(sel, x, y);
      if (h.kind) return {...sel, id:"__HANDLE__"} as any;
    }
    // check shapes by z (last on top)
    for (let i=shapes.length-1; i>=0; i--) {
      const s = shapes[i];
      if (pointInShape(s, x, y)) return s;
    }
    return null;
  }

  function pointInShape(s: ShapeBase, px:number, py:number): boolean {
    if (s.type === "rect" || s.type === "square") {
      // rotate point into rect local space
      const {x,y,w,h,rot=0} = s;
      const cx = x + w/2, cy = y + h/2;
      const lx = (px - cx)*Math.cos(-deg2rad(rot)) - (py - cy)*Math.sin(-deg2rad(rot));
      const ly = (px - cx)*Math.sin(-deg2rad(rot)) + (py - cy)*Math.cos(-deg2rad(rot));
      return (lx >= -w/2 && lx <= w/2 && ly >= -h/2 && ly <= h/2);
    }
    if (s.type === "line") {
      // distance from segment
      const x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h;
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx*dx + dy*dy || 1;
      const t = Math.max(0, Math.min(1, ((px-x1)*dx + (py-y1)*dy)/len2));
      const cx = x1 + t*dx, cy = y1 + t*dy;
      const dist = Math.hypot(px - cx, py - cy);
      return dist <= 6; // tolerance
    }
    if (s.type === "circle") {
      const r = Math.max(s.w,0)/2;
      const dist = Math.hypot(px - s.x, py - s.y);
      return Math.abs(dist - r) <= 6 || dist < r; // allow fill selection
    }
    return false;
  }

  function snap(v:number) { return Math.round(v/gridSize)*gridSize; }

  function handleDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "select") {
      // handles?
      const sel = shapes.find(s => s.selected);
      if (sel) {
        const h = hitHandle(sel, x, y);
        if (h.kind) {
          handleDrag.current = h;
          setDragId(sel.id);
          return;
        }
      }
      const hit = pick(x,y);
      setShapes(prev => prev.map(s => ({...s, selected: s.id === (hit?.id ?? "")})));
      if (hit && hit.id !== "__HANDLE__") {
        setDragId(hit.id);
        // compute offset to center or top-left depending on type
        dragOffset.current = { dx: x - hit.x, dy: y - hit.y };
      }
      return;
    }

    // Drawing tools
    drawing.current = { startX: x, startY: y };
    setShapes(prev => prev.map(s => ({...s, selected:false})));
  }

  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // handle transforms (selected)
    if (dragId && tool === "select") {
      const sel = shapes.find(s => s.id === dragId);
      if (!sel) return;
      const h = handleDrag.current;
      if (h.kind) {
        if (sel.type === "rect" || sel.type === "square") {
          if (h.kind === "rotate") {
            const cx = sel.x + sel.w/2, cy = sel.y + sel.h/2;
            const ang = Math.atan2(y - cy, x - cx) * 180/Math.PI;
            setShapes(prev => prev.map(s => s.id===sel.id ? {...s, rot: ang} : s));
            return;
          } else if (h.kind === "corner") {
            // scale from opposite corner
            const corners = [
              {ix:0, iy:0}, {ix:1, iy:0}, {ix:1, iy:1}, {ix:0, iy:1}
            ];
            const idx = h.index ?? 0;
            const c = corners[idx];
            const ox = sel.x + (1 - c.ix)*sel.w;
            const oy = sel.y + (1 - c.iy)*sel.h;
            const nx = snap(x); const ny = snap(y);
            const nw = (c.ix ? nx - sel.x : ox - nx);
            const nh = (c.iy ? ny - sel.y : oy - ny);
            let nx0 = c.ix ? sel.x : nx;
            let ny0 = c.iy ? sel.y : ny;
            // keep square if needed
            if (sel.type === "square") {
              const size = Math.max(Math.abs(nw), Math.abs(nh)) * Math.sign(nw>=0?1:-1);
              nx0 = c.ix ? sel.x : ox - Math.abs(size);
              ny0 = c.iy ? sel.y : oy - Math.abs(size);
              setShapes(prev => prev.map(s => s.id===sel.id ? {...s, x:nx0, y:ny0, w:Math.abs(size), h:Math.abs(size)} : s));
            } else {
              setShapes(prev => prev.map(s => s.id===sel.id ? {...s, x:Math.min(nx0, ox), y:Math.min(ny0, oy), w:Math.abs(ox - nx0), h:Math.abs(oy - ny0)} : s));
            }
            return;
          }
        } else if (sel.type === "line" && h.kind === "endpoint") {
          if (h.index === 0) {
            const nx = snap(x), ny = snap(y);
            setShapes(prev => prev.map(s => s.id===sel.id ? {...s, w: (s.x+s.w)-nx, h: (s.y+s.h)-ny, x: nx, y: ny} : s));
          } else {
            const nx = snap(x), ny = snap(y);
            setShapes(prev => prev.map(s => s.id===sel.id ? {...s, w: nx - s.x, h: ny - s.y} : s));
          }
          return;
        } else if (sel.type === "circle" && h.kind === "radius") {
          const nx = snap(x), ny = snap(y);
          const r = Math.hypot(nx - sel.x, ny - sel.y);
          setShapes(prev => prev.map(s => s.id===sel.id ? {...s, w: r*2, h: r*2} : s));
          return;
        }
      } else {
        // move shape
        setShapes(prev => prev.map(s => {
          if (s.id !== dragId) return s;
          const nx = snap(x - dragOffset.current.dx);
          const ny = snap(y - dragOffset.current.dy);
          return {...s, x: nx, y: ny};
        }));
      }
      return;
    }

    // drawing previews
    if (drawing.current && tool !== "select") {
      const { startX, startY } = drawing.current;
      if (tool === "draw-rect" || tool === "draw-square") {
        let w = snap(x - startX);
        let h = snap(y - startY);
        if (tool === "draw-square") {
          const size = Math.max(Math.abs(w), Math.abs(h));
          w = (w<0?-size:size);
          h = (h<0?-size:size);
        }
        const tmp: ShapeBase = { id: "__preview__", type: tool==="draw-square"?"square":"rect", x: startX, y: startY, w, h, selected: true, rot: 0 };
        setShapes(prev => [...prev.filter(s => s.id !== "__preview__"), tmp]);
      } else if (tool === "draw-line") {
        const w = snap(x - startX);
        const h = snap(y - startY);
        const tmp: ShapeBase = { id: "__preview__", type: "line", x: startX, y: startY, w, h, selected: true };
        setShapes(prev => [...prev.filter(s => s.id !== "__preview__"), tmp]);
      } else if (tool === "draw-circle") {
        const r = snap(Math.hypot(x - startX, y - startY));
        const tmp: ShapeBase = { id: "__preview__", type: "circle", x: startX, y: startY, w: r*2, h: r*2, selected: true };
        setShapes(prev => [...prev.filter(s => s.id !== "__preview__"), tmp]);
      }
    }
  }

  function handleUp(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = ref.current;
    if (!canvas) return;
    if (dragId) { setDragId(null); handleDrag.current = {kind:null}; return; }
    if (!drawing.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { startX, startY } = drawing.current;
    drawing.current = null;

    let newShape: ShapeBase | null = null;
    if (tool === "draw-rect" || tool === "draw-square") {
      let w = snap(x - startX);
      let h = snap(y - startY);
      if (tool === "draw-square") {
        const size = Math.max(Math.abs(w), Math.abs(h));
        w = (w<0?-size:size);
        h = (h<0?-size:size);
      }
      newShape = { id: "r_"+Date.now(), type: tool==="draw-square"?"square":"rect", x: startX, y: startY, w, h, rot: 0, selected: true };
    } else if (tool === "draw-line") {
      const w2 = snap(x - startX);
      const h2 = snap(y - startY);
      newShape = { id: "l_"+Date.now(), type: "line", x: startX, y: startY, w: w2, h: h2, selected: true };
    } else if (tool === "draw-circle") {
      const r = snap(Math.hypot(x - startX, y - startY));
      newShape = { id: "c_"+Date.now(), type: "circle", x: startX, y: startY, w: r*2, h: r*2, selected: true };
    }

    if (newShape) {
      setShapes(prev => {
        const others = prev.filter(s => s.id !== "__preview__").map(s => ({...s, selected:false}));
        return [...others, newShape!];
      });
    }
  }

  function hitHandle(s: ShapeBase, px:number, py:number): {kind:"corner"|"rotate"|"endpoint"|"radius"|null, index?:number} {
    const size = 8;
    function hitRect(hx:number, hy:number) {
      return (px>=hx-size/2 && px<=hx+size/2 && py>=hy-size/2 && py<=hy+size/2);
    }
    if (s.type === "rect" || s.type === "square") {
      const {x,y,w,h,rot=0} = s;
      const cx = x + w/2, cy = y + h/2;
      const corners = [
        {lx:-w/2, ly:-h/2},
        {lx:w/2,  ly:-h/2},
        {lx:w/2,  ly:h/2},
        {lx:-w/2, ly:h/2}
      ];
      for (let i=0;i<corners.length;i++){
        const p = corners[i];
        const gx = cx + (p.lx*Math.cos(deg2rad(rot)) - p.ly*Math.sin(deg2rad(rot)));
        const gy = cy + (p.lx*Math.sin(deg2rad(rot)) + p.ly*Math.cos(deg2rad(rot)));
        if (hitRect(gx,gy)) return {kind:"corner", index:i};
      }
      const rotHandleLocal = {lx:0, ly:-h/2 - 20};
      const rgx = cx + (rotHandleLocal.lx*Math.cos(deg2rad(rot)) - rotHandleLocal.ly*Math.sin(deg2rad(rot)));
      const rgy = cy + (rotHandleLocal.lx*Math.sin(deg2rad(rot)) + rotHandleLocal.ly*Math.cos(deg2rad(rot)));
      if (hitRect(rgx,rgy)) return {kind:"rotate"};
    } else if (s.type === "line") {
      const x1 = s.x, y1 = s.y;
      const x2 = s.x + s.w, y2 = s.y + s.h;
      if (hitRect(x1,y1)) return {kind:"endpoint", index:0};
      if (hitRect(x2,y2)) return {kind:"endpoint", index:1};
    } else if (s.type === "circle") {
      const r = Math.max(s.w,0)/2;
      const hx = s.x + r;
      const hy = s.y;
      if (hitRect(hx,hy)) return {kind:"radius"};
    }
    return {kind:null};
  }

  return (
    <div style={{background:"#0b0f13", color:"#e3f7ff", height:"100%", width:"100%", padding:"12px"}}>
      <div style={{display:"flex", gap:8, marginBottom:8, flexWrap:"wrap"}}>
        <button onClick={()=>setTool("draw-rect")} style={btnStyle(tool==="draw-rect")}>Rect</button>
        <button onClick={()=>setTool("draw-square")} style={btnStyle(tool==="draw-square")}>Square</button>
        <button onClick={()=>setTool("draw-line")} style={btnStyle(tool==="draw-line")}>Line</button>
        <button onClick={()=>setTool("draw-circle")} style={btnStyle(tool==="draw-circle")}>Circle</button>
        <button onClick={()=>setTool("select")} style={btnStyle(tool==="select")}>Select/Move</button>
        <button onClick={()=>setShowDims(v=>!v)} style={btnStyle(false)}>{showDims? "Hide dims" : "Show dims"}</button>
        <button onClick={()=>setShapes([])} style={btnStyle(false)}>Clear</button>
      </div>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{border:"1px solid #1b2630", borderRadius:8, touchAction:"none", background:"#101418"}}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
      />
      <div style={{marginTop:8, fontSize:12, opacity:0.8}}>
        Tool: <b>{tool}</b> · Snap: {gridSize} · {showDims? "Dimensions: ON" : "Dimensions: OFF"}
      </div>
      <div style={{marginTop:6, fontSize:12, opacity:0.65}}>
        Tips: Dibuja con Rect/Square/Line/Circle. Selecciona para ver <i>handles</i>. Arrastra esquinas para redimensionar, el punto superior para rotar (rect/square), extremos para líneas y handle lateral para radio en círculos.
      </div>
    </div>
  );
};

function btnStyle(active:boolean) {
  return {
    background: active ? "#00bcd4" : "#0f1a22",
    border: "1px solid #1b2a34",
    color: active ? "#0b0f13" : "#e3f7ff",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer"
  } as React.CSSProperties;
}

export default function _DefaultExportWrapper(){ return null as any; } // to satisfy default export in previous file (unused)
export { CanvasEditor };
