import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Block } from "./StationScene";

type Vec3 = [number, number, number];
const graphite = "#181b20", metal = "#8b9599", face = "#a49b8e";

function Link({ from, to, radius, color, endRadius = radius }: { from: Vec3; to: Vec3; radius: number; color: string; endRadius?: number }) {
  const { center, rotation, length } = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
    return { center: a.add(b).multiplyScalar(.5), length: direction.length(), rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()) };
  }, [from, to]);
  return <mesh position={center} quaternion={rotation} castShadow><cylinderGeometry args={[endRadius, radius, length, 32]}/><meshStandardMaterial color={color} roughness={.42} metalness={.55}/></mesh>;
}
function Joint({ at, radius = .11 }: { at: Vec3; radius?: number }) {
  return <mesh position={at} castShadow><sphereGeometry args={[radius, 24, 20]}/><meshStandardMaterial color="#3b434a" metalness={.8} roughness={.28}/></mesh>;
}
function Emblem({ at, scale = 1 }: { at: Vec3; scale?: number }) {
  return <group position={at} scale={scale}>
    {[[-.105, -.01, -.5], [.105, -.01, .5], [0, .11, 0]].map(([x, y, angle], i) => <Block key={i} at={[x!, y!, 0]} size={[.06, .16, .014]} rotation={[0, 0, angle!]} color="#e5edf0" radius={.002}/>)}
  </group>;
}

function PortraitHead({ reducedMotion }: { reducedMotion: boolean }) {
  const head = useRef<THREE.Group>(null);
  const capBill = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-.37, .05); shape.quadraticCurveTo(-.47, .55, -.26, .65);
    shape.quadraticCurveTo(0, .76, .26, .65); shape.quadraticCurveTo(.47, .55, .37, .05); shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 2, steps: 1, curveSegments: 20 });
  }, []);
  useFrame(({ clock }) => { if (head.current && !reducedMotion) head.current.rotation.y = Math.sin(clock.elapsedTime * .3) * .065; });
  return <group ref={head} position={[0, 1.92, .025]} name="caleb-robot-portrait">
    {/* Human proportions expressed as machined face plates and an articulated jaw. */}
    <mesh scale={[.34, .40, .29]} castShadow><sphereGeometry args={[1, 48, 32]}/><meshPhysicalMaterial color={face} metalness={.65} roughness={.44} clearcoat={.15}/></mesh>
    <Block at={[0, -.12, .19]} size={[.48, .34, .20]} radius={.085} color="#504b47" rough={.85} metal={.2}/>
    <Block at={[0, -.225, .23]} size={[.36, .13, .13]} radius={.05} color="#474442" rough={.9}/>
    {[-1, 1].map((side) => <group key={side}>
      <Block at={[side * .246, -.045, .18]} size={[.11, .30, .15]} radius={.04} color="#55504a" rough={.9}/>
      <mesh position={[side * .355, .015, -.015]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.094, .094, .07, 32]}/><meshStandardMaterial color={metal} metalness={.8} roughness={.3}/></mesh>
      <Block at={[side * .142, .065, .269]} size={[.21, .095, .04]} radius={.035} color="#171d23"/>
      <Block at={[side * .142, .065, .293]} size={[.12, .018, .012]} radius={.006} color="#b8e8ed" metal={.2}/>
      <Block at={[side * .14, .137, .272]} size={[.21, .035, .034]} radius={.012} color="#393631" rotation={[0, 0, side * -.09]}/>
    </group>)}
    <Block at={[0, -.012, .299]} size={[.085, .145, .08]} radius={.025} color="#b5aa98" metal={.55}/>
    <Block at={[0, -.116, .3]} size={[.26, .042, .028]} radius={.013} color="#363331"/>
    <Block at={[0, -.162, .307]} size={[.19, .015, .012]} radius={.004} color="#9e9890"/>
    {/* Stubble-like machining on the lower face, kept subtle at normal view distance. */}
    {Array.from({ length: 21 }, (_, i) => <Block key={i} at={[-.18 + (i % 7) * .06, -.20 - Math.floor(i / 7) * .027, .301 - Math.floor(i / 7) * .006]} size={[.022, .007, .005]} radius={.002} color="#726b61"/>)}
    <group position={[0, .20, -.015]}>
      <mesh scale={[1, .76, .95]} castShadow><sphereGeometry args={[.405, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]}/><meshStandardMaterial color="#17191d" roughness={.93}/></mesh>
      <mesh geometry={capBill} rotation={[Math.PI / 2, 0, 0]} position={[0, -.005, 0]} castShadow><meshStandardMaterial color="#111419" roughness={.82}/></mesh>
      <Emblem at={[0, .17, .343]} scale={.6}/>
      <mesh position={[0, .31, 0]} castShadow><sphereGeometry args={[.028, 16, 12]}/><meshStandardMaterial color="#26292d" roughness={.8}/></mesh>
    </group>
  </group>;
}

/** A stylised mechanical portrait from the supplied photo: cap, beard, black shirt and watch. */
export function CalebOperator({ reducedMotion, showHead = true }: { reducedMotion: boolean; showHead?: boolean }) {
  return <group name="caleb-command-operator">
    <Block at={[0, 1.22, .005]} size={[.75, .69, .43]} radius={.16} color={graphite} rough={.9}/>
    <Block at={[0, .86, .04]} size={[.58, .23, .4]} radius={.08} color="#272e34" rough={.6}/>
    <Link from={[0, 1.53, 0]} to={[0, 1.68, 0]} radius={.10} color={metal}/>
    <Emblem at={[-.19, 1.35, .229]} scale={.46}/>
    <group visible={showHead}><PortraitHead reducedMotion={reducedMotion}/></group>
    {[-1, 1].map((side) => <group key={side}>
      <Joint at={[side * .4, 1.45, .02]} radius={.145}/>
      <Link from={[side * .43, 1.43, .04]} to={[side * .52, 1.17, .33]} radius={.15} endRadius={.125} color={graphite}/>
      <Joint at={[side * .52, 1.17, .33]}/>
      <Link from={[side * .52, 1.17, .33]} to={[side * .27, 1.19, .88]} radius={.10} endRadius={.075} color={metal}/>
      <Block at={[side * .25, 1.19, .96]} size={[.19, .075, .18]} radius={.025} color="#a6afb2" metal={.7} rotation={[0, side * -.15, 0]}/>
      {[0, 1, 2, 3].map((finger) => <Block key={finger} at={[side * .25 - .067 + finger * .045, 1.175, 1.075]} size={[.032, .042, .10]} radius={.012} color="#879498" metal={.6}/>)}
      <Link from={[side * .2, .84, .10]} to={[side * .24, .80, .64]} radius={.135} color="#242b32"/>
      <Joint at={[side * .24, .78, .65]} radius={.125}/>
      <Link from={[side * .24, .72, .67]} to={[side * .24, .2, .75]} radius={.105} endRadius={.08} color="#707c83"/>
      <Block at={[side * .24, .13, .86]} size={[.25, .17, .42]} radius={.065} color="#20282f" metal={.2}/>
    </group>)}
    {/* Photo's left-wrist watch, rendered as an actual watch on the forearm. */}
    <group position={[-.305, 1.195, .795]} rotation={[0, -.43, 0]}>
      <Block at={[0, 0, 0]} size={[.18, .18, .08]} radius={.045} color="#11171b"/>
      <mesh position={[0, .097, 0]}><cylinderGeometry args={[.078, .078, .025, 32]}/><meshStandardMaterial color="#b4bdc0" metalness={.9} roughness={.24}/></mesh>
      <mesh position={[0, .112, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.06, 32]}/><meshStandardMaterial color="#18252a" roughness={.18}/></mesh>
      <Block at={[0, .115, .015]} size={[.006, .006, .046]} radius={.002} color="#e5edf0"/>
    </group>
  </group>;
}
