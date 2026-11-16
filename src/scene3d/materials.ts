import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';

export interface SceneMaterialLibrary {
  terrain: THREE.MeshStandardMaterial;
  plazaStone: THREE.MeshStandardMaterial;
  terracotta: THREE.MeshStandardMaterial;
  porcelain: THREE.MeshPhysicalMaterial;
  espresso: THREE.MeshStandardMaterial;
  brass: THREE.MeshPhysicalMaterial;
  coralEnamel: THREE.MeshPhysicalMaterial;
  tealEnamel: THREE.MeshPhysicalMaterial;
  goldHighlight: THREE.MeshPhysicalMaterial;
  glassDome: THREE.MeshPhysicalMaterial;
  lanternGlow: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  boulder: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  ringCoral: THREE.MeshBasicMaterial;
  ringTeal: THREE.MeshBasicMaterial;
  radarSweep: THREE.MeshBasicMaterial;
  fireflyGlow: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createMaterialLibrary(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): SceneMaterialLibrary {
  const terrain = new THREE.MeshStandardMaterial({
    map: textures.terrainAlbedo,
    bumpMap: textures.terrainBump,
    bumpScale: 0.08,
    roughness: 0.88,
    metalness: 0.03,
  });

  const plazaStone = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#EFE0CA'),
    bumpMap: textures.terrainBump,
    bumpScale: 0.04,
    roughness: 0.82,
    metalness: 0.04,
  });

  const terracotta = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C96C4A'),
    roughness: 0.72,
    metalness: 0.06,
  });

  const porcelain = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FFF8EC'),
    roughness: 0.32,
    metalness: 0.04,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
  });

  const espresso = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3D2817'),
    roughness: 0.78,
    metalness: 0.08,
  });

  const brass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E3A857'),
    metalness: 0.92,
    roughness: 0.2,
    anisotropy: 0.8,
    anisotropyRotation: Math.PI / 4,
    bumpMap: textures.metalBump,
    bumpScale: 0.015,
  });

  const coralEnamel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E8603A'),
    roughness: 0.24,
    metalness: 0.1,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
  });

  const tealEnamel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#3D8C7A'),
    roughness: 0.26,
    metalness: 0.1,
    clearcoat: 0.8,
    clearcoatRoughness: 0.16,
  });

  const goldHighlight = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FFC98B'),
    metalness: 0.85,
    roughness: 0.16,
    clearcoat: 0.6,
  });

  const glassDome = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FFFDF9'),
    roughness: 0.06,
    metalness: 0.0,
    transmission: isSoftwareGl ? 0 : 0.88,
    transparent: true,
    opacity: isSoftwareGl ? 0.34 : 1.0,
    ior: 1.52,
    thickness: 0.9,
    attenuationColor: new THREE.Color('#FDE4D8'),
    attenuationDistance: 4.5,
    clearcoat: 1.0,
    depthWrite: false,
  });

  const lanternGlow = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFE4B8'),
    emissive: new THREE.Color('#F08C4B'),
    emissiveIntensity: 1.35,
    roughness: 0.3,
    metalness: 0.05,
  });

  const bark = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6F4E37'),
    roughness: 0.92,
    metalness: 0.02,
  });

  const foliage = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'), // Tinted per instance via setColorAt
    roughness: 0.78,
    metalness: 0.02,
  });

  const boulder = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'), // Tinted per instance via setColorAt
    roughness: 0.9,
    metalness: 0.04,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  const ringCoral = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#E8603A'),
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    depthWrite: false,
  });

  const ringTeal = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#3D8C7A'),
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    depthWrite: false,
  });

  const radarSweep = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#E8603A'),
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    depthWrite: false,
  });

  const fireflyGlow = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFF8EC'),
    emissive: new THREE.Color('#FFC98B'),
    emissiveIntensity: 1.4,
    roughness: 0.25,
    metalness: 0.05,
  });

  const all = [
    terrain,
    plazaStone,
    terracotta,
    porcelain,
    espresso,
    brass,
    coralEnamel,
    tealEnamel,
    goldHighlight,
    glassDome,
    lanternGlow,
    bark,
    foliage,
    boulder,
    contactShadow,
    ringCoral,
    ringTeal,
    radarSweep,
    fireflyGlow,
  ];

  return {
    terrain,
    plazaStone,
    terracotta,
    porcelain,
    espresso,
    brass,
    coralEnamel,
    tealEnamel,
    goldHighlight,
    glassDome,
    lanternGlow,
    bark,
    foliage,
    boulder,
    contactShadow,
    ringCoral,
    ringTeal,
    radarSweep,
    fireflyGlow,
    dispose: () => {
      all.forEach((m) => m.dispose());
    },
  };
}
