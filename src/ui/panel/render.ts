import { ControlDef, PanelHandle, SectionDef, SliderDef, ColorDef, ToggleDef, ButtonDef, ButtonRowDef, SegmentedDef, SelectDef, SwatchListDef, SearchDef, CardGridDef, ReadoutDef, CustomDef } from './types';
import './panel.css';

/**
 * Global registry of active panel handles and control definitions for audit probing.
 */
interface ActiveControlRef {
    def: ControlDef;
    label: string;
    getFn?: () => any;
    visibleFn?: () => boolean;
    disabledFn?: () => boolean;
}

const activeControlRefs = new Set<ActiveControlRef>();

export function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`requireEl: Required element #${id} was not found in DOM`);
    }
    return el as T;
}

/**
 * Declarative DOM renderer for developer editor control schemas.
 */
export function renderPanel(host: HTMLElement, schema: ControlDef[]): PanelHandle {
    host.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'dev-panel-root';
    host.appendChild(root);

    const refreshFns: Array<() => void> = [];
    const destroyFns: Array<() => void> = [];
    const panelRefs = new Set<ActiveControlRef>();

    function refreshPanel() {
        for (const fn of refreshFns) {
            fn();
        }
    }

    function trackRef(def: ControlDef, label: string, getFn?: () => any) {
        const ref: ActiveControlRef = {
            def,
            label,
            getFn,
            visibleFn: def.visible,
            disabledFn: def.disabled
        };
        activeControlRefs.add(ref);
        panelRefs.add(ref);

        if (import.meta.env.DEV) {
            try {
                if (ref.visibleFn) ref.visibleFn();
                if (ref.disabledFn) ref.disabledFn();
                if (ref.getFn) ref.getFn();
            } catch (err: any) {
                console.error(`[Panel Audit] Error evaluating control "${label}":`, err);
            }
        }
    }

    function renderControl(def: ControlDef, parent: HTMLElement) {
        switch (def.kind) {
            case 'section':
                renderSection(def, parent);
                break;
            case 'slider':
                renderSlider(def, parent);
                break;
            case 'color':
                renderColor(def, parent);
                break;
            case 'toggle':
                renderToggle(def, parent);
                break;
            case 'button':
                renderButton(def, parent);
                break;
            case 'buttonRow':
                renderButtonRow(def, parent);
                break;
            case 'segmented':
                renderSegmented(def, parent);
                break;
            case 'select':
                renderSelect(def, parent);
                break;
            case 'swatchList':
                renderSwatchList(def, parent);
                break;
            case 'search':
                renderSearch(def, parent);
                break;
            case 'cardGrid':
                renderCardGrid(def, parent);
                break;
            case 'readout':
                renderReadout(def, parent);
                break;
            case 'custom':
                renderCustom(def, parent);
                break;
        }
    }

    function renderSection(def: SectionDef, parent: HTMLElement) {
        const card = document.createElement('div');
        card.className = 'dev-section';

        const header = document.createElement('div');
        header.className = 'dev-section-header';

        const title = document.createElement('span');
        title.className = 'dev-section-title';
        title.textContent = def.title;
        header.appendChild(title);

        let tagEl: HTMLSpanElement | null = null;
        if (def.tag) {
            tagEl = document.createElement('span');
            tagEl.className = 'dev-section-tag';
            tagEl.textContent = def.tag();
            header.appendChild(tagEl);
        }

        card.appendChild(header);

        const body = document.createElement('div');
        body.className = 'dev-section-body';
        card.appendChild(body);

        for (const child of def.children) {
            renderControl(child, body);
        }

        parent.appendChild(card);

        trackRef(def, def.title);

        refreshFns.push(() => {
            if (def.visible) {
                card.classList.toggle('is-hidden', !def.visible());
            }
            if (tagEl && def.tag) {
                tagEl.textContent = def.tag();
            }
        });
    }

    function renderSlider(def: SliderDef, parent: HTMLElement) {
        const row = document.createElement('div');
        row.className = 'dev-control-row';

        const header = document.createElement('div');
        header.className = 'dev-row-header';

        const labelWrap = document.createElement('div');
        labelWrap.className = 'dev-row-label';
        labelWrap.textContent = def.label || '';

        if (def.hint) {
            const hint = document.createElement('div');
            hint.className = 'dev-row-hint';
            hint.textContent = def.hint;
            labelWrap.appendChild(hint);
        }
        header.appendChild(labelWrap);

        const valReadout = document.createElement('span');
        valReadout.className = 'dev-row-val';
        header.appendChild(valReadout);
        row.appendChild(header);

        const wrap = document.createElement('div');
        wrap.className = 'dev-slider-wrap';

        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'dev-slider-input';
        input.min = String(def.min);
        input.max = String(def.max);
        input.step = String(def.step);
        wrap.appendChild(input);

        let numInput: HTMLInputElement | null = null;
        if (def.numeric) {
            numInput = document.createElement('input');
            numInput.type = 'number';
            numInput.className = 'dev-num-input';
            numInput.min = String(def.min);
            numInput.max = String(def.max);
            numInput.step = String(def.step);
            wrap.appendChild(numInput);
        }

        row.appendChild(wrap);
        parent.appendChild(row);

        const prec = def.precision !== undefined ? def.precision : (def.step % 1 === 0 ? 0 : 2);
        const unit = def.unit || '';

        function formatVal(v: number): string {
            return `${Number(v).toFixed(prec)}${unit}`;
        }

        let isDragging = false;

        input.addEventListener('pointerdown', () => {
            isDragging = true;
        });

        input.addEventListener('input', () => {
            isDragging = true;
            const v = parseFloat(input.value);
            valReadout.textContent = formatVal(v);
            if (numInput && document.activeElement !== numInput) {
                numInput.value = String(v);
            }
            def.set(v);
        });

        input.addEventListener('change', () => {
            isDragging = false;
            const v = parseFloat(input.value);
            if (def.commit) {
                def.commit(v);
            }
        });

        window.addEventListener('pointerup', () => {
            isDragging = false;
        });

        if (numInput) {
            numInput.addEventListener('input', () => {
                const v = parseFloat(numInput!.value);
                if (!isNaN(v)) {
                    input.value = String(v);
                    valReadout.textContent = formatVal(v);
                    def.set(v);
                }
            });

            numInput.addEventListener('change', () => {
                const v = parseFloat(numInput!.value);
                if (!isNaN(v)) {
                    if (def.commit) {
                        def.commit(v);
                    }
                }
            });
        }

        const initialVal = def.get();
        input.value = String(initialVal);
        valReadout.textContent = formatVal(initialVal);
        if (numInput) numInput.value = String(initialVal);

        trackRef(def, def.label || 'Slider', def.get);

        refreshFns.push(() => {
            if (def.visible) {
                row.classList.toggle('is-hidden', !def.visible());
            }
            const disabled = def.disabled ? def.disabled() : false;
            row.classList.toggle('is-disabled', disabled);
            input.disabled = disabled;
            if (numInput) numInput.disabled = disabled;

            if (!isDragging) {
                const val = def.get();
                input.value = String(val);
                valReadout.textContent = formatVal(val);
                if (numInput && document.activeElement !== numInput) {
                    numInput.value = String(val);
                }
            }
        });
    }

    function renderColor(def: ColorDef, parent: HTMLElement) {
        const row = document.createElement('div');
        row.className = 'dev-control-row';

        const header = document.createElement('div');
        header.className = 'dev-row-header';

        const labelEl = document.createElement('span');
        labelEl.className = 'dev-row-label';
        labelEl.textContent = def.label || '';
        header.appendChild(labelEl);

        const wrap = document.createElement('div');
        wrap.className = 'dev-color-wrap';

        const hexText = document.createElement('span');
        hexText.className = 'dev-color-hex';

        const input = document.createElement('input');
        input.type = 'color';
        input.className = 'dev-color-picker';

        wrap.appendChild(hexText);
        wrap.appendChild(input);
        header.appendChild(wrap);
        row.appendChild(header);
        parent.appendChild(row);

        const updateUI = (hex: string) => {
            const cleanHex = hex.toLowerCase();
            input.value = cleanHex;
            hexText.textContent = cleanHex;
        };

        input.addEventListener('input', () => {
            const hex = input.value.toLowerCase();
            hexText.textContent = hex;
            def.set(hex);
        });

        input.addEventListener('change', () => {
            const hex = input.value.toLowerCase();
            hexText.textContent = hex;
            def.set(hex);
        });

        updateUI(def.get());
        trackRef(def, def.label || 'Color', def.get);

        refreshFns.push(() => {
            if (def.visible) {
                row.classList.toggle('is-hidden', !def.visible());
            }
            const disabled = def.disabled ? def.disabled() : false;
            row.classList.toggle('is-disabled', disabled);
            input.disabled = disabled;
            updateUI(def.get());
        });
    }

    function renderToggle(def: ToggleDef, parent: HTMLElement) {
        const row = document.createElement('div');
        row.className = 'dev-control-row';

        const btn = document.createElement('button');
        btn.className = 'dev-btn';

        row.appendChild(btn);
        parent.appendChild(row);

        const updateUI = () => {
            const val = def.get();
            btn.textContent = val ? def.onLabel : def.offLabel;
            btn.classList.toggle('active', val);
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            def.set(!def.get());
            updateUI();
        });

        updateUI();
        trackRef(def, def.label || 'Toggle', def.get);

        refreshFns.push(() => {
            if (def.visible) {
                row.classList.toggle('is-hidden', !def.visible());
            }
            const disabled = def.disabled ? def.disabled() : false;
            row.classList.toggle('is-disabled', disabled);
            btn.disabled = disabled;
            updateUI();
        });
    }

    function renderButton(def: ButtonDef, parent: HTMLElement) {
        const btn = document.createElement('button');
        btn.className = `dev-btn ${def.tone ? `tone-${def.tone}` : ''}`;
        btn.textContent = def.text;

        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (btn.disabled) return;
            try {
                const res = def.onClick();
                if (res instanceof Promise) {
                    btn.disabled = true;
                    await res;
                }
            } finally {
                btn.disabled = def.disabled ? def.disabled() : false;
            }
        });

        parent.appendChild(btn);
        trackRef(def, def.text);

        refreshFns.push(() => {
            if (def.visible) {
                btn.classList.toggle('is-hidden', !def.visible());
            }
            const disabled = def.disabled ? def.disabled() : false;
            btn.disabled = disabled;
        });
    }

    function renderButtonRow(def: ButtonRowDef, parent: HTMLElement) {
        const row = document.createElement('div');
        row.className = 'dev-btn-row';

        for (const b of def.buttons) {
            renderButton(b, row);
        }

        parent.appendChild(row);
        trackRef(def, def.label || 'ButtonRow');

        refreshFns.push(() => {
            if (def.visible) {
                row.classList.toggle('is-hidden', !def.visible());
            }
        });
    }

    function renderSegmented(def: SegmentedDef, parent: HTMLElement) {
        const row = document.createElement('div');
        row.className = 'dev-control-row';

        if (def.label) {
            const header = document.createElement('div');
            header.className = 'dev-row-header';
            const labelEl = document.createElement('span');
            labelEl.className = 'dev-row-label';
            labelEl.textContent = def.label;
            header.appendChild(labelEl);
            row.appendChild(header);
        }

        const seg = document.createElement('div');
        seg.className = 'dev-segmented';

        const buttons: Array<{ el: HTMLButtonElement; val: string }> = [];

        def.options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.className = 'dev-seg-item';
            btn.textContent = opt.text;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                def.set(opt.value);
                updateUI();
                refreshPanel();
            });
            seg.appendChild(btn);
            buttons.push({ el: btn, val: opt.value });
        });

        row.appendChild(seg);
        parent.appendChild(row);

        const updateUI = () => {
            const current = def.get();
            buttons.forEach((b) => {
                b.el.classList.toggle('active', b.val === current);
            });
        };

        updateUI();
        trackRef(def, def.label || 'Segmented', def.get);

        refreshFns.push(() => {
            if (def.visible) {
                row.classList.toggle('is-hidden', !def.visible());
            }
            const disabled = def.disabled ? def.disabled() : false;
            row.classList.toggle('is-disabled', disabled);
            buttons.forEach((b) => (b.el.disabled = disabled));
            updateUI();
        });
    }

    function renderSelect(def: SelectDef, parent: HTMLElement) {
        const row = document.createElement('div');
        row.className = 'dev-control-row';

        if (def.label) {
            const header = document.createElement('div');
            header.className = 'dev-row-header';
            const labelEl = document.createElement('span');
            labelEl.className = 'dev-row-label';
            labelEl.textContent = def.label;
            header.appendChild(labelEl);
            row.appendChild(header);
        }

        const select = document.createElement('select');
        select.className = 'dev-select';

        const populate = () => {
            const opts = def.options();
            select.innerHTML = '';
            opts.forEach((o) => {
                const optEl = document.createElement('option');
                optEl.value = o.value;
                optEl.textContent = o.text;
                select.appendChild(optEl);
            });
            select.value = def.get();
        };

        select.addEventListener('change', () => {
            def.set(select.value);
        });

        populate();
        row.appendChild(select);
        parent.appendChild(row);

        trackRef(def, def.label || 'Select', def.get);

        refreshFns.push(() => {
            if (def.visible) {
                row.classList.toggle('is-hidden', !def.visible());
            }
            const disabled = def.disabled ? def.disabled() : false;
            row.classList.toggle('is-disabled', disabled);
            select.disabled = disabled;
            populate();
        });
    }

    function renderSwatchList(def: SwatchListDef, parent: HTMLElement) {
        const row = document.createElement('div');
        row.className = 'dev-control-row';

        if (def.label) {
            const header = document.createElement('div');
            header.className = 'dev-row-header';
            const labelEl = document.createElement('span');
            labelEl.className = 'dev-row-label';
            labelEl.textContent = def.label;
            header.appendChild(labelEl);
            row.appendChild(header);
        }

        const listWrap = document.createElement('div');
        listWrap.className = 'dev-swatch-list';
        row.appendChild(listWrap);
        parent.appendChild(row);

        const rebuildSwatches = () => {
            listWrap.innerHTML = '';
            const colors = def.get();

            colors.forEach((color, idx) => {
                const swatch = document.createElement('div');
                swatch.className = 'dev-swatch-item';
                swatch.style.backgroundColor = color;

                const picker = document.createElement('input');
                picker.type = 'color';
                picker.className = 'dev-swatch-picker';
                picker.value = color.startsWith('#') ? color : '#ffffff';

                picker.addEventListener('input', (e) => {
                    e.stopPropagation();
                    const next = [...colors];
                    next[idx] = picker.value.toLowerCase();
                    swatch.style.backgroundColor = picker.value;
                    def.set(next);
                });

                swatch.appendChild(picker);
                listWrap.appendChild(swatch);
            });

            if (def.editableLength) {
                const addBtn = document.createElement('button');
                addBtn.className = 'dev-swatch-add-btn';
                addBtn.textContent = '+';
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const next = [...colors, '#ffffff'];
                    def.set(next);
                    rebuildSwatches();
                });
                listWrap.appendChild(addBtn);
            }
        };

        rebuildSwatches();
        trackRef(def, def.label || 'SwatchList', def.get);

        refreshFns.push(() => {
            if (def.visible) {
                row.classList.toggle('is-hidden', !def.visible());
            }
            const disabled = def.disabled ? def.disabled() : false;
            row.classList.toggle('is-disabled', disabled);
            rebuildSwatches();
        });
    }

    function renderSearch(def: SearchDef, parent: HTMLElement) {
        const row = document.createElement('div');
        row.className = 'dev-control-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'dev-search-input';
        input.placeholder = def.placeholder;
        input.value = def.get();

        input.addEventListener('input', () => {
            def.set(input.value);
            refreshPanel();
        });

        row.appendChild(input);
        parent.appendChild(row);

        trackRef(def, def.placeholder || 'Search', def.get);

        refreshFns.push(() => {
            if (def.visible) {
                row.classList.toggle('is-hidden', !def.visible());
            }
            const disabled = def.disabled ? def.disabled() : false;
            row.classList.toggle('is-disabled', disabled);
            input.disabled = disabled;
            if (document.activeElement !== input) {
                input.value = def.get();
            }
        });
    }

    function renderCardGrid(def: CardGridDef, parent: HTMLElement) {
        const row = document.createElement('div');
        row.className = 'dev-control-row';

        if (def.label) {
            const header = document.createElement('div');
            header.className = 'dev-row-header';
            const labelEl = document.createElement('span');
            labelEl.className = 'dev-row-label';
            labelEl.textContent = def.label;
            header.appendChild(labelEl);
            row.appendChild(header);
        }

        const grid = document.createElement('div');
        grid.className = 'dev-card-grid';
        if (def.columns) {
            grid.style.gridTemplateColumns = `repeat(${def.columns}, 1fr)`;
        }

        row.appendChild(grid);
        parent.appendChild(row);

        const rebuildGrid = () => {
            grid.innerHTML = '';
            const items = def.items();

            if (items.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'dev-card-empty';
                empty.textContent = def.emptyText || 'No items available';
                grid.appendChild(empty);
                return;
            }

            items.forEach((item) => {
                const card = document.createElement('div');
                card.className = 'dev-grid-card';
                if (item.selected?.()) {
                    card.classList.add('is-selected');
                }

                if (item.draggable) {
                    card.draggable = true;
                    card.addEventListener('dragstart', (e) => {
                        card.classList.add('is-dragging');
                        if (e.dataTransfer) {
                            e.dataTransfer.setData('text/plain', item.id);
                            e.dataTransfer.effectAllowed = 'copy';
                        }
                        def.onDragStart?.(item.id);
                    });
                    card.addEventListener('dragend', () => {
                        card.classList.remove('is-dragging');
                        def.onDragEnd?.(item.id);
                    });
                }

                const thumbWrap = document.createElement('div');
                thumbWrap.className = 'dev-card-thumb-wrap';

                const img = document.createElement('img');
                img.className = 'dev-card-thumb';
                thumbWrap.appendChild(img);

                if (item.thumbnail) {
                    item.thumbnail().then((src) => {
                        img.src = src;
                    }).catch(() => {});
                }

                if (item.state) {
                    const pill = document.createElement('span');
                    pill.className = 'dev-card-state-pill';
                    pill.textContent = item.state();
                    if (item.active?.()) pill.classList.add('active');

                    if (def.onToggle) {
                        pill.addEventListener('click', (e) => {
                            e.stopPropagation();
                            def.onToggle?.(item.id);
                            refreshPanel();
                        });
                    }
                    thumbWrap.appendChild(pill);
                }

                card.appendChild(thumbWrap);

                const info = document.createElement('div');
                info.className = 'dev-card-info';

                const name = document.createElement('div');
                name.className = 'dev-card-name';
                name.textContent = item.name;
                info.appendChild(name);

                if (item.meta) {
                    const meta = document.createElement('div');
                    meta.className = 'dev-card-meta';
                    meta.textContent = item.meta;
                    info.appendChild(meta);
                }

                card.appendChild(info);

                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    def.onSelect?.(item.id);
                    refreshPanel();
                });

                grid.appendChild(card);
            });
        };

        rebuildGrid();
        trackRef(def, def.label || 'CardGrid');

        refreshFns.push(() => {
            if (def.visible) {
                row.classList.toggle('is-hidden', !def.visible());
            }
            const disabled = def.disabled ? def.disabled() : false;
            row.classList.toggle('is-disabled', disabled);
            rebuildGrid();
        });
    }

    function renderReadout(def: ReadoutDef, parent: HTMLElement) {
        const row = document.createElement('div');
        row.className = 'dev-readout-row';

        if (def.label) {
            const labelEl = document.createElement('span');
            labelEl.className = 'dev-row-label';
            labelEl.textContent = def.label;
            row.appendChild(labelEl);
        }

        const textEl = document.createElement('span');
        textEl.className = 'dev-readout-text';
        textEl.textContent = def.get();
        row.appendChild(textEl);

        parent.appendChild(row);
        trackRef(def, def.label || 'Readout', def.get);

        refreshFns.push(() => {
            if (def.visible) {
                row.classList.toggle('is-hidden', !def.visible());
            }
            textEl.textContent = def.get();
        });
    }

    function renderCustom(def: CustomDef, parent: HTMLElement) {
        const hostEl = document.createElement('div');
        hostEl.className = 'dev-control-row';
        parent.appendChild(hostEl);

        def.mount(hostEl);

        trackRef(def, def.label || 'Custom');

        refreshFns.push(() => {
            if (def.visible) {
                hostEl.classList.toggle('is-hidden', !def.visible());
            }
            if (def.refresh) {
                def.refresh(hostEl);
            }
        });

        destroyFns.push(() => {
            if (def.destroy) {
                def.destroy(hostEl);
            }
        });
    }

    for (const item of schema) {
        renderControl(item, root);
    }

    const handle: PanelHandle = {
        root,
        refresh: () => {
            for (const fn of refreshFns) {
                fn();
            }
        },
        destroy: () => {
            for (const fn of destroyFns) {
                fn();
            }
            for (const ref of panelRefs) {
                activeControlRefs.delete(ref);
            }
            panelRefs.clear();
            host.innerHTML = '';
        }
    };

    return handle;
}

/**
 * Expose window.__panelAudit() in development to audit all live panel control accessors.
 */
if (typeof window !== 'undefined') {
    (window as any).__panelAudit = function (): Array<{ label: string; error: string }> {
        const errors: Array<{ label: string; error: string }> = [];
        for (const ref of activeControlRefs) {
            try {
                if (ref.visibleFn) ref.visibleFn();
                if (ref.disabledFn) ref.disabledFn();
                if (ref.getFn) ref.getFn();
            } catch (err: any) {
                errors.push({
                    label: ref.label,
                    error: err?.message || String(err)
                });
            }
        }
        return errors;
    };
}
