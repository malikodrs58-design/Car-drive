import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CarState,
  createInitialCarState,
  stepCarPhysics,
  checkCheckpointProgress,
  resolveTrackBoundary,
  InputState,
} from './physics';
import { buildProceduralCar, CarVisuals, CarModelType } from './models';
import { buildRaceTrack, TrackData } from './track';
import { initVRSystem, VRSystem } from './vr';
import { sound } from './audio';

export interface OpponentData {
  id: string;
  name: string;
  carModel: CarModelType;
  color: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  steering: number;
  isBoosting: boolean;
  isDrifting: boolean;
  lap: number;
  currentCheckpoint: number;
  inVR?: boolean;
}

export type CameraViewMode = 'chase' | 'cockpit';

export interface GameEngineCallbacks {
  onStateUpdate: (state: CarState, speedKmh: number, rank: number, totalRacers: number) => void;
  onLapCompleted: (lap: number, lapTime: number) => void;
  onRaceFinished: (rank: number, bestLap: number, totalTime: number) => void;
  onNetworkSendState: (data: Partial<CarState> & { inVR: boolean }) => void;
  onCheckpointPassed: (cpIndex: number) => void;
}

export class GameEngine {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public vrSystem: VRSystem;

  private container: HTMLElement;
  private trackData: TrackData;
  private playerCar: CarVisuals;
  private playerState: CarState;
  private opponents: Map<string, { visuals: CarVisuals; targetX: number; targetZ: number; targetYaw: number; speed: number; isBoosting: boolean; isDrifting: boolean; lap: number; currentCheckpoint: number }> = new Map();

  private isSoftwareGl: boolean;
  private animationFrameId = 0;
  private lastTime = 0;
  private cameraMode: CameraViewMode = 'chase';
  private gameState: 'title' | 'playing' | 'paused' | 'gameover' = 'title';

  private keyboardInputs: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    boost: boolean;
    handbrake: boolean;
  } = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
    handbrake: false,
  };

  private callbacks: GameEngineCallbacks;
  private trauma = 0;
  private networkSendTimer = 0;
  private hudThrottleTimer = 0;
  private isDestroyed = false;

  constructor(
    container: HTMLElement,
    carModel: CarModelType = 'hypercar',
    carColor = '#00e5ff',
    callbacks: GameEngineCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Initialize Three.js renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    container.appendChild(this.renderer.domElement);

    // 3. Scene and Environment
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080b12);
    this.scene.fog = new THREE.FogExp2(0x080b12, 0.0035);

    this.camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    // Room Environment for PBR metallic reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 4. Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x4488ff, 0x112233, 1.2);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.2);
    keyLight.position.set(40, 80, 50);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 10;
      keyLight.shadow.camera.far = 250;
      const d = 60;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // 5. Track and Environment
    this.trackData = buildRaceTrack();
    this.scene.add(this.trackData.group);

    // 6. Build Player Car
    this.playerCar = buildProceduralCar(carModel, carColor, '#0a101d');
    this.scene.add(this.playerCar.group);

    // Start state
    const startP = this.trackData.startPoint;
    this.playerState = createInitialCarState(startP.x, startP.z, this.trackData.startHeading);
    this.playerCar.group.position.set(this.playerState.x, 0, this.playerState.z);
    this.playerCar.group.rotation.y = this.playerState.yaw;

    // 7. WebXR VR System
    this.vrSystem = initVRSystem(this.renderer, this.camera);
    this.scene.add(this.vrSystem.dolly);

    // 8. Event Listeners
    this.setupInputs();
    window.addEventListener('resize', this.onResize);

    // 9. Pre-warm shaders
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 10. Start Animation Loop
    this.lastTime = performance.now();
    this.startLoop();
  }

  public setCarConfiguration(carModel: CarModelType, color: string) {
    this.scene.remove(this.playerCar.group);
    this.playerCar = buildProceduralCar(carModel, color, '#0a101d');
    this.scene.add(this.playerCar.group);
    this.playerCar.group.position.set(this.playerState.x, 0, this.playerState.z);
    this.playerCar.group.rotation.y = this.playerState.yaw;
  }

  public setGameState(state: 'title' | 'playing' | 'paused' | 'gameover') {
    this.gameState = state;
    if (state === 'playing') {
      sound.startEngine();
    }
  }

  public toggleCamera() {
    this.cameraMode = this.cameraMode === 'chase' ? 'cockpit' : 'chase';
  }

  public getCameraMode(): CameraViewMode {
    return this.cameraMode;
  }

  public setCameraMode(mode: CameraViewMode) {
    this.cameraMode = mode;
  }

  public syncOpponents(opponentsList: OpponentData[], myId: string) {
    const activeIds = new Set<string>();

    opponentsList.forEach((opp) => {
      if (opp.id === myId) return;
      activeIds.add(opp.id);

      let record = this.opponents.get(opp.id);
      if (!record) {
        const visuals = buildProceduralCar(opp.carModel, opp.color, '#0f172a');
        this.scene.add(visuals.group);
        record = {
          visuals,
          targetX: opp.x,
          targetZ: opp.z,
          targetYaw: opp.yaw,
          speed: opp.speed,
          isBoosting: opp.isBoosting,
          isDrifting: opp.isDrifting,
          lap: opp.lap,
          currentCheckpoint: opp.currentCheckpoint,
        };
        visuals.group.position.set(opp.x, 0, opp.z);
        visuals.group.rotation.y = opp.yaw;
        this.opponents.set(opp.id, record);
      } else {
        record.targetX = opp.x;
        record.targetZ = opp.z;
        record.targetYaw = opp.yaw;
        record.speed = opp.speed;
        record.isBoosting = opp.isBoosting;
        record.isDrifting = opp.isDrifting;
        record.lap = opp.lap;
        record.currentCheckpoint = opp.currentCheckpoint;
      }
    });

    // Remove disconnected opponents
    this.opponents.forEach((record, id) => {
      if (!activeIds.has(id)) {
        this.scene.remove(record.visuals.group);
        this.opponents.delete(id);
      }
    });
  }

  public restartRace() {
    const startP = this.trackData.startPoint;
    this.playerState = createInitialCarState(startP.x, startP.z, this.trackData.startHeading);
    this.playerCar.group.position.set(this.playerState.x, 0, this.playerState.z);
    this.playerCar.group.rotation.y = this.playerState.yaw;
    this.gameState = 'playing';
    sound.startEngine();
  }

  private setupInputs() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.keyboardInputs.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') this.keyboardInputs.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') this.keyboardInputs.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.keyboardInputs.right = true;
      if (code === 'Space') {
        this.keyboardInputs.boost = true;
        e.preventDefault();
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        this.keyboardInputs.handbrake = true;
      }
      if (code === 'KeyC') {
        this.toggleCamera();
      }
      if (code === 'KeyM') {
        sound.toggleMute();
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.keyboardInputs.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') this.keyboardInputs.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') this.keyboardInputs.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.keyboardInputs.right = false;
      if (code === 'Space') this.keyboardInputs.boost = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.keyboardInputs.handbrake = false;
    });

    // Clear keys on window blur to avoid stuck keys
    window.addEventListener('blur', () => {
      this.keyboardInputs.forward = false;
      this.keyboardInputs.backward = false;
      this.keyboardInputs.left = false;
      this.keyboardInputs.right = false;
      this.keyboardInputs.boost = false;
      this.keyboardInputs.handbrake = false;
    });
  }

  private onResize = () => {
    if (!this.container || this.isDestroyed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private startLoop() {
    const tick = () => {
      if (this.isDestroyed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.render();

      if (this.isSoftwareGl && !this.vrSystem.isInVR) {
        this.afterDraw(tick);
      } else {
        this.animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (this.vrSystem.isInVR) {
      this.renderer.setAnimationLoop(tick);
    } else {
      this.animationFrameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.animationFrameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.animationFrameId = window.setTimeout(cb, 60);
      }
    };
    this.animationFrameId = window.setTimeout(poll, 5);
  }

  private update(dt: number) {
    // 1. Gather inputs (Keyboard + WebXR Controllers)
    const vrInput = this.vrSystem.getVRInput();

    const throttle = Math.max(this.keyboardInputs.forward ? 1 : 0, vrInput.throttle);
    const brake = Math.max(this.keyboardInputs.backward ? 1 : 0, vrInput.brake);
    let steer = 0;
    if (this.keyboardInputs.left) steer -= 1;
    if (this.keyboardInputs.right) steer += 1;
    if (Math.abs(vrInput.steer) > 0.1) steer = vrInput.steer;

    const boost = this.keyboardInputs.boost || vrInput.boost;
    const handbrake = this.keyboardInputs.handbrake || vrInput.handbrake;

    const input: InputState = { throttle, brake, steer, boost, handbrake };

    // 2. Step Physics if in playing or title cinematic
    if (this.gameState === 'playing') {
      const prevCheckpoint = this.playerState.currentCheckpoint;
      const prevLap = this.playerState.lap;
      const wasBoosting = this.playerState.isBoosting;

      this.playerState = stepCarPhysics(this.playerState, input, dt);

      // Boost sound trigger
      if (this.playerState.isBoosting && !wasBoosting) {
        sound.playBoost();
      }

      // Check track boundary collision
      const boundary = resolveTrackBoundary(
        this.playerState.x,
        this.playerState.z,
        this.trackData.splinePoints,
        13.5
      );
      if (boundary.collided) {
        this.playerState.x = boundary.x;
        this.playerState.z = boundary.z;
        this.playerState.speed *= 0.88; // collision friction
        this.trauma = Math.min(1.0, this.trauma + 0.35);
        sound.playCollision(0.4);
      }

      // Check Checkpoints and Laps
      this.playerState = checkCheckpointProgress(this.playerState, this.trackData.checkpoints, 3);

      if (this.playerState.currentCheckpoint !== prevCheckpoint) {
        sound.playCheckpoint();
        this.callbacks.onCheckpointPassed(this.playerState.currentCheckpoint);
      }

      if (this.playerState.lap !== prevLap) {
        const lastLapTime = this.playerState.lapTimes[this.playerState.lapTimes.length - 1] || 0;
        this.callbacks.onLapCompleted(prevLap, lastLapTime);
      }

      if (this.playerState.isFinished) {
        this.gameState = 'gameover';
        sound.playVictory();
        const totalTime = this.playerState.lapTimes.reduce((a, b) => a + b, 0);
        this.callbacks.onRaceFinished(1, this.playerState.bestLapTime || totalTime, totalTime);
      }

      // Procedural audio engine update
      const speedNormalized = Math.abs(this.playerState.speed) / 55;
      sound.updateEngine(speedNormalized, this.playerState.isDrifting, this.playerState.isBoosting);

      // Throttled HUD update (10Hz)
      this.hudThrottleTimer += dt;
      if (this.hudThrottleTimer >= 0.1) {
        this.hudThrottleTimer = 0;
        const speedKmh = Math.round(Math.abs(this.playerState.speed) * 3.6);
        // Calculate player rank among opponents
        let rank = 1;
        this.opponents.forEach((opp) => {
          if (opp.lap > this.playerState.lap) rank++;
          else if (opp.lap === this.playerState.lap && opp.currentCheckpoint > this.playerState.currentCheckpoint) rank++;
        });
        const totalRacers = this.opponents.size + 1;
        this.callbacks.onStateUpdate(this.playerState, speedKmh, rank, totalRacers);
      }

      // Network send state tick (20Hz)
      this.networkSendTimer += dt;
      if (this.networkSendTimer >= 0.05) {
        this.networkSendTimer = 0;
        this.callbacks.onNetworkSendState({
          x: this.playerState.x,
          y: this.playerState.y,
          z: this.playerState.z,
          yaw: this.playerState.yaw,
          speed: this.playerState.speed,
          steering: this.playerState.steering,
          isBoosting: this.playerState.isBoosting,
          isDrifting: this.playerState.isDrifting,
          lap: this.playerState.lap,
          currentCheckpoint: this.playerState.currentCheckpoint,
          bestLapTime: this.playerState.bestLapTime,
          inVR: this.vrSystem.isInVR,
        });
      }
    }

    // 3. Update Player Visuals
    this.playerCar.group.position.set(this.playerState.x, 0, this.playerState.z);
    this.playerCar.group.rotation.y = this.playerState.yaw;
    this.playerCar.update(
      this.playerState.speed,
      this.playerState.steering,
      this.playerState.isBoosting,
      this.playerState.isDrifting,
      dt
    );

    // 4. Smooth Opponents Interpolation
    this.opponents.forEach((opp) => {
      opp.visuals.group.position.x = THREE.MathUtils.damp(opp.visuals.group.position.x, opp.targetX, 12, dt);
      opp.visuals.group.position.z = THREE.MathUtils.damp(opp.visuals.group.position.z, opp.targetZ, 12, dt);
      opp.visuals.group.rotation.y = THREE.MathUtils.damp(opp.visuals.group.rotation.y, opp.targetYaw, 12, dt);
      opp.visuals.update(opp.speed, 0, opp.isBoosting, opp.isDrifting, dt);
    });

    // 5. Camera Management
    this.updateCamera(dt);
  }

  private updateCamera(dt: number) {
    if (this.vrSystem.isInVR) {
      // In WebXR, head tracking controls camera rotation and position relative to dolly
      this.vrSystem.updateDolly(this.playerCar.group.position, this.playerState.yaw);
      return;
    }

    // 1. Decay impact trauma shake
    this.trauma = Math.max(0, this.trauma - dt * 2.0);
    const impactShake = this.trauma * this.trauma * 0.4;
    const impactOffsetX = (Math.random() * 2 - 1) * impactShake;
    const impactOffsetY = (Math.random() * 2 - 1) * impactShake;

    // 2. Continuous high-speed camera vibration (Motion Shake at > 110 km/h)
    const absSpeed = Math.abs(this.playerState.speed);
    const speedRatio = Math.max(0, (absSpeed - 30) / 25); // 0 at ~108 km/h, up to 1.6 at 250+ km/h
    const speedVibration = Math.min(0.24, speedRatio * 0.09 * (this.playerState.isBoosting ? 1.6 : 1.0));

    const timeNow = performance.now() * 0.045;
    const speedShakeX = (Math.sin(timeNow * 1.4) * 0.65 + (Math.random() - 0.5) * 0.7) * speedVibration;
    const speedShakeY = (Math.cos(timeNow * 1.8) * 0.65 + (Math.random() - 0.5) * 0.7) * speedVibration;
    const speedRoll = Math.sin(timeNow * 0.9) * 0.007 * speedRatio;

    const totalOffsetX = impactOffsetX + speedShakeX;
    const totalOffsetY = impactOffsetY + speedShakeY;

    if (this.gameState === 'title') {
      // Cinematic orbital camera tour around the car on the starting grid
      const time = performance.now() * 0.0004;
      const radius = 10.5;
      this.camera.position.x = this.playerState.x + Math.sin(time) * radius;
      this.camera.position.y = 4.2 + Math.sin(time * 0.5) * 0.8;
      this.camera.position.z = this.playerState.z + Math.cos(time) * radius;
      this.camera.lookAt(this.playerState.x, 0.7, this.playerState.z);
      return;
    }

    if (this.cameraMode === 'cockpit') {
      // First-person driver eye view inside the car with speed vibration
      const eyeOffset = new THREE.Vector3(0, 1.05, -0.22);
      eyeOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerState.yaw);
      this.camera.position.set(
        this.playerState.x + eyeOffset.x + totalOffsetX,
        this.playerState.y + eyeOffset.y + totalOffsetY,
        this.playerState.z + eyeOffset.z
      );

      const lookAhead = new THREE.Vector3(0, 0.98, 16);
      lookAhead.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerState.yaw);
      this.camera.lookAt(
        this.playerState.x + lookAhead.x,
        this.playerState.y + lookAhead.y,
        this.playerState.z + lookAhead.z
      );
      this.camera.rotation.z += speedRoll;
    } else {
      // Third-person chase camera with dynamic speed FOV and high-speed rumble
      const chaseDist = 7.5;
      const chaseHeight = 3.2;
      const targetCamPos = new THREE.Vector3(
        this.playerState.x - Math.sin(this.playerState.yaw) * chaseDist + totalOffsetX,
        this.playerState.y + chaseHeight + totalOffsetY,
        this.playerState.z - Math.cos(this.playerState.yaw) * chaseDist
      );

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamPos.x, 9, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamPos.y, 9, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamPos.z, 9, dt);

      const lookTarget = new THREE.Vector3(
        this.playerState.x + Math.sin(this.playerState.yaw) * 6,
        this.playerState.y + 1.2,
        this.playerState.z + Math.cos(this.playerState.yaw) * 6
      );
      this.camera.lookAt(lookTarget);
      this.camera.rotation.z += speedRoll;
    }

    // Dynamic FOV Warp: wider FOV at top speed and nitro for hyperspace rush
    const boostFov = this.playerState.isBoosting ? 9 : 0;
    const targetFov = 65 + Math.min(26, (absSpeed / 50) * 18 + boostFov);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
    this.camera.updateProjectionMatrix();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    this.isDestroyed = true;
    sound.stopAll();
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.animationFrameId);
    clearTimeout(this.animationFrameId);
    this.renderer.dispose();
  }
}
