import * as THREE from 'three';

export type CarModelType = 'hypercar' | 'buggy' | 'formula' | 'muscle';

export interface CarVisuals {
  group: THREE.Group;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  steeringWheel: THREE.Mesh;
  exhaustLeft: THREE.Mesh;
  exhaustRight: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  cockpitAnchor: THREE.Object3D;
  update: (speed: number, steering: number, isBoosting: boolean, isDrifting: boolean, dt: number) => void;
}

// Reusable wheel geometry and rubber material
const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
tireGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.29, 12);
rimGeo.rotateZ(Math.PI / 2);

const tireMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  roughness: 0.85,
  metalness: 0.1,
});

const rimMat = new THREE.MeshStandardMaterial({
  color: 0xd8d8d8,
  roughness: 0.25,
  metalness: 0.85,
});

function createWheelMesh(isFront = false): THREE.Group {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheel.add(tire);
  wheel.add(rim);

  // Wheel hub cap accent
  const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.31, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMat = new THREE.MeshStandardMaterial({
    color: isFront ? 0x00e5ff : 0xff0055,
    emissive: isFront ? 0x004455 : 0x550022,
    roughness: 0.3,
    metalness: 0.7,
  });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  wheel.add(hub);

  return wheel;
}

/**
 * Builds a composite 8-12 part procedural car with cockpit and animated wheels.
 */
export function buildProceduralCar(
  modelType: CarModelType = 'hypercar',
  primaryColorHex = '#ff0055',
  secondaryColorHex = '#111827'
): CarVisuals {
  const group = new THREE.Group();
  const color = new THREE.Color(primaryColorHex);
  const secondaryColor = new THREE.Color(secondaryColorHex);

  // 1. Car body material (Glossy metallic paint)
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.2,
    metalness: 0.7,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: secondaryColor,
    roughness: 0.4,
    metalness: 0.5,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x112233,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.7,
    transparent: true,
    opacity: 0.65,
  });

  const glowHeadlightMat = new THREE.MeshStandardMaterial({
    color: 0xccffff,
    emissive: 0x88ffff,
    emissiveIntensity: 2.0,
    roughness: 0.1,
  });

  const glowTaillightMat = new THREE.MeshStandardMaterial({
    color: 0xff1133,
    emissive: 0xff0022,
    emissiveIntensity: 2.5,
    roughness: 0.1,
  });

  const exhaustFlameMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0,
  });

  // Cockpit view anchor (where VR head and 1st-person camera sits)
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(0, 0.95, -0.1);
  group.add(cockpitAnchor);

  // Wheels
  const frontLeftWheel = createWheelMesh(true);
  const frontRightWheel = createWheelMesh(true);
  const rearLeftWheel = createWheelMesh(false);
  const rearRightWheel = createWheelMesh(false);

  // Base chassis
  let bodyMesh: THREE.Mesh;

  if (modelType === 'hypercar') {
    // Sleek low-slung wedge chassis
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 4.2);
    bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.45;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Cabin canopy / Windshield
    const cabinGeo = new THREE.BoxGeometry(1.3, 0.45, 1.8);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 0.85, -0.2);
    group.add(cabin);

    // Aerodynamic Rear Wing
    const wingPostL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.1), darkTrimMat);
    wingPostL.position.set(-0.65, 0.85, -1.9);
    const wingPostR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.1), darkTrimMat);
    wingPostR.position.set(0.65, 0.85, -1.9);
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.35), darkTrimMat);
    wingBlade.position.set(0, 1.05, -1.9);
    group.add(wingPostL, wingPostR, wingBlade);

    // Front splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.06, 0.6), darkTrimMat);
    splitter.position.set(0, 0.22, 2.05);
    group.add(splitter);
  } else if (modelType === 'formula') {
    // Long aerodynamic needle body
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.45, 4.4);
    bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.42;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Nosecone
    const noseGeo = new THREE.ConeGeometry(0.5, 1.2, 4);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0.4, 2.7);
    group.add(nose);

    // Front wing
    const fWing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.4), darkTrimMat);
    fWing.position.set(0, 0.25, 2.5);
    group.add(fWing);

    // Halo cockpit bar
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 16, Math.PI), darkTrimMat);
    halo.position.set(0, 0.85, -0.1);
    halo.rotateX(-Math.PI / 2);
    group.add(halo);

    // Rear wing
    const rWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.3), darkTrimMat);
    rWing.position.set(0, 1.05, -2.0);
    group.add(rWing);
  } else if (modelType === 'buggy') {
    // Off-road tubular buggy
    const bodyGeo = new THREE.BoxGeometry(1.7, 0.55, 3.8);
    bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.55;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Roll cage tubes
    const cageL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8), darkTrimMat);
    cageL.position.set(-0.7, 1.1, -0.2);
    cageL.rotateZ(0.2);
    const cageR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8), darkTrimMat);
    cageR.position.set(0.7, 1.1, -0.2);
    cageR.rotateZ(-0.2);
    const cageTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 1.4), darkTrimMat);
    cageTop.position.set(0, 1.5, -0.2);
    group.add(cageL, cageR, cageTop);

    // Roof light bar
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.15), glowHeadlightMat);
    lightBar.position.set(0, 1.58, 0.4);
    group.add(lightBar);
  } else {
    // Muscle car
    const bodyGeo = new THREE.BoxGeometry(1.9, 0.65, 4.3);
    bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.52;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Hood scoop
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.8), darkTrimMat);
    scoop.position.set(0, 0.92, 1.1);
    group.add(scoop);

    // Fastback roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 2.0), glassMat);
    roof.position.set(0, 1.0, -0.3);
    group.add(roof);
  }

  // Headlights
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.1), glowHeadlightMat);
  headL.position.set(-0.68, 0.48, 2.1);
  const headR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.1), glowHeadlightMat);
  headR.position.set(0.68, 0.48, 2.1);
  group.add(headL, headR);

  // Taillights
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), glowTaillightMat);
  tailL.position.set(-0.65, 0.52, -2.1);
  const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), glowTaillightMat);
  tailR.position.set(0.65, 0.52, -2.1);
  group.add(tailL, tailR);

  // Cockpit Interior: Dashboard & Steering Wheel
  const dashGeo = new THREE.BoxGeometry(1.2, 0.28, 0.45);
  const dash = new THREE.Mesh(dashGeo, darkTrimMat);
  dash.position.set(0, 0.70, 0.42);
  group.add(dash);

  // Digital instrument cluster screen
  const screenGeo = new THREE.PlaneGeometry(0.42, 0.16);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 0.81, 0.26);
  screen.rotateX(-0.4);
  group.add(screen);

  // Functional Steering Wheel (compact sporty racing wheel)
  const steerWheelGeo = new THREE.TorusGeometry(0.12, 0.022, 8, 20);
  const steerWheelMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.5,
    metalness: 0.6,
  });
  const steeringWheel = new THREE.Mesh(steerWheelGeo, steerWheelMat);
  steeringWheel.position.set(0, 0.72, 0.20);
  steeringWheel.rotateX(-0.5);
  group.add(steeringWheel);

  // Dual Exhausts
  const exhaustGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10);
  exhaustGeo.rotateX(Math.PI / 2);
  const exMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 });

  const exL = new THREE.Mesh(exhaustGeo, exMat);
  exL.position.set(-0.38, 0.32, -2.1);
  const exR = new THREE.Mesh(exhaustGeo, exMat);
  exR.position.set(0.38, 0.32, -2.1);
  group.add(exL, exR);

  // Exhaust Nitro Flame Cones
  const flameGeo = new THREE.ConeGeometry(0.14, 0.65, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const exhaustLeft = new THREE.Mesh(flameGeo, exhaustFlameMat);
  exhaustLeft.position.set(-0.38, 0.32, -2.5);
  const exhaustRight = new THREE.Mesh(flameGeo, exhaustFlameMat);
  exhaustRight.position.set(0.38, 0.32, -2.5);
  group.add(exhaustLeft, exhaustRight);

  // Position wheels
  const wheelX = 0.95;
  const wheelY = 0.38;
  const wheelZFront = 1.35;
  const wheelZRear = -1.35;

  frontLeftWheel.position.set(-wheelX, wheelY, wheelZFront);
  frontRightWheel.position.set(wheelX, wheelY, wheelZFront);
  rearLeftWheel.position.set(-wheelX, wheelY, wheelZRear);
  rearRightWheel.position.set(wheelX, wheelY, wheelZRear);

  group.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

  // Contact shadow disc beneath car
  const shadowGeo = new THREE.CircleGeometry(1.6, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  let wheelRotation = 0;

  const update = (
    speed: number,
    steering: number,
    isBoosting: boolean,
    isDrifting: boolean,
    dt: number
  ) => {
    // Wheel spin based on forward distance traveled
    wheelRotation += (speed * dt) / 0.38;
    frontLeftWheel.rotation.x = wheelRotation;
    frontRightWheel.rotation.x = wheelRotation;
    rearLeftWheel.rotation.x = wheelRotation;
    rearRightWheel.rotation.x = wheelRotation;

    // Front wheel steering yaw
    const steerAngle = -steering * 0.45;
    frontLeftWheel.rotation.y = steerAngle;
    frontRightWheel.rotation.y = steerAngle;

    // Cockpit steering wheel rotation
    steeringWheel.rotation.z = -steering * 1.8;

    // Body roll during sharp turns / drift
    const targetRoll = -steering * 0.06 * Math.min(1.0, Math.abs(speed) / 20);
    bodyMesh.rotation.z = THREE.MathUtils.damp(bodyMesh.rotation.z, targetRoll, 8, dt);

    // Boost flame animation
    if (isBoosting) {
      exhaustFlameMat.opacity = 0.75 + Math.random() * 0.25;
      const flicker = 0.85 + Math.random() * 0.3;
      exhaustLeft.scale.set(flicker, flicker, flicker);
      exhaustRight.scale.set(flicker, flicker, flicker);
    } else {
      exhaustFlameMat.opacity = 0;
    }
  };

  return {
    group,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
    steeringWheel,
    exhaustLeft,
    exhaustRight,
    bodyMesh,
    cockpitAnchor,
    update,
  };
}
