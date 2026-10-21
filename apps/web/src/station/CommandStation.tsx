import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Block, ChairBase, ChairSeat, KeyboardKeys, Sign } from "./StationScene";
import { CalebOperator } from "./CalebOperator";

function CounterRing({ outer, inner, height, y, color, rough = .5 }: { outer: number; inner: number; height: number; y: number; color: string; rough?: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 2, curveSegments: 80, steps: 1 });
  }, [outer, inner, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} castShadow receiveShadow><meshStandardMaterial color={color} roughness={rough}/></mesh>;
}

export function CommandStation({ reducedMotion, firstPerson }: { reducedMotion: boolean; firstPerson: boolean }) {
  return <group name="central-command-station">
    <mesh position={[0, .035, 0]} receiveShadow><cylinderGeometry args={[3.42, 3.42, .07, 96]}/><meshStandardMaterial color="#bcb7c7" roughness={.85}/></mesh>
    <CounterRing outer={2.98} inner={1.04} height={.85} y={.12} color="#34414a"/>
    <CounterRing outer={3.15} inner={.95} height={.14} y={1.01} color="#aabfc9" rough={.32}/>
    <CounterRing outer={3.02} inner={2.98} height={.035} y={.96} color="#93aeb9" rough={.25}/>
    {Array.from({ length: 40 }, (_, i) => {
      const a = i * Math.PI * 2 / 40;
      return <Block key={i} at={[Math.sin(a) * 2.988, .55, Math.cos(a) * 2.988]} size={[.022, .65, .023]} color="#596b74" radius={.004} rotation={[0, a, 0]}/>;
    })}
    <group position={[0, .04, -.08]}>
      <ChairBase/><ChairSeat color="#252e36"/><CalebOperator reducedMotion={reducedMotion} showHead={!firstPerson}/>
    </group>
    <group position={[0, 1.20, 1.14]} rotation={[0, Math.PI, 0]}>
      <Block at={[0, 0, 0]} size={[1.14, .06, .4]} radius={.025} color="#212c35"/>
      <KeyboardKeys/>
    </group>
    <Sign title="BELAC.FUN" subtitle="COMMAND DESK" at={[0, .57, 3.01]} size={[1.65, .412]} color="#e5edf0" background="#34414a"/>
  </group>;
}
