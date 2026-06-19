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

    for (const gp of gamepads) {
      if (gp && gp.connected) {
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
        break;
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
