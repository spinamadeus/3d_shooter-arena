import * as THREE from "three";
import { resolveCircle, losBlocked } from "./collision.js";

const RADIUS = 0.45;
const SPEED = 6.4;
const STRAFE = 4.2;
const FIRE_GAP = 0.38;
const DAMAGE = 14;

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

function mat(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extras.roughness ?? 0.72,
    metalness: extras.metalness ?? 0.05,
    emissive: extras.emissive ?? 0x000000,
    emissiveIntensity: extras.emissiveIntensity ?? 0,
  });
}

function addCast(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Pivô na junta; cápsula cresce para baixo no eixo Y. */
function limb(length, radius, material) {
  const pivot = new THREE.Group();
  const mesh = addCast(new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material));
  mesh.position.y = -length / 2 - radius * 0.15;
  pivot.add(mesh);
  return { pivot, mesh };
}

function buildHuman() {
  const skin = mat(0xc49a78, { roughness: 0.62 });
  const skinDark = mat(0xa87b5c, { roughness: 0.65 });
  const hair = mat(0x1c1410, { roughness: 0.85 });
  const shirt = mat(0x2a3140, { roughness: 0.55, metalness: 0.12 });
  const vest = mat(0x1a1e28, { roughness: 0.48, metalness: 0.22, emissive: 0x3a0814, emissiveIntensity: 0.25 });
  const pants = mat(0x161b24, { roughness: 0.7 });
  const boot = mat(0x0d0f14, { roughness: 0.45, metalness: 0.2 });
  const gunMetal = mat(0x2a323c, { roughness: 0.32, metalness: 0.7 });
  const gunGlow = mat(0xff2d6a, { emissive: 0xff2d6a, emissiveIntensity: 1.6, metalness: 0.4, roughness: 0.3 });
  const white = mat(0xf2efe8, { roughness: 0.35 });
  const iris = mat(0x2a1a14, { roughness: 0.25 });

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.98;
  root.add(hips);

  const pelvis = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), pants));
  pelvis.scale.set(1.35, 0.7, 0.95);
  hips.add(pelvis);

  const torsoPivot = new THREE.Group();
  hips.add(torsoPivot);

  const abdomen = addCast(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.18, 4, 10), shirt));
  abdomen.position.y = 0.18;
  torsoPivot.add(abdomen);

  const chest = addCast(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.28, 6, 12), vest));
  chest.position.y = 0.48;
  chest.scale.set(1.15, 1, 0.85);
  torsoPivot.add(chest);

  const collar = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.22), shirt));
  collar.position.y = 0.68;
  torsoPivot.add(collar);

  const neck = addCast(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 10), skin));
  neck.position.y = 0.76;
  torsoPivot.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.92;
  torsoPivot.add(headPivot);

  const head = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 16), skin));
  head.scale.set(0.92, 1.05, 0.95);
  headPivot.add(head);

  const hairCap = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hair));
  hairCap.position.y = 0.04;
  hairCap.scale.set(1.02, 1.05, 1.05);
  headPivot.add(hairCap);

  const bangs = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.08), hair));
  bangs.position.set(0, 0.08, 0.1);
  bangs.rotation.x = -0.35;
  headPivot.add(bangs);

  for (const side of [-1, 1]) {
    const ear = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), skinDark));
    ear.position.set(0.125 * side, 0.0, 0);
    ear.scale.set(0.55, 1, 0.7);
    headPivot.add(ear);

    const brow = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.018, 0.02), hair));
    brow.position.set(0.045 * side, 0.04, 0.11);
    brow.rotation.z = -0.15 * side;
    headPivot.add(brow);

    const eyeWhite = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), white));
    eyeWhite.position.set(0.042 * side, 0.015, 0.115);
    eyeWhite.scale.set(1, 0.7, 0.5);
    headPivot.add(eyeWhite);

    const pupil = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), iris));
    pupil.position.set(0.042 * side, 0.015, 0.13);
    headPivot.add(pupil);
  }

  const nose = addCast(new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 6), skinDark));
  nose.position.set(0, -0.01, 0.13);
  nose.rotation.x = Math.PI / 2;
  headPivot.add(nose);

  const mouth = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.012), mat(0x7a3d3d, { roughness: 0.5 })));
  mouth.position.set(0, -0.055, 0.12);
  headPivot.add(mouth);

  const chin = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin));
  chin.position.set(0, -0.1, 0.04);
  chin.scale.set(0.9, 0.55, 0.7);
  headPivot.add(chin);

  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.28 * side, 0.62, 0);
    torsoPivot.add(shoulder);

    const pad = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), vest));
    pad.scale.set(1.1, 0.85, 1);
    shoulder.add(pad);

    const upper = limb(0.28, 0.055, skin);
    shoulder.add(upper.pivot);

    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    upper.pivot.add(elbow);

    const lower = limb(0.26, 0.045, skin);
    elbow.add(lower.pivot);

    const hand = addCast(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin));
    hand.position.y = -0.3;
    elbow.add(hand);

    return { shoulder, upper: upper.pivot, elbow, hand };
  }

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  const gun = new THREE.Group();
  gun.position.set(0.02, -0.02, 0.12);
  gun.rotation.set(-Math.PI / 2, 0, 0);
  rightArm.hand.add(gun);

  const gunBody = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.42), gunMetal));
  gun.add(gunBody);
  const barrel = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.28), gunGlow));
  barrel.position.z = 0.3;
  gun.add(barrel);
  const mag = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.1), gunMetal));
  mag.position.set(0, -0.08, 0.02);
  gun.add(mag);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 0.48);
  gun.add(muzzle);

  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.11 * side, -0.02, 0);
    hips.add(hip);

    const thigh = limb(0.38, 0.075, pants);
    hip.add(thigh.pivot);

    const knee = new THREE.Group();
    knee.position.y = -0.42;
    thigh.pivot.add(knee);

    const shin = limb(0.36, 0.06, pants);
    knee.add(shin.pivot);

    const foot = addCast(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.22), boot));
    foot.position.set(0, -0.4, 0.05);
    knee.add(foot);

    return { hip, thigh: thigh.pivot, knee };
  }

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  const bodyHit = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.85, 4, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  bodyHit.position.y = 1.12;
  root.add(bodyHit);

  return {
    root,
    hips,
    torsoPivot,
    head,
    chest,
    bodyHit,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    muzzle,
    vest,
    skin,
  };
}

export function createBot(scene, spawn) {
  const human = buildHuman();
  const root = human.root;
  root.position.copy(spawn);
  scene.add(root);

  const hitBoxes = { torso: human.bodyHit, head: human.head };

  let health = 100;
  let cooldown = 0;
  let waypoint = 0;
  let strafeSign = 1;
  let strafeTimer = 0;
  let hitFlash = 0;
  let alive = true;
  let walkPhase = 0;
  const aim = new THREE.Vector3();
  const muzzleWorld = new THREE.Vector3();
  const muzzleDir = new THREE.Vector3();

  function poseIdle() {
    human.leftArm.upper.rotation.set(0.15, 0, 0.12);
    human.rightArm.upper.rotation.set(-1.15, 0.15, -0.2);
    human.leftArm.elbow.rotation.set(-0.2, 0, 0);
    human.rightArm.elbow.rotation.set(-0.35, 0, 0);
    human.leftLeg.thigh.rotation.set(0.05, 0, 0);
    human.rightLeg.thigh.rotation.set(0.05, 0, 0);
    human.leftLeg.knee.rotation.set(0.08, 0, 0);
    human.rightLeg.knee.rotation.set(0.08, 0, 0);
    human.torsoPivot.rotation.set(0.04, 0, 0);
  }

  poseIdle();

  function reset(pos = spawn) {
    health = 100;
    alive = true;
    cooldown = 0.6;
    walkPhase = 0;
    root.visible = true;
    root.position.copy(pos);
    root.position.y = 0;
    human.vest.emissiveIntensity = 0.25;
    human.skin.emissiveIntensity = 0;
    poseIdle();
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
      human.vest.emissiveIntensity = 0.25 + hitFlash * 2.2;
      human.skin.emissive.setHex(0xff2d6a);
      human.skin.emissiveIntensity = hitFlash * 0.55;

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
        root.rotation.y = Math.atan2(look.x, look.z);
      }

      const speedNow = move.length();
      const moving = speedNow > 0.4;
      if (moving) walkPhase += dt * Math.min(12, speedNow * 1.6);
      const swing = moving ? Math.sin(walkPhase) : 0;
      const swingAbs = Math.abs(swing);

      human.leftLeg.thigh.rotation.x = swing * 0.7;
      human.rightLeg.thigh.rotation.x = -swing * 0.7;
      human.leftLeg.knee.rotation.x = swing > 0 ? swingAbs * 0.55 : 0.1;
      human.rightLeg.knee.rotation.x = swing < 0 ? swingAbs * 0.55 : 0.1;
      human.hips.position.y = 0.98 + (moving ? Math.abs(Math.sin(walkPhase * 2)) * 0.03 : 0);

      human.leftArm.upper.rotation.x = 0.12 + (moving ? -swing * 0.45 : 0);
      human.leftArm.elbow.rotation.x = -0.25;
      human.rightArm.upper.rotation.set(canSee ? -1.25 : -0.9 + swing * 0.2, 0.12, -0.18);
      human.rightArm.elbow.rotation.x = canSee ? -0.2 : -0.4;
      human.torsoPivot.rotation.x = canSee ? 0.08 : 0.03;
      human.torsoPivot.rotation.y = moving ? swing * 0.06 : 0;

      if (canSee && cooldown <= 0 && dist < 34) {
        cooldown = FIRE_GAP + Math.random() * 0.12;
        human.muzzle.getWorldPosition(muzzleWorld);
        human.muzzle.getWorldDirection(muzzleDir);
        const target = playerPos.clone();
        target.y += 1.35;
        const spread = 0.04 + dist * 0.0018;
        target.x += (Math.random() - 0.5) * spread * dist;
        target.y += (Math.random() - 0.5) * spread * 4;
        target.z += (Math.random() - 0.5) * spread * dist;
        const dir = target.sub(muzzleWorld).normalize();
        return { origin: muzzleWorld.clone(), dir, damage: DAMAGE };
      }
      return null;
    },
  };
}
