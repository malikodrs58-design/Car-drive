/**
 * Pure physics & rules calculations for VR Cyber Racers.
 * Decoupled from WebGL and DOM for fast deterministic unit testing.
 */

export interface CarState {
  x: number;
  y: number;
  z: number;
  yaw: number; // heading in radians
  speed: number; // current forward velocity in m/s
  steering: number; // -1 (left) to 1 (right)
  boost: number; // 0 to 100
  isBoosting: boolean;
  isDrifting: boolean;
  driftAngle: number;
  driftScore: number;
  lap: number;
  currentCheckpoint: number;
  totalCheckpointsPassed: number;
  lapTimes: number[];
  currentLapTime: number;
  bestLapTime: number | null;
  isFinished: boolean;
  finishRank: number | null;
}

export interface CarConfig {
  maxSpeed: number; // e.g. 55 m/s (~200 km/h)
  boostMaxSpeed: number; // e.g. 75 m/s (~270 km/h)
  acceleration: number; // m/s^2
  brakeForce: number; // m/s^2
  reverseMaxSpeed: number; // m/s
  turnSpeed: number; // rad/s at moderate speed
  drag: number; // air resistance
  grip: number; // lateral friction
}

export const DEFAULT_CAR_CONFIG: CarConfig = {
  maxSpeed: 50,
  boostMaxSpeed: 70,
  acceleration: 24,
  brakeForce: 35,
  reverseMaxSpeed: 15,
  turnSpeed: 2.4,
  drag: 0.985,
  grip: 0.92,
};

export interface InputState {
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  steer: number; // -1 to 1
  boost: boolean;
  handbrake: boolean;
}

export interface CheckpointGate {
  index: number;
  x: number;
  z: number;
  radius: number;
}

/**
 * Creates initial car state.
 */
export function createInitialCarState(startX = 0, startZ = 0, startYaw = 0): CarState {
  return {
    x: startX,
    y: 0,
    z: startZ,
    yaw: startYaw,
    speed: 0,
    steering: 0,
    boost: 100,
    isBoosting: false,
    isDrifting: false,
    driftAngle: 0,
    driftScore: 0,
    lap: 1,
    currentCheckpoint: 0,
    totalCheckpointsPassed: 0,
    lapTimes: [],
    currentLapTime: 0,
    bestLapTime: null,
    isFinished: false,
    finishRank: null,
  };
}

/**
 * Step car physics by dt seconds.
 */
export function stepCarPhysics(
  state: CarState,
  input: InputState,
  dt: number,
  config: CarConfig = DEFAULT_CAR_CONFIG
): CarState {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);

  // 1. Boost state
  const wantsBoost = input.boost && state.boost > 5;
  const isBoosting = wantsBoost && state.speed > 5;
  let newBoost = state.boost;
  if (isBoosting) {
    newBoost = Math.max(0, state.boost - clampedDt * 28);
  } else {
    // Regenerate boost slowly, bonus when drifting
    const regenRate = state.isDrifting ? 18 : 6;
    newBoost = Math.min(100, state.boost + clampedDt * regenRate);
  }

  // 2. Target max speed and acceleration
  const effectiveMaxSpeed = isBoosting ? config.boostMaxSpeed : config.maxSpeed;
  let speed = state.speed;

  if (input.throttle > 0) {
    const accel = config.acceleration * input.throttle * (isBoosting ? 1.6 : 1.0);
    speed += accel * clampedDt;
    if (speed > effectiveMaxSpeed) {
      speed = THREE_MATH_damp(speed, effectiveMaxSpeed, 4, clampedDt);
    }
  } else if (input.brake > 0) {
    if (speed > 0.5) {
      // Braking
      speed -= config.brakeForce * input.brake * clampedDt;
      if (speed < 0) speed = 0;
    } else {
      // Reverse
      speed -= config.acceleration * 0.6 * input.brake * clampedDt;
      if (speed < -config.reverseMaxSpeed) {
        speed = -config.reverseMaxSpeed;
      }
    }
  } else {
    // Coasting / natural drag
    speed *= Math.pow(config.drag, clampedDt * 60);
    if (Math.abs(speed) < 0.1) speed = 0;
  }

  // 3. Steering and drift
  // Handbrake or sharp turn at high speed triggers drift
  const isDrifting =
    (input.handbrake || (Math.abs(input.steer) > 0.7 && Math.abs(speed) > 22)) &&
    Math.abs(speed) > 8;

  const steerSpeedFactor = Math.min(1.0, Math.abs(speed) / 12);
  const targetSteer = input.steer;
  const steering = THREE_MATH_damp(state.steering, targetSteer, 14, clampedDt);

  // Turning yaw rate
  const turnRate = config.turnSpeed * steering * steerSpeedFactor * (speed < 0 ? -1 : 1);
  const driftMultiplier = isDrifting ? 1.4 : 1.0;
  const newYaw = state.yaw + turnRate * driftMultiplier * clampedDt;

  // Drift angle calculation
  let driftAngle = 0;
  let newDriftScore = state.driftScore;
  if (isDrifting && Math.abs(steering) > 0.2) {
    driftAngle = -steering * 0.35;
    newDriftScore += Math.abs(speed) * clampedDt * 10;
  }

  // 4. Movement vector (forward + subtle drift slide)
  const moveAngle = newYaw + driftAngle * 0.5;
  const forwardX = Math.sin(moveAngle);
  const forwardZ = Math.cos(moveAngle);

  const newX = state.x + forwardX * speed * clampedDt;
  const newZ = state.z + forwardZ * speed * clampedDt;

  // 5. Lap time advancement
  const newCurrentLapTime = state.isFinished ? state.currentLapTime : state.currentLapTime + clampedDt;

  return {
    ...state,
    x: newX,
    z: newZ,
    yaw: newYaw,
    speed,
    steering,
    boost: newBoost,
    isBoosting,
    isDrifting,
    driftAngle,
    driftScore: Math.round(newDriftScore),
    currentLapTime: newCurrentLapTime,
  };
}

/**
 * Check and advance checkpoints and laps.
 */
export function checkCheckpointProgress(
  state: CarState,
  checkpoints: CheckpointGate[],
  totalLaps = 3
): CarState {
  if (state.isFinished || checkpoints.length === 0) return state;

  const targetCheckpoint = checkpoints[state.currentCheckpoint];
  if (!targetCheckpoint) return state;

  const dx = state.x - targetCheckpoint.x;
  const dz = state.z - targetCheckpoint.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist <= targetCheckpoint.radius) {
    const nextCheckpoint = (state.currentCheckpoint + 1) % checkpoints.length;
    const isLapComplete = nextCheckpoint === 0;

    let newLap = state.lap;
    let isFinished: boolean = state.isFinished;
    const lapTimes = [...state.lapTimes];
    let currentLapTime = state.currentLapTime;
    let bestLapTime = state.bestLapTime;

    if (isLapComplete) {
      lapTimes.push(currentLapTime);
      if (bestLapTime === null || currentLapTime < bestLapTime) {
        bestLapTime = currentLapTime;
      }

      if (state.lap >= totalLaps) {
        isFinished = true;
      } else {
        newLap = state.lap + 1;
        currentLapTime = 0;
      }
    }

    return {
      ...state,
      currentCheckpoint: nextCheckpoint,
      totalCheckpointsPassed: state.totalCheckpointsPassed + 1,
      lap: newLap,
      isFinished,
      lapTimes,
      currentLapTime,
      bestLapTime,
    };
  }

  return state;
}

/**
 * Resolves track boundary collisions, preventing cars from wandering off the racing road.
 */
export function resolveTrackBoundary(
  x: number,
  z: number,
  trackCenterSpline: { x: number; z: number }[],
  trackHalfWidth = 14
): { x: number; z: number; collided: boolean; normalX: number; normalZ: number } {
  // Find closest point on spline
  let minDistSq = Infinity;
  let closestX = x;
  let closestZ = z;

  for (let i = 0; i < trackCenterSpline.length; i++) {
    const p1 = trackCenterSpline[i];
    const p2 = trackCenterSpline[(i + 1) % trackCenterSpline.length];

    // Project point onto segment p1-p2
    const segDx = p2.x - p1.x;
    const segDz = p2.z - p1.z;
    const segLenSq = segDx * segDx + segDz * segDz;

    let t = segLenSq > 0 ? ((x - p1.x) * segDx + (z - p1.z) * segDz) / segLenSq : 0;
    t = Math.max(0, Math.min(1, t));

    const projX = p1.x + t * segDx;
    const projZ = p1.z + t * segDz;
    const distSq = (x - projX) * (x - projX) + (z - projZ) * (z - projZ);

    if (distSq < minDistSq) {
      minDistSq = distSq;
      closestX = projX;
      closestZ = projZ;
    }
  }

  const dist = Math.sqrt(minDistSq);
  if (dist > trackHalfWidth) {
    const nx = (x - closestX) / (dist || 1);
    const nz = (z - closestZ) / (dist || 1);
    const clampedX = closestX + nx * trackHalfWidth;
    const clampedZ = closestZ + nz * trackHalfWidth;
    return {
      x: clampedX,
      z: clampedZ,
      collided: true,
      normalX: nx,
      normalZ: nz,
    };
  }

  return { x, z, collided: false, normalX: 0, normalZ: 0 };
}

/**
 * Exponential damping helper.
 */
function THREE_MATH_damp(x: number, y: number, lambda: number, dt: number): number {
  return x + (y - x) * (1 - Math.exp(-lambda * dt));
}
