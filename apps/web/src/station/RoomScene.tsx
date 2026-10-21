import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Block, SeatedOperator, type AgentPose } from "./StationScene";
import { BAY_ANGLE, indexAtAngle, ROOM_RADIUS, shortestAngle, STATIONS, stationTransform, STATION_SCALE, type Station } from "./room-model";
import { createScreenTexture, paintOverview } from "./screen";
import { type CameraView } from "./simulation";
import { moneyUsd, useStudio, type LiveStudio } from "./live-data";
import { CommandStation } from "./CommandStation";
import { StationCubicle } from "./StationCubicle";
import { stationTheme } from "./station-themes";
import { SpaceEnvironment } from "./SpaceEnvironment";
import { OrbitalPlatform } from "./OrbitalPlatform";

export interface NavigationTarget { index: number; revision: number }
interface RoomProps {
  view: CameraView;
  navigation: NavigationTarget;
  histories: number[][];
  running: boolean;
  reducedMotion: boolean;
  cameraReset: number;
  greetings: number[];
  onReady: () => void;
  onFocus: (index: number) => void;
  onChoose: (index: number) => void;
  onPoseChange: (index: number, pose: AgentPose) => void;
}

const Bay = memo(function Bay({ station, history, view, running, reducedMotion, greeting, onChoose, onPoseChange }: {
  station: Station; history: number[]; view: CameraView; running: boolean; reducedMotion: boolean; greeting: number;
  onChoose: (index: number) => void; onPoseChange: (index: number, pose: AgentPose) => void;
}) {
  const transform = useMemo(() => stationTransform(station.id), [station.id]);
  const focus = useMemo(() => [transform.position[0], 2.1, transform.position[2]] as [number, number, number], [transform]);
  const theme = stationTheme(station);
  return <group position={transform.position} rotation={[0, transform.rotation, 0]} scale={STATION_SCALE}>
    <StationCubicle station={station} history={history} running={running}/>
    <group position={[.7, 0, 0]}>
    <SeatedOperator focus={focus} color={theme.robot} chairColor={theme.hardware} view={view} reducedMotion={reducedMotion} greeting={greeting}
      onGreet={() => onChoose(station.id)} onPoseChange={(pose) => onPoseChange(station.id, pose)}/>
    </group>

  </group>;
});

function Overview({ histories, running }: { histories: number[][]; running: boolean }) {
  const live = useStudio();
  const texture = useMemo(() => createScreenTexture(2560, 1280), []);
  const transform = useMemo(() => stationTransform(0), []);
  useEffect(() => { paintOverview(texture, histories, running, live); }, [texture, histories, running, live]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={transform.position} scale={STATION_SCALE} name="overview-clean-display">
    <Block at={[0, .025, -.3]} size={[10.6, .05, 4.6]} radius={.02} color="#dce3e4"/>
    <Block at={[0, 4.2, -2.15]} size={[10.6, 5.58, .18]} radius={.09} color="#e5e9e8"/>
    <Block at={[0, 4.2, -1.96]} size={[10.2, 5.18, .14]} radius={.055} color="#263b32" rough={.45}/>
    <mesh position={[0, 4.2, -1.883]}><planeGeometry args={[10.04, 5.02]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
    <Block at={[0, .63, -1.8]} size={[9.1, .92, .75]} radius={.075} color="#e6ecee"/>
    <Block at={[0, .15, -1.8]} size={[8.8, .06, .68]} radius={.02} color="#8961cf"/>
  </group>;
}

function RoomCamera({ view, navigation, reducedMotion, cameraReset, onFocus }: Pick<RoomProps, "view" | "navigation" | "reducedMotion" | "cameraReset" | "onFocus">) {
  const { camera, gl, size } = useThree();
  const angle = useRef(0), wanted = useRef(0), focus = useRef(0);
  const drag = useRef({ active: false, x: 0 });
  const lookAt = useRef(new THREE.Vector3(0, 2.12, -ROOM_RADIUS));
  const destination = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const orbit = useRef<OrbitControls | null>(null);
  useEffect(() => { wanted.current = angle.current + shortestAngle(angle.current, navigation.index * BAY_ANGLE); }, [navigation]);
  useEffect(() => {
    drag.current.active = false;
    if (view !== "birdseye") return;
    const aspect = size.width / size.height;
    const distance = 21.5 / Math.tan(THREE.MathUtils.degToRad(38) / 2) / Math.min(aspect, 1);
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = 38;
    perspective.position.set(-Math.sin(angle.current) * distance * Math.SQRT1_2, distance * Math.SQRT1_2, Math.cos(angle.current) * distance * Math.SQRT1_2);
    perspective.updateProjectionMatrix();
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = .09;
    controls.minDistance = 8;
    controls.maxDistance = distance * 2;
    controls.minPolarAngle = .06;
    controls.maxPolarAngle = Math.PI - .06;
    controls.screenSpacePanning = true;
    controls.zoomSpeed = .8;
    controls.update();
    orbit.current = controls;
    return () => { controls.dispose(); orbit.current = null; };
  }, [camera, gl, view, cameraReset, reducedMotion, size.width, size.height]);
  useEffect(() => {
    const element = gl.domElement;
    const down = (event: PointerEvent) => {
      if (view !== "centre") return;
      drag.current = { active: true, x: event.clientX };
      element.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!drag.current.active) return;
      wanted.current -= (event.clientX - drag.current.x) * .0045;
      drag.current.x = event.clientX;
    };
    const up = () => { drag.current.active = false; };
    element.addEventListener("pointerdown", down); element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up); element.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
    return () => {
      element.removeEventListener("pointerdown", down); element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up); element.removeEventListener("pointercancel", up); window.removeEventListener("blur", up);
    };
  }, [gl, view]);
  useFrame((_, delta) => {
    // Only one controller owns the camera at a time. Free orbit must not be
    // pulled back towards the old bird's-eye destination on every frame.
    if (view === "birdseye") {
      orbit.current?.update();
      if (orbit.current) lookAt.current.copy(orbit.current.target);
      return;
    }
    angle.current = THREE.MathUtils.damp(angle.current, wanted.current, 5, reducedMotion ? 10 : delta);
    const current = indexAtAngle(angle.current);
    if (current !== focus.current && view === "centre") { focus.current = current; onFocus(current); }
    const aspect = size.width / size.height;
    const perspective = camera as THREE.PerspectiveCamera;
    destination.set(0, 2.5, 0);
    look.set(Math.sin(angle.current) * ROOM_RADIUS, 2.12, -Math.cos(angle.current) * ROOM_RADIUS);
    const fov = Math.max(34, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50) / 2) / aspect)));
    const blend = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.5);
    camera.position.lerp(destination, blend);
    lookAt.current.lerp(look, blend);
    perspective.fov = THREE.MathUtils.lerp(perspective.fov, fov, blend);
    perspective.updateProjectionMatrix();
    camera.lookAt(lookAt.current);
    camera.updateMatrixWorld();
  });
  return null;
}

export function RoomScene(props: RoomProps) {
  const { gl } = useThree();
  const live = useStudio();
  const [labelsVisible, setLabelsVisible] = useState(true);
  const aboveDeck = useRef(true);
  useFrame(({ camera }) => {
    const visible = camera.position.y > .5;
    if (aboveDeck.current !== visible) {
      aboveDeck.current = visible;
      setLabelsVisible(visible);
    }
  });
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    props.onReady();
  }, [gl, props.onReady]);
  return <>
    <SpaceEnvironment reducedMotion={props.reducedMotion}/>
    <ambientLight intensity={.5}/>
    <hemisphereLight args={["#d8edff", "#27344f", 1.5]}/>
    <directionalLight position={[-8, 18, 7]} intensity={2.2} color="#f2f8ff" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-21} shadow-camera-right={21} shadow-camera-top={21} shadow-camera-bottom={-21} shadow-camera-far={60} shadow-normalBias={.03} shadow-bias={-.00015}/>
    <directionalLight position={[10, 9, -9]} intensity={1.3} color="#aab9ff"/>
    <directionalLight position={[-12, -18, 10]} intensity={2.2} color="#96c5ee"/>
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" intensity={3} color="#e0f1ff" scale={[20, 15, 1]} position={[-10, 15, 5]} rotation={[0, Math.PI / 4, 0]}/>
      <Lightformer form="rect" intensity={2} color="#98b6eb" scale={[12, 8, 1]} position={[12, 8, -5]} rotation={[0, -Math.PI / 2, 0]}/>
    </Environment>
    <OrbitalPlatform/>
    <Overview histories={props.histories} running={props.running}/>
    <CommandStation reducedMotion={props.reducedMotion} firstPerson={props.view === "centre"}/>
    {STATIONS.map((station, index) => <Bay key={station.id} station={station} history={props.histories[index]!} view={props.view} running={props.running} reducedMotion={props.reducedMotion}
      greeting={props.greetings[index] ?? 0} onChoose={props.onChoose} onPoseChange={props.onPoseChange}/>)}
    {props.view === "birdseye" && labelsVisible && Array.from({ length: 11 }, (_, index) => {
      const { position } = stationTransform(index);
      const station = STATIONS[index - 1];
      return <Html key={index} center position={[position[0] * .68, .5, position[2] * .68]} zIndexRange={[10, 0]}>
        <button className="room-map-label" onClick={() => props.onChoose(index)} aria-label={index ? `Visit ${station!.provider}` : "Visit overview"}>
          <span>{index ? String(index).padStart(2, "0") : "◎"}</span><strong>{station?.provider ?? "Overview"}</strong>
          <LiveMapValue index={index} live={live}/>
        </button>
      </Html>;
    })}
    <RoomCamera view={props.view} navigation={props.navigation} reducedMotion={props.reducedMotion} cameraReset={props.cameraReset} onFocus={props.onFocus}/>
  </>;
}

function LiveMapValue({ index, live }: { index: number; live: LiveStudio }) {
  // Drei Html mounts a separate DOM root; pass the feed across that boundary explicitly.
  if (index === 0) return <small>{live.stale || live.snapshot?.accounting?.status === "unavailable" ? "Stale" : moneyUsd(live.snapshot?.accounting?.data?.equityUsd)}</small>;
  const observation = live.snapshot?.platforms.find((p) => p.id === index)?.observation;
  return <small>{observation?.data?.performance
    ? live.stale || observation.status === "unavailable" ? "Stale" : moneyUsd(observation.data.performance.equityUsd)
    : index === 9 ? "Pending" : "Execution off"}</small>;
}
