import React, { useState } from "react";
import { CanvasEditor } from "../components/CanvasEditor";
import { ThreePreview } from "../components/ThreePreview";

export default function Home(){
  const [threeData,setThreeData] = useState<any[]|null>(null);
  return (
    <>
      <h1 style={{color:"#e3f7ff", fontFamily:"ui-sans-serif", margin:"12px 12px 0"}}>ArchiFlow Studio — Web Renderer</h1>
      <CanvasEditor onOpen3D={(shapes)=>setThreeData(shapes)} />
      {threeData && <ThreePreview shapes={threeData as any} onClose={()=>setThreeData(null)} />}
    </>
  );
}