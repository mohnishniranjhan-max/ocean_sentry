import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Creates a high-quality procedural Earth texture focused on the Indian Ocean region.
 * Returns a CanvasTexture (2048×1024).
 */
export function useEarthTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const W = 2048, H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Helper: lat/lon → canvas (x,y)
    const C = (lat: number, lon: number): [number, number] => [
      ((lon + 180) / 360) * W,
      ((90 - lat) / 180) * H,
    ];

    // ── Deep ocean base ──────────────────────────────────────────────────────
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
    oceanGrad.addColorStop(0, '#061830');
    oceanGrad.addColorStop(0.5, '#071e3d');
    oceanGrad.addColorStop(1, '#040f1e');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, W, H);

    // Indian Ocean shimmer (Bay of Bengal + Arabian Sea)
    const applyOceanGlow = (lat: number, lon: number, rx: number, ry: number, alpha: number) => {
      const [cx, cy] = C(lat, lon);
      const grd = ctx.createRadialGradient(cx, cy, 10, cx, cy, rx);
      grd.addColorStop(0, `rgba(8,50,100,${alpha})`);
      grd.addColorStop(1, 'rgba(4,14,40,0)');
      ctx.save();
      ctx.scale(1, ry / rx);
      ctx.fillStyle = grd;
      ctx.fillRect(cx - rx, cy * (rx / ry) - ry, rx * 2, ry * 2);
      ctx.restore();
    };
    applyOceanGlow(10, 80, 300, 200, 0.55);  // Bay of Bengal
    applyOceanGlow(15, 62, 400, 280, 0.40);  // Arabian Sea
    applyOceanGlow(0,  75, 500, 350, 0.30);  // Indian Ocean

    // ── Land masses ──────────────────────────────────────────────────────────
    const land = (color: string, coords: [number, number][], alpha = 1.0) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      coords.forEach(([lat, lon], i) => {
        const [x, y] = C(lat, lon);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    // Africa
    land('#2a5a18', [
      [37,-6],[35,10],[28,15],[18,15],[10,14],[5,8],[0,10],[-5,10],
      [-18,12],[-30,16],[-34,18],[-34,26],[-34,34],[-26,34],[-18,38],
      [-12,40],[-4,40],[5,41],[12,45],[20,42],[28,34],[33,28],[37,28],[37,-6],
    ]);

    // Indian Subcontinent
    land('#3a6e20', [
      [37,72],[35,76],[30,76],[24,80],[20,84],[16,80],[10,78],[8,77],
      [8,80],[10,80],[14,80],[20,87],[24,91],[27,90],[30,80],[35,76],[37,72],
    ]);

    // Sri Lanka
    land('#3a6e20', [[9,80],[7,80],[6,81],[7,82],[9,81],[9,80]]);

    // Arabian Peninsula
    land('#8b7a4a', [
      [30,35],[30,50],[24,58],[18,56],[14,50],[12,44],[18,38],[22,36],[26,35],[30,35],
    ]);

    // Pakistan / Afghanistan
    land('#6b7a3a', [
      [37,62],[36,66],[32,68],[26,64],[24,66],[26,70],[30,74],[34,74],[37,72],[37,62],
    ]);

    // Myanmar / Thailand / Malay
    land('#2a5a18', [
      [28,98],[22,98],[18,100],[15,102],[10,99],[6,100],[2,103],[1,104],
      [2,103],[5,102],[10,99],[15,100],[20,96],[26,96],[28,98],
    ]);

    // Andaman Islands
    land('#2a5a18', [[13,93],[11,93],[10,93],[11,93],[13,93]]);

    // Bangladesh / Eastern India
    land('#3a6e20', [[24,88],[24,92],[20,92],[22,90],[20,87],[24,88]]);

    // Australia (distant)
    land('#74652a', [
      [-10,131],[-18,122],[-30,114],[-35,118],[-38,140],[-38,148],
      [-34,151],[-24,152],[-18,148],[-14,136],[-10,131],
    ]);

    // ── Coastline highlights ──────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(30,100,160,0.35)';
    ctx.lineWidth = 1.5;
    // India west coast
    ctx.beginPath();
    [[8,77],[10,76],[15,74],[18,73],[22,73],[26,70],[28,70]].forEach(([lat, lon], i) => {
      const [x, y] = C(lat, lon);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ── Ocean depth color patches ─────────────────────────────────────────────
    // Shallow continental shelf areas (lighter)
    const shelf = (lat: number, lon: number, r: number, alpha: number) => {
      const [cx, cy] = C(lat, lon);
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, `rgba(10,60,120,${alpha})`);
      grd.addColorStop(1, 'rgba(6,20,50,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    shelf(13, 80, 80, 0.5);   // Chennai shelf
    shelf(20, 87, 100, 0.4);  // Odisha shelf
    shelf(10, 79, 60, 0.4);   // Tamil Nadu coast

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/**
 * Creates a night lights / specular overlay texture.
 */
export function useSpecularTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const W = 1024, H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Ocean has higher specularity
    const oceanSpec = ctx.createLinearGradient(0, 0, 0, H);
    oceanSpec.addColorStop(0, 'rgba(80,80,80,1)');
    oceanSpec.addColorStop(1, 'rgba(60,60,60,1)');
    ctx.fillStyle = oceanSpec;
    ctx.fillRect(0, 0, W, H);

    // Land (lower specularity)
    ctx.fillStyle = 'rgba(20,20,20,1)';
    // crude land mask - India
    ctx.fillRect(390, 160, 90, 90);
    ctx.fillRect(380, 200, 120, 60);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);
}
