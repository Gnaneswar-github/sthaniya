import * as THREE from "three";
import type { Chapter, WorldState } from "./chapters";

/**
 * World bible — the rules every object in this scene follows.
 *
 * Scale: 1 unit ≈ 1 metre. One island, ~140 m radius with a ~35 m peak, in open sea.
 * Silhouette: soft low-poly, flat-shaded, rounded proportions. Nothing photoreal and nothing
 * that reads as one real city — it is anywhere a traveller might want to belong.
 * Palette: the site's own tokens. Sea-blue sky and water, whitewashed walls, terracotta and
 * teal roofs, brand-green and gold awnings, warm practical light.
 * Lighting roles: key = sun or moon (one directional light), fill = hemisphere, practicals =
 * emissive windows, lanterns and the lighthouse lamp. No shadow maps.
 * Atmosphere: exponential fog tinted to the horizon so sea meets sky without a seam; stars and
 * lantern glow at night, birds by day.
 * Motion: scroll moves the camera and the time of day. Ambient loops (sea, boats, birds, beam)
 * stay small and stop entirely under reduced motion.
 *
 * Everything is generated here — no downloaded models or textures.
 */

export type WorldHandle = {
  /** `progress` is fractional chapter progress; `dt` is 0 when ambient motion should freeze. */
  update: (progress: number, dt: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
};

const ISLAND_RADIUS = 150;
const PEAK = 40;
const LIGHTHOUSE = { x: -18, z: -14 };
const MOON_DIR = new THREE.Vector3(-0.5, 0.45, -0.74).normalize();

type NumericKey = { [K in keyof WorldState]: WorldState[K] extends number ? K : never }[keyof WorldState];

/* ------------------------------------------------------------------ terrain */

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z) / ISLAND_RADIUS;
  const dome = PEAK * Math.pow(Math.max(0, 1 - r * r), 1.35);
  const detail = (valueNoise(x * 0.035, z * 0.035) - 0.5) * 7 * Math.max(0, 1 - r);
  return dome + detail - 4;
}

/** Where the shoreline sits along a bearing, walking inland from the sea. */
function shoreAt(angle: number) {
  for (let rr = ISLAND_RADIUS; rr > 40; rr -= 0.5) {
    if (heightAt(Math.sin(angle) * rr, Math.cos(angle) * rr) >= 0.6) return rr;
  }
  return 120;
}

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,226,170,0.6)");
    gradient.addColorStop(1, "rgba(255,196,110,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sunDirection(elevationDeg: number, azimuthDeg: number) {
  const e = THREE.MathUtils.degToRad(elevationDeg);
  const a = THREE.MathUtils.degToRad(azimuthDeg);
  return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunGlow;
uniform vec3 uMoonDir;
uniform float uMoon;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.35));

  vec3 sun = normalize(uSunDir);
  float s = max(dot(d, sun), 0.0);
  float above = smoothstep(-0.15, 0.04, sun.y);
  col += uSunColor * (pow(s, 6.0) * 0.28 + pow(s, 48.0) * 0.5) * uSunGlow * above;
  col = mix(col, uSunColor * 1.6 + vec3(0.25), smoothstep(0.9991, 0.9996, s) * uSunGlow * above);

  float m = max(dot(d, normalize(uMoonDir)), 0.0);
  col = mix(col, vec3(0.92, 0.94, 1.0), smoothstep(0.9993, 0.9996, m) * uMoon);
  col += vec3(0.5, 0.6, 1.0) * pow(m, 40.0) * 0.15 * uMoon;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/* -------------------------------------------------------------------- world */

export function createWorld(canvas: HTMLCanvasElement, chapters: readonly Chapter[]): WorldHandle | null {
  if (chapters.length < 2) return null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    if (!renderer.getContext()) return null;
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x071c29);

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(0x000000, 0.002);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 4000);
  const rand = mulberry32(20260913);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const glow = glowTexture();
  let aspect = 1;
  let elapsed = 0;

  /* sky, sun, moon, stars ------------------------------------------------- */
  const skyUniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uSunGlow: { value: 0 },
    uMoonDir: { value: MOON_DIR.clone() },
    uMoon: { value: 0 },
  };
  const skyGroup = new THREE.Group();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2000, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  sky.renderOrder = -1;
  skyGroup.add(sky);

  const starPositions: number[] = [];
  for (let i = 0; i < 900; i++) {
    const u = rand() * Math.PI * 2;
    const y = 0.04 + rand() * 0.96;
    const r = Math.sqrt(1 - y * y);
    starPositions.push(Math.cos(u) * r * 1800, y * 1800, Math.sin(u) * r * 1800);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0xdfe6ff,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  skyGroup.add(new THREE.Points(starGeometry, starMaterial));
  scene.add(skyGroup);

  /* lights ---------------------------------------------------------------- */
  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2418, 1);
  const key = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(hemi, key);

  /* sea ------------------------------------------------------------------- */
  const seaTime = { value: 0 };
  const seaMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d4b60,
    roughness: 0.32,
    metalness: 0.08,
    flatShading: true,
  });
  seaMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = seaTime;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  transformed.z += sin(position.x * 0.05 + uTime * 0.9) * 0.5 + cos(position.y * 0.043 - uTime * 0.7) * 0.4;",
    )}`;
  };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 160, 160), seaMaterial);
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);

  /* island ---------------------------------------------------------------- */
  const terrainGeometry = new THREE.PlaneGeometry(ISLAND_RADIUS * 2.4, ISLAND_RADIUS * 2.4, 140, 140);
  terrainGeometry.rotateX(-Math.PI / 2);
  const positions = terrainGeometry.attributes.position;
  const terrainColors: number[] = [];
  const sand = new THREE.Color("#d8c39a");
  const olive = new THREE.Color("#6f8a4e");
  const meadow = new THREE.Color("#8b9b5a");
  const scrub = new THREE.Color("#5b7443");
  const rock = new THREE.Color("#8a8270");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = heightAt(x, z);
    positions.setY(i, y);
    if (y < 1.4) color.copy(sand);
    else if (y < 14) color.copy(olive).lerp(meadow, valueNoise(x * 0.08, z * 0.08));
    else if (y < 29) color.copy(scrub).lerp(olive, valueNoise(x * 0.06, z * 0.06) * 0.5);
    else color.copy(rock).lerp(scrub, valueNoise(x * 0.1, z * 0.1) * 0.4);
    terrainColors.push(color.r, color.g, color.b);
  }
  terrainGeometry.setAttribute("color", new THREE.Float32BufferAttribute(terrainColors, 3));
  terrainGeometry.computeVertexNormals();
  scene.add(
    new THREE.Mesh(
      terrainGeometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    ),
  );

  /* town ------------------------------------------------------------------ */
  type House = { x: number; y: number; z: number; w: number; h: number; d: number; rot: number };
  const houses: House[] = [];
  for (let guard = 0; houses.length < 150 && guard < 5000; guard++) {
    const a = (rand() * 2 - 1) * 1.25;
    const rr = 30 + rand() * 98;
    const x = Math.sin(a) * rr;
    const z = Math.cos(a) * rr;
    const y = heightAt(x, z);
    if (y < 2.2) continue;
    const slope =
      Math.abs(heightAt(x + 3, z) - heightAt(x - 3, z)) + Math.abs(heightAt(x, z + 3) - heightAt(x, z - 3));
    if (slope > 9) continue;
    if (houses.some((house) => Math.hypot(house.x - x, house.z - z) < 7.5)) continue;
    houses.push({ x, y, z, w: 4 + rand() * 3, h: 3.2 + rand() * 3.5, d: 4 + rand() * 2.5, rot: a + (rand() - 0.5) * 0.3 });
  }

  const walls = ["#f3efe6", "#efe3cc", "#e9dcc3", "#e2e8e4", "#f1e6d6"];
  const roofs = ["#b5573a", "#c46a45", "#2e7d74", "#c98f3c", "#a54b36"];

  const bodyGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const bodies = new THREE.InstancedMesh(
    bodyGeometry,
    new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }),
    houses.length,
  );
  const pitchedGeometry = new THREE.ConeGeometry(0.72, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const pitched = houses.filter(() => rand() < 0.55);
  const flat = houses.filter((house) => !pitched.includes(house));
  const pitchedRoofs = new THREE.InstancedMesh(
    pitchedGeometry,
    new THREE.MeshStandardMaterial({ roughness: 0.75, flatShading: true }),
    pitched.length,
  );
  const flatRoofs = new THREE.InstancedMesh(
    bodyGeometry,
    new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }),
    flat.length,
  );

  const windowSlots: { x: number; y: number; z: number; rot: number; lit: boolean }[] = [];
  houses.forEach((house, i) => {
    dummy.position.set(house.x, house.y - 1.2, house.z);
    dummy.rotation.set(0, house.rot, 0);
    dummy.scale.set(house.w, house.h + 1.2, house.d);
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    bodies.setColorAt(i, color.set(walls[Math.floor(rand() * walls.length)]));

    const count = house.w > 5.5 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const ox = count === 2 ? (k === 0 ? -0.25 : 0.25) * house.w : 0;
      const oz = house.d / 2 + 0.03;
      windowSlots.push({
        x: house.x + ox * Math.cos(house.rot) + oz * Math.sin(house.rot),
        y: house.y + house.h * 0.5,
        z: house.z - ox * Math.sin(house.rot) + oz * Math.cos(house.rot),
        rot: house.rot,
        lit: rand() < 0.72,
      });
    }
  });
  pitched.forEach((house, i) => {
    dummy.position.set(house.x, house.y + house.h, house.z);
    dummy.rotation.set(0, house.rot, 0);
    dummy.scale.set(house.w * 1.08, 1.6 + rand() * 1.2, house.d * 1.08);
    dummy.updateMatrix();
    pitchedRoofs.setMatrixAt(i, dummy.matrix);
    pitchedRoofs.setColorAt(i, color.set(roofs[Math.floor(rand() * roofs.length)]));
  });
  flat.forEach((house, i) => {
    dummy.position.set(house.x, house.y + house.h, house.z);
    dummy.rotation.set(0, house.rot, 0);
    dummy.scale.set(house.w * 1.05, 0.35, house.d * 1.05);
    dummy.updateMatrix();
    flatRoofs.setMatrixAt(i, dummy.matrix);
    flatRoofs.setColorAt(i, color.set(walls[Math.floor(rand() * walls.length)]).multiplyScalar(0.92));
  });
  scene.add(bodies, pitchedRoofs, flatRoofs);

  // Practicals are toneMapped: false so they read as light sources, not paint.
  const windowMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  const windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), windowMaterial, windowSlots.length);
  const litColor = new THREE.Color("#ffd08a");
  const unlitColor = new THREE.Color("#4a5a60");
  windowSlots.forEach((slot, i) => {
    dummy.position.set(slot.x, slot.y, slot.z);
    dummy.rotation.set(0, slot.rot, 0);
    dummy.scale.set(0.9, 1.1, 1);
    dummy.updateMatrix();
    windows.setMatrixAt(i, dummy.matrix);
    windows.setColorAt(i, slot.lit ? litColor : unlitColor);
  });
  scene.add(windows);

  /* harbour and market ---------------------------------------------------- */
  const pierAngle = 0.28;
  const pierShore = shoreAt(pierAngle);
  const pierDir = new THREE.Vector3(Math.sin(pierAngle), 0, Math.cos(pierAngle));
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 1, 36),
    new THREE.MeshStandardMaterial({ color: "#9c7a56", roughness: 0.9, flatShading: true }),
  );
  pier.position.copy(pierDir).multiplyScalar(pierShore + 16).setY(0.9);
  pier.rotation.y = pierAngle;
  scene.add(pier);

  const boatCount = 7;
  const boatBase: { x: number; z: number; rot: number; phase: number }[] = [];
  for (let i = 0; i < boatCount; i++) {
    const along = pierShore + 12 + rand() * 38;
    const side = (i % 2 === 0 ? 1 : -1) * (6 + rand() * 10);
    const lateral = new THREE.Vector3(pierDir.z, 0, -pierDir.x).multiplyScalar(side);
    const p = pierDir.clone().multiplyScalar(along).add(lateral);
    boatBase.push({ x: p.x, z: p.z, rot: pierAngle + (rand() - 0.5) * 0.6, phase: rand() * Math.PI * 2 });
  }
  const hulls = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.6, 1.1, 7),
    new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }),
    boatCount,
  );
  const cabins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.8, 1.2, 2.4),
    new THREE.MeshStandardMaterial({ color: "#f3efe6", roughness: 0.7, flatShading: true }),
    boatCount,
  );
  const masts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.08, 0.1, 6, 5),
    new THREE.MeshStandardMaterial({ color: "#4a3a2c", roughness: 0.8 }),
    boatCount,
  );
  const hullColors = ["#2e7d74", "#15795a", "#c46a45", "#35506a", "#e0a63c"];
  for (let i = 0; i < boatCount; i++) hulls.setColorAt(i, color.set(hullColors[i % hullColors.length]));
  scene.add(hulls, cabins, masts);

  function placeBoats() {
    boatBase.forEach((boat, i) => {
      const bob = Math.sin(elapsed * 1.1 + boat.phase) * 0.25;
      const roll = Math.sin(elapsed * 0.9 + boat.phase) * 0.05;
      dummy.rotation.set(0, boat.rot, roll);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(boat.x, 0.35 + bob, boat.z);
      dummy.updateMatrix();
      hulls.setMatrixAt(i, dummy.matrix);
      dummy.position.set(boat.x, 1.4 + bob, boat.z);
      dummy.updateMatrix();
      cabins.setMatrixAt(i, dummy.matrix);
      dummy.position.set(boat.x, 3.8 + bob, boat.z);
      dummy.updateMatrix();
      masts.setMatrixAt(i, dummy.matrix);
    });
    hulls.instanceMatrix.needsUpdate = true;
    cabins.instanceMatrix.needsUpdate = true;
    masts.instanceMatrix.needsUpdate = true;
  }
  placeBoats();

  const stallCount = 9;
  const awnings = new THREE.InstancedMesh(
    new THREE.BoxGeometry(5, 0.25, 3.6),
    new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }),
    stallCount,
  );
  const counters = new THREE.InstancedMesh(
    new THREE.BoxGeometry(4.4, 1.2, 2.4),
    new THREE.MeshStandardMaterial({ color: "#9c7a56", roughness: 0.9, flatShading: true }),
    stallCount,
  );
  const awningColors = ["#15795a", "#e0a63c", "#f3efe6", "#2e7d74", "#c8674a"];
  for (let i = 0; i < stallCount; i++) {
    const a = -0.55 + i * 0.1;
    const rr = shoreAt(a) - 4;
    const x = Math.sin(a) * rr;
    const z = Math.cos(a) * rr;
    const y = Math.max(heightAt(x, z), 0.8);
    dummy.position.set(x, y + 0.6, z);
    dummy.rotation.set(0, a, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    counters.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + 3.3, z + 0.2);
    dummy.rotation.set(0.3, a, 0);
    dummy.updateMatrix();
    awnings.setMatrixAt(i, dummy.matrix);
    awnings.setColorAt(i, color.set(awningColors[i % awningColors.length]));
  }
  scene.add(awnings, counters);

  /* lantern lane ---------------------------------------------------------- */
  const laneBearings: [number, number][] = [
    [0.18, shoreAt(0.18) - 7],
    [-0.28, 104],
    [0.22, 86],
    [-0.24, 68],
    [0.16, 52],
    [-0.2, 38],
    [0.1, 26],
  ];
  const lane = new THREE.CatmullRomCurve3(
    laneBearings.map(([a, rr]) => {
      const x = Math.sin(a) * rr;
      const z = Math.cos(a) * rr;
      return new THREE.Vector3(x, heightAt(x, z), z);
    }),
    false,
    "centripetal",
  );
  const lanternPoints = lane.getSpacedPoints(43).map((p) => p.setY(Math.max(heightAt(p.x, p.z), 0.8)));
  const posts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.1, 0.12, 2.6, 5).translate(0, 1.3, 0),
    new THREE.MeshStandardMaterial({ color: "#2b2620", roughness: 0.9 }),
    lanternPoints.length,
  );
  const lanternCoreMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), lanternCoreMaterial, lanternPoints.length);
  const glowPositions: number[] = [];
  lanternPoints.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, p.y + 2.75, p.z);
    dummy.updateMatrix();
    cores.setMatrixAt(i, dummy.matrix);
    glowPositions.push(p.x, p.y + 2.75, p.z);
  });
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(glowPositions, 3));
  const lanternGlowMaterial = new THREE.PointsMaterial({
    map: glow,
    color: 0xffc46b,
    size: 7,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  scene.add(posts, cores, new THREE.Points(glowGeometry, lanternGlowMaterial));

  /* lighthouse ------------------------------------------------------------ */
  const baseY = heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z);
  const lighthouse = new THREE.Group();
  lighthouse.position.set(LIGHTHOUSE.x, baseY - 0.5, LIGHTHOUSE.z);
  const whitewash = new THREE.MeshStandardMaterial({ color: "#f3efe6", roughness: 0.8, flatShading: true });
  const band = new THREE.MeshStandardMaterial({ color: "#b5573a", roughness: 0.8, flatShading: true });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 18, 14).translate(0, 9, 0), whitewash);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.36, 2.52, 2.2, 14).translate(0, 11, 0), band);
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.6, 14).translate(0, 18.3, 0), band);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 14).translate(0, 22, 0), band);
  const lampMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10).translate(0, 19.8, 0), lampMaterial);
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff1c4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const beamGeometry = new THREE.ConeGeometry(9, 140, 24, 1, true).translate(0, -70, 0).rotateZ(-Math.PI / 2);
  const beam = new THREE.Group();
  beam.position.y = 19.8;
  beam.add(new THREE.Mesh(beamGeometry, beamMaterial));
  lighthouse.add(tower, stripe, gallery, cap, lamp, beam);
  scene.add(lighthouse);

  /* trees ----------------------------------------------------------------- */
  const treeSpots: { x: number; y: number; z: number; s: number; tall: boolean }[] = [];
  for (let guard = 0; treeSpots.length < 170 && guard < 6000; guard++) {
    const a = rand() * Math.PI * 2;
    const rr = 18 + rand() * 118;
    const x = Math.sin(a) * rr;
    const z = Math.cos(a) * rr;
    const y = heightAt(x, z);
    if (y < 2) continue;
    if (houses.some((house) => Math.hypot(house.x - x, house.z - z) < 6)) continue;
    if (lanternPoints.some((p) => Math.hypot(p.x - x, p.z - z) < 3.5)) continue;
    if (Math.hypot(LIGHTHOUSE.x - x, LIGHTHOUSE.z - z) < 7) continue;
    treeSpots.push({ x, y, z, s: rand(), tall: rand() < 0.5 });
  }
  const tall = treeSpots.filter((tree) => tree.tall);
  const round = treeSpots.filter((tree) => !tree.tall);
  const cypress = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
    tall.length,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
    round.length,
  );
  tall.forEach((tree, i) => {
    dummy.position.set(tree.x, tree.y - 0.5, tree.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1.3 + tree.s * 0.7, 7 + tree.s * 5, 1.3 + tree.s * 0.7);
    dummy.updateMatrix();
    cypress.setMatrixAt(i, dummy.matrix);
    cypress.setColorAt(i, color.set(tree.s > 0.5 ? "#2f5a44" : "#3b6a4e"));
  });
  round.forEach((tree, i) => {
    const s = 2.3 + tree.s * 1.8;
    dummy.position.set(tree.x, tree.y + s * 0.7, tree.z);
    dummy.rotation.set(0, tree.s * 6, 0);
    dummy.scale.set(s, s * 0.85, s);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
    crowns.setColorAt(i, color.set(tree.s > 0.5 ? "#5f7d4a" : "#6e8a52"));
  });
  scene.add(cypress, crowns);

  /* birds ----------------------------------------------------------------- */
  const birdGeometry = new THREE.BufferGeometry();
  birdGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0.6, 0, 0, -0.6, -2, 0.25, 0, 0, 0, -0.6, 0, 0, 0.6, 2, 0.25, 0], 3),
  );
  birdGeometry.computeVertexNormals();
  const birdCount = 14;
  const birds = new THREE.InstancedMesh(
    birdGeometry,
    new THREE.MeshBasicMaterial({ color: "#1b2a33", side: THREE.DoubleSide }),
    birdCount,
  );
  // Kept well away from every camera waypoint: a close pass turns a bird into a crude triangle.
  const birdSeeds = Array.from({ length: birdCount }, () => ({
    radius: 25 + rand() * 25,
    height: 60 + rand() * 14,
    speed: 0.12 + rand() * 0.08,
    phase: rand() * Math.PI * 2,
  }));
  function placeBirds() {
    birdSeeds.forEach((bird, i) => {
      const angle = elapsed * bird.speed + bird.phase;
      dummy.position.set(20 + Math.cos(angle) * bird.radius, bird.height + Math.sin(angle * 2) * 2, 230 + Math.sin(angle) * bird.radius);
      dummy.rotation.set(0, -angle, 0);
      const flap = 0.55 + Math.abs(Math.sin(elapsed * 6 + bird.phase)) * 0.45;
      dummy.scale.set(flap, 1, 1);
      dummy.updateMatrix();
      birds.setMatrixAt(i, dummy.matrix);
    });
    birds.instanceMatrix.needsUpdate = true;
  }
  placeBirds();
  scene.add(birds);

  /* chapter state --------------------------------------------------------- */
  const prepared = chapters.map((chapter) => ({
    top: new THREE.Color(chapter.world.skyTop),
    horizon: new THREE.Color(chapter.world.horizon),
    sea: new THREE.Color(chapter.world.sea),
    sun: new THREE.Color(chapter.world.sunColor),
    dir: sunDirection(chapter.world.sunElevation, chapter.world.sunAzimuth),
  }));
  const basePositions = chapters.map((chapter) => new THREE.Vector3(...chapter.camera.position));
  const baseTargets = chapters.map((chapter) => new THREE.Vector3(...chapter.camera.target));
  const positionCurve = new THREE.CatmullRomCurve3(basePositions, false, "centripetal");
  const targetCurve = new THREE.CatmullRomCurve3(baseTargets, false, "centripetal");
  let tallPositionCurve = positionCurve;
  let tallTargetCurve = targetCurve;
  let pull = 1;

  /**
   * Tall screens: a chapter with an authored phone framing uses it; the rest pull back along
   * their own view direction so the landmark stays in frame. Rebuilt on resize, not per frame.
   */
  function buildTallCurves() {
    const positions = chapters.map((chapter, i) =>
      chapter.camera.mobile
        ? new THREE.Vector3(...chapter.camera.mobile.position)
        : basePositions[i].clone().sub(baseTargets[i]).multiplyScalar(pull).add(baseTargets[i]),
    );
    const targets = chapters.map((chapter, i) =>
      chapter.camera.mobile ? new THREE.Vector3(...chapter.camera.mobile.target) : baseTargets[i].clone(),
    );
    tallPositionCurve = new THREE.CatmullRomCurve3(positions, false, "centripetal");
    tallTargetCurve = new THREE.CatmullRomCurve3(targets, false, "centripetal");
  }
  const cameraPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const windowDay = new THREE.Color("#262a2c");
  const windowNight = new THREE.Color("#ffffff");
  const lanternOff = new THREE.Color("#3a3024");
  const lanternOn = new THREE.Color("#ffd28a");

  function update(progress: number, dt: number) {
    const last = chapters.length - 1;
    const p = THREE.MathUtils.clamp(progress, 0, last);
    const index = Math.min(Math.floor(p), last - 1);
    const local = p - index;
    const t = local * local * (3 - 2 * local);
    const a = chapters[index];
    const b = chapters[index + 1];
    const pa = prepared[index];
    const pb = prepared[index + 1];
    const mix = (field: NumericKey) => THREE.MathUtils.lerp(a.world[field], b.world[field], t);

    /* camera — getPoint, not getPointAt, so each chapter lands exactly on its waypoint */
    const u = p / last;
    const tall = aspect < 1;
    (tall ? tallPositionCurve : positionCurve).getPoint(u, cameraPosition);
    (tall ? tallTargetCurve : targetCurve).getPoint(u, cameraTarget);
    const fovOf = (chapter: Chapter) =>
      tall ? (chapter.camera.mobile?.fov ?? Math.min(chapter.camera.fov * 1.08, 70)) : chapter.camera.fov;
    const fov = THREE.MathUtils.lerp(fovOf(a), fovOf(b), t);
    const ground = Math.max(heightAt(cameraPosition.x, cameraPosition.z), 0) + 3;
    if (cameraPosition.y < ground) cameraPosition.y = ground;
    camera.position.copy(cameraPosition);
    camera.lookAt(cameraTarget);
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    skyGroup.position.copy(camera.position);

    /* light and atmosphere */
    const top = skyUniforms.uTop.value.lerpColors(pa.top, pb.top, t);
    const horizon = skyUniforms.uHorizon.value.lerpColors(pa.horizon, pb.horizon, t);
    direction.lerpVectors(pa.dir, pb.dir, t).normalize();
    key.color.lerpColors(pa.sun, pb.sun, t);
    key.intensity = mix("sunIntensity");
    key.position.copy(direction).multiplyScalar(400);
    hemi.color.copy(top).lerp(horizon, 0.5);
    hemi.intensity = mix("hemi");
    skyUniforms.uSunDir.value.copy(direction);
    skyUniforms.uSunColor.value.copy(key.color);
    skyUniforms.uSunGlow.value = mix("sunGlow");
    skyUniforms.uMoon.value = mix("moon");
    starMaterial.opacity = mix("stars");
    // Pulling the camera back on tall screens also pushes the world into the fog.
    fog.color.copy(horizon);
    fog.density = mix("fog") / pull;
    seaMaterial.color.lerpColors(pa.sea, pb.sea, t);
    // Water reflects the sky. Without this, a low sun behind the island left the whole
    // foreground sea black at sunset; with the horizon alone at full strength it read as sand.
    // Half-way to the upper sky and kept faint, it stays water.
    seaMaterial.emissive.copy(horizon).lerp(top, 0.45).multiplyScalar(0.09);
    renderer.toneMappingExposure = mix("exposure");

    const windowsOn = mix("windows");
    windowMaterial.color.lerpColors(windowDay, windowNight, windowsOn);
    const lanterns = mix("lanterns");
    lanternCoreMaterial.color.lerpColors(lanternOff, lanternOn, lanterns);
    lanternGlowMaterial.opacity = lanterns * 0.9;
    const beamStrength = mix("beam");
    lampMaterial.color.lerpColors(lanternOff, lanternOn, Math.max(beamStrength, lanterns * 0.6));
    beamMaterial.opacity = beamStrength * 0.16;
    beam.visible = beamStrength > 0.01;
    birds.visible = mix("stars") < 0.5;

    /* ambient motion — frozen when dt is 0 */
    if (dt > 0) {
      elapsed += dt;
      seaTime.value = elapsed;
      beam.rotation.y = elapsed * 0.6;
      placeBoats();
      if (birds.visible) placeBirds();
    }

    renderer.render(scene, camera);
  }

  function resize(width: number, height: number) {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    renderer.setSize(width, height, false);
    aspect = width / Math.max(1, height);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    pull = aspect < 1 ? THREE.MathUtils.clamp(1 / aspect, 1, 1.9) : 1;
    buildTallCurves();
  }

  function dispose() {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    glow.dispose();
    renderer.dispose();
  }

  return { update, resize, dispose, renderer, canvas };
}
