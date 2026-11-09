import * as THREE from 'three';

export interface VRSystem {
  isVRSupported: boolean;
  isInVR: boolean;
  dolly: THREE.Group;
  requestVRSession: () => Promise<void>;
  exitVRSession: () => Promise<void>;
  getVRInput: () => { throttle: number; brake: number; steer: number; boost: boolean; handbrake: boolean };
  updateDolly: (carPosition: THREE.Vector3, carYaw: number) => void;
}

export function initVRSystem(renderer: THREE.WebGLRenderer, camera: THREE.Camera): VRSystem {
  renderer.xr.enabled = true;

  const dolly = new THREE.Group();
  dolly.add(camera);

  let isVRSupported = false;
  let isInVR = false;
  let currentSession: XRSession | null = null;

  if (typeof navigator !== 'undefined' && 'xr' in navigator && (navigator as unknown as { xr: XRSystem }).xr) {
    (navigator as unknown as { xr: XRSystem }).xr
      .isSessionSupported('immersive-vr')
      .then((supported: boolean) => {
        isVRSupported = supported;
      })
      .catch(() => {
        isVRSupported = false;
      });
  }

  const requestVRSession = async () => {
    if (!('xr' in navigator)) {
      throw new Error('WebXR not supported on this browser');
    }
    const xr = (navigator as unknown as { xr: XRSystem }).xr;
    try {
      const session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      currentSession = session;
      await renderer.xr.setSession(session);
      isInVR = true;

      session.addEventListener('end', () => {
        currentSession = null;
        isInVR = false;
      });
    } catch (err) {
      console.warn('Could not start WebXR VR session:', err);
      throw err;
    }
  };

  const exitVRSession = async () => {
    if (currentSession) {
      await currentSession.end();
      currentSession = null;
      isInVR = false;
    }
  };

  // Poll WebXR controller gamepads for steering, acceleration, and boost
  const getVRInput = () => {
    let throttle = 0;
    let brake = 0;
    let steer = 0;
    let boost = false;
    let handbrake = false;

    if (!currentSession) return { throttle, brake, steer, boost, handbrake };

    const sources = currentSession.inputSources;
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const gp = source.gamepad;
      if (!gp) continue;

      // Triggers (Buttons 0 or 1 usually trigger and grip)
      if (source.handedness === 'right') {
        // Right controller: Trigger is throttle
        if (gp.buttons[0]?.pressed || gp.buttons[0]?.value > 0.1) {
          throttle = Math.max(throttle, gp.buttons[0].value || 1.0);
        }
        // Button A (usually index 4 or 5) is boost
        if (gp.buttons[4]?.pressed || gp.buttons[1]?.pressed) {
          boost = true;
        }
      } else if (source.handedness === 'left') {
        // Left controller: Trigger is brake/reverse
        if (gp.buttons[0]?.pressed || gp.buttons[0]?.value > 0.1) {
          brake = Math.max(brake, gp.buttons[0].value || 1.0);
        }
        // Grip or button X is handbrake
        if (gp.buttons[1]?.pressed || gp.buttons[4]?.pressed) {
          handbrake = true;
        }
      }

      // Thumbsticks / Axes: Axes 2 or 0 is horizontal steer
      if (gp.axes.length >= 2) {
        const thumbX = gp.axes[2] !== undefined && Math.abs(gp.axes[2]) > 0.1 ? gp.axes[2] : gp.axes[0];
        if (Math.abs(thumbX) > 0.15) {
          steer = thumbX;
        }
      }
    }

    return { throttle, brake, steer, boost, handbrake };
  };

  const updateDolly = (carPosition: THREE.Vector3, carYaw: number) => {
    // Lock VR dolly inside cockpit: driver head level
    dolly.position.set(
      carPosition.x,
      carPosition.y + 0.95,
      carPosition.z
    );
    dolly.rotation.y = carYaw;
  };

  return {
    get isVRSupported() {
      return isVRSupported;
    },
    get isInVR() {
      return isInVR;
    },
    dolly,
    requestVRSession,
    exitVRSession,
    getVRInput,
    updateDolly,
  };
}
