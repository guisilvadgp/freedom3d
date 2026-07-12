export const Input = {
  keys: {} as Record<string, boolean>,
  mouse: {
    x: 0,
    y: 0,
    movementX: 0,
    movementY: 0,
    isLocked: false,
    buttons: {} as Record<number, boolean>,
  },
  gamepad: {
    buttons: {} as Record<string, boolean>,
    axes: [0, 0, 0, 0] as number[],
  },
  
  // Methods to check input state
  getKey: (code: string) => !!Input.keys[code],
  getMouseButton: (btn: number) => !!Input.mouse.buttons[btn],
  getGamepadButton: (btnName: string) => !!Input.gamepad.buttons[btnName],
  getGamepadAxis: (axisIdx: number) => Input.gamepad.axes[axisIdx] || 0,
  
  // Mouse Lock API helper
  lockMouse: () => {
    if (!document.pointerLockElement) {
      document.body.requestPointerLock().catch(() => {});
    }
  },
  unlockMouse: () => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  },

  // Internal event handlers
  _init: () => {
    window.addEventListener('keydown', Input._onKeyDown);
    window.addEventListener('keyup', Input._onKeyUp);
    window.addEventListener('mousemove', Input._onMouseMove);
    window.addEventListener('mousedown', Input._onMouseDown);
    window.addEventListener('mouseup', Input._onMouseUp);
    document.addEventListener('pointerlockchange', Input._onPointerLockChange);
  },
  _cleanup: () => {
    window.removeEventListener('keydown', Input._onKeyDown);
    window.removeEventListener('keyup', Input._onKeyUp);
    window.removeEventListener('mousemove', Input._onMouseMove);
    window.removeEventListener('mousedown', Input._onMouseDown);
    window.removeEventListener('mouseup', Input._onMouseUp);
    document.removeEventListener('pointerlockchange', Input._onPointerLockChange);
  },
  _resetFrame: () => {
    Input.mouse.movementX = 0;
    Input.mouse.movementY = 0;
  },

  _updateGamepadState: () => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const configStr = localStorage.getItem('freedom3d_gamepad_config');
    const config = configStr ? JSON.parse(configStr) : {
      triggerButton: 0,
      moveAxisX: 0,
      moveAxisY: 1,
      lookAxisX: 2,
      lookAxisY: 3,
      invertX: false,
      invertY: false,
      buttonA: 0,
      buttonB: 1,
      buttonC: 2,
      buttonD: 3,
      buttonL1: 4,
      buttonR1: 5,
      buttonL2: 6,
      buttonR2: 7,
      buttonShare: 8,
      buttonOptions: 9,
      buttonL3: 10,
      buttonR3: 11
    };

    const gamepads = navigator.getGamepads();
    Input.gamepad.buttons = {};
    Input.gamepad.axes = [0, 0, 0, 0];

    // Detecta se o XR está ativo (modos VR / AR / MR) para filtrar os
    // controllers virtuais do XR e o giroscópio do próprio celular.
    const isXRActive = typeof navigator !== 'undefined' &&
      typeof (navigator as any).xr !== 'undefined' &&
      (document.querySelector('canvas') !== null) &&
      !!window.__freedom3d_xr_presenting__;

    // IDs que denotam sensores de movimento / giroscópio expostos como
    // "gamepad" (bug comum do Chrome no Android, usado nos modos AR/MR).
    const MOTION_KEYWORDS = [
      'sensor', 'motion', 'accelerometer', 'gyro',
      'android', 'orientation', 'deviceorientation', 'tilt'
    ];

    const isMotionSensor = (gp: Gamepad): boolean => {
      const idLower = gp.id ? gp.id.toLowerCase() : '';
      if (MOTION_KEYWORDS.some(k => idLower.includes(k))) return true;
      // Em AR/MR (celular no headset) o giroscópio aparece como gamepad sem
      // botões. Um controle Bluetooth real sempre tem botões.
      if (isXRActive && (!gp.buttons || gp.buttons.length === 0)) return true;
      return false;
    };

    const isXRVirtualController = (gp: Gamepad): boolean => {
      const idLower = gp.id ? gp.id.toLowerCase() : '';
      return isXRActive &&
        (idLower.includes('openvr') || idLower.includes('oculus') ||
         idLower.includes('quest') || idLower.includes('hand'));
    };

    // Coleta apenas controles genuínos, ignorando o giroscópio e os
    // controllers virtuais do XR. Assim o drone NÃO é guiado pelo
    // giroscópio e o controle Bluetooth real é o selecionado.
    const candidates: Gamepad[] = [];
    for (const gp of gamepads) {
      if (!gp || !gp.connected) continue;
      if (isMotionSensor(gp)) continue;
      if (isXRVirtualController(gp)) continue;
      if (!gp.buttons || gp.buttons.length === 0) continue;
      candidates.push(gp);
    }

    // Prefere o dispositivo com mais botões/eixos (controle Bluetooth real)
    // em vez do primeiro da lista (que costuma ser o giroscópio do celular).
    candidates.sort((a, b) =>
      (b.buttons.length + b.axes.length) - (a.buttons.length + a.axes.length)
    );

    const gp = candidates[0];
    if (gp) {
      if (gp.buttons.length > config.buttonA) Input.gamepad.buttons['A'] = gp.buttons[config.buttonA].pressed;
      if (gp.buttons.length > config.buttonB) Input.gamepad.buttons['B'] = gp.buttons[config.buttonB].pressed;
      if (gp.buttons.length > config.buttonC) Input.gamepad.buttons['C'] = gp.buttons[config.buttonC].pressed;
      if (gp.buttons.length > config.buttonD) Input.gamepad.buttons['D'] = gp.buttons[config.buttonD].pressed;
      if (gp.buttons.length > config.buttonL1) Input.gamepad.buttons['L1'] = gp.buttons[config.buttonL1].pressed;
      if (gp.buttons.length > config.buttonR1) Input.gamepad.buttons['R1'] = gp.buttons[config.buttonR1].pressed;
      if (gp.buttons.length > config.buttonL2) Input.gamepad.buttons['L2'] = gp.buttons[config.buttonL2].pressed;
      if (gp.buttons.length > config.buttonR2) Input.gamepad.buttons['R2'] = gp.buttons[config.buttonR2].pressed;
      if (gp.buttons.length > config.buttonL3) Input.gamepad.buttons['L3'] = gp.buttons[config.buttonL3].pressed;
      if (gp.buttons.length > config.buttonR3) Input.gamepad.buttons['R3'] = gp.buttons[config.buttonR3].pressed;
      if (gp.buttons.length > config.buttonShare) Input.gamepad.buttons['Share'] = gp.buttons[config.buttonShare].pressed;
      if (gp.buttons.length > config.buttonOptions) Input.gamepad.buttons['Options'] = gp.buttons[config.buttonOptions].pressed;

      if (gp.axes.length > Math.max(config.moveAxisX, config.moveAxisY)) {
        const rawX = gp.axes[config.moveAxisX];
        const rawY = gp.axes[config.moveAxisY];
        Input.gamepad.axes[0] = config.invertX ? -rawX : rawX;
        Input.gamepad.axes[1] = config.invertY ? -rawY : rawY;
      }

      if (gp.axes.length > Math.max(config.lookAxisX, config.lookAxisY)) {
        Input.gamepad.axes[2] = gp.axes[config.lookAxisX];
        Input.gamepad.axes[3] = gp.axes[config.lookAxisY];
      }
    }
  },

  _onKeyDown: (e: KeyboardEvent) => { Input.keys[e.code] = true; },
  _onKeyUp: (e: KeyboardEvent) => { Input.keys[e.code] = false; },
  _onMouseMove: (e: MouseEvent) => {
    Input.mouse.x = e.clientX;
    Input.mouse.y = e.clientY;
    if (Input.mouse.isLocked) {
      Input.mouse.movementX += e.movementX;
      Input.mouse.movementY += e.movementY;
    }
  },
  _onMouseDown: (e: MouseEvent) => { Input.mouse.buttons[e.button] = true; },
  _onMouseUp: (e: MouseEvent) => { Input.mouse.buttons[e.button] = false; },
  _onPointerLockChange: () => {
    Input.mouse.isLocked = !!document.pointerLockElement;
  }
};
