import * as THREE from 'three';
import { CheckpointGate } from './physics';

export interface TrackData {
  group: THREE.Group;
  splinePoints: THREE.Vector3[];
  checkpoints: CheckpointGate[];
  startPoint: THREE.Vector3;
  startHeading: number;
}

/**
 * Creates procedural asphalt canvas texture with road markings and curb stripes.
 */
function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark asphalt base
  ctx.fillStyle = '#1c1f24';
  ctx.fillRect(0, 0, 512, 512);

  // Noise / pebble speckles
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const gray = Math.floor(20 + Math.random() * 30);
    ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Dashed glowing neon center lane marking
  ctx.fillStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 8;
  for (let y = 30; y < 512; y += 80) {
    ctx.fillRect(252, y, 8, 45);
  }

  // Edge warning lines
  ctx.fillStyle = '#ffaa00';
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 4;
  ctx.fillRect(20, 0, 6, 512);
  ctx.fillRect(486, 0, 6, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 40);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates start/finish checkered grid texture.
 */
function createCheckeredGridTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#111111';
  const size = 32;
  for (let y = 0; y < 256; y += size) {
    for (let x = 0; x < 256; x += size) {
      if ((x / size + y / size) % 2 === 0) {
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generates the full 3D racing track with curved ribbons, grandstands, cyber pillars and checkpoints.
 */
export function buildRaceTrack(): TrackData {
  const group = new THREE.Group();

  // 1. Spline definition for an exciting racing circuit
  const rawSpline = [
    new THREE.Vector3(0, 0, 0),        // Start straight
    new THREE.Vector3(0, 0, 120),
    new THREE.Vector3(30, 2, 180),     // Banked right turn & crest
    new THREE.Vector3(90, 4, 210),
    new THREE.Vector3(160, 2, 180),
    new THREE.Vector3(190, 0, 110),    // Right hairpin
    new THREE.Vector3(160, -1, 30),
    new THREE.Vector3(110, 0, -40),    // S-curve chicane
    new THREE.Vector3(140, 1, -110),
    new THREE.Vector3(90, 2, -180),    // Far south loop
    new THREE.Vector3(10, 0, -210),
    new THREE.Vector3(-60, 2, -170),
    new THREE.Vector3(-90, 3, -90),    // High elevation sweep
    new THREE.Vector3(-70, 1, -10),
    new THREE.Vector3(-40, 0, 40),     // Return into home straight
    new THREE.Vector3(-15, 0, -30),
  ];

  const curve = new THREE.CatmullRomCurve3(rawSpline, true, 'centripetal', 0.5);
  const sampleCount = 200;
  const points = curve.getSpacedPoints(sampleCount);

  // 2. Extrude road geometry as a ribbon along the curve
  const roadWidth = 24;
  const roadGeom = new THREE.BufferGeometry();
  const roadPositions: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  for (let i = 0; i <= sampleCount; i++) {
    const p = points[i % sampleCount];
    const nextP = points[(i + 1) % sampleCount];
    const tangent = new THREE.Vector3().subVectors(nextP, p).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // Left vertex
    const leftX = p.x - normal.x * (roadWidth / 2);
    const leftY = p.y + 0.05;
    const leftZ = p.z - normal.z * (roadWidth / 2);

    // Right vertex
    const rightX = p.x + normal.x * (roadWidth / 2);
    const rightY = p.y + 0.05;
    const rightZ = p.z + normal.z * (roadWidth / 2);

    roadPositions.push(leftX, leftY, leftZ);
    roadPositions.push(rightX, rightY, rightZ);

    const vCoord = i / 10;
    roadUvs.push(0, vCoord);
    roadUvs.push(1, vCoord);

    if (i < sampleCount) {
      const base = i * 2;
      roadIndices.push(base, base + 1, base + 2);
      roadIndices.push(base + 1, base + 3, base + 2);
    }
  }

  roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeom.setIndex(roadIndices);
  roadGeom.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({
    map: createAsphaltTexture(),
    roughness: 0.75,
    metalness: 0.15,
  });

  const roadMesh = new THREE.Mesh(roadGeom, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Red/White Curb Edges
  const curbMatL = new THREE.MeshStandardMaterial({ color: 0xff0044, roughness: 0.5 });
  const curbMatR = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

  // 3. Start / Finish Line Banner & Checkered Grid
  const startGridGeo = new THREE.PlaneGeometry(roadWidth - 2, 6);
  startGridGeo.rotateX(-Math.PI / 2);
  const startGridMat = new THREE.MeshBasicMaterial({
    map: createCheckeredGridTexture(),
  });
  const startGrid = new THREE.Mesh(startGridGeo, startGridMat);
  startGrid.position.set(0, 0.07, 10);
  group.add(startGrid);

  // Overhead Finish Gantry / Arch
  const gantryPillarGeo = new THREE.BoxGeometry(1.2, 8, 1.2);
  const gantryPillarMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
  const pillarL = new THREE.Mesh(gantryPillarGeo, gantryPillarMat);
  pillarL.position.set(-13, 4, 10);
  const pillarR = new THREE.Mesh(gantryPillarGeo, gantryPillarMat);
  pillarR.position.set(13, 4, 10);

  const gantryBeamGeo = new THREE.BoxGeometry(28, 1.8, 1.4);
  const gantryBeam = new THREE.Mesh(gantryBeamGeo, gantryPillarMat);
  gantryBeam.position.set(0, 8, 10);

  // Glowing Finish Banner
  const bannerGeo = new THREE.PlaneGeometry(16, 1.4);
  const bannerMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 8, 10.75);

  group.add(pillarL, pillarR, gantryBeam, banner);

  // 4. Checkpoints along track with neon circular gates
  const checkpointIndices = [0, 25, 50, 75, 100, 125, 150, 175];
  const checkpoints: CheckpointGate[] = [];

  const gateGeo = new THREE.TorusGeometry(10, 0.45, 12, 32, Math.PI);
  const gateMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00a0dd,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });

  checkpointIndices.forEach((ptIdx, gateIdx) => {
    const pt = points[ptIdx];
    const nextPt = points[(ptIdx + 1) % sampleCount];
    const dir = new THREE.Vector3().subVectors(nextPt, pt).normalize();
    const yaw = Math.atan2(dir.x, dir.z);

    const gateMesh = new THREE.Mesh(gateGeo, gateMat);
    gateMesh.position.set(pt.x, pt.y + 0.1, pt.z);
    gateMesh.rotation.y = yaw;
    group.add(gateMesh);

    checkpoints.push({
      index: gateIdx,
      x: pt.x,
      z: pt.z,
      radius: 16,
    });
  });

  // 5. Surrounding Cyber World & Desert Landscape
  // Broad ground plane
  const groundGeo = new THREE.PlaneGeometry(800, 800, 32, 32);
  groundGeo.rotateX(-Math.PI / 2);

  // Slight undulating ground
  const posAttr = groundGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const distToCenter = Math.sqrt(x * x + z * z);
    if (distToCenter > 130) {
      posAttr.setY(i, Math.sin(x * 0.02) * Math.cos(z * 0.02) * 8 - 4);
    }
  }
  groundGeo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0e1117,
    roughness: 0.95,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.position.y = -0.1;
  group.add(ground);

  // Instanced cyber light poles alongside track
  const poleCount = 40;
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 7, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
  const instancedPoles = new THREE.InstancedMesh(poleGeo, poleMat, poleCount);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < poleCount; i++) {
    const ptIdx = Math.floor((i / poleCount) * sampleCount);
    const pt = points[ptIdx];
    const nextPt = points[(ptIdx + 1) % sampleCount];
    const tangent = new THREE.Vector3().subVectors(nextPt, pt).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const side = i % 2 === 0 ? 1 : -1;

    dummy.position.set(pt.x + normal.x * (roadWidth / 2 + 2) * side, pt.y + 3.5, pt.z + normal.z * (roadWidth / 2 + 2) * side);
    dummy.updateMatrix();
    instancedPoles.setMatrixAt(i, dummy.matrix);
  }
  instancedPoles.computeBoundingSphere();
  group.add(instancedPoles);

  // Instanced futuristic city towers in background (distant horizon silhouettes)
  const towerCount = 35;
  const towerGeo = new THREE.BoxGeometry(18, 90, 18);
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x111625,
    roughness: 0.8,
    metalness: 0.4,
  });
  const instancedTowers = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);

  for (let i = 0; i < towerCount; i++) {
    const angle = (i / towerCount) * Math.PI * 2;
    const dist = 240 + Math.random() * 80;
    const h = 50 + Math.random() * 80;
    dummy.position.set(Math.cos(angle) * dist, h / 2 - 5, Math.sin(angle) * dist);
    dummy.scale.set(0.8 + Math.random() * 0.8, h / 90, 0.8 + Math.random() * 0.8);
    dummy.updateMatrix();
    instancedTowers.setMatrixAt(i, dummy.matrix);
  }
  instancedTowers.computeBoundingSphere();
  group.add(instancedTowers);

  return {
    group,
    splinePoints: points,
    checkpoints,
    startPoint: points[0],
    startHeading: 0,
  };
}
