import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Domain-warping approach adapted from wwwtyro/space-3d (Unlicense).
// See public/station/space-source.md. Bake once, not on every display frame.
const noise = /* glsl */`
float hash(vec3 p) {
  p = fract(p * .3183099 + vec3(.11, .27, .63));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
    mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
    mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float nebula(vec3 p) {
  float scale = 64.0; vec3 displace = vec3(0.0);
  for (int i=0; i<6; i++) {
    displace = vec3(noise3(p.xyz*scale+displace),
      noise3(p.yzx*scale+displace),noise3(p.zxy*scale+displace));
    scale *= .5;
  }
  return noise3(p*scale+displace);
}`;
const vertex = /* glsl */`
varying vec3 vPosition;
void main() {
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;
const nebulaFragment = /* glsl */`
varying vec2 vUv;
${noise}
void main() {
  float longitude = vUv.x * 6.283185307;
  float latitude = vUv.y * 3.141592654;
  vec3 d = vec3(-cos(longitude)*sin(latitude),-cos(latitude),sin(longitude)*sin(latitude));
  float cloud = nebula(d*2.1+vec3(12.3,7.1,4.9));
  float wisps = nebula(d*3.4+vec3(3.5,18.7,7.2));
  float band = pow(max(0.0,1.0-abs(d.y*.8+d.x*.35+.12)),3.0);
  vec3 color = vec3(.003,.005,.014);
  color += vec3(.14,.055,.26)*pow(cloud,3.7)*band;
  color += vec3(.025,.17,.24)*pow(wisps,4.8)*band;
  gl_FragColor = vec4(color,1.0);
}`;
const planetFragment = /* glsl */`
varying vec3 vPosition;
${noise}
void main() {
  vec3 n = normalize(vPosition);
  float turbulence = noise3(n*8.0) + .45*noise3(n*24.0);
  float bands = sin(n.y*45.0+turbulence*5.0)*.5+.5;
  vec3 color = mix(vec3(.035,.12,.21),vec3(.28,.57,.68),bands*.55+turbulence*.25);
  float clouds = smoothstep(.63,.88,noise3(n*14.0+vec3(4.0)));
  color = mix(color,vec3(.62,.77,.8),clouds*.45);
  float daylight = smoothstep(-.16,.8,dot(n,normalize(vec3(-1.0,.7,1.2))));
  gl_FragColor = vec4(color*(.025+daylight*.95),1.0);
}`;

function NebulaSky({ reducedMotion }: { reducedMotion: boolean }) {
  const { gl, camera } = useThree();
  const shell = useRef<THREE.Mesh>(null);
  const target = useMemo(() => new THREE.WebGLRenderTarget(2048, 1024, {
    type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
  }), []);
  useLayoutEffect(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: nebulaFragment,
      depthWrite: false, depthTest: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const sky = new THREE.Scene();
    sky.add(new THREE.Mesh(geometry, material));
    const previousTarget = gl.getRenderTarget();
    const previousXr = gl.xr.enabled;
    gl.xr.enabled = false;
    try {
      gl.setRenderTarget(target);
      gl.render(sky, new THREE.Camera());
    } finally { gl.setRenderTarget(previousTarget); gl.xr.enabled = previousXr; }
    target.texture.wrapS = THREE.RepeatWrapping;
    geometry.dispose(); material.dispose();
    return () => target.dispose();
  }, [gl, target]);
  useFrame((_, delta) => {
    if (!shell.current) return;
    shell.current.position.copy(camera.position);
    if (!reducedMotion) shell.current.rotation.y += Math.min(delta, .05) * .0012;
  });
  return <mesh ref={shell} renderOrder={-1000} rotation={[.1, .4, -.2]} frustumCulled={false}>
    <sphereGeometry args={[2100, 64, 32]}/>
    <meshBasicMaterial map={target.texture} side={THREE.BackSide} depthWrite={false} depthTest={false}/>
  </mesh>;
}

export function SpaceEnvironment({ reducedMotion }: { reducedMotion: boolean }) {
  const surroundings = useRef<THREE.Group>(null);
  const stars = useMemo(() => {
    let seed = 7421;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const positions = [], colors = [];
    for (let i = 0; i < 6500; i++) {
      const y = rand() * 2 - 1, angle = rand() * Math.PI * 2;
      const distance = 450 + rand() * 1200, r = Math.sqrt(1 - y * y);
      positions.push(Math.cos(angle) * r * distance, y * distance, Math.sin(angle) * r * distance);
      const brightness = .2 + Math.pow(rand(), 3) * .8;
      colors.push(brightness * .82, brightness * .91, brightness);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }, []);
  useEffect(() => () => stars.dispose(), [stars]);
  useFrame((_, delta) => {
    if (!reducedMotion && surroundings.current) surroundings.current.rotation.y += Math.min(delta, .05) * .0012;
  });
  return <>
    <NebulaSky reducedMotion={reducedMotion}/>
    <group ref={surroundings} name="orbital-surroundings">
    <points geometry={stars}>
      <shaderMaterial vertexColors transparent depthWrite={false}
        vertexShader={`varying vec3 vColor; void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=1.2+color.b*1.6;}`}
        fragmentShader={`varying vec3 vColor;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(vColor,1.-smoothstep(.12,.5,r));}`}/>
    </points>
    <group position={[-115, -140, -180]} rotation={[.15, 0, -.35]} name="ice-planet">
      <mesh>
        <sphereGeometry args={[48, 96, 64]}/>
        <shaderMaterial vertexShader={vertex} fragmentShader={planetFragment}/>
      </mesh>
      <mesh scale={1.018}>
        <sphereGeometry args={[48, 64, 48]}/>
        <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending}
          vertexShader={`varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`}
          fragmentShader={`varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-max(0.,dot(normalize(n),normalize(v))),4.);gl_FragColor=vec4(.16,.6,1.,rim*.55);}`}/>
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[62, 87, 160]}/>
        <shaderMaterial transparent side={THREE.DoubleSide} depthWrite={false}
          vertexShader={vertex}
          fragmentShader={`varying vec3 vPosition;void main(){float r=length(vPosition.xy);float lines=.45+.3*sin(r*7.)+.15*sin(r*23.);float edge=smoothstep(62.,64.,r)*(1.-smoothstep(83.,87.,r));gl_FragColor=vec4(.35,.52,.63,lines*edge*.32);}`}/>
      </mesh>
    </group>
  </group></>;
}
