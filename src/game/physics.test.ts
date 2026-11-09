import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialCarState,
  stepCarPhysics,
  checkCheckpointProgress,
  resolveTrackBoundary,
  CheckpointGate,
  InputState,
} from './physics';

test('initial car state has zero speed and full boost', () => {
  const car = createInitialCarState(10, 20, Math.PI / 2);
  assert.equal(car.x, 10);
  assert.equal(car.z, 20);
  assert.equal(car.speed, 0);
  assert.equal(car.boost, 100);
  assert.equal(car.lap, 1);
  assert.equal(car.isFinished, false);
});

test('car accelerates when throttle is applied', () => {
  const initial = createInitialCarState(0, 0, 0);
  const input: InputState = {
    throttle: 1,
    brake: 0,
    steer: 0,
    boost: false,
    handbrake: false,
  };

  const next = stepCarPhysics(initial, input, 0.05);
  assert.ok(next.speed > 0, 'Car speed should increase with throttle');
  assert.ok(next.z > 0, 'Car should move along forward Z axis');
});

test('boost increases speed faster and drains boost reserve', () => {
  const moving = { ...createInitialCarState(0, 0, 0), speed: 20, boost: 100 };
  const inputWithBoost: InputState = {
    throttle: 1,
    brake: 0,
    steer: 0,
    boost: true,
    handbrake: false,
  };

  const next = stepCarPhysics(moving, inputWithBoost, 0.05);
  assert.ok(next.isBoosting, 'Car should be marked as boosting');
  assert.ok(next.boost < 100, 'Boost reserve should deplete while boosting');
  assert.ok(next.speed > 20, 'Speed should increase during boost');
});

test('checkpoints trigger in sequential order and complete lap', () => {
  const checkpoints: CheckpointGate[] = [
    { index: 0, x: 0, z: 0, radius: 10 },
    { index: 1, x: 50, z: 50, radius: 10 },
    { index: 2, x: 100, z: 0, radius: 10 },
  ];

  let car = createInitialCarState(0, 0, 0);
  // In checkpoint 0
  car = checkCheckpointProgress(car, checkpoints, 2);
  assert.equal(car.currentCheckpoint, 1, 'Should advance to checkpoint 1');

  // Move to checkpoint 1
  car = { ...car, x: 50, z: 50 };
  car = checkCheckpointProgress(car, checkpoints, 2);
  assert.equal(car.currentCheckpoint, 2, 'Should advance to checkpoint 2');

  // Move to checkpoint 2
  car = { ...car, x: 100, z: 0 };
  car = checkCheckpointProgress(car, checkpoints, 2);
  assert.equal(car.currentCheckpoint, 0, 'Should loop back to start checkpoint');
  assert.equal(car.lap, 2, 'Lap should advance to 2');
});

test('track boundary collision clamps position outside track', () => {
  const spline = [
    { x: 0, z: 0 },
    { x: 0, z: 100 },
    { x: 100, z: 100 },
    { x: 100, z: 0 },
  ];

  // Point way off track (x = 50, z = 50 is inside loop, track road is half-width 10)
  // Check a point on segment (0, 50), offset to x = 30 (outside 10m road)
  const result = resolveTrackBoundary(30, 50, spline, 10);
  assert.equal(result.collided, true, 'Should detect collision with track boundary');
  assert.ok(result.x <= 10.01, 'Clamped X should be at road boundary');
});
