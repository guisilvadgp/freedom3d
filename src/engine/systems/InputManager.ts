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
  
  // Methods to check input state
  getKey: (code: string) => !!Input.keys[code],
  getMouseButton: (btn: number) => !!Input.mouse.buttons[btn],
  
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
