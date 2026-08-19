import * as THREE from "three";
import { addBoxCollider } from "./collision.js";

const ARENA = 42;
const WALL_H = 8;

function neonMat(color, emissive, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 1.4,
    roughness: 0.35,
    metalness: 0.55,
    transparent: opacity < 1,
    opacity,
  });
}

function box(scene, w, h, d, x, y, z, mat, collide = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.world = true;
  scene.add(mesh);
  if (collide) addBoxCollider(x, z, w, d);
  return mesh;
}

export function buildArena(scene) {
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.Fog(0x05070d, 18, 72);

  const hemi = new THREE.HemisphereLight(0x4aa0c8, 0x08060c, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xc8e8ff, 1.1);
  key.position.set(16, 28, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 80;
  key.shadow.camera.left = -40;
  key.shadow.camera.right = 40;
  key.shadow.camera.top = 40;
  key.shadow.camera.bottom = -40;
  scene.add(key);

  scene.add(new THREE.PointLight(0x39f3ff, 18, 40, 1.6).translateX(0).translateY(6).translateZ(0));
  const magenta = new THREE.PointLight(0xff2d6a, 16, 36, 1.4);
  magenta.position.set(-16, 5, -16);
  scene.add(magenta);
  const amber = new THREE.PointLight(0xffb020, 10, 28, 1.6);
  amber.position.set(18, 4, 14);
  scene.add(amber);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x121722,
    roughness: 0.85,
    metalness: 0.2,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.world = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(ARENA * 2, 42, 0x16485a, 0x0c1c28);
  grid.position.y = 0.02;
  scene.add(grid);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x151a24,
    roughness: 0.7,
    metalness: 0.35,
  });
  const trim = neonMat(0x082028, 0x39f3ff);

  box(scene, ARENA * 2, WALL_H, 1.4, 0, WALL_H / 2, -ARENA, wallMat);
  box(scene, ARENA * 2, WALL_H, 1.4, 0, WALL_H / 2, ARENA, wallMat);
  box(scene, 1.4, WALL_H, ARENA * 2, -ARENA, WALL_H / 2, 0, wallMat);
  box(scene, 1.4, WALL_H, ARENA * 2, ARENA, WALL_H / 2, 0, wallMat);

  box(scene, ARENA * 2, 0.18, 0.18, 0, 0.2, -ARENA + 0.8, trim, false);
  box(scene, ARENA * 2, 0.18, 0.18, 0, 0.2, ARENA - 0.8, trim, false);

  const concrete = new THREE.MeshStandardMaterial({
    color: 0x1c2430,
    roughness: 0.62,
    metalness: 0.28,
  });
  const accent = neonMat(0x2a0812, 0xff2d6a);

  const covers = [
    [0, 2.2, 0, 4.4, 4.4, 4.4],
    [14, 1.4, 10, 5, 2.8, 2.2],
    [-14, 1.4, -10, 5, 2.8, 2.2],
    [12, 1.8, -14, 2.4, 3.6, 6],
    [-12, 1.8, 14, 2.4, 3.6, 6],
    [0, 1.1, 22, 8, 2.2, 2],
    [0, 1.1, -22, 8, 2.2, 2],
    [24, 1.2, 0, 2, 2.4, 9],
    [-24, 1.2, 0, 2, 2.4, 9],
    [8, 0.9, 6, 3.2, 1.8, 1.4],
    [-8, 0.9, -6, 3.2, 1.8, 1.4],
  ];

  for (const [x, y, z, w, h, d] of covers) {
    box(scene, w, h, d, x, y, z, concrete);
    box(scene, w + 0.05, 0.12, d + 0.05, x, y + h / 2, z, accent, false);
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(6.5, 6.7, 48),
    new THREE.MeshBasicMaterial({ color: 0x39f3ff, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  scene.add(ring);

  return {
    half: ARENA,
    spawnPlayer: new THREE.Vector3(0, 1.65, 28),
    spawnBot: new THREE.Vector3(0, 0, -26),
  };
}

export function createImpact(scene) {
  const geo = new THREE.SphereGeometry(0.08, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  scene.add(mesh);
  let life = 0;

  return {
    burst(point) {
      mesh.position.copy(point);
      mesh.visible = true;
      mesh.scale.setScalar(1);
      life = 0.18;
    },
    update(dt) {
      if (!mesh.visible) return;
      life -= dt;
      mesh.scale.multiplyScalar(1 + dt * 8);
      if (life <= 0) mesh.visible = false;
    },
  };
}

export function createTracer(scene) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(0, 0, -1),
  ]);
  const mat = new THREE.LineBasicMaterial({ color: 0x9dfff8, transparent: true, opacity: 0 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  let life = 0;

  return {
    fire(from, to, color = 0x9dfff8) {
      const pos = line.geometry.attributes.position;
      pos.setXYZ(0, from.x, from.y, from.z);
      pos.setXYZ(1, to.x, to.y, to.z);
      pos.needsUpdate = true;
      mat.color.setHex(color);
      mat.opacity = 0.9;
      life = 0.08;
    },
    update(dt) {
      if (life <= 0) {
        mat.opacity = 0;
        return;
      }
      life -= dt;
      mat.opacity = Math.max(0, life / 0.08);
    },
  };
}
