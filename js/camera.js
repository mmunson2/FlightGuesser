// The camera rig: three ways to look at the airplane.
//   fly   (default) first person, after noclip.website's FPS camera: drag
//         to look, WASD to move (Q/E down/up, Shift faster), scroll zooms.
//   orbit three.js OrbitControls: drag to rotate around a target, right
//         drag to pan, scroll to dolly.
//   seat  Operate mode: the head is in the pilot's seat. Drag to look
//         around (within what a seated pilot can), scroll zooms; no moving.
// The rig stands in for OrbitControls wherever something switches the
// camera off for a moment (g1000-panel.js turning a knob): `enabled`.
const CAMERA_RIG = (() => {
  const FLY_FOV = 50, ORBIT_FOV = 35;
  const SPEED = 1.5, FAST = 4;            // m/s, Shift multiplier
  const LOOK = 0.0035;                    // rad per pixel at FLY_FOV
  const DRAG = 4;                         // px before a press is a drag, not a click
  // The pilot's eye in the left seat (+x: the PFD's side), and the yaw
  // and pitch a seated pilot can turn through around straight ahead.
  const SEAT = { eye: [0.19, 0.13, -0.36], look: [0.19, 0.03, 0.36], yaw: 1.9, up: 0.7, down: 1.0,
    fovMin: 12, fovMax: 70 };
  const MOVE_KEYS = {
    KeyW: [0, 0, 1], ArrowUp: [0, 0, 1], KeyS: [0, 0, -1], ArrowDown: [0, 0, -1],
    KeyA: [-1, 0, 0], ArrowLeft: [-1, 0, 0], KeyD: [1, 0, 0], ArrowRight: [1, 0, 0],
    KeyQ: [0, -1, 0], KeyE: [0, 1, 0],
  };

  function create({ THREE, camera, dom, ignoreKeys = () => false }) {
    const orbit = new THREE.OrbitControls(camera, dom);
    orbit.enableDamping = true;
    let mode = 'fly', blocked = false, prevMode = 'fly';
    const keys = new Set();
    let shift = false;
    const vel = new THREE.Vector3();
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    let press = null, dragged = false, lastT = performance.now();
    // Seat: yaw/pitch of straight ahead, to clamp the look against.
    let seatYaw = 0, seatPitch = 0;

    function applyEnabled() { orbit.enabled = mode === 'orbit' && !blocked; }

    // Yaw and pitch from the camera as it is, so anything that places the
    // camera (goView, tools/shot.py through OrbitControls) still counts.
    function look(dx, dy) {
      euler.setFromQuaternion(camera.quaternion, 'YXZ');
      const k = LOOK * camera.fov / FLY_FOV;
      euler.y -= dx * k;
      euler.x -= dy * k;
      euler.z = 0;
      const lim = Math.PI / 2 - 0.01;
      if (mode === 'seat') {
        let dyaw = euler.y - seatYaw;
        dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
        euler.y = seatYaw + Math.max(-SEAT.yaw, Math.min(SEAT.yaw, dyaw));
        euler.x = Math.max(seatPitch - SEAT.down, Math.min(seatPitch + SEAT.up, euler.x));
      }
      euler.x = Math.max(-lim, Math.min(lim, euler.x));
      camera.quaternion.setFromEuler(euler);
    }

    // Look by dragging, either button. A press that moves less than DRAG
    // pixels stays a click (select, hide, press a key): `consumeDrag`.
    dom.addEventListener('pointerdown', (e) => {
      if (mode === 'orbit' || (e.button !== 0 && e.button !== 2)) return;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, looking: false };
      dragged = false;
    });
    dom.addEventListener('pointermove', (e) => {
      if (!press || e.pointerId !== press.id) return;
      // Something else took the drag (a knob, a lever): leave it be.
      if (blocked) { press = null; return; }
      if (!press.looking) {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) <= DRAG) return;
        press.looking = dragged = true;
        dom.setPointerCapture(e.pointerId);
        dom.style.cursor = 'grabbing';
      }
      look(e.movementX, e.movementY);
    });
    const endPress = (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (press.looking) dom.style.cursor = '';
      press = null;
    };
    dom.addEventListener('pointerup', endPress);
    dom.addEventListener('pointercancel', endPress);

    // Scroll zooms (field of view) in fly and seat; OrbitControls has its own.
    // g1000-panel.js takes scrolls over its knobs and levers first.
    dom.addEventListener('wheel', (e) => {
      if (mode === 'orbit') return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      zoom(Math.exp(dy * 0.0012));
    }, { passive: false });
    function zoom(f) {
      const [lo, hi] = mode === 'seat' ? [SEAT.fovMin, SEAT.fovMax] : [10, 80];
      camera.fov = Math.max(lo, Math.min(hi, camera.fov * f));
      camera.updateProjectionMatrix();
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') shift = true;
      if (ignoreKeys(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (mode === 'fly' && MOVE_KEYS[e.code]) {
        keys.add(e.code);
        e.preventDefault();
      } else if (mode !== 'orbit' && (e.key === '+' || e.key === '=' || e.key === '-')) {
        zoom(e.key === '-' ? 1.15 : 1 / 1.15);
        e.preventDefault();
      }
    });
    document.addEventListener('keyup', (e) => {
      keys.delete(e.code);
      if (e.key === 'Shift') shift = false;
    });
    window.addEventListener('blur', () => { keys.clear(); shift = false; });

    // Each frame. True if the camera moved, so the viewer draws a frame
    // (it draws only on a change); a look drag or a zoom is an input,
    // which draws one anyway.
    const want = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
    function update() {
      const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      if (mode === 'orbit') return orbit.update();
      if (mode !== 'fly') return false;
      want.set(0, 0, 0);
      for (const k of keys) want.add(new THREE.Vector3(...MOVE_KEYS[k]));
      if (want.lengthSq()) want.normalize().multiplyScalar(SPEED * (shift ? FAST : 1));
      // Ease toward the wanted speed, like noclip's acceleration and drag.
      camera.getWorldDirection(fwd);
      right.crossVectors(fwd, camera.up).normalize();
      const target = new THREE.Vector3().addScaledVector(right, want.x)
        .addScaledVector(fwd, want.z).addScaledVector(camera.up, want.y);
      vel.lerp(target, 1 - Math.exp(-dt * 10));
      if (vel.lengthSq() < 1e-6) { vel.set(0, 0, 0); return false; }
      camera.position.addScaledVector(vel, dt);
      return true;
    }
    // Place the camera (a view preset).
    function goTo(position, target) {
      camera.position.set(...position);
      orbit.target.set(...target);
      camera.lookAt(orbit.target);
      if (mode === 'orbit') orbit.update();
      vel.set(0, 0, 0);
    }

    function setMode(next) {
      if (next === mode) return;
      if (next === 'orbit') {
        // Orbit around what the camera is looking at, about a metre ahead.
        camera.getWorldDirection(fwd);
        orbit.target.copy(camera.position).addScaledVector(fwd, Math.max(0.5, orbit.target.distanceTo(camera.position)));
      }
      if (next === 'seat') {
        prevMode = mode;
        camera.position.set(...SEAT.eye);
        camera.lookAt(new THREE.Vector3(...SEAT.look));
        euler.setFromQuaternion(camera.quaternion, 'YXZ');
        seatYaw = euler.y;
        seatPitch = euler.x;
      }
      mode = next;
      keys.clear();
      vel.set(0, 0, 0);
      camera.fov = mode === 'orbit' ? ORBIT_FOV : FLY_FOV;
      camera.updateProjectionMatrix();
      if (mode === 'orbit') orbit.update();
      applyEnabled();
    }
    applyEnabled();
    camera.fov = FLY_FOV;
    camera.updateProjectionMatrix();

    return {
      orbit, update, goTo, setMode,
      get mode() { return mode; },
      // Leaving the seat goes back to the mode before it.
      leaveSeat() { if (mode === 'seat') setMode(prevMode); },
      // OrbitControls' switch, for g1000-panel.js.
      get enabled() { return !blocked; },
      set enabled(v) { blocked = !v; applyEnabled(); },
      // True once, after a press that became a look: not a click.
      consumeDrag() { const d = dragged; dragged = false; return d; },
    };
  }
  return { create, SEAT };
})();
