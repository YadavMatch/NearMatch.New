import * as THREE from 'three';

export interface ProceduralTextureSet {
  terrainAlbedo: THREE.CanvasTexture;
  terrainBump: THREE.CanvasTexture;
  metalBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function createNoiseCanvas(size: number, drawFn: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawFn(ctx, size);
  }
  return canvas;
}

export function createProceduralTextureSet(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy || 1));

  // 1. Topographic neighborhood sandstone & subtle ~300m cartographic street texture
  const albedoCanvas = createNoiseCanvas(512, (ctx, s) => {
    ctx.fillStyle = '#F7EAD7';
    ctx.fillRect(0, 0, s, s);

    // Subtle organic warm grain
    for (let i = 0; i < 3600; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const y = (Math.sin(i * 78.233) * 19341.123) % 1;
      const px = Math.abs(x) * s;
      const py = Math.abs(y) * s;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(220, 184, 148, 0.20)' : 'rgba(255, 250, 242, 0.28)';
      ctx.fillRect(px, py, 2 + (i % 3), 2 + (i % 2));
    }

    // Subtle neighborhood block lines
    ctx.strokeStyle = 'rgba(186, 144, 108, 0.22)';
    ctx.lineWidth = 2;
    const step = s / 4;
    for (let g = 0; g <= s; g += step) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, s);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(s, g);
      ctx.stroke();
    }

    // Fine inner sub-blocks
    ctx.strokeStyle = 'rgba(186, 144, 108, 0.10)';
    ctx.lineWidth = 1;
    const subStep = s / 8;
    for (let g = subStep; g < s; g += subStep * 2) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, s);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(s, g);
      ctx.stroke();
    }
  });

  const terrainAlbedo = new THREE.CanvasTexture(albedoCanvas);
  terrainAlbedo.colorSpace = THREE.SRGBColorSpace;
  terrainAlbedo.wrapS = THREE.RepeatWrapping;
  terrainAlbedo.wrapT = THREE.RepeatWrapping;
  terrainAlbedo.repeat.set(10, 10);
  terrainAlbedo.anisotropy = aniso;

  // 2. Linear Terrain Bump Map
  const bumpCanvas = createNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 4200; i++) {
      const rx = Math.abs((Math.sin(i * 41.3) * 9183.7) % 1) * s;
      const ry = Math.abs((Math.sin(i * 93.7) * 5217.1) % 1) * s;
      const shade = 112 + (i % 36);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(rx, ry, 2, 2);
    }
  });

  const terrainBump = new THREE.CanvasTexture(bumpCanvas);
  terrainBump.wrapS = THREE.RepeatWrapping;
  terrainBump.wrapT = THREE.RepeatWrapping;
  terrainBump.repeat.set(14, 14);
  terrainBump.anisotropy = aniso;

  // 3. Linear Brushed Metal Bump Map
  const metalCanvas = createNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      const v = 114 + Math.round(Math.sin(y * 1.7) * 14 + (y % 5) * 3);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, s, 1);
    }
  });

  const metalBump = new THREE.CanvasTexture(metalCanvas);
  metalBump.wrapS = THREE.RepeatWrapping;
  metalBump.wrapT = THREE.RepeatWrapping;
  metalBump.repeat.set(3, 3);
  metalBump.anisotropy = aniso;

  // 4. Radial Contact Shadow Texture
  const shadowCanvas = createNoiseCanvas(256, (ctx, s) => {
    const grad = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(43, 26, 16, 0.56)');
    grad.addColorStop(0.5, 'rgba(43, 26, 16, 0.24)');
    grad.addColorStop(1, 'rgba(43, 26, 16, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  });

  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  return {
    terrainAlbedo,
    terrainBump,
    metalBump,
    contactShadow,
    dispose: () => {
      terrainAlbedo.dispose();
      terrainBump.dispose();
      metalBump.dispose();
      contactShadow.dispose();
    },
  };
}

export function createEmblemBadgeTexture(
  initials: string,
  score: number,
  isMatched: boolean,
  isSelected: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = createNoiseCanvas(256, (ctx, s) => {
    // Cream porcelain face
    ctx.fillStyle = isSelected ? '#FDE4D8' : '#FFF8EC';
    ctx.fillRect(0, 0, s, s);

    // Outer accent ring
    const accent = isMatched ? '#3D8C7A' : '#E8603A';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2);
    ctx.stroke();

    // Inner subtle ring
    ctx.strokeStyle = isMatched ? '#A9D7C8' : '#F5C4A8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.37, 0, Math.PI * 2);
    ctx.stroke();

    // Initials
    ctx.fillStyle = '#3D2817';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 74px Quicksand, sans-serif';
    ctx.fillText(initials || 'NM', s / 2, s * 0.45);

    // Score pill footer
    ctx.fillStyle = accent;
    ctx.font = '700 28px "JetBrains Mono", monospace';
    ctx.fillText(`${score}%`, s / 2, s * 0.72);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, Math.min(8, maxAnisotropy || 1));
  return tex;
}
