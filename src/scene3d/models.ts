import * as THREE from 'three';
import type { SceneMaterialLibrary } from './materials';
import { groundHeightAt } from './terrain';
import { createEmblemBadgeTexture } from './textures';

export interface RadarPinInput {
  id: string;
  name: string;
  age: number;
  city: string;
  distanceKm: number;
  score: number;
  isMatched: boolean;
  isDemo: boolean;
}

export interface MonumentHandle {
  group: THREE.Group;
  innerGimbal: THREE.Mesh;
  outerGimbal: THREE.Mesh;
  heartCluster: THREE.Group;
  dispose: () => void;
}

export interface CandidatePinHandle {
  id: string;
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  haloRing: THREE.Mesh;
  headGroup: THREE.Group;
  baseY: number;
  worldPos: THREE.Vector3;
  dispose: () => void;
}

export interface ConnectionArcHandle {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  pulseBead: THREE.Mesh;
  dispose: () => void;
}

function createHeartShape(scale = 1): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0.25 * scale);
  s.bezierCurveTo(0, 0.55 * scale, -0.45 * scale, 0.55 * scale, -0.45 * scale, 0.2 * scale);
  s.bezierCurveTo(-0.45 * scale, -0.1 * scale, -0.15 * scale, -0.32 * scale, 0, -0.48 * scale);
  s.bezierCurveTo(0.15 * scale, -0.32 * scale, 0.45 * scale, -0.1 * scale, 0.45 * scale, 0.2 * scale);
  s.bezierCurveTo(0.45 * scale, 0.55 * scale, 0, 0.55 * scale, 0, 0.25 * scale);
  return s;
}

function createRoundedFrameShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

/**
 * Deterministic polar placement from UID and real distanceKm.
 */
export function computePinWorldCoords(
  id: string,
  index: number,
  total: number,
  distanceKm: number,
  maxDistanceKm: number
): { x: number; z: number } {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const baseSector = (index / Math.max(1, total)) * Math.PI * 2;
  const jitter = ((hash >>> 0) % 1000) / 1000 - 0.5;
  const angle = baseSector + jitter * 0.42 + 0.35;

  const clampedMax = Math.max(5, maxDistanceKm);
  const normDist = Math.min(1, Math.max(0.08, distanceKm / clampedMax));
  const radius = 5.4 + normDist * 16.5;

  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
  };
}

/**
 * 8-part composite central NearMatch beacon monument pivoted at bottom-center (y = 0).
 */
export function buildUserBeaconMonument(materials: SceneMaterialLibrary): MonumentHandle {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];

  // 1. Contact shadow disc
  const shadowGeo = new THREE.PlaneGeometry(4.4, 4.4);
  shadowGeo.rotateX(-Math.PI / 2);
  geometries.push(shadowGeo);
  const shadow = new THREE.Mesh(shadowGeo, materials.contactShadow);
  shadow.position.y = 0.065;
  group.add(shadow);

  // 2. Stepped terracotta plinth (LatheGeometry)
  const plinthPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(1.75, 0),
    new THREE.Vector2(1.75, 0.24),
    new THREE.Vector2(1.52, 0.32),
    new THREE.Vector2(1.42, 0.56),
    new THREE.Vector2(1.18, 0.68),
    new THREE.Vector2(0, 0.68),
  ];
  const plinthGeo = new THREE.LatheGeometry(plinthPoints, 40);
  geometries.push(plinthGeo);
  const plinth = new THREE.Mesh(plinthGeo, materials.terracotta);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // 3. Porcelain pedestal collar
  const collarPoints = [
    new THREE.Vector2(0, 0.68),
    new THREE.Vector2(1.06, 0.68),
    new THREE.Vector2(1.12, 0.88),
    new THREE.Vector2(0.88, 1.06),
    new THREE.Vector2(0.54, 1.18),
    new THREE.Vector2(0, 1.18),
  ];
  const collarGeo = new THREE.LatheGeometry(collarPoints, 36);
  geometries.push(collarGeo);
  const collar = new THREE.Mesh(collarGeo, materials.porcelain);
  collar.castShadow = true;
  collar.receiveShadow = true;
  group.add(collar);

  // 4. Outer brass bezel ring at glass seat
  const bezelGeo = new THREE.TorusGeometry(1.02, 0.06, 16, 48);
  bezelGeo.rotateX(Math.PI / 2);
  geometries.push(bezelGeo);
  const bezel = new THREE.Mesh(bezelGeo, materials.brass);
  bezel.position.y = 1.06;
  bezel.castShadow = true;
  group.add(bezel);

  // 5. Outer & Inner Brushed Brass Gimbal Rings
  const outerGimbalGeo = new THREE.TorusGeometry(1.08, 0.045, 16, 48);
  geometries.push(outerGimbalGeo);
  const outerGimbal = new THREE.Mesh(outerGimbalGeo, materials.brass);
  outerGimbal.position.y = 2.35;
  outerGimbal.castShadow = true;
  group.add(outerGimbal);

  const innerGimbalGeo = new THREE.TorusGeometry(0.84, 0.038, 16, 44);
  geometries.push(innerGimbalGeo);
  const innerGimbal = new THREE.Mesh(innerGimbalGeo, materials.goldHighlight);
  innerGimbal.position.y = 2.35;
  innerGimbal.rotation.y = Math.PI / 3;
  group.add(innerGimbal);

  // 6. Twin Beveled Sculpted 3D Heart Emblem (echoing NearMatch core icon)
  const heartCluster = new THREE.Group();
  heartCluster.position.y = 2.36;

  const heartShape = createHeartShape(0.82);
  const heartGeo = new THREE.ExtrudeGeometry(heartShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 4,
    curveSegments: 20,
  });
  heartGeo.center();
  geometries.push(heartGeo);

  const creamHeart = new THREE.Mesh(heartGeo, materials.porcelain);
  creamHeart.position.set(-0.22, 0.02, -0.05);
  creamHeart.rotation.z = 0.09;
  creamHeart.castShadow = true;
  heartCluster.add(creamHeart);

  const coralHeart = new THREE.Mesh(heartGeo, materials.coralEnamel);
  coralHeart.position.set(0.2, 0.04, 0.06);
  coralHeart.rotation.z = -0.08;
  coralHeart.castShadow = true;
  heartCluster.add(coralHeart);

  group.add(heartCluster);

  // 7. Vertical Brass Spire & Compass Finial
  const mastGeo = new THREE.CylinderGeometry(0.035, 0.06, 0.8, 16);
  geometries.push(mastGeo);
  const mast = new THREE.Mesh(mastGeo, materials.brass);
  mast.position.y = 3.55;
  mast.castShadow = true;
  group.add(mast);

  const tipGeo = new THREE.ConeGeometry(0.11, 0.34, 16);
  geometries.push(tipGeo);
  const tip = new THREE.Mesh(tipGeo, materials.coralEnamel);
  tip.position.y = 4.08;
  tip.castShadow = true;
  group.add(tip);

  // 8. Optical Glass Enclosure Dome
  const domeGeo = new THREE.SphereGeometry(1.18, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.62);
  geometries.push(domeGeo);
  const dome = new THREE.Mesh(domeGeo, materials.glassDome);
  dome.position.y = 1.98;
  dome.renderOrder = 10;
  group.add(dome);

  return {
    group,
    innerGimbal,
    outerGimbal,
    heartCluster,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
    },
  };
}

/**
 * 6-part composite Candidate Match Beacon pivoted flush on terrain height.
 */
export function buildCandidateBeacon(
  pin: RadarPinInput,
  worldX: number,
  worldZ: number,
  isSelected: boolean,
  materials: SceneMaterialLibrary,
  maxAnisotropy: number
): CandidatePinHandle {
  const group = new THREE.Group();
  const baseY = groundHeightAt(worldX, worldZ);
  group.position.set(worldX, baseY, worldZ);

  const geometries: THREE.BufferGeometry[] = [];
  const localMaterials: THREE.Material[] = [];
  const localTextures: THREE.Texture[] = [];

  // 1. Contact shadow disc
  const shadowGeo = new THREE.PlaneGeometry(2.2, 2.2);
  shadowGeo.rotateX(-Math.PI / 2);
  geometries.push(shadowGeo);
  const shadow = new THREE.Mesh(shadowGeo, materials.contactShadow);
  shadow.position.y = 0.025;
  group.add(shadow);

  // 2. Lathed base pedestal (teal for matched, espresso/terracotta for candidates)
  const basePoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.64, 0),
    new THREE.Vector2(0.64, 0.12),
    new THREE.Vector2(0.46, 0.24),
    new THREE.Vector2(0.26, 0.34),
    new THREE.Vector2(0, 0.34),
  ];
  const baseGeo = new THREE.LatheGeometry(basePoints, 28);
  geometries.push(baseGeo);
  const baseMesh = new THREE.Mesh(
    baseGeo,
    pin.isMatched ? materials.tealEnamel : materials.terracotta
  );
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // 3. Brushed brass riser stem
  const stemHeight = pin.isMatched ? 1.55 : 1.25;
  const stemGeo = new THREE.CylinderGeometry(0.075, 0.105, stemHeight, 16);
  geometries.push(stemGeo);
  const stem = new THREE.Mesh(stemGeo, materials.brass);
  stem.position.y = 0.34 + stemHeight / 2;
  stem.castShadow = true;
  group.add(stem);

  // 4. Head housing group (billboards gently toward camera or orbits smoothly)
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.34 + stemHeight + 0.62;
  group.add(headGroup);

  const frameShape = createRoundedFrameShape(1.18, 1.18, 0.28);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 3,
  });
  frameGeo.center();
  geometries.push(frameGeo);

  const frameMat = pin.isMatched
    ? materials.tealEnamel
    : isSelected
    ? materials.goldHighlight
    : materials.coralEnamel;
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.castShadow = true;
  headGroup.add(frameMesh);

  // 5. Procedural CanvasTexture Medallion Face (front & back so readable from all angles)
  const initials = pin.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const badgeTex = createEmblemBadgeTexture(
    initials,
    pin.score,
    pin.isMatched,
    isSelected,
    maxAnisotropy
  );
  localTextures.push(badgeTex);

  const badgeMat = new THREE.MeshStandardMaterial({
    map: badgeTex,
    roughness: 0.36,
    metalness: 0.04,
  });
  localMaterials.push(badgeMat);

  const faceGeo = new THREE.CircleGeometry(0.46, 32);
  geometries.push(faceGeo);

  const frontFace = new THREE.Mesh(faceGeo, badgeMat);
  frontFace.position.z = 0.135;
  headGroup.add(frontFace);

  const backFace = new THREE.Mesh(faceGeo, badgeMat);
  backFace.position.z = -0.135;
  backFace.rotation.y = Math.PI;
  headGroup.add(backFace);

  // 6. Floating Halo Crown Ring
  const haloGeo = new THREE.TorusGeometry(0.76, 0.032, 12, 36);
  haloGeo.rotateX(Math.PI / 2);
  geometries.push(haloGeo);
  const haloRing = new THREE.Mesh(
    haloGeo,
    pin.isMatched ? materials.tealEnamel : materials.brass
  );
  haloRing.position.y = 0.72;
  headGroup.add(haloRing);

  // Invisible simplified hit proxy on layer 1 for effortless raycasting
  const hitGeo = new THREE.CylinderGeometry(0.95, 0.95, 3.2, 12);
  geometries.push(hitGeo);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  localMaterials.push(hitMat);
  const hitProxy = new THREE.Mesh(hitGeo, hitMat);
  hitProxy.position.y = 1.6;
  hitProxy.layers.set(1);
  hitProxy.userData.pinId = pin.id;
  group.add(hitProxy);

  return {
    id: pin.id,
    group,
    hitProxy,
    haloRing,
    headGroup,
    baseY,
    worldPos: new THREE.Vector3(worldX, baseY, worldZ),
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      localMaterials.forEach((m) => m.dispose());
      localTextures.forEach((t) => t.dispose());
    },
  };
}

export interface FirefliesHandle {
  group: THREE.Group;
  mesh: THREE.InstancedMesh;
  update: (elapsed: number, atmosphere: 'golden' | 'morning' | 'twilight') => void;
  dispose: () => void;
}

const _fireflyDummy = new THREE.Object3D();

/**
 * 6-part composite neighborhood landmark pavilion (Cafe, Conservatory, or Bookstore) grounded flush.
 */
export function buildNeighborhoodLandmark(
  kind: 'cafe' | 'conservatory' | 'bookstore',
  x: number,
  z: number,
  rotY: number,
  materials: SceneMaterialLibrary
): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  const y = groundHeightAt(x, z);
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const geometries: THREE.BufferGeometry[] = [];

  const shadowGeo = new THREE.PlaneGeometry(4.8, 4.8);
  shadowGeo.rotateX(-Math.PI / 2);
  geometries.push(shadowGeo);
  const shadow = new THREE.Mesh(shadowGeo, materials.contactShadow);
  shadow.position.y = 0.02;
  group.add(shadow);

  if (kind === 'cafe') {
    // 1. Stone deck base
    const deckGeo = new THREE.BoxGeometry(3.4, 0.24, 2.8);
    geometries.push(deckGeo);
    const deck = new THREE.Mesh(deckGeo, materials.plazaStone);
    deck.position.y = 0.12;
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // 2. Warm glowing espresso pavilion core
    const coreGeo = new THREE.BoxGeometry(2.5, 1.55, 1.9);
    geometries.push(coreGeo);
    const core = new THREE.Mesh(coreGeo, materials.porcelain);
    core.position.y = 1.01;
    core.castShadow = true;
    core.receiveShadow = true;
    group.add(core);

    // 3. Glowing cafe window band
    const winGeo = new THREE.BoxGeometry(2.56, 0.65, 1.4);
    geometries.push(winGeo);
    const win = new THREE.Mesh(winGeo, materials.lanternGlow);
    win.position.y = 1.02;
    group.add(win);

    // 4. Coral awning overhang
    const awningGeo = new THREE.BoxGeometry(2.8, 0.12, 0.85);
    geometries.push(awningGeo);
    const awning = new THREE.Mesh(awningGeo, materials.coralEnamel);
    awning.position.set(0, 1.48, 1.2);
    awning.rotation.x = 0.24;
    awning.castShadow = true;
    group.add(awning);

    // 5. Pitched terracotta roof
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-1.55, 0);
    roofShape.lineTo(1.55, 0);
    roofShape.lineTo(0, 0.85);
    roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
      depth: 2.3,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    roofGeo.center();
    geometries.push(roofGeo);
    const roof = new THREE.Mesh(roofGeo, materials.terracotta);
    roof.position.y = 2.15;
    roof.castShadow = true;
    group.add(roof);

    // 6. Brass finial lantern on ridge
    const finialGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.34, 12);
    geometries.push(finialGeo);
    const finial = new THREE.Mesh(finialGeo, materials.brass);
    finial.position.y = 2.7;
    group.add(finial);
  } else if (kind === 'bookstore') {
    // Indie Bookstore & Reading Courtyard (6 composite parts)
    // 1. Stone courtyard terrace base
    const terraceGeo = new THREE.BoxGeometry(3.8, 0.22, 3.2);
    geometries.push(terraceGeo);
    const terrace = new THREE.Mesh(terraceGeo, materials.plazaStone);
    terrace.position.y = 0.11;
    terrace.castShadow = true;
    terrace.receiveShadow = true;
    group.add(terrace);

    // 2. Main porcelain storefront & cozy reading annex
    const bodyGeo = new THREE.BoxGeometry(2.7, 1.75, 2.05);
    geometries.push(bodyGeo);
    const body = new THREE.Mesh(bodyGeo, materials.porcelain);
    body.position.y = 1.09;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 3. Warm glowing showcase window & reading alcove
    const showcaseGeo = new THREE.BoxGeometry(2.1, 0.92, 2.12);
    geometries.push(showcaseGeo);
    const showcase = new THREE.Mesh(showcaseGeo, materials.lanternGlow);
    showcase.position.set(0, 0.96, 0);
    group.add(showcase);

    // 4. Teal enamel storefront awning + brushed brass support brackets
    const awningGeo = new THREE.BoxGeometry(2.85, 0.1, 0.78);
    geometries.push(awningGeo);
    const awning = new THREE.Mesh(awningGeo, materials.tealEnamel);
    awning.position.set(0, 1.56, 1.28);
    awning.rotation.x = 0.22;
    awning.castShadow = true;
    group.add(awning);

    const bracketGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.65, 8);
    geometries.push(bracketGeo);
    [-1.1, 1.1].forEach((bx) => {
      const bracket = new THREE.Mesh(bracketGeo, materials.brass);
      bracket.position.set(bx, 1.38, 1.15);
      bracket.rotation.x = Math.PI / 3;
      group.add(bracket);
    });

    // 5. Pitched terracotta gable roof
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-1.62, 0);
    gableShape.lineTo(1.62, 0);
    gableShape.lineTo(0, 0.92);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
      depth: 2.35,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    gableGeo.center();
    geometries.push(gableGeo);
    const gable = new THREE.Mesh(gableGeo, materials.terracotta);
    gable.position.y = 2.38;
    gable.castShadow = true;
    group.add(gable);

    // 6. Brass skylight cupola finial on ridge
    const cupolaBaseGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.28, 8);
    geometries.push(cupolaBaseGeo);
    const cupolaBase = new THREE.Mesh(cupolaBaseGeo, materials.brass);
    cupolaBase.position.y = 2.92;
    group.add(cupolaBase);
  } else {
    // Conservatory Pavilion
    const basePoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1.9, 0),
      new THREE.Vector2(1.9, 0.22),
      new THREE.Vector2(1.65, 0.3),
      new THREE.Vector2(0, 0.3),
    ];
    const baseGeo = new THREE.LatheGeometry(basePoints, 32);
    geometries.push(baseGeo);
    const base = new THREE.Mesh(baseGeo, materials.plazaStone);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const colGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.5, 12);
    geometries.push(colGeo);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const col = new THREE.Mesh(colGeo, materials.brass);
      col.position.set(Math.cos(ang) * 1.45, 1.05, Math.sin(ang) * 1.45);
      col.castShadow = true;
      group.add(col);
    }

    const crownGeo = new THREE.TorusGeometry(1.48, 0.06, 12, 32);
    crownGeo.rotateX(Math.PI / 2);
    geometries.push(crownGeo);
    const crown = new THREE.Mesh(crownGeo, materials.tealEnamel);
    crown.position.y = 1.8;
    group.add(crown);

    const cupolaGeo = new THREE.SphereGeometry(1.46, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    geometries.push(cupolaGeo);
    const cupola = new THREE.Mesh(cupolaGeo, materials.glassDome);
    cupola.position.y = 1.8;
    cupola.renderOrder = 9;
    group.add(cupola);

    const lanternGeo = new THREE.SphereGeometry(0.28, 16, 12);
    geometries.push(lanternGeo);
    const lantern = new THREE.Mesh(lanternGeo, materials.lanternGlow);
    lantern.position.y = 1.2;
    group.add(lantern);
  }

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
    },
  };
}

/**
 * Instanced foliage, perimeter boulders, and promenade lantern bollards (> 20 repeated items).
 */
export function buildInstancedEnvironment(materials: SceneMaterialLibrary): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const dummy = new THREE.Object3D();
  const tintColor = new THREE.Color();

  // 1. 36 Procedural Park Trees (Instanced Trunks + 2-tier Canopy Crowns)
  const treeCount = 36;
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, 1.8, 10);
  trunkGeo.translate(0, 0.9, 0);
  const canopyLowerGeo = new THREE.IcosahedronGeometry(1.05, 1);
  canopyLowerGeo.translate(0, 2.3, 0);
  const canopyUpperGeo = new THREE.IcosahedronGeometry(0.74, 1);
  canopyUpperGeo.translate(0.12, 3.1, -0.08);
  geometries.push(trunkGeo, canopyLowerGeo, canopyUpperGeo);

  const trunks = new THREE.InstancedMesh(trunkGeo, materials.bark, treeCount);
  const canopiesLower = new THREE.InstancedMesh(canopyLowerGeo, materials.foliage, treeCount);
  const canopiesUpper = new THREE.InstancedMesh(canopyUpperGeo, materials.foliage, treeCount);
  trunks.castShadow = true;
  canopiesLower.castShadow = true;
  canopiesUpper.castShadow = true;
  canopiesLower.receiveShadow = true;

  const treePalette = [0x3d8c7a, 0x4b9b86, 0x568e6b, 0x679c73];

  for (let i = 0; i < treeCount; i++) {
    const angle = (i / treeCount) * Math.PI * 2 + (i % 3) * 0.14;
    const radius = 24.5 + (i % 5) * 4.4;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = groundHeightAt(x, z);
    const s = 0.85 + ((i * 37) % 30) / 100; // ±15% scale variation

    dummy.position.set(x, y, z);
    dummy.rotation.set(0, (i * 1.13) % (Math.PI * 2), 0);
    dummy.scale.set(s, s * (0.94 + (i % 4) * 0.05), s);
    dummy.updateMatrix();

    trunks.setMatrixAt(i, dummy.matrix);
    canopiesLower.setMatrixAt(i, dummy.matrix);
    canopiesUpper.setMatrixAt(i, dummy.matrix);

    tintColor.setHex(treePalette[i % treePalette.length]);
    canopiesLower.setColorAt(i, tintColor);
    tintColor.offsetHSL(0.01, 0.04, 0.05);
    canopiesUpper.setColorAt(i, tintColor);
  }
  trunks.instanceMatrix.needsUpdate = true;
  canopiesLower.instanceMatrix.needsUpdate = true;
  canopiesUpper.instanceMatrix.needsUpdate = true;
  if (canopiesLower.instanceColor) canopiesLower.instanceColor.needsUpdate = true;
  if (canopiesUpper.instanceColor) canopiesUpper.instanceColor.needsUpdate = true;
  trunks.computeBoundingSphere();
  canopiesLower.computeBoundingSphere();
  canopiesUpper.computeBoundingSphere();
  group.add(trunks, canopiesLower, canopiesUpper);

  // 2. 42 Natural Perimeter Boulder Outcrops
  const boulderCount = 42;
  const boulderGeo = new THREE.IcosahedronGeometry(1.1, 1);
  boulderGeo.translate(0, 0.48, 0);
  geometries.push(boulderGeo);

  const boulders = new THREE.InstancedMesh(boulderGeo, materials.boulder, boulderCount);
  boulders.castShadow = true;
  boulders.receiveShadow = true;
  const boulderPalette = [0xc9a581, 0xb88b68, 0xd8bca0, 0xa87c5d];

  for (let i = 0; i < boulderCount; i++) {
    const angle = (i / boulderCount) * Math.PI * 2 + 0.08;
    const radius = 34 + (i % 6) * 4.2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = groundHeightAt(x, z);
    const sx = 0.85 + ((i * 19) % 45) / 100;
    const sy = 0.6 + ((i * 23) % 35) / 100;
    const sz = 0.85 + ((i * 29) % 40) / 100;

    dummy.position.set(x, y - 0.15, z);
    dummy.rotation.set((i % 3) * 0.2, i * 0.9, (i % 2) * 0.18);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();

    boulders.setMatrixAt(i, dummy.matrix);
    tintColor.setHex(boulderPalette[i % boulderPalette.length]);
    boulders.setColorAt(i, tintColor);
  }
  boulders.instanceMatrix.needsUpdate = true;
  if (boulders.instanceColor) boulders.instanceColor.needsUpdate = true;
  boulders.computeBoundingSphere();
  group.add(boulders);

  // 3. 24 Inner Promenade Warm Lantern Bollards
  const bollardCount = 24;
  const bollardPostGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.78, 10);
  bollardPostGeo.translate(0, 0.39, 0);
  const bollardCapGeo = new THREE.SphereGeometry(0.11, 10, 8);
  bollardCapGeo.translate(0, 0.82, 0);
  geometries.push(bollardPostGeo, bollardCapGeo);

  const bollardPosts = new THREE.InstancedMesh(bollardPostGeo, materials.espresso, bollardCount);
  const bollardCaps = new THREE.InstancedMesh(bollardCapGeo, materials.lanternGlow, bollardCount);
  bollardPosts.castShadow = true;

  for (let i = 0; i < bollardCount; i++) {
    const angle = (i / bollardCount) * Math.PI * 2;
    const radius = 5.45;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, -angle, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    bollardPosts.setMatrixAt(i, dummy.matrix);
    bollardCaps.setMatrixAt(i, dummy.matrix);
  }
  bollardPosts.instanceMatrix.needsUpdate = true;
  bollardCaps.instanceMatrix.needsUpdate = true;
  bollardPosts.computeBoundingSphere();
  bollardCaps.computeBoundingSphere();
  group.add(bollardPosts, bollardCaps);

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
    },
  };
}

/**
 * Parabolic signal arc linking the user beacon to matched / selected candidates.
 */
export function buildConnectionArc(
  endWorldPos: THREE.Vector3,
  isMatched: boolean
): ConnectionArcHandle {
  const group = new THREE.Group();
  const start = new THREE.Vector3(0, 2.5, 0);
  const end = new THREE.Vector3(endWorldPos.x, endWorldPos.y + 2.1, endWorldPos.z);
  const mid = start.clone().lerp(end, 0.5);
  mid.y += Math.max(2.2, start.distanceTo(end) * 0.28);

  const curve = new THREE.CatmullRomCurve3([start, mid, end]);
  const tubeGeo = new THREE.TubeGeometry(curve, 36, isMatched ? 0.055 : 0.04, 8, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(isMatched ? '#3D8C7A' : '#E8603A'),
    emissive: new THREE.Color(isMatched ? '#2E6B5C' : '#C44C29'),
    emissiveIntensity: 0.75,
    roughness: 0.3,
    metalness: 0.2,
    transparent: true,
    opacity: isMatched ? 0.88 : 0.65,
  });

  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  group.add(tubeMesh);

  const beadGeo = new THREE.SphereGeometry(isMatched ? 0.15 : 0.12, 12, 10);
  const beadMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFF8EC'),
    emissive: new THREE.Color(isMatched ? '#A9D7C8' : '#FFC98B'),
    emissiveIntensity: 1.6,
    roughness: 0.15,
  });
  const pulseBead = new THREE.Mesh(beadGeo, beadMat);
  group.add(pulseBead);

  return {
    group,
    curve,
    pulseBead,
    dispose: () => {
      tubeGeo.dispose();
      tubeMat.dispose();
      beadGeo.dispose();
      beadMat.dispose();
    },
  };
}

/**
 * Ambient drifting firefly / lantern-spark particles rendered in 1 InstancedMesh draw call (> 20 items).
 */
export function buildAmbientFireflies(
  count: number,
  materials: SceneMaterialLibrary
): FirefliesHandle {
  const group = new THREE.Group();
  const safeCount = Math.max(24, count);
  const orbGeo = new THREE.SphereGeometry(0.065, 8, 6);
  const mesh = new THREE.InstancedMesh(orbGeo, materials.fireflyGlow, safeCount);
  mesh.frustumCulled = false;

  const radii = new Float32Array(safeCount);
  const angles = new Float32Array(safeCount);
  const heights = new Float32Array(safeCount);
  const speeds = new Float32Array(safeCount);
  const phases = new Float32Array(safeCount);

  for (let i = 0; i < safeCount; i++) {
    radii[i] = 4.2 + ((i * 73) % 210) / 10; // 4.2 to 25.1
    angles[i] = ((i * 137.5) * Math.PI) / 180;
    const x = Math.cos(angles[i]) * radii[i];
    const z = Math.sin(angles[i]) * radii[i];
    heights[i] = groundHeightAt(x, z) + 0.9 + ((i * 29) % 26) / 10;
    speeds[i] = 0.04 + ((i * 17) % 12) * 0.008;
    phases[i] = i * 0.87;
  }

  const update = (elapsed: number, atmosphere: 'golden' | 'morning' | 'twilight') => {
    const scaleBase = atmosphere === 'morning' ? 0.58 : atmosphere === 'twilight' ? 1.25 : 0.95;
    materials.fireflyGlow.emissiveIntensity =
      atmosphere === 'twilight' ? 2.1 : atmosphere === 'golden' ? 1.35 : 0.55;

    for (let i = 0; i < safeCount; i++) {
      const ang = angles[i] + elapsed * speeds[i];
      const rad = radii[i] + Math.sin(elapsed * 0.45 + phases[i]) * 0.65;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const y = heights[i] + Math.sin(elapsed * 1.15 + phases[i]) * 0.35;
      const pulse = scaleBase * (0.72 + 0.32 * Math.sin(elapsed * 2.1 + phases[i]));

      _fireflyDummy.position.set(x, y, z);
      _fireflyDummy.scale.setScalar(pulse);
      _fireflyDummy.updateMatrix();
      mesh.setMatrixAt(i, _fireflyDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  update(0, 'golden');
  mesh.computeBoundingSphere();
  group.add(mesh);

  return {
    group,
    mesh,
    update,
    dispose: () => {
      orbGeo.dispose();
    },
  };
}

