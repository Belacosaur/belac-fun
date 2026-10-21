// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { AnimationMixer, Box3, Group, LoopOnce, Mesh, SkinnedMesh, Triangle, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { chairSeat, robotIdleBob, robotSeatedPosition } from "./seat-fit";

describe("the seated robot's chair clearance", () => {
  it("keeps both complete leg meshes outside the cushion, including idle movement", async () => {
    const bytes = await readFile(new URL("../../public/station/robot.glb", import.meta.url));
    const { scene, animations } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const robot = new Group();
    robot.position.fromArray(robotSeatedPosition);
    robot.scale.setScalar(.5);
    robot.add(scene);
    const mixer = new AnimationMixer(scene);
    const clip = animations.find((item) => item.name === "Sitting")!;
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    mixer.update(clip.duration);
    // Expanding by the idle bob tests the full vertical motion envelope.
    // Cushion and robot share the same swivel, so this clearance is rotation invariant.
    const cushion = new Box3().setFromCenterAndSize(new Vector3(...chairSeat.position), new Vector3(...chairSeat.size));
    cushion.min.y -= robotIdleBob;
    cushion.max.y += robotIdleBob;
    robot.updateMatrixWorld(true);
    const collisions: string[] = [];
    let checkedMeshes = 0;
    scene.traverse((node) => {
      if (!(node instanceof Mesh) || !/^(Leg[LR]|LowerLeg[LR]_1)$/.test(node.name)) return;
      checkedMeshes++;
      if (node instanceof SkinnedMesh) node.skeleton.update();
      const geometry = node.geometry;
      const index = geometry.index;
      const count = index?.count ?? geometry.attributes.position!.count;
      for (let i = 0; i < count; i += 3) {
        const points = [i, i + 1, i + 2].map((j) => node.getVertexPosition(index ? index.getX(j) : j, new Vector3()).applyMatrix4(node.matrixWorld));
        if (cushion.intersectsTriangle(new Triangle(points[0]!, points[1]!, points[2]!))) {
          collisions.push(node.name);
          break;
        }
      }
    });
    expect(checkedMeshes).toBe(4);
    expect(collisions, "Leg triangles penetrate the cushion").toEqual([]);
    const hips = scene.getObjectByName("Hips")!.getWorldPosition(new Vector3());
    expect(hips.y - cushion.max.y, "The pelvis should remain seated close to the cushion").toBeGreaterThanOrEqual(0);
    expect(hips.y - cushion.max.y).toBeLessThan(.05);
    mixer.stopAllAction();
  });
});
