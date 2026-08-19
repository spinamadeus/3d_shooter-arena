import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { resolveCircle } from "./collision.js";

const RADIUS = 0.42;
const WALK = 8.2;
const SPRINT = 12.4;
const GRAVITY = 22;
const JUMP = 8.2;
const EYE = 1.65;
const FIRE_GAP = 0.14;
const DAMAGE = 22;
const HEAD_BONUS = 14;

export function createPlayer(camera, canvas, spawn) {
  const controls = new PointerLockControls(camera, canvas);
  const velocity = new THREE.Vector3();
  const keys = new Set();
  let vy = 0;
  let grounded = true;
  let health = 100;
  let cooldown = 0;
  let hurtFlash = 0;

  const gun = buildGun();
  camera.add(gun.group);

  const onDown = (e) => keys.add(e.code);
  const onUp = (e) => keys.delete(e.code);
  document.addEventListener("keydown", onDown);
  document.addEventListener("keyup", onUp);

  function reset(pos = spawn) {
    health = 100;
    vy = 0;
    grounded = true;
    velocity.set(0, 0, 0);
    controls.getObject().position.copy(pos);
    camera.rotation.set(0, 0, 0);
  }

  reset();

  return {
    controls,
    camera,
    gun,
    get position() {
      return controls.getObject().position;
    },
    get health() {
      return health;
    },
    get hurtFlash() {
      return hurtFlash;
    },
    lock() {
      controls.lock();
    },
    unlock() {
      controls.unlock();
    },
    reset,
    takeDamage(amount) {
      health = Math.max(0, health - amount);
      hurtFlash = 1;
      return health <= 0;
    },
    update(dt, playing) {
      cooldown = Math.max(0, cooldown - dt);
      hurtFlash = Math.max(0, hurtFlash - dt * 2.4);
      gun.update(dt);

      if (!playing) return;

      const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
      const speed = sprint ? SPRINT : WALK;
      const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
      const right = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);

      velocity.x = 0;
      velocity.z = 0;
      if (forward) controls.moveForward(forward * speed * dt);
      if (right) controls.moveRight(right * speed * dt);

      if ((keys.has("Space") || keys.has("Spacebar")) && grounded) {
        vy = JUMP;
        grounded = false;
      }

      vy -= GRAVITY * dt;
      const obj = controls.getObject();
      obj.position.y += vy * dt;
      if (obj.position.y <= EYE) {
        obj.position.y = EYE;
        vy = 0;
        grounded = true;
      }

      const resolved = resolveCircle(obj.position.x, obj.position.z, RADIUS);
      obj.position.x = resolved.x;
      obj.position.z = resolved.z;
    },
    tryShoot() {
      if (cooldown > 0) return null;
      cooldown = FIRE_GAP;
      gun.kick();
      const origin = new THREE.Vector3();
      const dir = new THREE.Vector3();
      camera.getWorldPosition(origin);
      camera.getWorldDirection(dir);
      return { origin, dir, damage: DAMAGE, headBonus: HEAD_BONUS };
    },
  };
}

function buildGun() {
  const group = new THREE.Group();
  group.position.set(0.28, -0.28, -0.55);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1a222c, metalness: 0.7, roughness: 0.3 })
  );
  group.add(body);

  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x39f3ff, emissive: 0x39f3ff, emissiveIntensity: 0.7 })
  );
  barrel.position.set(0, 0.04, -0.38);
  group.add(barrel);

  const mag = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x10141a })
  );
  mag.position.set(0, -0.12, 0.05);
  group.add(mag);

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8 })
  );
  flash.position.set(0, 0.04, -0.62);
  flash.visible = false;
  group.add(flash);

  const rest = group.position.clone();
  let kick = 0;
  let flashT = 0;

  return {
    group,
    kick() {
      kick = 1;
      flashT = 0.05;
    },
    update(dt) {
      kick = Math.max(0, kick - dt * 8);
      flashT = Math.max(0, flashT - dt);
      flash.visible = flashT > 0;
      group.position.z = rest.z + kick * 0.08;
      group.rotation.x = kick * 0.08;
    },
  };
}
