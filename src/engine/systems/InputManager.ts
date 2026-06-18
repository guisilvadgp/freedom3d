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
    axes: [0, 0] as [number, number],
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
      buttonA: 0,
      buttonB: 1,
      buttonC: 2,
      buttonD: 3
    };

    const gamepads = navigator.getGamepads();
    Input.gamepad.buttons = {};
    Input.gamepad.axes = [0, 0];

    for (const gp of gamepads) {
      if (gp && gp.connected) {
        if (gp.buttons.length > config.buttonA) Input.gamepad.buttons['A'] = gp.buttons[config.buttonA].pressed;
        if (gp.buttons.length > config.buttonB) Input.gamepad.buttons['B'] = gp.buttons[config.buttonB].pressed;
        if (gp.buttons.length > config.buttonC) Input.gamepad.buttons['C'] = gp.buttons[config.buttonC].pressed;
        if (gp.buttons.length > config.buttonD) Input.gamepad.buttons['D'] = gp.buttons[config.buttonD].pressed;

        if (gp.axes.length > Math.max(config.moveAxisX, config.moveAxisY)) {
          Input.gamepad.axes[0] = gp.axes[config.moveAxisX];
          Input.gamepad.axes[1] = gp.axes[config.moveAxisY];
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
