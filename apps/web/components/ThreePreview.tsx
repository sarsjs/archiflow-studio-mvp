import React, { useEffect, useRef } from "react";
import * as THREE from "three";

type ShapeBase = { id:string; type:"rect"|"square"|"line"|"circle"; x:number;y:number; w:number;h:number; rot?:number; stroke?:number; };
type Polyline = { id:string; type:"polyline"; points:{x:number,y:number}[]; closed?:boolean; stroke?:number; };
type AnyShape = ShapeBase | Polyline;

export const ThreePreview:React.FC<{shapes:AnyShape[], onClose:()=>void}> = ({shapes,onClose})=>{
  const mountRef = useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    const W = Math.min(window.innerWidth-60, 1100);
    const H = Math.min(window.innerHeight-60, 720);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xCFE8FF);

    const camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 5000);
    camera.position.set(300, 250, 300);

    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(W, H);
    mountRef.current!.appendChild(renderer.domElement);

    const amb = new THREE.AmbientLight(0xffffff, 0.7); scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.7); dir.position.set(200,300,200); scene.add(dir);

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2000,2000), new THREE.MeshPhongMaterial({color:0xf0f5ff}));
    plane.rotation.x = -Math.PI/2; plane.position.y = 0; scene.add(plane);

    const HEIGHT = 300;
    const wallMat  = new THREE.MeshPhongMaterial({color:0xe6a86b});
    const lineMat  = new THREE.MeshPhongMaterial({color:0x666666});
    const cylMat   = new THREE.MeshPhongMaterial({color:0xdadada});

    shapes.forEach(s=>{
      if(s.type==="rect"||s.type==="square"){
        const R=s as ShapeBase;
        const geom = new THREE.BoxGeometry(Math.abs(R.w), HEIGHT, Math.abs(R.h));
        const mesh = new THREE.Mesh(geom, wallMat);
        mesh.position.set(R.x + R.w/2, HEIGHT/2, R.y + R.h/2);
        mesh.rotation.y = (R.rot||0) * Math.PI/180; scene.add(mesh);
      } else if(s.type==="line"){
        const L=s as ShapeBase; const len = Math.hypot(L.w, L.h) || 1;
        const geom = new THREE.BoxGeometry(len, Math.max(10,(s as ShapeBase).stroke||4), Math.max(10,(s as ShapeBase).stroke||4));
        const mesh = new THREE.Mesh(geom, lineMat);
        const angle = Math.atan2(L.h, L.w);
        mesh.position.set(L.x + L.w/2, 10, L.y + L.h/2);
        mesh.rotation.y = -angle; scene.add(mesh);
      } else if(s.type==="circle"){
        const C=s as ShapeBase; const r = Math.max(C.w,0)/2;
        const geom = new THREE.CylinderGeometry(r, r, HEIGHT, 48);
        const mesh = new THREE.Mesh(geom, cylMat);
        mesh.position.set(C.x, HEIGHT/2, C.y); scene.add(mesh);
      } else {
        const P=s as Polyline; if(P.points.length<2) return;
        const sh = new THREE.Shape();
        sh.moveTo(P.points[0].x, P.points[0].y);
        for (let i=1;i<P.points.length;i++) sh.lineTo(P.points[i].x, P.points[i].y);
        if(P.closed) sh.closePath();
        const geom = new THREE.ExtrudeGeometry(sh, {depth: HEIGHT, bevelEnabled:false});
        const mesh = new THREE.Mesh(geom, wallMat);
        mesh.rotation.x = -Math.PI/2; mesh.position.y = 0; scene.add(mesh);
      }
    });

    // controles orbitales básicos
    let isDown=false, lastX=0, lastY=0;
    function onDown(e:MouseEvent){isDown=true; lastX=e.clientX; lastY=e.clientY;}
    function onUp(){isDown=false;}
    function onMove(e:MouseEvent){ if(!isDown) return; const dx=(e.clientX-lastX)*0.005, dy=(e.clientY-lastY)*0.005; lastX=e.clientX; lastY=e.clientY; camera.position.applyAxisAngle(new THREE.Vector3(0,1,0), -dx); camera.position.y = Math.max(60, Math.min(600, camera.position.y - dy*200)); camera.lookAt(0,0,0);}    
    renderer.domElement.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);

    function animate(){ requestAnimationFrame(animate); renderer.render(scene,camera); }
    animate();

    return ()=>{ renderer.domElement.removeEventListener("mousedown", onDown); window.removeEventListener("mouseup", onUp); window.removeEventListener("mousemove", onMove); mountRef.current?.removeChild(renderer.domElement); renderer.dispose(); };
  },[shapes]);

  return (
    <div style={{position:"fixed",inset:0 as any,background:"rgba(0,0,0,.65)",display:"grid",placeItems:"center",zIndex:80}}>
      <div ref={mountRef} style={{position:"relative",borderRadius:12,overflow:"hidden",border:"2px solid #1b2a34"}} />
      <button onClick={onClose} style={{position:"fixed",top:20,right:20,background:"#00bcd4",border:"none",color:"#0b0f13",padding:"8px 12px",borderRadius:10,cursor:"pointer"}}>Cerrar 3D</button>
    </div>
  );
};