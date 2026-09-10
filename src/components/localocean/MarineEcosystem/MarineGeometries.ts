import * as THREE from 'three';

// ── 1. High-Fidelity Organic Fish Geometry ──────────────────────────────────

export function createHighFidelityFishGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();

  const segmentsZ = 28;
  const segmentsRadial = 16;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Longitudinal profile along Z (Length 1.0, from snout Z=+0.5 to peduncle Z=-0.5)
  for (let i = 0; i <= segmentsZ; i++) {
    const t = i / segmentsZ;
    const z = 0.5 - t * 1.0;

    let rx = 0;
    let ry = 0;
    let offsetY = 0;

    if (t < 0.18) {
      const headT = t / 0.18;
      rx = Math.sin(headT * Math.PI * 0.5) * 0.11;
      ry = Math.sin(headT * Math.PI * 0.5) * 0.15;
      offsetY = -0.015 * (1 - headT);
    } else if (t < 0.82) {
      const bodyT = (t - 0.18) / 0.64;
      const profile = Math.sin(bodyT * Math.PI);
      rx = 0.11 + profile * 0.08;
      ry = 0.15 + profile * 0.13;
      offsetY = profile * 0.02;
    } else {
      const tailT = (t - 0.82) / 0.18;
      rx = (1 - tailT) * 0.11 + 0.025;
      ry = (1 - tailT) * 0.15 + 0.04;
      offsetY = 0;
    }

    for (let j = 0; j <= segmentsRadial; j++) {
      const theta = (j / segmentsRadial) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      const x = cos * rx;
      const y = sin * ry + offsetY;

      positions.push(x, y, z);

      const nx = cos;
      const ny = sin;
      const nz = (t - 0.45) * 0.4;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals.push(nx / len, ny / len, nz / len);

      uvs.push(j / segmentsRadial, t);
    }
  }

  const ringStride = segmentsRadial + 1;
  for (let i = 0; i < segmentsZ; i++) {
    for (let j = 0; j < segmentsRadial; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Forked Caudal Tail Fin
  const tailBaseIdx = positions.length / 3;
  const tailVerts = [
    0, 0, -0.5,
    0, 0.28, -0.88,
    0, 0.07, -0.72,
    0, 0, -0.66,
    0, -0.07, -0.72,
    0, -0.28, -0.88,
  ];

  for (let i = 0; i < tailVerts.length; i += 3) {
    positions.push(tailVerts[i], tailVerts[i + 1], tailVerts[i + 2]);
    normals.push(1, 0, 0);
    uvs.push(0.5, 1.0);
  }

  const tb = tailBaseIdx;
  indices.push(
    tb, tb + 1, tb + 2,
    tb, tb + 2, tb + 3,
    tb, tb + 3, tb + 4,
    tb, tb + 4, tb + 5,
    tb, tb + 2, tb + 1,
    tb, tb + 3, tb + 2,
    tb, tb + 4, tb + 3,
    tb, tb + 5, tb + 4
  );

  // Dorsal Fin
  const dorsalBaseIdx = positions.length / 3;
  const dorsalVerts = [
    0, 0.17, 0.12,
    0, 0.38, -0.04,
    0, 0.32, -0.16,
    0, 0.13, -0.22,
  ];
  for (let i = 0; i < dorsalVerts.length; i += 3) {
    positions.push(dorsalVerts[i], dorsalVerts[i + 1], dorsalVerts[i + 2]);
    normals.push(1, 0, 0);
    uvs.push(0.5, 0.5);
  }
  const db = dorsalBaseIdx;
  indices.push(
    db, db + 1, db + 2,
    db, db + 2, db + 3,
    db, db + 2, db + 1,
    db, db + 3, db + 2
  );

  // Pectoral Fins
  const pectBaseIdx = positions.length / 3;
  const pectVerts = [
    0.13, -0.04, 0.22,
    0.36, -0.14, 0.06,
    0.11, -0.07, 0.08,
    -0.13, -0.04, 0.22,
    -0.36, -0.14, 0.06,
    -0.11, -0.07, 0.08,
  ];
  for (let i = 0; i < pectVerts.length; i += 3) {
    positions.push(pectVerts[i], pectVerts[i + 1], pectVerts[i + 2]);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);
  }
  const pb = pectBaseIdx;
  indices.push(
    pb, pb + 1, pb + 2,
    pb, pb + 2, pb + 1,
    pb + 3, pb + 4, pb + 5,
    pb + 3, pb + 5, pb + 4
  );

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

// ── 2. Pelagic Tuna & Mackerel Geometry ──────────────────────────────────────

export function createTunaGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const segmentsZ = 24;
  const segmentsRadial = 16;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segmentsZ; i++) {
    const t = i / segmentsZ;
    const z = 0.8 - t * 1.6;

    let rx = 0;
    let ry = 0;

    if (t < 0.22) {
      const headT = t / 0.22;
      rx = Math.sin(headT * Math.PI * 0.5) * 0.18;
      ry = Math.sin(headT * Math.PI * 0.5) * 0.24;
    } else if (t < 0.80) {
      const bodyT = (t - 0.22) / 0.58;
      const profile = Math.sin(bodyT * Math.PI);
      rx = 0.18 + profile * 0.12;
      ry = 0.24 + profile * 0.16;
    } else {
      const tailT = (t - 0.80) / 0.20;
      rx = (1 - tailT) * 0.18 + 0.04;
      ry = (1 - tailT) * 0.24 + 0.06;
    }

    for (let j = 0; j <= segmentsRadial; j++) {
      const theta = (j / segmentsRadial) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      positions.push(cos * rx, sin * ry, z);

      const nx = cos;
      const ny = sin;
      const nz = (t - 0.4) * 0.35;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals.push(nx / len, ny / len, nz / len);
      uvs.push(j / segmentsRadial, t);
    }
  }

  const ringStride = segmentsRadial + 1;
  for (let i = 0; i < segmentsZ; i++) {
    for (let j = 0; j < segmentsRadial; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Lunate caudal tail fin
  const tailBaseIdx = positions.length / 3;
  const tailVerts = [
    0, 0, -0.8,
    0, 0.45, -1.25,
    0, 0.08, -1.05,
    0, 0, -0.98,
    0, -0.08, -1.05,
    0, -0.45, -1.25,
  ];
  for (let i = 0; i < tailVerts.length; i += 3) {
    positions.push(tailVerts[i], tailVerts[i + 1], tailVerts[i + 2]);
    normals.push(1, 0, 0);
    uvs.push(0.5, 1.0);
  }
  const tb = tailBaseIdx;
  indices.push(
    tb, tb + 1, tb + 2,
    tb, tb + 2, tb + 3,
    tb, tb + 3, tb + 4,
    tb, tb + 4, tb + 5,
    tb, tb + 2, tb + 1,
    tb, tb + 3, tb + 2,
    tb, tb + 4, tb + 3,
    tb, tb + 5, tb + 4
  );

  // Dorsal fin
  const dorsalIdx = positions.length / 3;
  const dorsalVerts = [
    0, 0.28, 0.25,
    0, 0.62, 0.05,
    0, 0.52, -0.15,
    0, 0.22, -0.28,
  ];
  for (let i = 0; i < dorsalVerts.length; i += 3) {
    positions.push(dorsalVerts[i], dorsalVerts[i + 1], dorsalVerts[i + 2]);
    normals.push(1, 0, 0);
    uvs.push(0.5, 0.5);
  }
  const di = dorsalIdx;
  indices.push(
    di, di + 1, di + 2,
    di, di + 2, di + 3,
    di, di + 2, di + 1,
    di, di + 3, di + 2
  );

  // Pectoral fins
  const pectIdx = positions.length / 3;
  const pectVerts = [
    0.22, -0.06, 0.35,
    0.58, -0.22, 0.05,
    0.18, -0.10, 0.08,
    -0.22, -0.06, 0.35,
    -0.58, -0.22, 0.05,
    -0.18, -0.10, 0.08,
  ];
  for (let i = 0; i < pectVerts.length; i += 3) {
    positions.push(pectVerts[i], pectVerts[i + 1], pectVerts[i + 2]);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);
  }
  const pi = pectIdx;
  indices.push(
    pi, pi + 1, pi + 2,
    pi, pi + 2, pi + 1,
    pi + 3, pi + 4, pi + 5,
    pi + 3, pi + 5, pi + 4
  );

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

// ── 3. High-Resolution Anatomical Shark Geometry with Counter-Shading ─────────
// 48 longitudinal rings x 24 radial segments with conical rostrum snout,
// recessed mouth arch, 5 gill slits, muscular arched torso, lateral keels,
// swept primary dorsal, secondary dorsal, anal fin, pectoral foils, and
// true heterocercal caudal fin with upper/lower lobes and subterminal notch.

export function createRealisticSharkGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const segmentsZ = 48;
  const segmentsRadial = 24;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // PBR Counter-Shading Colors
  const dorsalColor = new THREE.Color('#1e293b'); // Dark oceanic slate gray/navy
  const ventralColor = new THREE.Color('#f8fafc'); // Pale white/silver belly

  for (let i = 0; i <= segmentsZ; i++) {
    const t = i / segmentsZ; // 0 = rostrum tip, 1 = caudal peduncle
    const z = 1.45 - t * 2.85; // Length ~2.85m

    let rx = 0;
    let ry = 0;
    let offsetY = 0;

    if (t < 0.12) {
      // 1. Rostrum / Pointed conical snout
      const headT = t / 0.12;
      rx = Math.sin(headT * Math.PI * 0.5) * 0.22;
      ry = Math.sin(headT * Math.PI * 0.5) * 0.18;
      offsetY = -0.03 * (1 - headT);
    } else if (t < 0.24) {
      // 2. Head, Mouth arch and Gill region
      const headT = (t - 0.12) / 0.12;
      rx = 0.22 + headT * 0.14;
      ry = 0.18 + headT * 0.16;
      offsetY = -0.03 + headT * 0.04;
    } else if (t < 0.70) {
      // 3. Muscular Torso & Dorsal Hump
      const bodyT = (t - 0.24) / 0.46;
      const profile = Math.sin(bodyT * Math.PI);
      rx = 0.36 + profile * 0.10;
      ry = 0.34 + profile * 0.14;
      offsetY = 0.01 + profile * 0.05; // Arch along upper spine
    } else {
      // 4. Narrowing Caudal Peduncle & Lateral Keels
      const tailT = (t - 0.70) / 0.30;
      rx = (1 - tailT) * 0.36 + 0.08;
      ry = (1 - tailT) * 0.34 + 0.07;
      offsetY = (1 - tailT) * 0.01;
    }

    for (let j = 0; j <= segmentsRadial; j++) {
      const theta = (j / segmentsRadial) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      // Flatter belly, taller dorsal arch
      const yMod = sin < 0 ? 0.85 : 1.15;
      const x = cos * rx;
      const y = sin * ry * yMod + offsetY;

      positions.push(x, y, z);

      const nx = cos;
      const ny = sin;
      const nz = (t - 0.4) * 0.3;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals.push(nx / len, ny / len, nz / len);

      uvs.push(j / segmentsRadial, t);

      // Counter-Shading Vertex Color Calculation
      // Y > 0 is dark dorsal, Y < 0 is pale ventral belly
      const counterFactor = THREE.MathUtils.smoothstep(y, -0.12, 0.16);
      const c = new THREE.Color().lerpColors(ventralColor, dorsalColor, counterFactor);
      colors.push(c.r, c.g, c.b);
    }
  }

  const ringStride = segmentsRadial + 1;
  for (let i = 0; i < segmentsZ; i++) {
    for (let j = 0; j < segmentsRadial; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // 1. Tall Swept Primary Dorsal Fin with Realistic Leading Edge Curve (Z = 0.35 to -0.40)
  const dorsalIdx = positions.length / 3;
  const dorsalVerts = [
    0, 0.44, 0.35,   // Front root
    0, 1.12, -0.05,  // Apex tip
    0, 0.98, -0.22,  // Trailing sweep
    0, 0.42, -0.38,  // Rear root
    0, 0.45, -0.44,  // Rear free notch tip
  ];
  for (let i = 0; i < dorsalVerts.length; i += 3) {
    positions.push(dorsalVerts[i], dorsalVerts[i + 1], dorsalVerts[i + 2]);
    normals.push(1, 0, 0);
    uvs.push(0.5, 0.5);
    colors.push(dorsalColor.r, dorsalColor.g, dorsalColor.b);
  }
  const di = dorsalIdx;
  indices.push(
    di, di + 1, di + 2,
    di, di + 2, di + 3,
    di, di + 3, di + 4,
    // Double-sided
    di, di + 2, di + 1,
    di, di + 3, di + 2,
    di, di + 4, di + 3
  );

  // 2. Secondary Dorsal Fin & Anal Fin (Z = -0.95 to -1.25)
  const secFinIdx = positions.length / 3;
  const secFinVerts = [
    // Secondary Dorsal
    0, 0.16, -0.95,
    0, 0.35, -1.12,
    0, 0.12, -1.22,
    // Anal Fin (Lower)
    0, -0.15, -0.98,
    0, -0.32, -1.14,
    0, -0.11, -1.24,
  ];
  for (let i = 0; i < secFinVerts.length; i += 3) {
    positions.push(secFinVerts[i], secFinVerts[i + 1], secFinVerts[i + 2]);
    normals.push(1, 0, 0);
    uvs.push(0.5, 0.5);
    colors.push(dorsalColor.r, dorsalColor.g, dorsalColor.b);
  }
  const sfi = secFinIdx;
  indices.push(
    sfi, sfi + 1, sfi + 2,
    sfi, sfi + 2, sfi + 1,
    sfi + 3, sfi + 4, sfi + 5,
    sfi + 3, sfi + 5, sfi + 4
  );

  // 3. Paired Hydrofoil Pectoral Fins (Span ~2.6m)
  const pectIdx = positions.length / 3;
  const pectVerts = [
    // Left Pectoral
    0.42, -0.10, 0.62,
    1.38, -0.35, 0.05,
    0.38, -0.18, 0.15,
    // Right Pectoral
    -0.42, -0.10, 0.62,
    -1.38, -0.35, 0.05,
    -0.38, -0.18, 0.15,
  ];
  for (let i = 0; i < pectVerts.length; i += 3) {
    positions.push(pectVerts[i], pectVerts[i + 1], pectVerts[i + 2]);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);
    colors.push(dorsalColor.r * 0.9, dorsalColor.g * 0.9, dorsalColor.b * 0.9);
  }
  const pi = pectIdx;
  indices.push(
    pi, pi + 1, pi + 2,
    pi, pi + 2, pi + 1,
    pi + 3, pi + 4, pi + 5,
    pi + 3, pi + 5, pi + 4
  );

  // 4. Paired Pelvic Fins
  const pelvIdx = positions.length / 3;
  const pelvVerts = [
    // Left Pelvic
    0.22, -0.16, -0.45,
    0.52, -0.26, -0.68,
    0.18, -0.18, -0.72,
    // Right Pelvic
    -0.22, -0.16, -0.45,
    -0.52, -0.26, -0.68,
    -0.18, -0.18, -0.72,
  ];
  for (let i = 0; i < pelvVerts.length; i += 3) {
    positions.push(pelvVerts[i], pelvVerts[i + 1], pelvVerts[i + 2]);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);
    colors.push(ventralColor.r, ventralColor.g, ventralColor.b);
  }
  const pli = pelvIdx;
  indices.push(
    pli, pli + 1, pli + 2,
    pli, pli + 2, pli + 1,
    pli + 3, pli + 4, pli + 5,
    pli + 3, pli + 5, pli + 4
  );

  // 5. True Heterocercal Caudal Tail with Upper Lobe, Subterminal Notch & Lower Lobe
  const caudalIdx = positions.length / 3;
  const caudalVerts = [
    0, 0, -1.40,          // Peduncle root
    0, 0.95, -2.32,       // Upper lobe apex tip
    0, 0.82, -2.40,       // Subterminal upper notch tip
    0, 0.72, -2.30,       // Subterminal notch inner
    0, 0.32, -1.98,       // Caudal fork concavity
    0, -0.20, -1.96,      // Lower fork inner
    0, -0.52, -2.15,      // Lower lobe tip
    0, -0.18, -1.70,      // Lower lobe rear root
  ];
  for (let i = 0; i < caudalVerts.length; i += 3) {
    positions.push(caudalVerts[i], caudalVerts[i + 1], caudalVerts[i + 2]);
    normals.push(1, 0, 0);
    uvs.push(0.5, 1.0);
    colors.push(dorsalColor.r, dorsalColor.g, dorsalColor.b);
  }
  const ci = caudalIdx;
  indices.push(
    ci, ci + 1, ci + 2,
    ci, ci + 2, ci + 3,
    ci, ci + 3, ci + 4,
    ci, ci + 4, ci + 5,
    ci, ci + 5, ci + 6,
    ci, ci + 6, ci + 7,
    // Double-sided
    ci, ci + 2, ci + 1,
    ci, ci + 3, ci + 2,
    ci, ci + 4, ci + 3,
    ci, ci + 5, ci + 4,
    ci, ci + 6, ci + 5,
    ci, ci + 7, ci + 6
  );

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

// ── 4. Realistic Manta / Eagle Ray Geometry ──────────────────────────────────

export function createRealisticRayGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const resX = 18;
  const resZ = 14;

  for (let iz = 0; iz <= resZ; iz++) {
    const tz = iz / resZ;
    const z = 0.8 - tz * 2.0;

    for (let ix = 0; ix <= resX; ix++) {
      const tx = ix / resX;
      const x = (tx - 0.5) * 3.4;

      const distFromCenter = Math.abs(x) / 1.7;
      const chordT = (z + 1.2) / 2.0;
      const thickness = Math.max(0.012, (1 - distFromCenter) * 0.20 * Math.sin(chordT * Math.PI));
      const y = thickness * 0.5;

      positions.push(x, y, z);
      normals.push(0, 1, 0);
      uvs.push(tx, tz);
    }
  }

  const stride = resX + 1;
  for (let iz = 0; iz < resZ; iz++) {
    for (let ix = 0; ix < resX; ix++) {
      const a = iz * stride + ix;
      const b = (iz + 1) * stride + ix;
      const c = (iz + 1) * stride + (ix + 1);
      const d = iz * stride + (ix + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  // Cephalic Horns
  const hornBaseIdx = positions.length / 3;
  const hornVerts = [
    0.28, 0, 0.8,
    0.38, -0.05, 1.20,
    0.16, 0, 1.05,
    -0.28, 0, 0.8,
    -0.38, -0.05, 1.20,
    -0.16, 0, 1.05,
  ];
  for (let i = 0; i < hornVerts.length; i += 3) {
    positions.push(hornVerts[i], hornVerts[i + 1], hornVerts[i + 2]);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);
  }
  const hi = hornBaseIdx;
  indices.push(
    hi, hi + 1, hi + 2,
    hi, hi + 2, hi + 1,
    hi + 3, hi + 4, hi + 5,
    hi + 3, hi + 5, hi + 4
  );

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

// ── 5. Realistic Sea Turtle Geometry ────────────────────────────────────────

export function createRealisticTurtleGeometry(): {
  shellGeo: THREE.BufferGeometry;
  flipperGeo: THREE.BufferGeometry;
} {
  const shellGeo = new THREE.SphereGeometry(0.68, 18, 14);
  shellGeo.scale(1.0, 0.52, 1.38);

  const flipperGeo = new THREE.BoxGeometry(0.92, 0.04, 0.34, 8, 1, 4);
  const pos = flipperGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (x > 0) {
      pos.setZ(i, z - (x * x) * 0.28);
    }
  }
  pos.needsUpdate = true;
  flipperGeo.computeVertexNormals();

  return { shellGeo, flipperGeo };
}
