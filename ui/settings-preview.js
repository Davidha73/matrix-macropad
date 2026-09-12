// ========================================================
// SETTINGS: INTERACTIVE LIVE PREVIEW & CANVAS RENDERER
// ========================================================

const PREVIEW_SCALE = 0.38;

function formatTime(d, fmt) {
    const hours24 = d.getHours();
    const hours12 = hours24 % 12 || 12;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    const h24Str = String(hours24).padStart(2, '0');

    if (fmt === '12h-sec') return `${hours12}:${mins}:${secs} ${ampm}`;
    if (fmt === '12h') return `${hours12}:${mins} ${ampm}`;
    if (fmt === '24h-sec') return `${h24Str}:${mins}:${secs}`;
    if (fmt === '24h') return `${h24Str}:${mins}`;
    if (fmt === 'utc') {
        const uh = String(d.getUTCHours()).padStart(2, '0');
        const um = String(d.getUTCMinutes()).padStart(2, '0');
        const us = String(d.getUTCSeconds()).padStart(2, '0');
        return `${uh}:${um}:${us} UTC`;
    }
    return `${hours12}:${mins}:${secs} ${ampm}`;
}

function formatDate(d, fmt) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = days[d.getDay()];
    const fullDayName = fullDays[d.getDay()];
    const monthName = months[d.getMonth()];
    const fullMonthName = fullMonths[d.getMonth()];
    const dateNum = d.getDate();
    const dd = String(dateNum).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();

    if (fmt === 'iso') return `${yyyy}-${mm}-${dd}`;
    if (fmt === 'full') return `${fullDayName}, ${dateNum} ${fullMonthName} ${yyyy}`;
    if (fmt === 'uk') return `${dd}/${mm}/${yyyy}`;
    if (fmt === 'us') return `${mm}/${dd}/${yyyy}`;
    if (fmt === 'short') return `${monthName} ${dateNum}`;
    if (fmt === 'day-only') return fullDayName;
    return `${dayName}, ${monthName} ${dateNum}`;
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

function getWidgetDisplay(cfg) {
    const now = new Date();
    if (cfg.type === 'clock') {
        return formatTime(now, cfg.format || '12h-sec');
    }
    if (cfg.type === 'date') {
        return formatDate(now, cfg.format || 'standard');
    }
    if (cfg.type === 'stopwatch') {
        return `<span class="material-symbols-outlined">timer</span> 00:00`;
    }
    if (cfg.type === 'timer' || cfg.type === 'countdown') {
        const secs = parseInt(cfg.duration || cfg.timerDuration || 300, 10);
        return `<span class="material-symbols-outlined">hourglass_top</span> ${formatSeconds(isNaN(secs) ? 300 : secs)}`;
    }
    return cfg.label || '';
}

function formatButtonLabelHTML(label) {
    if (!label) return '';
    return label.replace(/\[([a-z0-9_]+)\]/gi, '<span class="material-symbols-outlined">$1</span>');
}

function getCustomBackgroundCSS(cfg) {
    if (!cfg) return 'linear-gradient(180deg, #2980b9, #2573a7)';
    const type = cfg.customColorType || 'linear';
    const c1 = cfg.customColor1 || '#2980b9';
    const c2 = cfg.customColor2 || '#2573a7';
    const angle = (cfg.customAngle == 90 || cfg.customGradientDir === 'horizontal') ? 90 : 180;
    if (type === 'solid') return c1;
    return `linear-gradient(${angle}deg, ${c1}, ${c2})`;
}

function getDashedBorderSVG(width, color, radiusPx, dash, gap) {
    const rUnits = Math.min(48, Math.max(0, Math.round((radiusPx || 6) * 1.1)));
    const strokeW = Math.max(1, width);
    const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%"><rect x="0" y="0" width="100" height="100" rx="${rUnits}" ry="${rUnits}" fill="none" stroke="${color}" stroke-width="${strokeW * 2}" stroke-dasharray="${dash} ${gap}" vector-effect="non-scaling-stroke"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(rawSvg)}")`;
}

function getDottedBorderSVG(width, color, radiusPx, dotGap) {
    const rUnits = Math.min(48, Math.max(0, Math.round((radiusPx || 6) * 1.1)));
    const strokeW = Math.max(1, width);
    const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%"><rect x="0" y="0" width="100" height="100" rx="${rUnits}" ry="${rUnits}" fill="none" stroke="${color}" stroke-width="${strokeW * 2}" stroke-linecap="round" stroke-dasharray="0.1 ${dotGap}" vector-effect="non-scaling-stroke"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(rawSvg)}")`;
}

function getCornerBracketsSVG(width, color, radiusPx, armLengthPct) {
    const arm = Math.max(15, Math.min(45, armLengthPct || 30));
    const rUnits = Math.min(arm - 2, Math.max(0, Math.round((radiusPx || 20) * 0.425)));
    const strokeW = Math.max(1, width);
    const path = `M 0,${arm} L 0,${rUnits} A ${rUnits},${rUnits} 0 0,1 ${rUnits},0 L ${arm},0 M ${100 - arm},0 L ${100 - rUnits},0 A ${rUnits},${rUnits} 0 0,1 100,${rUnits} L 100,${arm} M 100,${100 - arm} L 100,${100 - rUnits} A ${rUnits},${rUnits} 0 0,1 ${100 - rUnits},100 L ${100 - arm},100 M ${arm},100 L ${rUnits},100 A ${rUnits},${rUnits} 0 0,1 0,${100 - rUnits} L 0,${100 - arm}`;
    const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%"><path d="${path}" fill="none" stroke="${color}" stroke-width="${strokeW}" vector-effect="non-scaling-stroke"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(rawSvg)}")`;
}

function getDoubleBorderSVG(width, color, radiusPx) {
    const strokeW = Math.max(1, width);
    const rUnits = Math.min(48, Math.max(0, Math.round((radiusPx || 6) * 1.1)));
    const gapPct = 3.5;
    const rInner = Math.max(0, rUnits - Math.round(gapPct * 0.8));
    const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
        <rect x="0" y="0" width="100" height="100" rx="${rUnits}" ry="${rUnits}" fill="none" stroke="${color}" stroke-width="${strokeW}" vector-effect="non-scaling-stroke"/>
        <rect x="${gapPct}" y="${gapPct}" width="${100 - gapPct * 2}" height="${100 - gapPct * 2}" rx="${rInner}" ry="${rInner}" fill="none" stroke="${color}" stroke-width="${strokeW}" vector-effect="non-scaling-stroke"/>
    </svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(rawSvg)}")`;
}

function getPreviewCornerRadius(radiusVal) {
    const rad = parseInt(radiusVal, 10);
    if (radiusVal === 0 || radiusVal === '0' || rad === 0) return '0px';
    if (!rad || isNaN(rad)) return '9.9% / 12.9%'; // Classic (24px Default)
    if (rad <= 8) return '3.3% / 4.3%';            // Subtle (8px)
    if (rad <= 16) return '6.6% / 8.6%';           // Rounded (16px)
    if (rad <= 24) return '9.9% / 12.9%';          // Classic (24px)
    if (rad <= 36) return '14.8% / 19.3%';         // Curved (36px)
    if (rad <= 48) return '19.8% / 25.8%';         // Large (48px)
    if (rad <= 64) return '26.4% / 34.4%';         // Extra Large (64px)
    if (rad <= 80) return '33.0% / 43.0%';         // Pill (80px)
    return '999px';                                // Full Oval (120px)
}

function getPreviewFontSize(fontSize) {
    const size = parseInt(fontSize, 10);
    if (!size || isNaN(size)) return 16; // Normal (Default / 68px)
    if (size <= 28) return 11;           // Extra Small (28px)
    if (size <= 36) return 12;           // Small (36px)
    if (size <= 44) return 13;           // Medium-Small (44px)
    if (size <= 52) return 14;           // Medium (52px)
    if (size <= 60) return 15;           // Standard (60px)
    if (size <= 68) return 16;           // Normal (68px)
    if (size <= 76) return 18;           // Large (76px)
    if (size <= 84) return 20;           // Extra Large (84px)
    if (size <= 96) return 23;           // Huge (96px)
    return 26;                           // Max (112px)
}

function applyPreviewButtonStyles(btn, cfg, activeTheme) {
    const rawColor = cfg.color || 'c-gray';
    const isHex = (typeof rawColor === 'string' && rawColor.startsWith('#'));
    const isTransparent = (rawColor === 'transparent' || rawColor === 'c-transparent');

    if (isTransparent) {
        btn.style.setProperty('--preview-custom-bg', 'transparent');
        btn.style.setProperty('--preview-custom-color', cfg.customTextColor || '#ffffff');
        btn.style.setProperty('--preview-btn-box-shadow', 'none');
    } else if (isHex) {
        btn.style.setProperty('--preview-custom-bg', rawColor);
        btn.style.setProperty('--preview-custom-color', cfg.customTextColor || '#ffffff');
        btn.style.removeProperty('--preview-btn-box-shadow');
    } else if (rawColor === 'custom' || cfg.customColorType) {
        btn.style.setProperty('--preview-custom-bg', getCustomBackgroundCSS(cfg));
        btn.style.setProperty('--preview-custom-color', cfg.customTextColor || '#ffffff');
        btn.style.removeProperty('--preview-btn-box-shadow');
    } else {
        btn.style.removeProperty('--preview-custom-bg');
        btn.style.removeProperty('--preview-btn-box-shadow');
        if (cfg.customTextColor) {
            btn.style.setProperty('--preview-custom-color', cfg.customTextColor);
        } else {
            btn.style.removeProperty('--preview-custom-color');
        }
    }

    if (cfg.customIconColor && cfg.customIconColor !== 'same_as_text' && cfg.customIconColor.startsWith('#')) {
        btn.style.setProperty('--preview-btn-icon-color', cfg.customIconColor);
    } else {
        btn.style.removeProperty('--preview-btn-icon-color');
    }

    // Border, Radius & Glow Preview with unified PREVIEW_SCALE
    if (cfg.borderStyle && cfg.borderStyle !== 'none') {
        const bWidth = parseInt(cfg.borderWidth || 2, 10);
        const previewWidth = Math.max(1, Math.round(bWidth * PREVIEW_SCALE));
        const bColor = cfg.borderColor || '#ffffff';
        const radPx = (cfg.borderRadius !== undefined && cfg.borderRadius !== 'default') ? parseInt(cfg.borderRadius, 10) : 24;
        const previewRad = radPx >= 120 ? 32 : (radPx >= 80 ? 26 : Math.round(radPx * PREVIEW_SCALE));

        if (cfg.borderStyle === 'dashed') {
            const dashGap = parseInt(cfg.borderDashGap !== undefined ? cfg.borderDashGap : 8, 10);
            const dashLen = parseInt(cfg.borderDashLength !== undefined ? cfg.borderDashLength : 12, 10);
            const prevDashGap = Math.max(2, Math.round(dashGap * PREVIEW_SCALE));
            const prevDashLen = Math.max(3, Math.round(dashLen * PREVIEW_SCALE));
            btn.style.setProperty('--preview-btn-border', 'none');
            btn.style.setProperty('--preview-btn-overlay-svg', getDashedBorderSVG(previewWidth, bColor, previewRad, prevDashLen, prevDashGap));
            btn.style.removeProperty('--preview-btn-box-shadow');
            btn.style.removeProperty('--preview-btn-inner-border');
            btn.style.removeProperty('--preview-btn-inner-border-inset');
        } else if (cfg.borderStyle === 'dotted') {
            const dotGap = parseInt(cfg.borderDashGap !== undefined ? cfg.borderDashGap : 8, 10);
            const prevDotGap = Math.max(3, Math.round(dotGap * PREVIEW_SCALE));
            btn.style.setProperty('--preview-btn-border', 'none');
            btn.style.setProperty('--preview-btn-overlay-svg', getDottedBorderSVG(previewWidth, bColor, previewRad, prevDotGap));
            btn.style.removeProperty('--preview-btn-box-shadow');
            btn.style.removeProperty('--preview-btn-inner-border');
            btn.style.removeProperty('--preview-btn-inner-border-inset');
        } else if (cfg.borderStyle === 'double') {
            const gap = Math.max(2, Math.round(previewWidth + 2));
            btn.style.setProperty('--preview-btn-border', `${previewWidth}px solid ${bColor}`);
            btn.style.setProperty('--preview-btn-inner-border-inset', `${gap}px`);
            btn.style.setProperty('--preview-btn-inner-border', `${previewWidth}px solid ${bColor}`);
            btn.style.removeProperty('--preview-btn-overlay-svg');
            btn.style.removeProperty('--preview-btn-box-shadow');
        } else if (cfg.borderStyle === 'brackets') {
            const armPct = parseInt(cfg.borderBracketLength !== undefined ? cfg.borderBracketLength : 35, 10);
            btn.style.setProperty('--preview-btn-border', 'none');
            btn.style.setProperty('--preview-btn-overlay-svg', getCornerBracketsSVG(previewWidth, bColor, radPx, armPct));
            btn.style.removeProperty('--preview-btn-box-shadow');
            btn.style.removeProperty('--preview-btn-inner-border');
            btn.style.removeProperty('--preview-btn-inner-border-inset');
        } else if (cfg.borderStyle === 'glow') {
            btn.style.setProperty('--preview-btn-border', `${previewWidth}px solid ${bColor}`);
            btn.style.setProperty('--preview-btn-box-shadow', `0 0 10px ${bColor}, 0 2px 4px rgba(0,0,0,0.4)`);
            btn.style.removeProperty('--preview-btn-overlay-svg');
            btn.style.removeProperty('--preview-btn-inner-border');
            btn.style.removeProperty('--preview-btn-inner-border-inset');
        } else {
            btn.style.setProperty('--preview-btn-border', `${previewWidth}px ${cfg.borderStyle} ${bColor}`);
            btn.style.removeProperty('--preview-btn-box-shadow');
            btn.style.removeProperty('--preview-btn-overlay-svg');
            btn.style.removeProperty('--preview-btn-inner-border');
            btn.style.removeProperty('--preview-btn-inner-border-inset');
        }
    } else {
        btn.style.removeProperty('--preview-btn-border');
        btn.style.removeProperty('--preview-btn-box-shadow');
        btn.style.removeProperty('--preview-btn-overlay-svg');
        btn.style.removeProperty('--preview-btn-inner-border');
        btn.style.removeProperty('--preview-btn-inner-border-inset');
    }

    const radVal = (cfg.borderRadius !== undefined && cfg.borderRadius !== 'default') ? parseInt(cfg.borderRadius, 10) : 24;
    const previewRad = getPreviewCornerRadius(radVal);
    btn.style.setProperty('--preview-btn-border-radius', previewRad);

    const previewSize = getPreviewFontSize(cfg.fontSize);
    btn.style.setProperty('--preview-btn-font-size', `${previewSize}px`);
    btn.style.setProperty('font-size', `${previewSize}px`, 'important');
}

function renderPreviewButtonContent(btn, cfg, defaultIndex) {
    const hasImage = cfg.icon && isImageFile(cfg.icon);
    if (hasImage) {
        const fitClass = cfg.iconFit === 'cover' ? 'fit-cover' : 'fit-contain';
        const iconSrc = (cfg.icon.startsWith('data:') || cfg.icon.startsWith('http://') || cfg.icon.startsWith('https://') || cfg.icon.startsWith('file://') || cfg.icon.startsWith('app-asset://'))
            ? cfg.icon
            : `app-asset://${cfg.icon.replace(/^assets\//, '')}`;
        let content = `<img src="${iconSrc}" class="preview-icon ${fitClass}" draggable="false">`;
        if (cfg.label !== undefined && cfg.label !== null && cfg.label !== '') {
            content += `<span class="preview-btn-label">${formatButtonLabelHTML(cfg.label)}</span>`;
        }
        btn.innerHTML = content;
    } else if (cfg.type === 'clock' || cfg.type === 'date' || cfg.type === 'timer') {
        btn.innerHTML = getWidgetDisplay(cfg);
    } else {
        let content = '';
        const matIcon = cfg.materialIcon || (cfg.icon && !isImageFile(cfg.icon) ? cfg.icon : '');
        if (matIcon) {
            content += `<span class="material-symbols-outlined">${matIcon}</span>`;
        }
        if (cfg.label !== undefined && cfg.label !== null) {
            if (cfg.label !== '') {
                content += (content ? ' ' : '') + `<span class="preview-btn-label">${formatButtonLabelHTML(cfg.label)}</span>`;
            }
        } else if (!matIcon) {
            content = `<span class="preview-btn-label">Button ${defaultIndex}</span>`;
        }
        btn.innerHTML = content;
    }
}

function getContrastBorderColor(bgHex) {
    if (!bgHex || typeof bgHex !== 'string') {
        return {
            border: 'rgba(255, 255, 255, 0.22)',
            text: 'rgba(255, 255, 255, 0.85)',
            hoverBorder: 'rgba(255, 255, 255, 0.55)',
            activeBorder: '#38bdf8',
            activeText: '#ffffff',
            titleColor: 'rgba(255, 255, 255, 0.6)'
        };
    }
    const cleanHex = bgHex.trim();
    if (!cleanHex.startsWith('#') || cleanHex.length < 7) {
        return {
            border: 'rgba(255, 255, 255, 0.22)',
            text: 'rgba(255, 255, 255, 0.85)',
            hoverBorder: 'rgba(255, 255, 255, 0.55)',
            activeBorder: '#38bdf8',
            activeText: '#ffffff',
            titleColor: 'rgba(255, 255, 255, 0.6)'
        };
    }
    const r = parseInt(cleanHex.slice(1, 3), 16) || 0;
    const g = parseInt(cleanHex.slice(3, 5), 16) || 0;
    const b = parseInt(cleanHex.slice(5, 7), 16) || 0;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luminance > 0.55) {
        return {
            border: 'rgba(0, 0, 0, 0.28)',
            text: 'rgba(0, 0, 0, 0.85)',
            hoverBorder: 'rgba(0, 0, 0, 0.65)',
            activeBorder: '#0284c7',
            activeText: '#0f172a',
            titleColor: 'rgba(0, 0, 0, 0.65)'
        };
    } else {
        return {
            border: 'rgba(255, 255, 255, 0.22)',
            text: 'rgba(255, 255, 255, 0.85)',
            hoverBorder: 'rgba(255, 255, 255, 0.55)',
            activeBorder: '#38bdf8',
            activeText: '#ffffff',
            titleColor: 'rgba(255, 255, 255, 0.6)'
        };
    }
}

let isDraggingInProgress = false;

function setupButtonDragAndDrop(btn, key, index, isSub) {
    btn.setAttribute('draggable', 'true');

    btn.addEventListener('dragstart', (e) => {
        isDraggingInProgress = true;

        window.activeDraggedButton = {
            key: key,
            index: index,
            isSub: !!isSub,
            parent: activeSubPageParent,
            page: activePage,
            element: btn
        };

        e.dataTransfer.effectAllowed = 'copyMove';
        e.dataTransfer.setData('text/plain', key);

        btn.classList.add('is-dragging');
    });

    btn.addEventListener('dragend', () => {
        window.activeDraggedButton = null;
        setTimeout(() => {
            isDraggingInProgress = false;
        }, 120);

        const ghost = document.getElementById('drag-ghost-keeper');
        if (ghost) ghost.innerHTML = '';

        document.querySelectorAll('.preview-btn').forEach(b => {
            b.classList.remove('is-dragging', 'drag-over', 'drag-copy');
        });
        document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('tab-drag-over'));
        document.querySelectorAll('.preview-arrow-btn').forEach(a => a.classList.remove('arrow-drag-over'));
    });

    btn.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.activeDraggedButton || window.activeDraggedButton.key === key) return;

        const isCopy = e.altKey || e.ctrlKey;
        e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';

        if (isCopy) {
            btn.classList.remove('drag-over');
            btn.classList.add('drag-copy');
        } else {
            btn.classList.remove('drag-copy');
            btn.classList.add('drag-over');
        }
    });

    btn.addEventListener('dragleave', (e) => {
        if (!btn.contains(e.relatedTarget)) {
            btn.classList.remove('drag-over', 'drag-copy');
        }
    });

    btn.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove('drag-over', 'drag-copy');

        if (!window.activeDraggedButton || window.activeDraggedButton.key === key) return;

        const src = window.activeDraggedButton;
        const targetKey = key;
        const isCopy = e.altKey || e.ctrlKey;

        const srcConfig = JSON.parse(JSON.stringify(getButtonConfigByKey(src.key) || { label: `Button ${src.index}` }));
        const targetConfig = JSON.parse(JSON.stringify(getButtonConfigByKey(targetKey) || { label: `Button ${index}` }));

        if (isCopy) {
            setButtonConfigByKey(targetKey, srcConfig);
        } else {
            setButtonConfigByKey(src.key, targetConfig);
            setButtonConfigByKey(targetKey, srcConfig);
        }

        if (isSub) {
            selectSubButton(index, true);
        } else {
            selectButton(index, true);
        }

        renderPreview();
        renderFormFields();
        markUnsaved();
    });
}

function renderPreview() {
    const grid = document.getElementById('preview-grid');
    if (!grid) return;

    let ghostKeeper = document.getElementById('drag-ghost-keeper');
    if (!ghostKeeper) {
        ghostKeeper = document.createElement('div');
        ghostKeeper.id = 'drag-ghost-keeper';
        ghostKeeper.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0.001;pointer-events:none;overflow:hidden;';
        document.body.appendChild(ghostKeeper);
    }
    if (window.activeDraggedButton && window.activeDraggedButton.element && grid.contains(window.activeDraggedButton.element)) {
        ghostKeeper.appendChild(window.activeDraggedButton.element);
    }

    grid.innerHTML = '';
    grid.ondragover = (e) => e.preventDefault();

    const previewPanel = document.querySelector('.preview-panel');
    if (previewPanel) {
        const bg = currentConfig._bgColor || '#0f1115';
        previewPanel.style.backgroundColor = bg;
        const contrast = getContrastBorderColor(bg);
        previewPanel.style.setProperty('--nav-border-color', contrast.border);
        previewPanel.style.setProperty('--nav-text-color', contrast.text);
        previewPanel.style.setProperty('--nav-hover-border-color', contrast.hoverBorder);
        previewPanel.style.setProperty('--nav-active-border-color', contrast.activeBorder);
        previewPanel.style.setProperty('--nav-active-text-color', contrast.activeText);
        const titleH3 = previewPanel.querySelector('h3');
        if (titleH3) titleH3.style.color = contrast.titleColor;
    }

    const activeTheme = (currentConfig && currentConfig._theme) ? currentConfig._theme : 'default';

    if (activeSubPageParent) {
        // Render 6 sub-buttons of activeSubPageParent
        for (let i = 1; i <= 6; i++) {
            const subKey = `${activeSubPageParent}-sub${i}`;
            const subCfg = getButtonConfigByKey(subKey) || { label: `Button ${i}`, color: '#4b5563' };
            const rawColor = subCfg.color || 'c-gray';
            const isHex = (typeof rawColor === 'string' && rawColor.startsWith('#'));
            const isCustom = (rawColor === 'custom' || isHex || subCfg.customColorType || rawColor === 'transparent' || rawColor === 'c-transparent');
            const btn = document.createElement('div');
            btn.setAttribute('role', 'button');
            btn.setAttribute('tabindex', '0');
            btn.className = `preview-btn${isCustom ? ' custom' : ' ' + rawColor}${i === selectedSubButtonIndex ? ' selected' : ''}`;
            btn.id = `preview-btn-${subKey}`;
            btn.onclick = () => {
                if (isDraggingInProgress) return;
                if (subCfg.type === 'toggle') {
                    if (typeof window.toggleButtonPreviewState === 'function') {
                        window.toggleButtonPreviewState(subKey);
                    }
                }
                selectSubButton(i);
            };
            btn.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    btn.click();
                }
            };

            applyPreviewButtonStyles(btn, subCfg, activeTheme);
            renderPreviewButtonContent(btn, subCfg, i);
            setupButtonDragAndDrop(btn, subKey, i, true);

            if (subCfg.type === 'toggle') {
                const tBadge = document.createElement('span');
                const curState = (subCfg.toggleState === 1) ? 1 : 0;
                tBadge.className = `preview-toggle-badge ${curState === 1 ? 'state-on' : 'state-off'}`;
                tBadge.title = `Toggle: ${curState === 1 ? 'State B (Active)' : 'State A (Default)'} - Click to flip`;
                tBadge.setAttribute('draggable', 'false');
                tBadge.innerHTML = `<span class="material-symbols-outlined toggle-badge-icon">${curState === 1 ? 'toggle_on' : 'toggle_off'}</span>`;
                tBadge.onclick = (e) => {
                    e.stopPropagation();
                    if (typeof window.toggleButtonPreviewState === 'function') {
                        window.toggleButtonPreviewState(subKey);
                    }
                };
                tBadge.ondragstart = (e) => { e.preventDefault(); e.stopPropagation(); };
                btn.appendChild(tBadge);
            }

            grid.appendChild(btn);
        }
        return;
    }

    // Normal Root Page 6 buttons
    for (let i = 1; i <= 6; i++) {
        const key = `p${activePage}-b${i}`;
        const cfg = currentConfig[key] || { label: `Button ${i}`, color: '#4b5563' };
        const rawColor = cfg.color || 'c-gray';
        const isHex = (typeof rawColor === 'string' && rawColor.startsWith('#'));
        const isCustom = (rawColor === 'custom' || isHex || cfg.customColorType || rawColor === 'transparent' || rawColor === 'c-transparent');
        const btn = document.createElement('div');
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.className = `preview-btn${isCustom ? ' custom' : ' ' + rawColor}${i === selectedButtonIndex ? ' selected' : ''}`;
        btn.id = `preview-btn-${key}`;
        btn.onclick = () => {
            if (isDraggingInProgress) return;
            if (cfg.type === 'toggle') {
                if (typeof window.toggleButtonPreviewState === 'function') {
                    window.toggleButtonPreviewState(key);
                }
            }
            selectButton(i);
        };
        btn.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        };

        applyPreviewButtonStyles(btn, cfg, activeTheme);
        renderPreviewButtonContent(btn, cfg, i);
        setupButtonDragAndDrop(btn, key, i, false);

        const isSubPage = (cfg.type === 'subpage' || cfg.type === 'folder');
        if (isSubPage) {
            const badge = document.createElement('span');
            badge.className = 'preview-folder-badge';
            badge.title = `Edit Sub-Page (Click to open 6 buttons)`;
            badge.setAttribute('draggable', 'false');
            badge.innerHTML = `<span class="material-symbols-outlined folder-icon-mini">folder_open</span>`;
            badge.onclick = (e) => {
                e.stopPropagation();
                selectButton(i);
                enterSubPage(key);
            };
            badge.ondragstart = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };
            btn.appendChild(badge);
        }

        if (cfg.type === 'toggle') {
            const tBadge = document.createElement('span');
            const curState = (cfg.toggleState === 1) ? 1 : 0;
            tBadge.className = `preview-toggle-badge ${curState === 1 ? 'state-on' : 'state-off'}`;
            tBadge.title = `Toggle: ${curState === 1 ? 'State B (Active)' : 'State A (Default)'} - Click to flip`;
            tBadge.setAttribute('draggable', 'false');
            tBadge.innerHTML = `<span class="material-symbols-outlined toggle-badge-icon">${curState === 1 ? 'toggle_on' : 'toggle_off'}</span>`;
            tBadge.onclick = (e) => {
                e.stopPropagation();
                if (typeof window.toggleButtonPreviewState === 'function') {
                    window.toggleButtonPreviewState(key);
                }
            };
            tBadge.ondragstart = (e) => { e.preventDefault(); e.stopPropagation(); };
            btn.appendChild(tBadge);
        }

        grid.appendChild(btn);
    }
}

// Live preview clock & timer ticker (1-second tick)
setInterval(() => {
    const grid = document.getElementById('preview-grid');
    if (!grid || typeof currentConfig === 'undefined' || !currentConfig) return;
    for (let i = 1; i <= 6; i++) {
        const key = `p${activePreviewPage}-b${i}`;
        const cfg = (typeof subPageStack !== 'undefined' && subPageStack.length > 0)
            ? (currentConfig[subPageStack[subPageStack.length - 1]]?.sub_buttons?.[i - 1])
            : currentConfig[key];
        if (cfg && (cfg.type === 'clock' || cfg.type === 'date' || cfg.type === 'timer')) {
            const btn = document.getElementById(`preview-btn-${i}`);
            if (btn && typeof renderPreviewButtonContent === 'function') {
                renderPreviewButtonContent(btn, cfg, i);
            }
        }
    }
}, 1000);
