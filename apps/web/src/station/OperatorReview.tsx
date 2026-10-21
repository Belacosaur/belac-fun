import { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { CalebOperator } from "./CalebOperator";
import { ChairBase, ChairSeat } from "./StationScene";

function Ready({ onReady }: { onReady: () => void }) {
  const { camera } = useThree();
  useEffect(() => { camera.lookAt(0, 1.25, 0); onReady(); }, [camera, onReady]); return null;
}
function Review() {
  const [ready, setReady] = useState(false);
  return <>
    <Canvas shadows dpr={[1, 2]} camera={{ position: [2.9, 2.35, 5.3], fov: 31 }}>
      <color attach="background" args={["#e9e8e1"]}/>
      <ambientLight intensity={.6}/><hemisphereLight args={["#fff5e8", "#9cabb5", 1]}/>
      <directionalLight position={[-3, 6, 5]} intensity={2.5} castShadow shadow-mapSize={[2048, 2048]}/>
      <directionalLight position={[4, 4, -2]} intensity={2} color="#bbd9e8"/>
      <Suspense fallback={null}>
        <Environment resolution={128} frames={1}><Lightformer intensity={3} position={[-3, 4, 2]} scale={[4, 5, 1]}/><Lightformer intensity={2} position={[3, 3, -2]} rotation={[0, Math.PI, 0]} scale={[4, 5, 1]}/></Environment>
        <CalebOperator reducedMotion/><ChairBase/><ChairSeat color="#252e36"/>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.025, 0]} receiveShadow><planeGeometry args={[200, 200]}/><meshStandardMaterial color="#e9e8e1" roughness={1}/></mesh>
        <Ready onReady={() => setReady(true)}/>
      </Suspense>
      <OrbitControls target={[0, 1.25, 0]} minDistance={3} maxDistance={10} maxPolarAngle={Math.PI / 2}/>
    </Canvas>
    <div className="label" data-ready={ready}><small>BELAC.FUN / CHARACTER STUDY</small><h1>The operator.</h1><p>Caleb, reimagined as a robot.<br/>Black cap · beard plates · graphite shirt · wristwatch</p></div>
    <div className="note">Actual scene geometry · drag to rotate</div>
  </>;
}
createRoot(document.getElementById("root")!).render(<Review/>);
