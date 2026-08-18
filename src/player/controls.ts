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

    private activeTouchId: number | null = null;
    private originX = 0;
    private originY = 0;
    private maxRadius = 45;

    constructor() {
        this.setupKeyboard();
        this.setupTouchControls();
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

    private setupTouchControls() {
        const joyZone = document.getElementById('joystick-zone');
        const joyBase = document.getElementById('joystick-base');
        const joyKnob = document.getElementById('joystick-knob');
        const boostBtn = document.getElementById('boost-btn');

        if (joyBase && joyKnob) {
            const handleTouchStart = (e: TouchEvent) => {
                if (this.activeTouchId !== null) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.clientX < window.innerWidth * 0.55) {
                        e.preventDefault();
                        this.activeTouchId = touch.identifier;
                        this.originX = touch.clientX;
                        this.originY = touch.clientY;

                        joyBase.style.left = `${this.originX}px`;
                        joyBase.style.top = `${this.originY}px`;
                        joyBase.style.opacity = '1';
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
                        let dx = touch.clientX - this.originX;
                        let dy = touch.clientY - this.originY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > this.maxRadius) {
                            dx = (dx / dist) * this.maxRadius;
                            dy = (dy / dist) * this.maxRadius;
                        }
                        joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
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
                        this.activeTouchId = null;
                        this.touchState.x = 0;
                        this.touchState.y = 0;
                        joyBase.style.opacity = '0';
                        joyKnob.style.transform = 'translate(-50%, -50%)';
                        break;
                    }
                }
            };

            if (joyZone) {
                joyZone.addEventListener('touchstart', handleTouchStart, { passive: false });
                joyZone.addEventListener('touchmove', handleTouchMove, { passive: false });
                joyZone.addEventListener('touchend', handleTouchEnd);
                joyZone.addEventListener('touchcancel', handleTouchEnd);
            } else {
                window.addEventListener('touchstart', handleTouchStart, { passive: false });
                window.addEventListener('touchmove', handleTouchMove, { passive: false });
                window.addEventListener('touchend', handleTouchEnd);
                window.addEventListener('touchcancel', handleTouchEnd);
            }
        }

        if (boostBtn) {
            const startBoost = (e: Event) => {
                e.preventDefault();
                this.touchState.boost = true;
                boostBtn.classList.add('active');
            };
            const resetBoost = (e: Event) => {
                e.preventDefault();
                this.touchState.boost = false;
                boostBtn.classList.remove('active');
            };
            boostBtn.addEventListener('touchstart', startBoost, { passive: false });
            boostBtn.addEventListener('touchend', resetBoost);
            boostBtn.addEventListener('touchcancel', resetBoost);
            boostBtn.addEventListener('mousedown', startBoost);
            boostBtn.addEventListener('mouseup', resetBoost);
            boostBtn.addEventListener('mouseleave', resetBoost);
        }
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
