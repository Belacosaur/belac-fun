import { BAY_ANGLE } from "./room-model";

function Ring({ radius, y, tube = .035, color = "#6ce5ee" }: { radius: number; y: number; tube?: number; color?: string }) {
  return <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <torusGeometry args={[radius, tube, 8, 160]}/>
    <meshBasicMaterial color={color} toneMapped={false}/>
  </mesh>;
}

/** Open flight deck; all structural detail sits below the existing station datum. */
export function OrbitalPlatform() {
  return <group name="orbital-platform">
    <mesh position={[0, -.34, 0]} receiveShadow castShadow>
      <cylinderGeometry args={[17.2, 17.5, .65, 128]}/>
      <meshStandardMaterial color="#344653" metalness={.65} roughness={.38}/>
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .005, 0]} receiveShadow>
      <circleGeometry args={[17.18, 128]}/>
      <meshStandardMaterial color="#566672" metalness={.35} roughness={.65}/>
    </mesh>
    <mesh position={[0, -1.05, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[16.85, 14.7, 1.2, 64]}/>
      <meshStandardMaterial color="#15212f" metalness={.7} roughness={.4}/>
    </mesh>
    <mesh position={[0, -1.85, 0]}>
      <cylinderGeometry args={[14.5, 9.5, .65, 64]}/>
      <meshStandardMaterial color="#263c4b" metalness={.65} roughness={.45}/>
    </mesh>
    <mesh position={[0, -2.35, 0]}>
      <cylinderGeometry args={[7, 5.4, .7, 64]}/>
      <meshStandardMaterial color="#101d2c" metalness={.7} roughness={.3}/>
    </mesh>
    <Ring radius={17.27} y={-.18} tube={.055}/>
    <Ring radius={16.96} y={.035} tube={.025} color="#9bc1d0"/>
    <Ring radius={16.2} y={-1.02} tube={.045} color="#9981f4"/>
    <Ring radius={9.5} y={-2.17} tube={.06}/>
    <Ring radius={5.6} y={-2.71} tube={.045} color="#9981f4"/>
    <mesh position={[0, -2.71, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <circleGeometry args={[4.6, 64]}/>
      <meshStandardMaterial color="#203749" emissive="#3d68b0" emissiveIntensity={.45} metalness={.6} roughness={.35}/>
    </mesh>
    <Ring radius={4.6} y={-2.73} tube={.055}/>
    <Ring radius={3.65} y={.025} tube={.025}/>
    <Ring radius={10.45} y={.018} tube={.018} color="#9aadb9"/>
    {Array.from({ length: 11 }, (_, i) => <group key={i} rotation={[0, -(i + .5) * BAY_ANGLE, 0]}>
      {/* Radial seams and short runway lights define the circulation aisle. */}
      <mesh position={[0, .013, -7.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[.025, 6.6]}/><meshBasicMaterial color="#354754"/>
      </mesh>
      {[5.2, 7.3, 9.4].map((r) => <mesh key={r} position={[0, .025, -r]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[.06, .55]}/><meshBasicMaterial color="#a4e6e9" toneMapped={false}/>
      </mesh>)}
      <mesh position={[0, -.98, -16.5]} rotation={[.45, 0, 0]} castShadow>
        <boxGeometry args={[.5, 1.4, .5]}/><meshStandardMaterial color="#7e95a1" metalness={.7} roughness={.3}/>
      </mesh>
      <mesh position={[0, -2.08, -10.8]}>
        <boxGeometry args={[.28, .32, 7.4]}/><meshStandardMaterial color="#718b9c" metalness={.65} roughness={.4}/>
      </mesh>
      <mesh position={[0, -1.25, -16.3]}>
        <boxGeometry args={[1.8, .12, .12]}/><meshBasicMaterial color={i % 3 ? "#78d9e9" : "#b4a2ff"} toneMapped={false}/>
      </mesh>
    </group>)}
    {Array.from({ length: 44 }, (_, i) => <group key={i} rotation={[0, i * Math.PI * 2 / 44, 0]}>
      <mesh position={[0, -.56, 17.22]}>
        <boxGeometry args={[.52, .19, .1]}/><meshStandardMaterial color="#0c1824" roughness={.8}/>
      </mesh>
    </group>)}
  </group>;
}
