import * as THREE from 'three';
import type { SceneMaterialLibrary } from './materials';

export function groundHeightAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);
  // Keep central radar plaza (r <= 11) level for crisp monument and ring grounding
  if (dist <= 11) return 0;
  const blend = THREE.MathUtils.smoothstep(dist, 11, 24);
  const hills =
    Math.sin(x * 0.085) * Math.cos(z * 0.075) * 1.45 +
    Math.sin((x + z) * 0.045) * 1.15 +
    Math.max(0, (dist - 30) * 0.14);
  return hills * blend;
}

export interface TerrainBuildResult {
  group: THREE.Group;
  radarRingsGroup: THREE.Group;
  radarSweepRing: THREE.Mesh;
  privacyGrid: THREE.LineSegments;
  dispose: () => void;
}

export function buildTerrainAndRings(
  maxDistanceKm: number,
  materials: SceneMaterialLibrary
): TerrainBuildResult {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const disposableMaterials: THREE.Material[] = [];

  // 1. Undulating Neighborhood Terrain Plane
  const terrainGeo = new THREE.PlaneGeometry(160, 160, 96, 96);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeightAt(x, z));
  }
  pos.needsUpdate = true;
  terrainGeo.computeVertexNormals();
  geometries.push(terrainGeo);

  const terrainMesh = new THREE.Mesh(terrainGeo, materials.terrain);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // 2. Central Raised Stone Plaza Disc (offset +0.025 Y so zero Z-fighting)
  const plazaGeo = new THREE.CylinderGeometry(5.6, 5.9, 0.06, 48);
  geometries.push(plazaGeo);
  const plazaMesh = new THREE.Mesh(plazaGeo, materials.plazaStone);
  plazaMesh.position.y = 0.03;
  plazaMesh.receiveShadow = true;
  group.add(plazaMesh);

  // 3. Concentric Distance Radar Rings (scaled smoothly against maxDistanceKm)
  const radarRingsGroup = new THREE.Group();
  const ringRadii = [6.5, 11.5, 17.0, 22.5];
  ringRadii.forEach((r, idx) => {
    const ringGeo = new THREE.RingGeometry(r - 0.07, r + 0.07, 96);
    ringGeo.rotateX(-Math.PI / 2);
    geometries.push(ringGeo);
    const ringMesh = new THREE.Mesh(
      ringGeo,
      idx === ringRadii.length - 1 ? materials.ringCoral : materials.ringTeal
    );
    ringMesh.position.y = 0.03 + idx * 0.002;
    radarRingsGroup.add(ringMesh);
  });
  radarRingsGroup.userData.maxDistanceKm = maxDistanceKm;
  group.add(radarRingsGroup);

  // 3b. Dynamic Radar Sweep Ring
  const sweepGeo = new THREE.RingGeometry(0.95, 1.0, 96);
  sweepGeo.rotateX(-Math.PI / 2);
  geometries.push(sweepGeo);
  const radarSweepRing = new THREE.Mesh(sweepGeo, materials.radarSweep);
  radarSweepRing.position.y = 0.055;
  group.add(radarSweepRing);

  // 4. ~300m Privacy Snap Lattice Grid (LineSegments, y = 0.045)
  const gridPoints: number[] = [];
  const halfExtent = 24;
  const step = 3;
  for (let c = -halfExtent; c <= halfExtent; c += step) {
    gridPoints.push(-halfExtent, 0.045, c, halfExtent, 0.045, c);
    gridPoints.push(c, 0.045, -halfExtent, c, 0.045, halfExtent);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
  geometries.push(gridGeo);

  const gridMat = new THREE.LineBasicMaterial({
    color: new THREE.Color('#3D8C7A'),
    transparent: true,
    opacity: 0.24,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  disposableMaterials.push(gridMat);

  const privacyGrid = new THREE.LineSegments(gridGeo, gridMat);
  group.add(privacyGrid);

  return {
    group,
    radarRingsGroup,
    radarSweepRing,
    privacyGrid,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      disposableMaterials.forEach((m) => m.dispose());
    },
  };
}
