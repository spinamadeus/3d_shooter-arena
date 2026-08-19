import * as THREE from "three";
import { resolveCircle, losBlocked } from "./collision.js";

const RADIUS = 0.55;
const SPEED = 6.4;
const STRAFE = 4.2;
const FIRE_GAP = 0.38;
const DAMAGE = 14;
const HEIGHT = 1.55;

const WAYPOINTS = [
  new THREE.Vector3(18, 0, 18),
  new THREE.Vector3(-18, 0, 18),
  new THREE.Vector3(-18, 0, -18),
  new THREE.Vector3(18, 0, -18),
  new THREE.Vector3(0, 0, -22),
  new THREE.Vector3(22, 0, 0),
  new THREE.Vector3(-22, 0, 0),
  new THREE.Vector3(10, 0, -8),
];

export function createBot(scene, spawn) {
  const root = new THREE.Group();
  root.position.copy(spawn);
  scene.add(root);

  const mats = {
    body: new THREE.MeshStandardMaterial({
      color: 0x1a0e14,
      metalness: 0.55,
      roughness: 0.35,
      emissive: 0x3a0814,
      emissiveIntensity: 0.5,
    }),
    glow: new THREE.MeshStandardMaterial({
      color: 0xff2d6a,
      emissive: 0xff2d6a,
      emissiveIntensity: 2.2,
    }),
    visor: new THREE.MeshStandardMaterial({
      color: 0xff6b9a,
      emissive: 0xff2d6a,
      emissiveIntensity: 3,
    }),
  };

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.85, 6, 12), mats.body);
  torso.position.y = 1.05;
  torso.castShadow = true;
  root.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), mats.body);
  head.position.y = 1.82;
  head.castShadow = true;
  root.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.12), mats.visor);
  visor.position.set(0, 1.84, 0.22);
  root.add(visor);

  const core = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.08), mats.glow);
  core.position.set(0, 1.1, 0.34);
  root.add(core);

  const hitBoxes = { torso, head };

  let health = 100;
  let cooldown = 0;
  let waypoint = 0;
  let strafeSign = 1;
  let strafeTimer = 0;
  let hitFlash = 0;
  let alive = true;
  const aim = new THREE.Vector3();

  function reset(pos = spawn) {
    health = 100;
    alive = true;
    cooldown = 0.6;
    root.visible = true;
    root.position.copy(pos);
    root.position.y = 0;
    mats.body.emissiveIntensity = 0.5;
  }

  return {
    root,
    hitBoxes,
    get position() {
      return root.position;
    },
    get health() {
      return health;
    },
    get alive() {
      return alive;
    },
    reset,
    takeDamage(amount) {
      if (!alive) return false;
      health = Math.max(0, health - amount);
      hitFlash = 1;
      if (health <= 0) {
        alive = false;
        root.visible = false;
        return true;
      }
      return false;
    },
    update(dt, playerPos, playing) {
      cooldown = Math.max(0, cooldown - dt);
      hitFlash = Math.max(0, hitFlash - dt * 5);
      mats.body.emissiveIntensity = 0.5 + hitFlash * 2.5;

      if (!playing || !alive) return null;

      const toPlayer = new THREE.Vector3().subVectors(playerPos, root.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      const canSee =
        dist < 48 &&
        !losBlocked(root.position.x, root.position.z, playerPos.x, playerPos.z, 0.35);

      strafeTimer -= dt;
      if (strafeTimer <= 0) {
        strafeSign *= -1;
        strafeTimer = 0.6 + Math.random() * 0.9;
      }

      let move = new THREE.Vector3();

      if (canSee) {
        aim.copy(playerPos);
        if (dist > 16) {
          move.copy(toPlayer).normalize().multiplyScalar(SPEED);
        } else if (dist < 7) {
          move.copy(toPlayer).normalize().multiplyScalar(-SPEED * 0.7);
        } else {
          const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
          move.copy(side).multiplyScalar(STRAFE * strafeSign);
        }
      } else {
        const wp = WAYPOINTS[waypoint];
        const toWp = new THREE.Vector3(wp.x - root.position.x, 0, wp.z - root.position.z);
        if (toWp.length() < 2.2) waypoint = (waypoint + 1) % WAYPOINTS.length;
        move.copy(toWp).normalize().multiplyScalar(SPEED * 0.85);
      }

      const next = resolveCircle(
        root.position.x + move.x * dt,
        root.position.z + move.z * dt,
        RADIUS
      );
      root.position.x = next.x;
      root.position.z = next.z;

      const look = canSee ? toPlayer : move;
      if (look.lengthSq() > 0.01) {
        const yaw = Math.atan2(look.x, look.z);
        root.rotation.y = yaw;
      }

      torso.position.y = 1.05 + Math.sin(performance.now() * 0.008) * 0.03;

      if (canSee && cooldown <= 0 && dist < 34) {
        cooldown = FIRE_GAP + Math.random() * 0.12;
        const origin = new THREE.Vector3(
          root.position.x,
          HEIGHT + 0.2,
          root.position.z
        );
        const target = playerPos.clone();
        target.y += 1.35;
        const spread = 0.04 + dist * 0.0018;
        target.x += (Math.random() - 0.5) * spread * dist;
        target.y += (Math.random() - 0.5) * spread * 4;
        target.z += (Math.random() - 0.5) * spread * dist;
        const dir = target.sub(origin).normalize();
        return { origin, dir, damage: DAMAGE };
      }
      return null;
    },
  };
}
