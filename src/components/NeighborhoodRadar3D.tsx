import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Grid,
  Heart,
  MapPin,
  Orbit,
  Sparkles,
  Star,
  Sun,
  X,
} from 'lucide-react';
import { displayDistance } from '../lib/matching';
import { createMaterialLibrary } from '../scene3d/materials';
import {
  buildAmbientFireflies,
  buildCandidateBeacon,
  buildConnectionArc,
  buildInstancedEnvironment,
  buildNeighborhoodLandmark,
  buildUserBeaconMonument,
  computePinWorldCoords,
  type CandidatePinHandle,
  type ConnectionArcHandle,
  type RadarPinInput,
} from '../scene3d/models';
import { buildTerrainAndRings } from '../scene3d/terrain';
import { createProceduralTextureSet } from '../scene3d/textures';
import type { PublicProfile, RankedCandidate, SwipeAction, UnifiedConversation } from '../types/models';
import { AvatarImage } from './AvatarImage';

export type RadarCameraPreset = 'panorama' | 'aerial' | 'focus';
export type RadarAtmospherePreset = 'golden' | 'morning' | 'twilight';

export interface NeighborhoodRadar3DProps {
  viewerName: string;
  viewerCity: string;
  maxDistanceKm: number;
  rankedCandidates: RankedCandidate[];
  conversations: UnifiedConversation[];
  demoFallbackProfiles?: PublicProfile[];
  isGuestPreview?: boolean;
  onClose: () => void;
  onSwipeCandidate?: (candidate: RankedCandidate, action: SwipeAction) => Promise<void>;
  onOpenChat?: (conversationId: string) => void;
  onGuestSignIn?: () => void;
}

interface RadarDisplayEntry {
  pin: RadarPinInput;
  profile: PublicProfile;
  ranked?: RankedCandidate;
  conversationId?: string;
}

// Pre-allocated scratch helpers (zero GC inside animation loop)
const _scratchTargetPos = new THREE.Vector3();
const _scratchLookAt = new THREE.Vector3();
const _scratchBeadPos = new THREE.Vector3();
const _scratchSky = new THREE.Color();
const _scratchKeyColor = new THREE.Color();
const _scratchHemiSky = new THREE.Color();
const _scratchHemiGround = new THREE.Color();
const _scratchPointer = new THREE.Vector2();

const ATMOSPHERE_TARGETS: Record<
  RadarAtmospherePreset,
  {
    bgHex: number;
    fogDensity: number;
    sunPos: [number, number, number];
    sunHex: number;
    sunIntensity: number;
    hemiSkyHex: number;
    hemiGroundHex: number;
    hemiIntensity: number;
    lanternIntensity: number;
  }
> = {
  golden: {
    bgHex: 0xf6dfc4,
    fogDensity: 0.0115,
    sunPos: [22, 24, 16],
    sunHex: 0xffe0b2,
    sunIntensity: 2.3,
    hemiSkyHex: 0xbfe2da,
    hemiGroundHex: 0x8f5d3e,
    hemiIntensity: 0.85,
    lanternIntensity: 1.15,
  },
  morning: {
    bgHex: 0xeaf4f1,
    fogDensity: 0.0105,
    sunPos: [14, 34, 22],
    sunHex: 0xfff4e2,
    sunIntensity: 2.15,
    hemiSkyHex: 0xcbe8f0,
    hemiGroundHex: 0x9b7556,
    hemiIntensity: 1.05,
    lanternIntensity: 0.45,
  },
  twilight: {
    bgHex: 0x2d2028,
    fogDensity: 0.0135,
    sunPos: [-18, 14, -20],
    sunHex: 0xffb37a,
    sunIntensity: 1.35,
    hemiSkyHex: 0x627391,
    hemiGroundHex: 0x3b2318,
    hemiIntensity: 0.72,
    lanternIntensity: 2.4,
  },
};

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function NeighborhoodRadar3D({
  viewerName,
  viewerCity,
  maxDistanceKm,
  rankedCandidates,
  conversations,
  demoFallbackProfiles = [],
  isGuestPreview = false,
  onClose,
  onSwipeCandidate,
  onOpenChat,
  onGuestSignIn,
}: NeighborhoodRadar3DProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [cameraPreset, setCameraPreset] = useState<RadarCameraPreset>('panorama');
  const [atmosphere, setAtmosphere] = useState<RadarAtmospherePreset>('golden');
  const [showPrivacyGrid, setShowPrivacyGrid] = useState(true);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<SwipeAction | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Merge ranked candidates + existing matches (or fallback profiles in guest preview)
  const displayEntries = useMemo<RadarDisplayEntry[]>(() => {
    const list: RadarDisplayEntry[] = [];
    const seenIds = new Set<string>();

    for (const c of rankedCandidates.slice(0, 10)) {
      seenIds.add(c.profile.uid);
      list.push({
        pin: {
          id: c.profile.uid,
          name: c.profile.displayName,
          age: c.profile.age,
          city: c.profile.city,
          distanceKm: c.breakdown.distanceKm,
          score: c.breakdown.total,
          isMatched: false,
          isDemo: Boolean(c.profile.isDemo),
        },
        profile: c.profile,
        ranked: c,
      });
    }

    for (const conv of conversations.slice(0, 6)) {
      if (seenIds.has(conv.partnerUid)) continue;
      seenIds.add(conv.partnerUid);
      list.push({
        pin: {
          id: conv.partnerUid,
          name: conv.partnerName,
          age: conv.partnerAge,
          city: conv.partnerCity,
          distanceKm: 2.4,
          score: conv.compatibilityScore,
          isMatched: true,
          isDemo: conv.kind === 'demo',
        },
        profile: {
          uid: conv.partnerUid,
          displayName: conv.partnerName,
          age: conv.partnerAge,
          city: conv.partnerCity,
          jobTitle: conv.partnerJobTitle,
          bio: conv.matchReasons.join(' · ') || 'Matched on NearMatch',
          interests: [],
          photos: conv.partnerPhoto ? [conv.partnerPhoto] : [],
          gender: 'other',
          interestedIn: ['woman', 'man', 'non_binary'],
          approxLat: 0,
          approxLng: 0,
          isOnboarded: true,
          isVisible: true,
          isDemo: conv.kind === 'demo',
          isBanned: false,
          isDeleted: false,
          lastActiveAt: conv.lastMessageAt,
          createdAt: conv.matchedAt,
          updatedAt: conv.lastMessageAt,
        },
        conversationId: conv.id,
      });
    }

    if (list.length === 0 && demoFallbackProfiles.length > 0) {
      demoFallbackProfiles.forEach((demo, idx) => {
        list.push({
          pin: {
            id: demo.uid,
            name: demo.displayName,
            age: demo.age,
            city: demo.city,
            distanceKm: 1.8 + idx * 1.9,
            score: 94 - idx * 4,
            isMatched: idx === 0,
            isDemo: true,
          },
          profile: demo,
        });
      });
    }

    return list;
  }, [rankedCandidates, conversations, demoFallbackProfiles]);

  const activeSelection = useMemo(
    () =>
      displayEntries.find((e) => e.pin.id === selectedPinId) ??
      displayEntries[0] ??
      null,
    [displayEntries, selectedPinId]
  );

  useEffect(() => {
    if (!selectedPinId && displayEntries[0]) {
      setSelectedPinId(displayEntries[0].pin.id);
    }
  }, [displayEntries, selectedPinId]);

  // Mutable refs for React -> WebGL sync without tearing down canvas
  const stateRef = useRef({
    cameraPreset,
    atmosphere,
    showPrivacyGrid,
    autoOrbit,
    selectedPinId: activeSelection?.pin.id ?? null,
    cameraTransitionActive: false,
  });
  stateRef.current.cameraPreset = cameraPreset;
  stateRef.current.atmosphere = atmosphere;
  stateRef.current.showPrivacyGrid = showPrivacyGrid;
  stateRef.current.autoOrbit = autoOrbit;
  stateRef.current.selectedPinId = activeSelection?.pin.id ?? null;

  const rebuildPinsRef = useRef<
    ((entries: RadarDisplayEntry[], maxKm: number, selectedId: string | null) => void) | null
  >(null);

  const triggerPresetTransition = (preset: RadarCameraPreset) => {
    setCameraPreset(preset);
    stateRef.current.cameraPreset = preset;
    stateRef.current.cameraTransitionActive = true;
  };

  // Keyboard shortcut: 'H' toggles HUD drawer, 'Escape' closes radar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Core Three.js WebGL lifecycle mounted once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initialAtmo = ATMOSPHERE_TARGETS[stateRef.current.atmosphere];
    scene.background = new THREE.Color(initialAtmo.bgHex);
    scene.fog = new THREE.FogExp2(initialAtmo.bgHex, initialAtmo.fogDensity);

    // Studio reflection map via RoomEnvironment on every device
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.25, 220);
    camera.position.set(16, 13.5, 22);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6.5;
    controls.maxDistance = 48;
    controls.minPolarAngle = 0.22;
    controls.maxPolarAngle = Math.PI / 2 - 0.07;
    controls.target.set(0, 1.4, 0);

    controls.addEventListener('start', () => {
      stateRef.current.cameraTransitionActive = false;
      if (stateRef.current.autoOrbit) {
        stateRef.current.autoOrbit = false;
        setAutoOrbit(false);
      }
    });

    // 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      initialAtmo.hemiSkyHex,
      initialAtmo.hemiGroundHex,
      initialAtmo.hemiIntensity
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(initialAtmo.sunHex, initialAtmo.sunIntensity);
    keyLight.position.set(...initialAtmo.sunPos);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 75;
    keyLight.shadow.camera.left = -26;
    keyLight.shadow.camera.right = 26;
    keyLight.shadow.camera.top = 26;
    keyLight.shadow.camera.bottom = -26;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffc98b, 0.55);
    rimLight.position.set(-18, 11, -18);
    scene.add(rimLight);

    let softboxLight: THREE.RectAreaLight | null = null;
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      softboxLight = new THREE.RectAreaLight(0xfff1dc, 2.2, 8, 6);
      softboxLight.position.set(-8, 12, 10);
      softboxLight.lookAt(0, 2, 0);
      scene.add(softboxLight);
    }

    // Procedural Textures & PBR Material Library
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextureSet(maxAniso);
    const materials = createMaterialLibrary(textures, isSoftwareGl);

    // Terrain, Rings & Privacy Grid
    const terrainBuild = buildTerrainAndRings(maxDistanceKm, materials);
    scene.add(terrainBuild.group);

    // Central User Beacon Monument
    const monument = buildUserBeaconMonument(materials);
    scene.add(monument.group);

    // Neighborhood Composite Landmarks
    const cafeLandmark = buildNeighborhoodLandmark('cafe', -8.8, -6.2, 0.45, materials);
    const conservatoryLandmark = buildNeighborhoodLandmark('conservatory', 9.2, -5.8, -0.5, materials);
    const bookstoreLandmark = buildNeighborhoodLandmark('bookstore', -1.8, 10.2, 0.28, materials);
    scene.add(cafeLandmark.group, conservatoryLandmark.group, bookstoreLandmark.group);

    // Instanced Trees, Perimeter Boulders, Bollards & Ambient Fireflies
    const instancedEnv = buildInstancedEnvironment(materials);
    const fireflies = buildAmbientFireflies(42, materials);
    scene.add(instancedEnv.group, fireflies.group);

    // Dynamic Candidate Beacons & Signal Arcs Container
    const dynamicPinsGroup = new THREE.Group();
    scene.add(dynamicPinsGroup);

    let pinHandles: CandidatePinHandle[] = [];
    let arcHandles: ConnectionArcHandle[] = [];
    let hitProxies: THREE.Object3D[] = [];

    const rebuildPins = (
      entries: RadarDisplayEntry[],
      currentMaxKm: number,
      selectedId: string | null
    ) => {
      pinHandles.forEach((h) => {
        dynamicPinsGroup.remove(h.group);
        h.dispose();
      });
      arcHandles.forEach((a) => {
        dynamicPinsGroup.remove(a.group);
        a.dispose();
      });
      pinHandles = [];
      arcHandles = [];
      hitProxies = [];

      entries.forEach((entry, idx) => {
        const { x, z } = computePinWorldCoords(
          entry.pin.id,
          idx,
          entries.length,
          entry.pin.distanceKm,
          currentMaxKm
        );
        const isSel = entry.pin.id === selectedId;
        const pinHandle = buildCandidateBeacon(
          entry.pin,
          x,
          z,
          isSel,
          materials,
          maxAniso
        );
        dynamicPinsGroup.add(pinHandle.group);
        pinHandles.push(pinHandle);
        hitProxies.push(pinHandle.hitProxy);

        if (entry.pin.isMatched || isSel) {
          const arc = buildConnectionArc(pinHandle.worldPos, entry.pin.isMatched);
          dynamicPinsGroup.add(arc.group);
          arcHandles.push(arc);
        }
      });
    };

    rebuildPinsRef.current = rebuildPins;
    rebuildPins(displayEntries, maxDistanceKm, activeSelection?.pin.id ?? null);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting on Layer 1
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let lastHoverCheck = 0;

    const updatePointerFromEvent = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _scratchPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _scratchPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 36) return;
      lastHoverCheck = now;
      updatePointerFromEvent(e.clientX, e.clientY);
      raycaster.setFromCamera(_scratchPointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    let downPos = { x: 0, y: 0 };
    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (moved > 8) return; // Ignore orbit drag
      updatePointerFromEvent(e.clientX, e.clientY);
      raycaster.setFromCamera(_scratchPointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const pinId = hits[0].object.userData.pinId as string | undefined;
        if (pinId) {
          setSelectedPinId(pinId);
          stateRef.current.selectedPinId = pinId;
          stateRef.current.cameraPreset = 'focus';
          setCameraPreset('focus');
          stateRef.current.cameraTransitionActive = true;
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for crisp layout adaptation
    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation loop with software WebGL pacing and exponential damping
    let disposed = false;
    let frameId = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync && gl.deleteSync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync && gl.deleteSync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();

      // 1. Monument & Beacon gentle orbital craft motion
      monument.outerGimbal.rotation.y = elapsed * 0.42;
      monument.outerGimbal.rotation.x = Math.sin(elapsed * 0.55) * 0.25;
      monument.innerGimbal.rotation.z = -elapsed * 0.65;
      monument.heartCluster.rotation.y = Math.sin(elapsed * 0.6) * 0.35;
      monument.heartCluster.position.y = 2.36 + Math.sin(elapsed * 1.4) * 0.08;

      const selectedId = stateRef.current.selectedPinId;
      const dampFast = 1 - Math.exp(-7 * dt);

      for (let i = 0; i < pinHandles.length; i++) {
        const pin = pinHandles[i];
        const isSel = pin.id === selectedId;
        const targetLift = isSel ? pin.baseY + 0.48 + Math.sin(elapsed * 2.2) * 0.08 : pin.baseY;
        pin.group.position.y = THREE.MathUtils.lerp(pin.group.position.y, targetLift, dampFast);
        pin.haloRing.rotation.z = elapsed * (isSel ? 1.6 : 0.6);
        pin.headGroup.rotation.y = Math.sin(elapsed * 0.7 + i) * 0.35;
      }

      // 2. Flowing signal beads along parabolic connection arcs
      for (let i = 0; i < arcHandles.length; i++) {
        const arc = arcHandles[i];
        const t = (elapsed * 0.35 + i * 0.23) % 1;
        arc.curve.getPointAt(t, _scratchBeadPos);
        arc.pulseBead.position.copy(_scratchBeadPos);
      }

      // 3. Privacy grid visibility & expanding radar sweep ring
      terrainBuild.privacyGrid.visible = stateRef.current.showPrivacyGrid;
      const sweepT = (elapsed * 0.22) % 1;
      const sweepRadius = 2.5 + sweepT * 20.0;
      terrainBuild.radarSweepRing.scale.set(sweepRadius, 1, sweepRadius);
      materials.radarSweep.opacity = (1 - sweepT) * 0.34;

      // 3b. Ambient drifting fireflies
      fireflies.update(elapsed, stateRef.current.atmosphere);

      // 4. Exponential damping for atmosphere & lighting
      const atmoTarget = ATMOSPHERE_TARGETS[stateRef.current.atmosphere];
      const dampAtmo = 1 - Math.exp(-3.5 * dt);
      _scratchSky.setHex(atmoTarget.bgHex);
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(_scratchSky, dampAtmo);
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.lerp(_scratchSky, dampAtmo);
        scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, atmoTarget.fogDensity, dampAtmo);
      }

      _scratchTargetPos.set(...atmoTarget.sunPos);
      keyLight.position.lerp(_scratchTargetPos, dampAtmo);
      _scratchKeyColor.setHex(atmoTarget.sunHex);
      keyLight.color.lerp(_scratchKeyColor, dampAtmo);
      keyLight.intensity = THREE.MathUtils.lerp(keyLight.intensity, atmoTarget.sunIntensity, dampAtmo);

      _scratchHemiSky.setHex(atmoTarget.hemiSkyHex);
      _scratchHemiGround.setHex(atmoTarget.hemiGroundHex);
      hemiLight.color.lerp(_scratchHemiSky, dampAtmo);
      hemiLight.groundColor.lerp(_scratchHemiGround, dampAtmo);
      hemiLight.intensity = THREE.MathUtils.lerp(hemiLight.intensity, atmoTarget.hemiIntensity, dampAtmo);
      materials.lanternGlow.emissiveIntensity = THREE.MathUtils.lerp(
        materials.lanternGlow.emissiveIntensity,
        atmoTarget.lanternIntensity,
        dampAtmo
      );

      // 5. Exponentially damped camera preset glide (yields immediately on OrbitControls start)
      if (stateRef.current.cameraTransitionActive) {
        const preset = stateRef.current.cameraPreset;
        if (preset === 'aerial') {
          _scratchTargetPos.set(0, 34, 9);
          _scratchLookAt.set(0, 0, 0);
        } else if (preset === 'focus' && selectedId) {
          const targetPin = pinHandles.find((p) => p.id === selectedId);
          if (targetPin) {
            const p = targetPin.worldPos;
            const dirLen = Math.max(0.01, Math.hypot(p.x, p.z));
            const nx = p.x / dirLen;
            const nz = p.z / dirLen;
            _scratchTargetPos.set(p.x + nx * 6.5 + nz * 3.0, p.y + 5.2, p.z + nz * 6.5 - nx * 3.0);
            _scratchLookAt.set(p.x, p.y + 2.0, p.z);
          } else {
            _scratchTargetPos.set(16, 13.5, 22);
            _scratchLookAt.set(0, 1.4, 0);
          }
        } else {
          _scratchTargetPos.set(16, 13.5, 22);
          _scratchLookAt.set(0, 1.4, 0);
        }

        const camDamp = 1 - Math.exp(-5.0 * dt);
        camera.position.lerp(_scratchTargetPos, camDamp);
        controls.target.lerp(_scratchLookAt, camDamp);
        if (
          camera.position.distanceTo(_scratchTargetPos) < 0.08 &&
          controls.target.distanceTo(_scratchLookAt) < 0.06
        ) {
          stateRef.current.cameraTransitionActive = false;
        }
      }

      controls.autoRotate =
        !isSoftwareGl && stateRef.current.autoOrbit && !stateRef.current.cameraTransitionActive;
      controls.autoRotateSpeed = 0.65;
      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);

      controls.dispose();
      pinHandles.forEach((h) => h.dispose());
      arcHandles.forEach((a) => a.dispose());
      monument.dispose();
      cafeLandmark.dispose();
      conservatoryLandmark.dispose();
      bookstoreLandmark.dispose();
      fireflies.dispose();
      instancedEnv.dispose();
      terrainBuild.dispose();
      materials.dispose();
      textures.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, []);

  // Live sync React state updates into Three.js pins without remounting WebGL canvas
  useEffect(() => {
    rebuildPinsRef.current?.(displayEntries, maxDistanceKm, activeSelection?.pin.id ?? null);
  }, [displayEntries, maxDistanceKm, activeSelection?.pin.id]);

  const handleDockSwipe = async (action: SwipeAction) => {
    if (!activeSelection?.ranked || !onSwipeCandidate || busyAction) return;
    setBusyAction(action);
    setStatusNote(null);
    try {
      await onSwipeCandidate(activeSelection.ranked, action);
      setStatusNote(
        action === 'like'
          ? `Liked ${activeSelection.pin.name.split(' ')[0]}`
          : action === 'superlike'
          ? `Super Liked ${activeSelection.pin.name.split(' ')[0]}`
          : `Passed ${activeSelection.pin.name.split(' ')[0]}`
      );
    } catch (err) {
      setStatusNote(err instanceof Error ? err.message : 'Unable to record swipe.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen overflow-hidden bg-[#F6DFC4]">
      {/* Isolated WebGL Mount Container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Minimal Top-Left Floating Identity Pill (No backdrop-filter over WebGL, no pulsing dots) */}
      <div className="fixed top-4 left-4 z-50 flex flex-wrap items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[40px] px-3.5 py-2 rounded-full bg-[#FFF8EC]/94 border border-[#F5C4A8] text-[#3D2817] hover:bg-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#E8603A]" />
          <span>{isGuestPreview ? 'Back to Home' : 'Back to Discover'}</span>
        </button>

        <div className="min-h-[40px] px-4 py-2 rounded-full bg-[#FFF8EC]/94 border border-[#F5C4A8] text-[#3D2817] inline-flex items-center gap-2.5 shadow-md">
          <span className="font-logo text-base text-[#E8603A]">NearMatch 3D</span>
          <span className="text-[11px] font-mono text-[#2E6B5C] font-semibold">
            {viewerName.split(' ')[0]} · {viewerCity} · {maxDistanceKm} km
          </span>
        </div>
      </div>

      {/* Unified Collapsible Bottom Control Dock (Zero Mid-Left/Right/Top-Right Cards) */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-50 w-[min(920px,94vw)] transition-transform duration-300 ease-out pointer-events-auto ${
          dockCollapsed ? 'bottom-3 translate-y-[calc(100%-36px)]' : 'bottom-5 translate-y-0'
        }`}
      >
        {/* Top Edge Drawer Toggle */}
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="min-h-[32px] px-4 py-1 rounded-full bg-[#2B1A10]/92 text-[#FFF8EC] border border-[#7A5234] text-[11px] font-bold inline-flex items-center gap-1.5 shadow-md cursor-pointer"
            title="Toggle 3D controls (H)"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-[#FFC98B]" />
                <span>Show 3D Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-[#FFC98B]" />
                <span>Hide Controls (H)</span>
              </>
            )}
          </button>
        </div>

        {/* Compact Horizontal Dock Panel (Solid/rgba surface, NO backdrop-filter) */}
        <div className="bg-[#FFF8EC]/96 border border-[#F5C4A8] rounded-3xl p-3.5 sm:p-4 shadow-[0_14px_36px_rgba(43,26,16,0.22)] space-y-3">
          {/* Selected Beacon Strip */}
          {activeSelection ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F5C4A8]">
              <div className="flex items-center gap-3 min-w-0">
                <AvatarImage
                  src={activeSelection.profile.photos[0]}
                  name={activeSelection.pin.name}
                  className="w-11 h-11 rounded-2xl border border-[#F5C4A8] shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#3D2817] truncate">
                      {activeSelection.pin.name}, {activeSelection.pin.age}
                    </p>
                    <span className="font-mono text-[11px] font-bold text-[#2E6B5C] bg-[#DCF0EA] px-2 py-0.5 rounded-md shrink-0">
                      {activeSelection.pin.score}% match
                    </span>
                  </div>
                  <p className="text-xs text-[#7A5234] flex items-center gap-1.5 truncate">
                    <MapPin className="w-3 h-3 text-[#E8603A] shrink-0" />
                    <span>
                      {activeSelection.pin.city} · {displayDistance(activeSelection.pin.distanceKm)}
                      {activeSelection.pin.isMatched ? ' · Connected' : ''}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {statusNote ? (
                  <span className="text-[11px] font-bold text-[#2E6B5C] px-2">{statusNote}</span>
                ) : null}

                {isGuestPreview ? (
                  <button
                    type="button"
                    onClick={onGuestSignIn}
                    className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-xs font-bold cursor-pointer"
                  >
                    Sign in with Google to Connect
                  </button>
                ) : activeSelection.conversationId && onOpenChat ? (
                  <button
                    type="button"
                    onClick={() => onOpenChat(activeSelection.conversationId!)}
                    className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white text-xs font-bold cursor-pointer"
                  >
                    Open Live Chat
                  </button>
                ) : activeSelection.ranked && onSwipeCandidate ? (
                  <>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => void handleDockSwipe('pass')}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#F5C4A8] bg-white hover:bg-[#FDE4D8] text-[#7A5234] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Pass</span>
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => void handleDockSwipe('superlike')}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#A9D7C8] bg-[#DCF0EA] hover:bg-[#CBE8DF] text-[#2E6B5C] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>Super Like</span>
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => void handleDockSwipe('like')}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>Like</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Controls Row: Camera Presets · Lighting · Grid · Beacon Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono uppercase tracking-wider text-[10px] text-[#7A5234] font-semibold mr-1 inline-flex items-center gap-1">
                <Orbit className="w-3 h-3 text-[#E8603A]" />
                View
              </span>
              {(
                [
                  { id: 'panorama', label: 'Panorama' },
                  { id: 'aerial', label: 'Aerial Radar' },
                  { id: 'focus', label: 'Focus Pin' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => triggerPresetTransition(preset.id)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-xl font-bold transition-colors cursor-pointer ${
                    cameraPreset === preset.id
                      ? 'bg-[#E8603A] text-white'
                      : 'bg-white border border-[#F5C4A8] text-[#7A5234] hover:border-[#E8603A]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono uppercase tracking-wider text-[10px] text-[#7A5234] font-semibold mr-1 inline-flex items-center gap-1">
                <Sun className="w-3 h-3 text-[#E8603A]" />
                Light
              </span>
              {(
                [
                  { id: 'golden', label: 'Golden Hour' },
                  { id: 'morning', label: 'Morning' },
                  { id: 'twilight', label: 'Twilight' },
                ] as const
              ).map((atmo) => (
                <button
                  key={atmo.id}
                  type="button"
                  onClick={() => setAtmosphere(atmo.id)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-xl font-bold transition-colors cursor-pointer ${
                    atmosphere === atmo.id
                      ? 'bg-[#3D8C7A] text-white'
                      : 'bg-white border border-[#F5C4A8] text-[#7A5234] hover:border-[#3D8C7A]'
                  }`}
                >
                  {atmo.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAutoOrbit((v) => !v)}
                className={`min-h-[34px] px-2.5 py-1 rounded-xl font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  autoOrbit
                    ? 'bg-[#E8603A] text-white'
                    : 'bg-white border border-[#F5C4A8] text-[#7A5234] hover:border-[#E8603A]'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Auto-Orbit</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrivacyGrid((v) => !v)}
                className={`min-h-[34px] px-2.5 py-1 rounded-xl font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showPrivacyGrid
                    ? 'bg-[#DCF0EA] border border-[#A9D7C8] text-[#2E6B5C]'
                    : 'bg-white border border-[#F5C4A8] text-[#7A5234]'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>~300m Grid</span>
              </button>

              {displayEntries.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    const idx = displayEntries.findIndex((e) => e.pin.id === activeSelection?.pin.id);
                    const next = displayEntries[(idx + 1) % displayEntries.length];
                    if (next) {
                      setSelectedPinId(next.pin.id);
                      stateRef.current.selectedPinId = next.pin.id;
                      triggerPresetTransition('focus');
                    }
                  }}
                  className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white border border-[#F5C4A8] hover:border-[#E8603A] text-[#3D2817] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E8603A]" />
                  <span>Next Pin</span>
                </button>
              ) : (
                <span className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white border border-[#F5C4A8] text-[#7A5234] font-bold inline-flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>{displayEntries.length} Active</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
