let currentConfig = {};
let activeModalKey = null;
let pressTimer = null;
let isLongPress = false;

let activePage = 1;

function getTotalPages() {
    let maxP = 1;
    if (currentConfig) {
        Object.keys(currentConfig).forEach(k => {
            const match = k.match(/^p(\d+)-/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxP) maxP = num;
            }
        });
    }
    return Math.max(1, maxP);
}

function renderNavBarTabs() {
    const track = document.getElementById('nav-track');
    const viewport = document.querySelector('.nav-track-viewport');
    if (!track || !viewport) return;
    track.innerHTML = '';
    const totalPages = getTotalPages();
    const viewportWidth = viewport.clientWidth || 600;
    const gap = 16;
    const tabWidth = Math.floor((viewportWidth - (gap * 2)) / 3);

    for (let p = 1; p <= totalPages; p++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `nav-btn${p === activePage ? ' active' : ''}`;
        btn.id = `tab-p${p}`;
        btn.textContent = currentConfig[`p${p}-name`] || `Page ${p}`;
        btn.style.width = `${tabWidth}px`;
        btn.style.flex = `0 0 ${tabWidth}px`;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            switchPage(p);
        });
        track.appendChild(btn);
    }
}

function updateNavBar() {
    const totalPages = getTotalPages();
    renderNavBarTabs();

    const track = document.getElementById('nav-track');
    const viewport = document.querySelector('.nav-track-viewport');
    if (track && viewport) {
        const viewportWidth = viewport.clientWidth || 600;
        const gap = 16;
        const tabWidth = Math.floor((viewportWidth - (gap * 2)) / 3);
        // Center activePage in slot 2 of 3 (offset = (2 - activePage) * (tabWidth + gap))
        const offset = (2 - activePage) * (tabWidth + gap);
        track.style.transform = `translateX(${offset}px)`;
    }

    const prevBtn = document.getElementById('nav-prev');
    const nextBtn = document.getElementById('nav-next');
    if (prevBtn) prevBtn.disabled = (activePage <= 1);
    if (nextBtn) nextBtn.disabled = (activePage >= totalPages);
}

function prevPage() {
    const totalPages = getTotalPages();
    const target = activePage > 1 ? activePage - 1 : totalPages;
    switchPage(target);
}

function nextPage() {
    const totalPages = getTotalPages();
    const target = activePage < totalPages ? activePage + 1 : 1;
    switchPage(target);
}

// Frontend Page Management Core
function switchPage(pageNumber) {
    const totalPages = getTotalPages();
    activePage = Math.max(1, Math.min(totalPages, pageNumber));

    document.querySelectorAll('.page-container').forEach(el => el.classList.remove('active'));
    const targetPage = document.getElementById(`page-${activePage}`);
    if (targetPage) targetPage.classList.add('active');

    updateNavBar();
}

const timerStates = {};

function formatTime(d, fmt) {
    if (fmt === '24h-sec') return d.toTimeString().split(' ')[0];
    if (fmt === '12h') return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (fmt === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function formatDate(d, fmt) {
    if (fmt === 'iso') return d.toISOString().split('T')[0];
    if (fmt === 'uk') {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
    }
    if (fmt === 'us') {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${mm}/${dd}/${d.getFullYear()}`;
    }
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatSeconds(totalSecs) {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateWidgets() {
    if (!currentConfig) return;
    const now = new Date();
    const totalPages = getTotalPages();

    for (let p = 1; p <= totalPages; p++) {
        for (let b = 1; b <= 6; b++) {
            const key = `p${p}-b${b}`;
            const btn = document.querySelector(`#page-${p} .macro-btn:nth-child(${b})`);
            const item = currentConfig[key];
            if (!btn || !item) continue;

            if (item.type === 'clock') {
                btn.textContent = formatTime(now, item.format || '12h-sec');
            } else if (item.type === 'date') {
                btn.textContent = formatDate(now, item.format || 'standard');
            } else if (item.type === 'timer' || item.type === 'countdown' || item.type === 'stopwatch') {
                let state = timerStates[key];
                const isStopwatch = item.type === 'stopwatch' || item.timerMode === 'stopwatch';
                const targetDuration = item.duration !== undefined ? parseInt(item.duration, 10) : (item.timerDuration !== undefined ? parseInt(item.timerDuration, 10) : 300);
                const validDuration = isNaN(targetDuration) || targetDuration <= 0 ? 300 : targetDuration;

                if (!state) {
                    state = timerStates[key] = {
                        isStopwatch,
                        targetDuration: validDuration,
                        elapsed: 0,
                        running: false,
                        lastTick: Date.now()
                    };
                } else if (!state.running && state.elapsed === 0 && state.targetDuration !== validDuration) {
                    state.targetDuration = validDuration;
                    state.isStopwatch = isStopwatch;
                }

                if (state.running) {
                    const nowMs = Date.now();
                    const deltaSec = (nowMs - state.lastTick) / 1000;
                    state.lastTick = nowMs;
                    state.elapsed += deltaSec;

                    if (!state.isStopwatch && state.elapsed >= state.targetDuration) {
                        state.elapsed = state.targetDuration;
                        state.running = false;
                    }
                }

                if (state.isStopwatch) {
                    btn.classList.remove('timer-alert');
                    btn.innerHTML = `<span class="material-symbols-outlined">timer</span> ${formatSeconds(Math.floor(state.elapsed))}`;
                } else {
                    const remaining = Math.max(0, Math.ceil(state.targetDuration - state.elapsed));
                    if (remaining === 0) {
                        btn.classList.add('timer-alert');
                        btn.innerHTML = `<span class="material-symbols-outlined">notifications_active</span> 00:00`;
                    } else {
                        btn.classList.remove('timer-alert');
                        btn.innerHTML = `<span class="material-symbols-outlined">hourglass_top</span> ${formatSeconds(remaining)}`;
                    }
                }
            }
        }
    }
}

setInterval(updateWidgets, 250);

const lastTapTimestamps = {};
const tapDebounceTimers = {};

// Send backend hardware tap trigger 
function tapMacro(macroName) {
    if (isLongPress) {
        isLongPress = false;
        return;
    }
    const item = currentConfig ? currentConfig[macroName] : null;
    if (item) {
        if (item.type === 'clock' && item.value === 'type') {
            const now = new Date();
            const text = formatTime(now, item.format || '12h-sec');
            window.api.sendAction({ type: 'text', value: text });
            return;
        }
        if (item.type === 'date' && item.value === 'type') {
            const now = new Date();
            const text = formatDate(now, item.format || 'standard');
            window.api.sendAction({ type: 'text', value: text });
            return;
        }
        if (item.type === 'shortcut' && (item.value === 'Alt+Tab' || item.value === 'Alt+Escape' || item.value === 'alt+tab')) {
            const now = Date.now();
            const lastTap = lastTapTimestamps[macroName] || 0;
            lastTapTimestamps[macroName] = now;

            if (now - lastTap < 400 && lastTap > 0) {
                // Double tap: cancel single-tap and trigger Alt+Escape (cycle all windows)
                lastTapTimestamps[macroName] = 0;
                if (tapDebounceTimers[macroName]) {
                    clearTimeout(tapDebounceTimers[macroName]);
                    delete tapDebounceTimers[macroName];
                }
                window.api.sendAction({ type: 'shortcut', value: 'Alt+Escape' });
                return;
            }

            // Buffer single tap briefly to detect potential double tap
            if (tapDebounceTimers[macroName]) clearTimeout(tapDebounceTimers[macroName]);
            tapDebounceTimers[macroName] = setTimeout(() => {
                delete tapDebounceTimers[macroName];
                lastTapTimestamps[macroName] = 0;
                window.api.sendAction({ type: 'shortcut', value: 'Alt+Tab' });
            }, 280);
            return;
        }
        if (item.type === 'timer' || item.type === 'countdown' || item.type === 'stopwatch') {
            let state = timerStates[macroName];
            const isStopwatch = item.type === 'stopwatch' || item.timerMode === 'stopwatch';
            const targetDuration = item.duration !== undefined ? parseInt(item.duration, 10) : (item.timerDuration !== undefined ? parseInt(item.timerDuration, 10) : 300);
            const validDuration = isNaN(targetDuration) || targetDuration <= 0 ? 300 : targetDuration;

            if (!state) {
                state = timerStates[macroName] = {
                    isStopwatch,
                    targetDuration: validDuration,
                    elapsed: 0,
                    running: false,
                    lastTick: Date.now()
                };
            }

            const now = Date.now();
            const lastTap = lastTapTimestamps[macroName] || 0;

            if (now - lastTap < 350 && lastTap > 0) {
                // Double click: reset timer to initial value
                state.elapsed = 0;
                state.running = false;
                state.lastTick = now;
                lastTapTimestamps[macroName] = 0;
                updateWidgets();
                return;
            }

            lastTapTimestamps[macroName] = now;

            if (!state.isStopwatch && state.elapsed >= state.targetDuration) {
                state.elapsed = 0;
            }
            state.running = !state.running;
            state.lastTick = now;
            updateWidgets();
            return;
        }
    }
    window.api.sendAction(macroName);
}

function attachButtonListeners() {
    for (let p = 1; p <= 3; p++) {
        for (let b = 1; b <= 6; b++) {
            const key = `p${p}-b${b}`;
            const btn = document.querySelector(`#page-${p} .macro-btn:nth-child(${b})`);
            if (!btn) continue;

            btn.ondblclick = (e) => {
                const item = currentConfig ? currentConfig[key] : null;
                if (item && item.type === 'timer') {
                    e.preventDefault();
                    e.stopPropagation();
                    const state = timerStates[key];
                    if (state) {
                        state.elapsed = 0;
                        state.running = false;
                        state.lastTick = Date.now();
                        updateWidgets();
                    }
                }
            };

            btn.onpointerdown = (e) => {
                isLongPress = false;
                const item = currentConfig ? currentConfig[key] : null;
                if (item && item.type === 'timer') {
                    pressTimer = setTimeout(() => {
                        isLongPress = true;
                        openTimerModal(key);
                    }, 650);
                }
            };

            btn.onpointerup = (e) => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            btn.onpointercancel = btn.onpointerleave = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };
        }
    }
}

let selectedModalMode = 'stopwatch';
let modalCustomSecs = 60;

function updateModalUI() {
    const presetGrid = document.querySelector('.modal-preset-grid');
    if (presetGrid) {
        presetGrid.classList.toggle('hidden', selectedModalMode === 'custom');
    }

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === selectedModalMode);
    });

    const customContainer = document.getElementById('modal-custom-container');
    if (customContainer) {
        customContainer.classList.toggle('hidden', selectedModalMode !== 'custom');
    }

    const resetBtn = document.querySelector('.btn-reset');
    if (resetBtn) {
        resetBtn.classList.toggle('hidden', selectedModalMode === 'custom');
    }

    const display = document.getElementById('stepper-time-display');
    if (display) {
        display.textContent = formatSeconds(modalCustomSecs);
    }
}

function selectModalPreset(mode) {
    selectedModalMode = mode;
    updateModalUI();
}

function resetCustomSeconds() {
    modalCustomSecs = 0;
    updateModalUI();
}

function adjustCustomSeconds(delta) {
    modalCustomSecs = Math.max(0, Math.min(86400, Math.round((modalCustomSecs + delta) / 10) * 10));
    updateModalUI();
}

function openTimerModal(key) {
    activeModalKey = key;
    const item = currentConfig[key] || {};
    const titleEl = document.getElementById('modal-timer-title');
    if (titleEl) titleEl.textContent = `${item.label || 'Timer'} Settings`;

    selectedModalMode = item.timerMode || 'stopwatch';
    modalCustomSecs = Math.max(10, Math.round((item.timerDuration || 60) / 10) * 10);
    updateModalUI();

    const modal = document.getElementById('timer-modal');
    if (modal) modal.classList.add('visible');
}

function closeTimerModal() {
    const modal = document.getElementById('timer-modal');
    if (modal) modal.classList.remove('visible');
    activeModalKey = null;
}

function resetCurrentTimer() {
    if (!activeModalKey) return;
    const state = timerStates[activeModalKey];
    if (state) {
        state.elapsed = 0;
        state.running = false;
        state.lastTick = Date.now();
    }
    updateWidgets();
    closeTimerModal();
}

async function saveTimerModal() {
    if (!activeModalKey || !currentConfig[activeModalKey]) return;

    currentConfig[activeModalKey].timerMode = selectedModalMode;
    currentConfig[activeModalKey].timerDuration = modalCustomSecs;
    currentConfig[activeModalKey].value = selectedModalMode;

    const isStopwatch = selectedModalMode === 'stopwatch';
    const targetDuration = selectedModalMode === 'custom' ? modalCustomSecs : parseInt(selectedModalMode || 60, 10);

    timerStates[activeModalKey] = {
        isStopwatch,
        targetDuration: isNaN(targetDuration) ? 60 : targetDuration,
        elapsed: 0,
        running: false,
        lastTick: Date.now()
    };

    if (window.api && window.api.saveConfig) {
        await window.api.saveConfig(currentConfig);
    }

    updateWidgets();
    closeTimerModal();
}

function ensurePageDOM(p) {
    let pageEl = document.getElementById(`page-${p}`);
    if (!pageEl) {
        pageEl = document.createElement('div');
        pageEl.className = 'page-container';
        pageEl.id = `page-${p}`;
        for (let b = 1; b <= 6; b++) {
            const btn = document.createElement('button');
            btn.className = 'macro-btn c-gray';
            btn.setAttribute('onclick', `tapMacro('p${p}-b${b}')`);
            btn.textContent = `Button ${b}`;
            pageEl.appendChild(btn);
        }
        const modal = document.getElementById('timer-modal');
        document.body.insertBefore(pageEl, modal);
    }
    return pageEl;
}

function formatButtonLabelHTML(label) {
    if (!label) return '';
    return label.replace(/\[([a-z0-9_]+)\]/gi, '<span class="material-symbols-outlined">$1</span>');
}

function isImageFile(icon) {
    if (!icon || typeof icon !== 'string') return false;
    if (icon.startsWith('data:image/') || icon.startsWith('data:application/') || icon.startsWith('http://') || icon.startsWith('https://')) return true;
    return /\.(png|jpg|jpeg|svg|webp|bmp|gif|ico)$/i.test(icon);
}

function getCustomBackgroundCSS(item) {
    if (!item) return 'linear-gradient(135deg, #2980b9, #2573a7)';
    const type = item.customColorType || 'linear';
    const c1 = item.customColor1 || '#2980b9';
    const c2 = item.customColor2 || '#2573a7';
    const angle = item.customAngle !== undefined ? item.customAngle : 135;
    if (type === 'solid') return c1;
    if (type === 'radial') return `radial-gradient(circle, ${c1}, ${c2})`;
    return `linear-gradient(${angle}deg, ${c1}, ${c2})`;
}

function getDashedBorderSVG(width, color, radius, dash, gap) {
    const encodedColor = encodeURIComponent(color);
    const half = (width / 2).toFixed(1);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><rect x='${half}' y='${half}' width='calc(100% - ${width}px)' height='calc(100% - ${width}px)' rx='${radius}' ry='${radius}' fill='none' stroke='${encodedColor}' stroke-width='${width}' stroke-dasharray='${dash} ${gap}'/></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
}

function getCornerBracketsSVG(width, color, radiusPx, armLengthPct) {
    const encodedColor = encodeURIComponent(color);
    const arm = Math.max(15, Math.min(45, armLengthPct || 30));
    const rUnits = Math.min(arm - 2, Math.max(0, Math.round((radiusPx || 20) * 0.425)));
    const path = `M 0,${arm} L 0,${rUnits} A ${rUnits},${rUnits} 0 0,1 ${rUnits},0 L ${arm},0 M ${100 - arm},0 L ${100 - rUnits},0 A ${rUnits},${rUnits} 0 0,1 100,${rUnits} L 100,${arm} M 100,${100 - arm} L 100,${100 - rUnits} A ${rUnits},${rUnits} 0 0,1 ${100 - rUnits},100 L ${100 - arm},100 M ${arm},100 L ${rUnits},100 A ${rUnits},${rUnits} 0 0,1 0,${100 - rUnits} L 0,${100 - arm}`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none' width='100%' height='100%'><path d='${path}' fill='none' stroke='${encodedColor}' stroke-width='${width}' vector-effect='non-scaling-stroke'/></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
}

function getSlotBackgroundCSS(fillType, bg1, bg2) {
    if (fillType === 'solid') return bg1 || '#181a1f';
    if (fillType === 'radial') return `radial-gradient(circle, ${bg1 || '#181a1f'}, ${bg2 || '#0d0f12'})`;
    if (fillType === 'transparent') return 'transparent';
    return `linear-gradient(135deg, ${bg1 || '#181a1f'}, ${bg2 || '#0d0f12'})`;
}

function injectCustomThemesCSS(themes) {
    if (!Array.isArray(themes)) return;
    let styleEl = document.getElementById('matrix-custom-themes-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'matrix-custom-themes-style';
        document.head.appendChild(styleEl);
    }
    let css = '';
    themes.forEach(t => {
        const selector = `body[data-theme="${t.id}"]`;
        css += `${selector} { background-color: ${t.backgroundColor || '#000000'} !important; }\n`;
        if (t.palette) {
            Object.keys(t.palette).forEach(pKey => {
                const p = t.palette[pKey];
                const bgCss = getSlotBackgroundCSS(p.fillType || 'linear', p.bg1, p.bg2);
                const fontSizeCss = p.fontSize ? `font-size: ${p.fontSize}px !important;` : '';
                css += `${selector} .${pKey} { background: ${bgCss} !important; color: ${p.text || '#ffffff'} !important; ${fontSizeCss} }\n`;
            });
        }
    });
    styleEl.textContent = css;
}

function applyConfig(cfg) {
    currentConfig = cfg;
    if (cfg._customThemes) {
        injectCustomThemesCSS(cfg._customThemes);
    }
    document.body.setAttribute('data-theme', cfg._theme || 'default');
    const totalPages = getTotalPages();

    // Ensure DOM elements for all pages exist
    for (let p = 1; p <= totalPages; p++) {
        ensurePageDOM(p);
    }

    // Remove any excess page containers
    document.querySelectorAll('.page-container').forEach(el => {
        const match = el.id.match(/^page-(\d+)$/);
        if (match && parseInt(match[1], 10) > totalPages) {
            el.remove();
        }
    });

    // Update navigation bar tabs and arrows
    updateNavBar();

    // Apply button labels, icons, and color themes
    for (let p = 1; p <= totalPages; p++) {
        for (let b = 1; b <= 6; b++) {
            const key = `p${p}-b${b}`;
            const btn = document.querySelector(`#page-${p} .macro-btn:nth-child(${b})`);
            if (btn && currentConfig[key]) {
                const rawColor = item.color || '#4b5563';
                const isTransparent = rawColor === 'transparent' || rawColor === 'c-transparent';
                const isHex = (rawColor && rawColor.startsWith('#'));
                const isCustom = rawColor === 'custom' || isHex;
                btn.className = `macro-btn${isTransparent ? ' c-transparent' : (isCustom ? ' custom' : ' ' + rawColor)}`;
                if (isTransparent) {
                    btn.style.setProperty('--btn-custom-bg', 'transparent');
                    btn.style.setProperty('--btn-custom-color', item.customTextColor || '#ffffff');
                } else if (isHex) {
                    btn.style.setProperty('--btn-custom-bg', rawColor);
                    btn.style.setProperty('--btn-custom-color', item.customTextColor || '#ffffff');
                } else if (item.color === 'custom') {
                    btn.style.setProperty('--btn-custom-bg', getCustomBackgroundCSS(item));
                    btn.style.setProperty('--btn-custom-color', item.customTextColor || '#ffffff');
                } else {
                    btn.style.removeProperty('--btn-custom-bg');
                    if (item.customTextColor) {
                        btn.style.setProperty('--btn-custom-color', item.customTextColor);
                    } else {
                        btn.style.removeProperty('--btn-custom-color');
                    }
                }
                if (item.fontSize) {
                    btn.style.setProperty('--btn-font-size', `${item.fontSize}px`);
                } else {
                    btn.style.removeProperty('--btn-font-size');
                }

                // Border, Radius & Glow
                if (item.borderStyle && item.borderStyle !== 'none') {
                    const bWidth = parseInt(item.borderWidth || 2, 10);
                    const bColor = item.borderColor || '#ffffff';
                    const bRad = (item.borderRadius !== undefined && item.borderRadius !== 'default') ? parseInt(item.borderRadius, 10) : 20;

                    if (item.borderStyle === 'dashed') {
                        const dashGap = parseInt(item.borderDashGap !== undefined ? item.borderDashGap : 8, 10);
                        const dashLen = parseInt(item.borderDashLength !== undefined ? item.borderDashLength : 12, 10);
                        btn.style.setProperty('--btn-border', 'none');
                        btn.style.setProperty('--btn-overlay-svg', getDashedBorderSVG(bWidth, bColor, bRad, dashLen, dashGap));
                        btn.style.removeProperty('--btn-box-shadow');
                    } else if (item.borderStyle === 'brackets') {
                        const armPct = parseInt(item.borderBracketLength !== undefined ? item.borderBracketLength : 35, 10);
                        btn.style.setProperty('--btn-border', 'none');
                        btn.style.setProperty('--btn-overlay-svg', getCornerBracketsSVG(bWidth, bColor, bRad, armPct));
                        btn.style.removeProperty('--btn-box-shadow');
                    } else if (item.borderStyle === 'glow') {
                        btn.style.setProperty('--btn-border', `${bWidth}px solid ${bColor}`);
                        btn.style.setProperty('--btn-box-shadow', `0 0 20px ${bColor}, 0 4px 8px rgba(0,0,0,0.4)`);
                        btn.style.removeProperty('--btn-overlay-svg');
                    } else {
                        btn.style.setProperty('--btn-border', `${bWidth}px ${item.borderStyle} ${bColor}`);
                        btn.style.removeProperty('--btn-box-shadow');
                        btn.style.removeProperty('--btn-overlay-svg');
                    }
                } else {
                    btn.style.removeProperty('--btn-border');
                    btn.style.removeProperty('--btn-box-shadow');
                    btn.style.removeProperty('--btn-overlay-svg');
                }

                if (item.borderRadius !== undefined && item.borderRadius !== 'default') {
                    const rad = parseInt(item.borderRadius, 10);
                    btn.style.setProperty('--btn-border-radius', `${rad}px`);
                } else {
                    btn.style.removeProperty('--btn-border-radius');
                }
                const hasImage = item.icon && isImageFile(item.icon);
                if (hasImage) {
                    const fitClass = item.iconFit === 'cover' ? 'fit-cover' : 'fit-contain';
                    const iconSrc = (item.icon.startsWith('data:') || item.icon.startsWith('http://') || item.icon.startsWith('https://') || item.icon.startsWith('file://') || item.icon.startsWith('app-asset://'))
                        ? item.icon
                        : `app-asset://${item.icon.replace(/^assets\//, '')}`;
                    btn.innerHTML = `<img src="${iconSrc}" alt="${item.label || ''}" class="macro-icon ${fitClass}">`;
                } else if (item.type !== 'clock' && item.type !== 'date' && item.type !== 'timer') {
                    let content = '';
                    const matIcon = item.materialIcon || (item.icon && !isImageFile(item.icon) ? item.icon : '');
                    if (matIcon) {
                        content += `<span class="material-symbols-outlined">${matIcon}</span>`;
                    }
                    if (item.label) {
                        content += (content ? ' ' : '') + `<span class="macro-btn-label">${formatButtonLabelHTML(item.label)}</span>`;
                    }
                    btn.innerHTML = content || '';
                }

                if (item.type === 'timer' || item.type === 'countdown' || item.type === 'stopwatch') {
                    const isStopwatch = item.type === 'stopwatch' || item.timerMode === 'stopwatch';
                    const targetDuration = item.duration !== undefined ? parseInt(item.duration, 10) : (item.timerDuration !== undefined ? parseInt(item.timerDuration, 10) : 300);
                    const validDuration = isNaN(targetDuration) || targetDuration <= 0 ? 300 : targetDuration;

                    if (!timerStates[key] || !timerStates[key].running) {
                        timerStates[key] = {
                            isStopwatch,
                            targetDuration: validDuration,
                            elapsed: 0,
                            running: false,
                            lastTick: Date.now()
                        };
                    }
                }
            }
        }
    }
    attachButtonListeners();
    updateWidgets();

    if (cfg._screensaverTimeout !== undefined) {
        const secs = parseInt(cfg._screensaverTimeout, 10);
        screensaverIdleTimeout = (isNaN(secs) ? 300 : secs) * 1000;
        resetScreensaverTimer();
    }

    if (cfg._screensaverImage) {
        screensaverImage.src = cfg._screensaverImage;
    }

    if (cfg._screensaverAnim !== undefined) {
        screensaverAnimMode = cfg._screensaverAnim || 'bouncing_clock';
    }

    if (cfg._brightness !== undefined) {
        const b = Math.max(10, Math.min(100, parseInt(cfg._brightness, 10) || 100));
        document.body.style.filter = b === 100 ? 'none' : `brightness(${b}%)`;
    }

    if (cfg._bgColor !== undefined) {
        document.body.style.backgroundColor = cfg._bgColor || '#0f1115';
    }
}

async function init() {
    if (window.api && window.api.getConfig) {
        const cfg = await window.api.getConfig();
        if (cfg) applyConfig(cfg);
    }
    attachButtonListeners();
}

if (window.api && window.api.onConfigUpdated) {
    window.api.onConfigUpdated((cfg) => applyConfig(cfg));
}

window.addEventListener('resize', updateNavBar);
init();

// ========================================================
// SCREENSAVER LOGIC & BOUNCING PHYSICS (BURN-IN PROTECTION)
// ========================================================
let screensaverActive = false;
let screensaverIdleTimeout = 300000; // 5 minutes default
let screensaverAnimMode = 'bouncing_clock';
let screensaverTimer = null;
let screensaverAnimId = null;

// Bouncing HUD Widget State
let hudX = 50;
let hudY = 50;
let hudVx = 1.2;
let hudVy = 0.9;

// Bouncing Background Image State
const screensaverImage = new Image();
screensaverImage.src = 'icon.png';
let ballX = 100;
let ballY = 100;
let ballVx = 2.0;
let ballVy = 1.6;
const ballRadius = 100;

function resetScreensaverTimer() {
    if (screensaverActive) {
        wakeFromScreensaver();
    }
    if (screensaverTimer) clearTimeout(screensaverTimer);
    if (screensaverIdleTimeout > 0) {
        screensaverTimer = setTimeout(startScreensaver, screensaverIdleTimeout);
    }
}

function updateScreensaverTime() {
    const now = new Date();
    const timeEl = document.getElementById('screensaver-time');
    const dateEl = document.getElementById('screensaver-date');
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    }
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    }
}

function startScreensaver() {
    if (screensaverActive) return;
    const overlay = document.getElementById('screensaver-overlay');
    const widget = document.getElementById('screensaver-widget');
    const canvas = document.getElementById('screensaver-canvas');
    if (!overlay || !widget || !canvas) return;

    screensaverActive = true;
    overlay.classList.remove('hidden');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (screensaverAnimMode === 'screen_off') {
        widget.style.display = 'none';
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        return;
    } else {
        widget.style.display = '';
    }

    updateScreensaverTime();

    hudVx = (Math.random() > 0.5 ? 1 : -1) * (1.1 + Math.random() * 0.5);
    hudVy = (Math.random() > 0.5 ? 1 : -1) * (0.9 + Math.random() * 0.5);

    ballX = Math.random() * (window.innerWidth - 120) + 60;
    ballY = Math.random() * (window.innerHeight - 120) + 60;
    ballVx = (Math.random() > 0.5 ? 1 : -1) * (1.8 + Math.random() * 0.8);
    ballVy = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 0.8);

    hudX = Math.random() * Math.max(50, window.innerWidth - 350) + 20;
    hudY = Math.random() * Math.max(50, window.innerHeight - 200) + 20;

    runScreensaverLoop();
}

function wakeFromScreensaver() {
    if (!screensaverActive) return;
    screensaverActive = false;
    const overlay = document.getElementById('screensaver-overlay');
    const widget = document.getElementById('screensaver-widget');
    if (overlay) overlay.classList.add('hidden');
    if (widget) widget.style.display = '';
    if (screensaverAnimId) {
        cancelAnimationFrame(screensaverAnimId);
        screensaverAnimId = null;
    }
    if (screensaverTimer) clearTimeout(screensaverTimer);
    screensaverTimer = setTimeout(startScreensaver, screensaverIdleTimeout);
}

function runScreensaverLoop() {
    if (!screensaverActive) return;

    const widget = document.getElementById('screensaver-widget');
    const canvas = document.getElementById('screensaver-canvas');
    if (!widget || !canvas) return;

    const ctx = canvas.getContext('2d');
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // 1. Draw glowing fading trail on canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, screenW, screenH);

    ballX += ballVx;
    ballY += ballVy;

    if (ballX - ballRadius <= 0) {
        ballX = ballRadius;
        ballVx = Math.abs(ballVx);
    } else if (ballX + ballRadius >= screenW) {
        ballX = screenW - ballRadius;
        ballVx = -Math.abs(ballVx);
    }

    if (ballY - ballRadius <= 0) {
        ballY = ballRadius;
        ballVy = Math.abs(ballVy);
    } else if (ballY + ballRadius >= screenH) {
        ballY = screenH - ballRadius;
        ballVy = -Math.abs(ballVy);
    }

    // Draw glowing bouncing screensaver image
    ctx.save();
    ctx.shadowColor = 'rgba(52, 152, 219, 0.7)';
    ctx.shadowBlur = 24;
    if (screensaverImage.complete && screensaverImage.naturalWidth !== 0) {
        ctx.drawImage(screensaverImage, ballX - ballRadius, ballY - ballRadius, ballRadius * 2, ballRadius * 2);
    } else {
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();
    }
    ctx.restore();

    // 2. Update Bouncing HUD Clock & Date
    const widgetRect = widget.getBoundingClientRect();
    const wWidth = widgetRect.width || 280;
    const wHeight = widgetRect.height || 110;

    hudX += hudVx;
    hudY += hudVy;

    if (hudX <= 0) {
        hudX = 0;
        hudVx = Math.abs(hudVx);
    } else if (hudX + wWidth >= screenW) {
        hudX = screenW - wWidth;
        hudVx = -Math.abs(hudVx);
    }

    if (hudY <= 0) {
        hudY = 0;
        hudVy = Math.abs(hudVy);
    } else if (hudY + wHeight >= screenH) {
        hudY = screenH - wHeight;
        hudVy = -Math.abs(hudVy);
    }

    widget.style.left = '0px';
    widget.style.top = '0px';
    widget.style.transform = `translate(${hudX}px, ${hudY}px)`;

    screensaverAnimId = requestAnimationFrame(runScreensaverLoop);
}

setInterval(() => {
    if (screensaverActive) updateScreensaverTime();
}, 1000);

['pointerdown', 'touchstart', 'mousemove', 'keydown', 'click'].forEach(evt => {
    window.addEventListener(evt, resetScreensaverTimer, { passive: true });
});
resetScreensaverTimer();
