export interface InputState {
    forward: boolean;
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    boost: boolean;
    brake: boolean;
}

export class ControlsManager {
    public keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
    public touchState = { x: 0, y: 0, boost: false, brake: false };
    public isFlightPaused = false;
    public isTouchDevice = false;

    private activeTouchId: number | null = null;
    private originX = 0;
    private originY = 0;
    private maxRadius = 45;

    private nativeTouchDetected = false;

    constructor() {
        this.detectTouchDevice();
        this.setupKeyboard();
        this.setupTouchControls();
        this.setupFocusLossHandler();
    }

    private detectTouchDevice() {
        const isMobileOrTablet = ('ontouchstart' in window) || 
            (navigator.maxTouchPoints > 0) || 
            /Android|iPhone|iPad|iPod|Windows Phone|Mobile|Tablet/i.test(navigator.userAgent) ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

        if (isMobileOrTablet) {
            this.nativeTouchDetected = true;
            this.setTouchMode(true);
        }
        window.addEventListener('touchstart', () => {
            if (!this.nativeTouchDetected) {
                this.nativeTouchDetected = true;
                this.setTouchMode(true);
            }
        }, { once: true, passive: true });
    }

    public forceTouchControls(forced: boolean) {
        this.setTouchMode(forced || this.nativeTouchDetected);
    }

    public restoreTouchMode() {
        this.setTouchMode(this.nativeTouchDetected);
    }

    private setTouchMode(enabled: boolean) {
        this.isTouchDevice = enabled;
        if (enabled) {
            document.body.classList.add('is-touch-device');
            const joyBase = document.getElementById('joystick-base');
            if (joyBase && this.activeTouchId === null) {
                joyBase.classList.add('resting');
            }
        } else {
            document.body.classList.remove('is-touch-device');
            const joyBase = document.getElementById('joystick-base');
            if (joyBase) {
                joyBase.classList.remove('resting');
            }
        }
    }

    private setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w') this.keys.w = true;
            if (k === 's') this.keys.s = true;
            if (k === 'a') this.keys.a = true;
            if (k === 'd') this.keys.d = true;
            if (e.key === 'Shift') this.keys.shift = true;
            if (e.key === ' ' || e.code === 'Space') this.keys.space = true;
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w') this.keys.w = false;
            if (k === 's') this.keys.s = false;
            if (k === 'a') this.keys.a = false;
            if (k === 'd') this.keys.d = false;
            if (e.key === 'Shift') this.keys.shift = false;
            if (e.key === ' ' || e.code === 'Space') this.keys.space = false;
        });
    }

    private setupFocusLossHandler() {
        const resetAll = () => {
            this.keys.w = false;
            this.keys.a = false;
            this.keys.s = false;
            this.keys.d = false;
            this.keys.shift = false;
            this.keys.space = false;
            this.resetJoystick();
            this.touchState.boost = false;
            const boostBtn = document.getElementById('boost-btn');
            if (boostBtn) boostBtn.classList.remove('active');
        };

        window.addEventListener('blur', resetAll);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) resetAll();
        });
    }

    private resetJoystick() {
        this.activeTouchId = null;
        this.touchState.x = 0;
        this.touchState.y = 0;
        const joyBase = document.getElementById('joystick-base');
        const joyKnob = document.getElementById('joystick-knob');
        if (joyKnob) {
            joyKnob.style.transform = 'translate(-50%, -50%)';
        }
        if (joyBase) {
            joyBase.style.left = '';
            joyBase.style.top = '';
            joyBase.classList.remove('active');
            if (this.isTouchDevice) {
                joyBase.classList.add('resting');
            }
        }
    }

    private setupTouchControls() {
        const joyBase = document.getElementById('joystick-base');
        const joyKnob = document.getElementById('joystick-knob');
        const boostBtn = document.getElementById('boost-btn');
        const touchContainer = document.getElementById('touch-controls') || document.body;

        if (joyBase && joyKnob) {
            const isInteractiveUI = (target: EventTarget | null): boolean => {
                if (!target || !(target instanceof HTMLElement)) return false;
                if (target === boostBtn || boostBtn?.contains(target)) return true;
                if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                    return true;
                }
                return Boolean(target.closest('#top-bar, #top-right-bar, #settings-menu, #model-dropdown, #biome-dropdown, #debug-panel, #dev-editor-panel, #photo-mode-ui, #boost-btn, #simulator-toolbar'));
            };

            const getLocalCoords = (clientX: number, clientY: number) => {
                const rect = touchContainer.getBoundingClientRect();
                const scale = rect.width > 0 ? rect.width / (touchContainer.clientWidth || rect.width) : 1;
                return {
                    x: (clientX - rect.left) / scale,
                    y: (clientY - rect.top) / scale,
                    scale: scale || 1,
                    containerWidth: touchContainer.clientWidth || rect.width
                };
            };

            const handleTouchStart = (e: TouchEvent) => {
                this.setTouchMode(true);
                if (this.activeTouchId !== null) return;
                if (e.touches.length > 2) return;

                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    const target = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (isInteractiveUI(target)) continue;

                    const coords = getLocalCoords(touch.clientX, touch.clientY);
                    const isLeftHalf = coords.x < coords.containerWidth * 0.65;
                    if (isLeftHalf || !isInteractiveUI(target)) {
                        e.preventDefault();
                        this.activeTouchId = touch.identifier;
                        this.originX = touch.clientX;
                        this.originY = touch.clientY;

                        joyBase.style.left = `${coords.x}px`;
                        joyBase.style.top = `${coords.y}px`;
                        joyBase.classList.remove('resting');
                        joyBase.classList.add('active');
                        joyKnob.style.transform = 'translate(-50%, -50%)';

                        this.touchState.x = 0;
                        this.touchState.y = 0;
                        break;
                    }
                }
            };

            const handleTouchMove = (e: TouchEvent) => {
                if (this.activeTouchId === null) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.identifier === this.activeTouchId) {
                        e.preventDefault();
                        const coords = getLocalCoords(touch.clientX, touch.clientY);
                        let dx = (touch.clientX - this.originX) / coords.scale;
                        let dy = (touch.clientY - this.originY) / coords.scale;
                        const dist = Math.hypot(dx, dy);
                        if (dist > this.maxRadius && dist > 0.001) {
                            dx = (dx / dist) * this.maxRadius;
                            dy = (dy / dist) * this.maxRadius;
                        }
                        joyKnob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
                        this.touchState.x = dx / this.maxRadius;
                        this.touchState.y = dy / this.maxRadius;
                        break;
                    }
                }
            };

            const handleTouchEnd = (e: TouchEvent) => {
                if (this.activeTouchId === null) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === this.activeTouchId) {
                        this.resetJoystick();
                        break;
                    }
                }
            };

            window.addEventListener('touchstart', handleTouchStart, { passive: false });
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd, { passive: true });
            window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

            // Support mouse dragging on joystick when simulated touch mode is active
            let isMouseDownJoy = false;
            window.addEventListener('mousedown', (e: MouseEvent) => {
                if (!this.isTouchDevice) return;
                if (e.button !== 0) return;
                const target = e.target as HTMLElement;
                if (isInteractiveUI(target)) return;

                const coords = getLocalCoords(e.clientX, e.clientY);
                const isLeftHalf = coords.x < coords.containerWidth * 0.65;
                if (isLeftHalf) {
                    isMouseDownJoy = true;
                    this.originX = e.clientX;
                    this.originY = e.clientY;

                    joyBase.style.left = `${coords.x}px`;
                    joyBase.style.top = `${coords.y}px`;
                    joyBase.classList.remove('resting');
                    joyBase.classList.add('active');
                    joyKnob.style.transform = 'translate(-50%, -50%)';

                    this.touchState.x = 0;
                    this.touchState.y = 0;
                }
            });

            window.addEventListener('mousemove', (e: MouseEvent) => {
                if (!isMouseDownJoy) return;
                const coords = getLocalCoords(e.clientX, e.clientY);
                let dx = (e.clientX - this.originX) / coords.scale;
                let dy = (e.clientY - this.originY) / coords.scale;
                const dist = Math.hypot(dx, dy);
                if (dist > this.maxRadius && dist > 0.001) {
                    dx = (dx / dist) * this.maxRadius;
                    dy = (dy / dist) * this.maxRadius;
                }
                joyKnob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
                this.touchState.x = dx / this.maxRadius;
                this.touchState.y = dy / this.maxRadius;
            });

            const stopMouseJoy = () => {
                if (isMouseDownJoy) {
                    isMouseDownJoy = false;
                    this.resetJoystick();
                }
            };
            window.addEventListener('mouseup', stopMouseJoy);
        }

        if (boostBtn) {
            const startBoost = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.touchState.boost = true;
                boostBtn.classList.add('active');
            };
            const resetBoost = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.touchState.boost = false;
                boostBtn.classList.remove('active');
            };

            boostBtn.addEventListener('touchstart', startBoost, { passive: false });
            boostBtn.addEventListener('touchend', resetBoost, { passive: false });
            boostBtn.addEventListener('touchcancel', resetBoost, { passive: false });
            boostBtn.addEventListener('mousedown', startBoost);
            boostBtn.addEventListener('mouseup', resetBoost);
            boostBtn.addEventListener('mouseleave', resetBoost);
            boostBtn.addEventListener('pointerdown', startBoost);
            boostBtn.addEventListener('pointerup', resetBoost);
            boostBtn.addEventListener('pointercancel', resetBoost);
        }
    }

    public isJoystickActive(): boolean {
        return this.activeTouchId !== null;
    }

    public getInputState(): InputState {
        const isBoosting = this.keys.shift || this.touchState.boost;
        const isBraking = this.keys.space || this.touchState.brake;
        return {
            forward: true,
            boost: isBoosting,
            brake: isBraking,
            up: this.keys.w || this.touchState.y < -0.15,
            down: this.keys.s || this.touchState.y > 0.15,
            left: this.keys.a || this.touchState.x < -0.15,
            right: this.keys.d || this.touchState.x > 0.15
        };
    }
}
