import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { createScreenTexture, labelTexture, paintScreen } from "./screen";
import { STATIONS, type Station } from "./room-model";
import type { CameraView } from "./simulation";
import { chairSeat, robotIdleBob, robotSeatedPosition } from "./seat-fit";

type Vec3 = [number, number, number];
const cream = "#e9e8dd", dark = "#35463d";
const boxGeometries = new Map<string, RoundedBoxGeometry>();
const boxMaterials = new Map<string, THREE.MeshStandardMaterial>();

export function Block({ at, size, color = cream, radius = .06, metal = 0, rough = .5, rotation }: {
  at: Vec3; size: Vec3; color?: string; radius?: number; metal?: number; rough?: number; rotation?: Vec3;
}) {
  const bevel = Math.min(radius, Math.min(...size) * .49);
  const geometryKey = [...size, bevel].join(",");
  if (!boxGeometries.has(geometryKey)) boxGeometries.set(geometryKey, new RoundedBoxGeometry(...size, 2, bevel));
  const materialKey = `${color},${metal},${rough}`;
  if (!boxMaterials.has(materialKey)) boxMaterials.set(materialKey, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough }));
  return <mesh position={at} rotation={rotation} geometry={boxGeometries.get(geometryKey)} material={boxMaterials.get(materialKey)} dispose={null} castShadow receiveShadow/>;
}

function Tube({ start, end, radius, color = dark }: { start: Vec3; end: Vec3; radius: number; color?: string }) {
  const { middle, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    return { middle: a.clone().add(b).multiplyScalar(.5), length: a.distanceTo(b), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()) };
  }, [start, end]);
  return <mesh position={middle} quaternion={quaternion} castShadow><cylinderGeometry args={[radius, radius, length, 16]}/><meshStandardMaterial color={color} metalness={.55} roughness={.32}/></mesh>;
}

export function Sign({ title, subtitle, at, size, color, background, rotation = [0, 0, 0] }: {
  title: string; subtitle: string; at: Vec3; size: [number, number]; color?: string; background?: string; rotation?: Vec3;
}) {
  const texture = useMemo(() => labelTexture(title, subtitle, color, background), [title, subtitle, color, background]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={at} rotation={rotation}><planeGeometry args={size}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>;
}

export function Desk({ number = "06", color = "#c1b2d3" }: { number?: string; color?: string }) {
  return <group>
    <Block at={[-.08, 1.08, -.08]} size={[5.65, .18, 1.65]} radius={.16} color="#efeee2" rough={.29}/>
    <Block at={[-.08, .96, -.08]} size={[5.42, .09, 1.46]} radius={.04} color="#a9a295" metal={.45} rough={.35}/>
    <Block at={[-2.16, .49, -.1]} size={[.58, .94, 1.24]} radius={.13} color={color}/>
    <Block at={[2.45, .49, -.3]} size={[.38, .94, 1.0]} radius={.13} color={color}/>
    <Block at={[-2.16, .045, -.1]} size={[.7, .08, 1.37]} radius={.035} color="#8b8e81" metal={.6}/>
    <Block at={[2.45, .045, -.3]} size={[.5, .08, 1.12]} radius={.035} color="#8b8e81" metal={.6}/>
    {/* Fine joinery on the front edge and a recessed lavender light strip. */}
    <Block at={[-.08, 1.016, .75]} size={[4.85, .018, .013]} color="#b5a0d3" radius={.004}/>
    <Block at={[-2.16, .61, .53]} size={[.49, .21, .025]} color="#d1d0c3" radius={.01}/>
    <Sign title="BELAC.FUN" subtitle={`STATION ${number}`} at={[-2.16, .61, .545]} size={[.46, .115]} color="#42503d" background="#d1d0c3"/>
    <Block at={[1.36, 1.181, .24]} size={[1.7, .022, .9]} radius={.09} color="#afbaa2" rough={.95} rotation={[0, .25, 0]}/>
    <group position={[1.35, 1.21, .31]} rotation={[0, -2.5, 0]}>
      <Block at={[0, 0, 0]} size={[1.14, .06, .4]} radius={.035} color="#d8d8ca"/>
      <KeyboardKeys/>
    </group>
    <Block at={[.64, 1.23, .5]} size={[.18, .09, .29]} radius={.07} color="#dddacf" rotation={[0, -2.5, 0]}/>
    {/* Desk accessories make the station feel inhabited. */}
    <group position={[-2.12, 1.18, .18]}>
      <mesh position={[0, .14, 0]} castShadow><cylinderGeometry args={[.11, .095, .28, 40]}/><meshPhysicalMaterial color="#c5acdc" roughness={.21} clearcoat={1}/></mesh>
      <mesh position={[0, .283, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.087, 32]}/><meshStandardMaterial color="#4d3528" roughness={.18}/></mesh>
      <mesh position={[.112, .17, 0]} rotation={[0, Math.PI / 2, 0]} castShadow><torusGeometry args={[.073, .022, 12, 24]}/><meshStandardMaterial color="#c5acdc" roughness={.25}/></mesh>
      <mesh position={[0, .006, 0]} receiveShadow><cylinderGeometry args={[.16, .16, .01, 36]}/><meshStandardMaterial color="#b7b49f"/></mesh>
    </group>
    <Block at={[-1.58, 1.19, .32]} size={[.42, .04, .57]} radius={.02} color="#718267" rotation={[0, -.17, 0]}/>
    <Block at={[-1.58, 1.217, .32]} size={[.4, .01, .54]} radius={.006} color="#e6e1cc" rotation={[0, -.17, 0]}/>
    <Tube start={[-1.6, 1.24, .13]} end={[-1.43, 1.24, .49]} radius={.012} color="#504c5c"/>
    {/* Small analogue timer. */}
    <Block at={[-1.73, 1.34, -.48]} size={[.46, .32, .12]} radius={.035} color="#626f57"/>
    <Sign title="07 / 30" subtitle="DAYS IN MOTION" at={[-1.73, 1.34, -.412]} size={[.4, .1]} color="#dfe8d1" background="#626f57"/>
  </group>;
}

export function KeyboardKeys() {
  const keys = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 36; i++) {
      keys.current?.setMatrixAt(i, matrix.makeTranslation(-.49 + (i % 12) * .089, .041, -.13 + Math.floor(i / 12) * .092));
    }
    if (keys.current) keys.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={keys} args={[undefined, undefined, 36]} castShadow>
    <boxGeometry args={[.071, .026, .067]}/><meshStandardMaterial color="#f2f1e7" roughness={.65}/>
  </instancedMesh>;
}

export function ChairBase() {
  return <group>
    <mesh position={[0, .39, 0]} castShadow><cylinderGeometry args={[.045, .06, .62, 24]}/><meshStandardMaterial color="#8c9586" metalness={.85} roughness={.24}/></mesh>
    {Array.from({ length: 5 }, (_, i) => {
      const a = i * Math.PI * 2 / 5, x = Math.cos(a) * .42, z = Math.sin(a) * .42;
      return <group key={i}><Tube start={[0, .11, 0]} end={[x, .07, z]} radius={.035} color="#8c9586"/><mesh position={[x, .055, z]} rotation={[0, a, Math.PI / 2]} castShadow><cylinderGeometry args={[.065, .065, .07, 16]}/><meshStandardMaterial color="#535e51"/></mesh></group>;
    })}
  </group>;
}

export function ChairSeat({ color }: { color?: string } = {}) {
  return <group>
    <Block at={chairSeat.position} size={chairSeat.size} radius={.06} color={color ?? "#75846a"} rough={.9}/>
    <Tube start={[0, .49, -.3]} end={[0, 1.24, -.44]} radius={.042} color="#829079"/>
    <Block at={[0, 1.23, -.43]} size={[.9, .75, .16]} radius={.075} color={color ?? "#859477"} rough={.9} rotation={[-.12, 0, 0]}/>
    {[-.51, .51].map((x) => <group key={x}>
      <Tube start={[x, .7, -.17]} end={[x, .98, -.17]} radius={.025} color="#829079"/>
      <Block at={[x, 1.01, .02]} size={[.12, .075, .48]} radius={.03} color={color ?? "#64765b"} rough={.85}/>
    </group>)}
  </group>;
}

export type AgentPose = "working" | "turning" | "greeting";

export function SeatedOperator({ view, reducedMotion, greeting, onGreet, onPoseChange, focus, color, chairColor }: {
  view: CameraView; reducedMotion: boolean; greeting: number; onGreet: () => void; onPoseChange: (pose: AgentPose) => void; focus: Vec3; color: string; chairColor?: string;
}) {
  const swivel = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const replay = useRef(-100);
  const looking = useRef(false);
  const dwell = useRef(0);
  const lastPose = useRef<AgentPose>("working");
  const vectors = useMemo(() => ({ forward: new THREE.Vector3(), toward: new THREE.Vector3(), focus: new THREE.Vector3(...focus) }), [focus]);
  useEffect(() => { if (greeting) replay.current = elapsed.current; }, [greeting]);
  useFrame(({ camera }, delta) => {
    if (!swivel.current) return;
    elapsed.current += Math.min(delta, .1);
    camera.getWorldDirection(vectors.forward);
    vectors.toward.copy(vectors.focus).sub(camera.position).normalize();
    const alignment = vectors.forward.dot(vectors.toward);
    // Separate enter/exit angles keep the chair from twitching near the gaze boundary.
    const shouldLook = view === "centre" && alignment > Math.cos(looking.current ? .22 : .12);
    if (shouldLook !== looking.current) {
      dwell.current += Math.min(delta, .1);
      if (dwell.current > .35) { looking.current = shouldLook; dwell.current = 0; }
    } else dwell.current = 0;
    const replayAge = elapsed.current - replay.current;
    const replaying = replayAge < 4.5;
    const facingVisitor = replaying ? (reducedMotion || replayAge > 1.15) : looking.current;
    const target = facingVisitor ? -Math.PI / 4 : -2.5;
    swivel.current.rotation.y = THREE.MathUtils.damp(swivel.current.rotation.y, target, 3.3, reducedMotion ? 10 : Math.min(delta, .1));
    const pose: AgentPose = Math.abs(swivel.current.rotation.y - target) > .035 ? "turning" : facingVisitor ? "greeting" : "working";
    if (pose !== lastPose.current) { lastPose.current = pose; onPoseChange(pose); }
  });
  return <group position={[1.92, 0, 1.37]}>
    <ChairBase/>
    <group ref={swivel} rotation={[0, -2.5, 0]}>
      <ChairSeat color={chairColor}/>
      <Robot reducedMotion={reducedMotion} greeting={greeting} onGreet={onGreet} color={color}/>
    </group>
  </group>;
}

export function Plant() {
  return <group position={[-3.02, .02, -1.57]}>
    <mesh position={[0, .26, 0]} castShadow receiveShadow><cylinderGeometry args={[.28, .22, .52, 48]}/><meshStandardMaterial color="#a1a88e" roughness={.85}/></mesh>
    <mesh position={[0, .52, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.24, 32]}/><meshStandardMaterial color="#4a493a"/></mesh>
    {Array.from({ length: 9 }, (_, i) => {
      const a = i * 2.4, h = .72 + (i % 4) * .24, x = Math.cos(a) * .33, z = Math.sin(a) * .3;
      return <group key={i}>
        <Tube start={[0, .5, 0]} end={[x, h + .2, z]} radius={.012} color="#5c6f44"/>
        <mesh position={[x, h + .18, z]} rotation={[.35 * Math.cos(a), a, -.4 * Math.sin(a)]} scale={[.13, .34, .035]} castShadow><sphereGeometry args={[1, 16, 16]}/><meshStandardMaterial color={i % 2 ? "#6d8254" : "#899a66"} roughness={.65}/></mesh>
      </group>;
    })}
  </group>;
}

export function Lamp() {
  return <group position={[-.88, -.25, -.25]}>
    <Tube start={[-2.6, .08, -1.1]} end={[-2.6, 2.8, -1.1]} radius={.026} color="#777669"/>
    <Tube start={[-2.6, 2.8, -1.1]} end={[-2.1, 2.8, -.72]} radius={.026} color="#777669"/>
    <mesh position={[-2.6, .045, -1.1]} castShadow><cylinderGeometry args={[.22, .24, .08, 40]}/><meshStandardMaterial color="#777669" metalness={.55}/></mesh>
    <mesh position={[-2.1, 2.72, -.72]} castShadow><cylinderGeometry args={[.17, .3, .22, 48]}/><meshStandardMaterial color="#d7cdab" metalness={.25} roughness={.38}/></mesh>
    <mesh position={[-2.1, 2.608, -.72]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[.26, 40]}/><meshBasicMaterial color="#fff2ca" toneMapped={false}/></mesh>
  </group>;
}

export function Robot({ reducedMotion, greeting, onGreet, color, atConsole = false }: { reducedMotion: boolean; greeting: number; onGreet: () => void; color: string; atConsole?: boolean }) {
  const gltf = useGLTF("/station/robot.glb");
  const object = useMemo(() => {
    const scene = clone(gltf.scene);
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true; child.receiveShadow = true;
      const material = child.material as THREE.MeshStandardMaterial;
      const palette: Record<string, string> = { Main: color, Grey: "#4e6354", Black: "#0d2523" };
      if (material.name === "Black") {
        const geometry = child.geometry.clone();
        geometry.deleteAttribute("normal");
        child.geometry = mergeVertices(geometry);
        child.geometry.computeVertexNormals();
        geometry.dispose();
      }
      child.material = new THREE.MeshPhysicalMaterial({
        color: palette[material.name] ?? material.color,
        metalness: material.name === "Grey" ? .65 : .18,
        roughness: material.name === "Black" ? .08 : .36,
        clearcoat: .65, clearcoatRoughness: .25,
      } as THREE.MeshPhysicalMaterialParameters);
    });
    return scene;
  }, [gltf.scene, color]);
  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object]);
  const head = useMemo(() => object.getObjectByName("Head"), [object]);
  const headRotation = useRef<THREE.Quaternion | null>(null);
  const armPoses = useRef<{ bone: THREE.Object3D; resting: THREE.Quaternion; working: THREE.Quaternion }[]>([]);
  const group = useRef<THREE.Group>(null);
  const greetingTime = useRef(-100);
  const elapsed = useRef(0);
  useEffect(() => {
    const clip = gltf.animations.find((a) => a.name === "Sitting");
    if (clip) {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      mixer.update(clip.duration);
      if (head) headRotation.current = head.quaternion.clone();
      const arms = ["UpperArmL", "UpperArmR", "LowerArmL", "LowerArmR"]
        .map((name) => object.getObjectByName(name))
        .filter((bone): bone is THREE.Object3D => Boolean(bone))
        .map((bone) => ({ bone, resting: bone.quaternion.clone(), working: bone.quaternion.clone() }));
      // Set the resting arms over the console using the rig, not detached hand meshes.
      object.updateWorldMatrix(true, true);
      const aim = (boneName: string, childName: string, destination: Vec3) => {
        const bone = object.getObjectByName(boneName), child = object.getObjectByName(childName);
        if (!bone || !child || !bone.parent) return;
        const origin = bone.getWorldPosition(new THREE.Vector3());
        const from = child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
        const to = object.localToWorld(new THREE.Vector3(...destination)).sub(origin).normalize();
        const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
        const world = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta);
        const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        bone.quaternion.copy(parent.multiply(world));
        object.updateWorldMatrix(true, true);
      };
      aim("UpperArmL", "LowerArmL", [.92, 1.62, -.14]);
      aim("UpperArmR", "LowerArmR", [-.98, 1.6, -.12]);
      aim("LowerArmL", "Palm2L", [.55, 1.3, 1.18]);
      aim("LowerArmR", "Palm2R", [-.55, 1.3, 1.18]);
      arms.forEach((pose) => pose.working.copy(pose.bone.quaternion));
      armPoses.current = arms;
    }
    return () => { mixer.stopAllAction(); };
  }, [mixer, gltf.animations, head, object]);
  useEffect(() => {
    if (greeting) greetingTime.current = elapsed.current;
  }, [greeting]);
  useEffect(() => () => {
    object.traverse((node) => {
      if (node instanceof THREE.Mesh) (node.material as THREE.Material).dispose();
    });
  }, [object]);
  useFrame((_, delta) => {
    elapsed.current += delta;
    const yaw = group.current?.parent?.rotation.y ?? -2.5;
    const restWeight = atConsole ? 0 : THREE.MathUtils.smoothstep(yaw, -2.5, -Math.PI / 4);
    armPoses.current.forEach(({ bone, resting, working }) => bone.quaternion.copy(working).slerp(resting, restWeight));
    if (!head || !headRotation.current || reducedMotion) return;
    const t = elapsed.current;
    head.quaternion.copy(headRotation.current);
    const hello = t - greetingTime.current;
    if (hello < 3.4) {
      head.rotateY(Math.sin(Math.min(hello / .6, 1) * Math.PI / 2) * -.24);
      head.rotateX(Math.sin(hello * 5) * .11 * Math.sin(hello / 3.4 * Math.PI));
    } else {
      head.rotateY(Math.sin(t * .42) * .07);
      head.rotateX(Math.sin(t * .8) * .025);
    }
    if (group.current) group.current.position.y = robotSeatedPosition[1] + Math.sin(t * 1.4) * robotIdleBob;
  });
  return <group ref={group} position={robotSeatedPosition} scale={.5}
    onClick={(event) => { event.stopPropagation(); onGreet(); }}
    onPointerOver={() => { document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = ""; }}>
    <primitive object={object}/>
  </group>;
}

export function Monitor({ history, running, station = STATIONS[5]! }: { history: number[]; running: boolean; station?: Station }) {
  const texture = useMemo(createScreenTexture, []);
  const logo = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const image = new Image();
    if (!station.logo) return;
    image.src = `/station/${station.logo}.png`;
    image.onload = () => { logo.current = image; paintScreen(texture, history, running, image, station); };
    return () => { image.onload = null; };
  }, [texture, station]);
  useEffect(() => { paintScreen(texture, history, running, logo.current, station); }, [texture, history, running, station]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={[-.6, 2.48, -1.8]}>
    <Block at={[0, 0, -.35]} size={[.85, .45, .6]} color="#92998b" metal={.8}/>
    <Block at={[0, 0, 0]} size={[4.5, 2.83, .16]} radius={.12} color={station.id === 6 ? "#5f7183" : "#777b70"} metal={.5} rough={.4}/>
    <Block at={[0, 0, .076]} size={[4.42, 2.75, .06]} radius={.09} color={station.id === 6 ? "#162136" : "#25392d"} rough={.45}/>
    <mesh position={[0, 0, .11]}><planeGeometry args={[4.28, 2.586]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
    <mesh position={[0, -1.37, .115]}><sphereGeometry args={[.012, 10, 10]}/><meshBasicMaterial color="#c7e9a9" toneMapped={false}/></mesh>
  </group>;
}

useGLTF.preload("/station/robot.glb");
