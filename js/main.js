import * as THREE from "three";
import { buildArena, createImpact, createTracer } from "./arena.js";
import { createPlayer } from "./player.js";
import { createBot } from "./bot.js";
import { resumeAudio, sfx } from "./audio.js";

const SCORE_LIMIT = 5;
const canvas = document.querySelector("#viewport");
const hud = document.querySelector("#hud");
const menu = document.querySelector("#menu");
const pause = document.querySelector("#pause");
const result = document.querySelector("#result");
const resultTitle = document.querySelector("#result-title");
const resultSub = document.querySelector("#result-sub");
const clockEl = document.querySelector("#clock");
const scorePlayerEl = document.querySelector("#score-player");
const scoreBotEl = document.querySelector("#score-bot");
const hpPlayerBar = document.querySelector("#hp-player");
const hpBotBar = document.querySelector("#hp-bot");
const hpPlayerNum = document.querySelector("#hp-player-num");
const hpBotNum = document.querySelector("#hp-bot-num");
const crosshair = document.querySelector("#crosshair");
const hitMarker = document.querySelector("#hit-marker");
const vignette = document.querySelector("#damage-vignette");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 200);
const arena = buildArena(scene);
const player = createPlayer(camera, canvas, arena.spawnPlayer);
scene.add(player.controls.getObject());

const bot = createBot(scene, arena.spawnBot);
const impact = createImpact(scene);
const playerTracer = createTracer(scene);
const botTracer = createTracer(scene);

const raycaster = new THREE.Raycaster();
const shootables = [bot.hitBoxes.torso, bot.hitBoxes.head];
const worldBoxes = [];
scene.traverse((obj) => {
  if (obj.isMesh && obj.userData.world) worldBoxes.push(obj);
});

const playerHit = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.42, 1.15, 4, 8),
  new THREE.MeshBasicMaterial({ visible: false })
);
playerHit.position.y = 1.05;
scene.add(playerHit);

let state = "menu";
let score = { player: 0, bot: 0 };
let elapsed = 0;
let respawnTimer = 0;
let last = performance.now();

player.controls.addEventListener("lock", () => {
  if (state === "menu" || state === "pause") beginPlay();
});

player.controls.addEventListener("unlock", () => {
  if (state === "playing") {
    state = "pause";
    pause.classList.remove("hidden");
  }
});

document.querySelector("#btn-start").addEventListener("click", () => {
  resumeAudio();
  startMatch();
  player.lock();
});

document.querySelector("#btn-resume").addEventListener("click", () => {
  player.lock();
});

document.querySelector("#btn-restart").addEventListener("click", () => {
  resumeAudio();
  startMatch();
  player.lock();
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (state === "menu" || state === "pause" || state === "result") {
    if (state === "result") startMatch();
    resumeAudio();
    player.lock();
    return;
  }
  if (state !== "playing" || player.health <= 0) return;
  firePlayer();
});

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function startMatch() {
  score = { player: 0, bot: 0 };
  elapsed = 0;
  respawnTimer = 0;
  player.reset(arena.spawnPlayer.clone());
  bot.reset(arena.spawnBot.clone());
  menu.classList.add("hidden");
  pause.classList.add("hidden");
  result.classList.add("hidden");
  hud.classList.remove("hidden");
  updateHud();
}

function beginPlay() {
  pause.classList.add("hidden");
  menu.classList.add("hidden");
  if (state !== "result") state = "playing";
}

function endMatch(playerWon) {
  state = "result";
  player.unlock();
  hud.classList.add("hidden");
  result.classList.remove("hidden");
  resultTitle.textContent = playerWon ? "VITÓRIA" : "DERROTA";
  resultTitle.className = playerWon ? "win" : "lose";
  resultSub.textContent = `${score.player} — ${score.bot}`;
  if (playerWon) sfx.win();
  else sfx.lose();
}

function firePlayer() {
  const shot = player.tryShoot();
  if (!shot) return;
  sfx.shoot();

  raycaster.set(shot.origin, shot.dir);
  raycaster.far = 80;

  const botHits = bot.alive ? raycaster.intersectObjects(shootables, false) : [];
  const worldHits = raycaster.intersectObjects(worldBoxes, false);
  const botHit = botHits[0];
  const worldHit = worldHits[0];

  let end = shot.origin.clone().add(shot.dir.clone().multiplyScalar(70));
  if (worldHit && (!botHit || worldHit.distance < botHit.distance)) {
    end = worldHit.point;
    impact.burst(end);
  } else if (botHit) {
    end = botHit.point;
    impact.burst(end);
    const head = botHit.object === bot.hitBoxes.head;
    const dmg = shot.damage + (head ? shot.headBonus : 0);
    const killed = bot.takeDamage(dmg);
    flashHit();
    sfx.hit();
    if (killed) {
      score.player += 1;
      sfx.kill();
      respawnTimer = 1.6;
      if (score.player >= SCORE_LIMIT) endMatch(true);
    }
  }
  playerTracer.fire(shot.origin.clone().add(shot.dir.clone().multiplyScalar(0.6)), end, 0x9dfff8);
  updateHud();
}

function fireBot(shot) {
  raycaster.set(shot.origin, shot.dir);
  raycaster.far = 80;
  const worldHits = raycaster.intersectObjects(worldBoxes, false);
  const playerHits = raycaster.intersectObject(playerHit, false);
  const playerHitPt = playerHits[0];
  const worldHit = worldHits[0];

  let end = shot.origin.clone().add(shot.dir.clone().multiplyScalar(60));
  if (playerHitPt && (!worldHit || playerHitPt.distance < worldHit.distance)) {
    end = playerHitPt.point;
    const dead = player.takeDamage(shot.damage);
    sfx.hurt();
    if (dead) {
      score.bot += 1;
      sfx.kill();
      respawnTimer = 1.6;
      if (score.bot >= SCORE_LIMIT) endMatch(false);
    }
  } else if (worldHit) {
    end = worldHit.point;
    impact.burst(end);
  }
  botTracer.fire(shot.origin, end, 0xff2d6a);
  updateHud();
}

function flashHit() {
  crosshair.classList.add("hit");
  hitMarker.classList.add("show");
  setTimeout(() => {
    crosshair.classList.remove("hit");
    hitMarker.classList.remove("show");
  }, 120);
}

function updateHud() {
  scorePlayerEl.textContent = String(score.player);
  scoreBotEl.textContent = String(score.bot);
  hpPlayerBar.style.transform = `scaleX(${player.health / 100})`;
  hpBotBar.style.transform = `scaleX(${bot.health / 100})`;
  hpPlayerNum.textContent = String(Math.ceil(player.health));
  hpBotNum.textContent = String(Math.ceil(bot.alive ? bot.health : 0));
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60);
  clockEl.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const playing = state === "playing";
  if (playing) elapsed += dt;

  if (playing && respawnTimer > 0) {
    respawnTimer -= dt;
    if (respawnTimer <= 0) {
      if (player.health <= 0) {
        player.reset(new THREE.Vector3((Math.random() - 0.5) * 20, 1.65, 26));
      }
      if (!bot.alive) {
        bot.reset(new THREE.Vector3((Math.random() - 0.5) * 18, 0, -24));
      }
      updateHud();
    }
  }

  player.update(dt, playing && player.health > 0);
  playerHit.position.set(player.position.x, 1.05, player.position.z);
  const botShot =
    playing && bot.alive && player.health > 0
      ? bot.update(dt, player.position, true)
      : bot.update(dt, player.position, false);
  if (botShot) fireBot(botShot);

  impact.update(dt);
  playerTracer.update(dt);
  botTracer.update(dt);

  vignette.classList.toggle("active", player.hurtFlash > 0.15);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
