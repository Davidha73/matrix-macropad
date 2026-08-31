/* ========================================================
   Matrix Macropad — Theme Builder & Library Logic
   ======================================================== */

const BUILTIN_THEMES = [
    { id: 'default', name: 'Default Matrix Dark', isBuiltin: true, bg: '#1e222b', swatches: ['#2980b9', '#c0392b', '#27ae60', '#8e44ad', '#f39c12', '#4b5563', '#181a1f', '#ffffff'] },
    { id: 'simple', name: 'Simple (Black & White)', isBuiltin: true, bg: '#000000', swatches: ['#000000', '#ffffff', '#000000', '#ffffff'] },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', isBuiltin: true, bg: '#08050e', swatches: ['#00f0ff', '#ff007f', '#05ffa1', '#ffe600'] },
    { id: 'synthwave', name: 'Retro Synthwave', isBuiltin: true, bg: '#12031e', swatches: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff'] },
    { id: 'matrix', name: 'Emerald Matrix', isBuiltin: true, bg: '#000000', swatches: ['#00ff41', '#003b00', '#008f11', '#00ff41'] },
    { id: 'midnight', name: 'Midnight Glass', isBuiltin: true, bg: '#0b0f19', swatches: ['#38bdf8', '#818cf8', '#34d399', '#f472b6'] },
    { id: 'monochrome', name: 'Minimalist Monochrome', isBuiltin: true, bg: '#121212', swatches: ['#ffffff', '#888888', '#333333', '#ff4444'] }
];

const DEFAULT_PALETTE_SLOTS = [
    { key: 'c-edit', label: 'Blue / Edit', fillType: 'linear', bg1: '#2980b9', bg2: '#2573a7', text: '#ffffff', fontSize: 16 },
    { key: 'c-danger', label: 'Red / Danger', fillType: 'linear', bg1: '#c0392b', bg2: '#a62c1f', text: '#ffffff', fontSize: 16 },
    { key: 'c-system', label: 'Green / System', fillType: 'linear', bg1: '#27ae60', bg2: '#219653', text: '#ffffff', fontSize: 16 },
    { key: 'c-util', label: 'Purple / Util', fillType: 'linear', bg1: '#8e44ad', bg2: '#7d3c98', text: '#ffffff', fontSize: 16 },
    { key: 'c-nav', label: 'Orange / Nav', fillType: 'linear', bg1: '#f39c12', bg2: '#d35400', text: '#ffffff', fontSize: 16 },
    { key: 'c-gray', label: 'Gray / Standard', fillType: 'linear', bg1: '#4b5563', bg2: '#374151', text: '#ffffff', fontSize: 16 },
    { key: 'c-black', label: 'Black / Dark', fillType: 'linear', bg1: '#181a1f', bg2: '#0d0f12', text: '#ffffff', fontSize: 16 },
    { key: 'c-white', label: 'White / Light', fillType: 'linear', bg1: '#ffffff', bg2: '#e2e8f0', text: '#0f172a', fontSize: 16 }
];

function getSlotBackgroundCSS(fillType, bg1, bg2) {
    if (fillType === 'solid') return bg1 || '#181a1f';
    if (fillType === 'radial') return `radial-gradient(circle, ${bg1 || '#181a1f'}, ${bg2 || '#0d0f12'})`;
    if (fillType === 'transparent') return 'transparent';
    return `linear-gradient(135deg, ${bg1 || '#181a1f'}, ${bg2 || '#0d0f12'})`;
}

function getCustomThemes() {
    if (typeof currentConfig !== 'undefined' && Array.isArray(currentConfig._customThemes)) {
        return currentConfig._customThemes;
    }
    try {
        const saved = localStorage.getItem('matrix_custom_themes');
        if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
}

function saveCustomThemes(themes) {
    if (typeof currentConfig !== 'undefined') {
        currentConfig._customThemes = themes;
    }
    try {
        localStorage.setItem('matrix_custom_themes', JSON.stringify(themes));
    } catch (e) {}
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

function populateThemeSelectOptions() {
    const select = document.getElementById('theme-select');
    if (!select) return;
    const currentTheme = (typeof currentConfig !== 'undefined' && currentConfig._theme) ? currentConfig._theme : 'default';
    const customThemes = getCustomThemes();

    let html = '<optgroup label="Built-in Themes">';
    BUILTIN_THEMES.forEach(t => {
        html += `<option value="${t.id}" ${t.id === currentTheme ? 'selected' : ''}>${t.name}</option>`;
    });
    html += '</optgroup>';

    if (customThemes.length > 0) {
        html += '<optgroup label="Custom Themes">';
        customThemes.forEach(t => {
            html += `<option value="${t.id}" ${t.id === currentTheme ? 'selected' : ''}>${t.name} (Custom)</option>`;
        });
        html += '</optgroup>';
    }

    select.innerHTML = html;
}

function openThemeManagerModal() {
    const modal = document.getElementById('theme-manager-modal');
    if (modal) {
        modal.classList.add('visible');
        renderThemePaletteEditor();
        switchThemeModalTab('library');
        renderThemeLibraryCards();
    }
}

function closeThemeManagerModal() {
    const modal = document.getElementById('theme-manager-modal');
    if (modal) modal.classList.remove('visible');
}

function switchThemeModalTab(tab) {
    const libTab = document.getElementById('theme-tab-library');
    const bldTab = document.getElementById('theme-tab-builder');
    const libBtn = document.getElementById('tab-btn-library');
    const bldBtn = document.getElementById('tab-btn-builder');

    if (tab === 'builder') {
        if (libTab) libTab.classList.remove('active');
        if (bldTab) bldTab.classList.add('active');
        if (libBtn) libBtn.classList.remove('active');
        if (bldBtn) bldBtn.classList.add('active');
        const editor = document.getElementById('theme-palette-editor');
        if (editor && !editor.children.length) {
            renderThemePaletteEditor();
        }
    } else {
        if (libTab) libTab.classList.add('active');
        if (bldTab) bldTab.classList.remove('active');
        if (libBtn) libBtn.classList.add('active');
        if (bldBtn) bldBtn.classList.remove('active');
        renderThemeLibraryCards();
    }
}

let currentEditingThemeId = null;

function renderThemeLibraryCards() {
    const grid = document.getElementById('theme-cards-grid');
    if (!grid) return;
    const currentTheme = (typeof currentConfig !== 'undefined' && currentConfig._theme) ? currentConfig._theme : 'default';
    const customThemes = getCustomThemes();
    let html = '';

    // Built-in themes
    BUILTIN_THEMES.forEach(t => {
        const isActive = t.id === currentTheme;
        const swatchesHTML = t.swatches.map(c => `<div class="theme-swatch" style="background:${c}"></div>`).join('');
        html += `
            <div class="theme-preset-card ${isActive ? 'active-theme' : ''}">
                <div class="theme-card-top">
                    <span class="theme-card-name">${t.name}</span>
                    <span class="theme-card-badge">Built-in</span>
                </div>
                <div class="theme-swatches-row">${swatchesHTML}</div>
                <div class="theme-card-footer">
                    <button type="button" class="theme-card-btn apply-btn" onclick="applyThemeFromCard('${t.id}')">${isActive ? 'Active' : 'Apply Theme'}</button>
                </div>
            </div>
        `;
    });

    // Custom themes
    customThemes.forEach(t => {
        const isActive = t.id === currentTheme;
        const swatches = t.palette ? Object.values(t.palette).map(p => p.bg1 || '#333') : [t.backgroundColor || '#000'];
        const swatchesHTML = swatches.slice(0, 8).map(c => `<div class="theme-swatch" style="background:${c}"></div>`).join('');
        html += `
            <div class="theme-preset-card ${isActive ? 'active-theme' : ''}">
                <div class="theme-card-top">
                    <span class="theme-card-name">${t.name}</span>
                    <span class="theme-card-badge custom">Custom</span>
                </div>
                <div class="theme-swatches-row">${swatchesHTML}</div>
                <div class="theme-card-footer">
                    <button type="button" class="theme-card-btn apply-btn" onclick="applyThemeFromCard('${t.id}')">${isActive ? 'Active' : 'Apply'}</button>
                    <button type="button" class="theme-card-btn" onclick="editCustomTheme('${t.id}')" title="Edit Theme"><span class="material-symbols-outlined">edit</span></button>
                    <button type="button" class="theme-card-btn" onclick="exportCustomTheme('${t.id}')" title="Export Theme JSON"><span class="material-symbols-outlined">file_download</span></button>
                    <button type="button" class="theme-card-btn del-btn" onclick="deleteCustomTheme('${t.id}')" title="Delete Theme">✕</button>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

function renderThemePaletteEditor(customPalette) {
    const editor = document.getElementById('theme-palette-editor');
    if (!editor) return;
    let html = '';

    DEFAULT_PALETTE_SLOTS.forEach(slot => {
        const p = (customPalette && customPalette[slot.key]) || slot;
        const fillType = p.fillType || slot.fillType || 'linear';
        const bg1 = p.bg1 || slot.bg1;
        const bg2 = p.bg2 || slot.bg2;
        const textColor = p.text || slot.text || '#ffffff';
        const fontSize = p.fontSize || slot.fontSize || 16;
        const bgCSS = getSlotBackgroundCSS(fillType, bg1, bg2);

        html += `
            <div class="palette-slot-card">
                <div class="palette-slot-header">
                    <span>${slot.label}</span>
                    <span class="color-chip-preview" id="preview-slot-${slot.key}" style="width: 24px; height: 18px; border-radius: 4px; background: ${bgCSS}; color: ${textColor}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; border: 1px solid rgba(255,255,255,0.2);">Aa</span>
                </div>
                <div class="palette-slot-inputs">
                    <div>
                        <div class="palette-sub-label">Fill Style</div>
                        <select id="slot-filltype-val-${slot.key}" onchange="onSlotColorChange('${slot.key}', 'fillType', this.value)">
                            <option value="linear" ${fillType === 'linear' ? 'selected' : ''}>Linear Gradient</option>
                            <option value="radial" ${fillType === 'radial' ? 'selected' : ''}>Radial Gradient</option>
                            <option value="solid" ${fillType === 'solid' ? 'selected' : ''}>Solid Color</option>
                            <option value="transparent" ${fillType === 'transparent' ? 'selected' : ''}>Transparent / Glass</option>
                        </select>
                    </div>
                    <div>
                        <div class="palette-sub-label">Primary Color</div>
                        <div class="color-input-group">
                            <input type="color" class="color-picker-input" id="slot-bg1-picker-${slot.key}" value="${bg1}" oninput="onSlotColorChange('${slot.key}', 'bg1', this.value)">
                            <input type="text" class="color-text-input" id="slot-bg1-val-${slot.key}" value="${bg1}" oninput="onSlotColorChange('${slot.key}', 'bg1', this.value)">
                        </div>
                    </div>
                </div>
                <div class="palette-slot-inputs">
                    <div>
                        <div class="palette-sub-label">Secondary Color</div>
                        <div class="color-input-group">
                            <input type="color" class="color-picker-input" id="slot-bg2-picker-${slot.key}" value="${bg2}" oninput="onSlotColorChange('${slot.key}', 'bg2', this.value)">
                            <input type="text" class="color-text-input" id="slot-bg2-val-${slot.key}" value="${bg2}" oninput="onSlotColorChange('${slot.key}', 'bg2', this.value)">
                        </div>
                    </div>
                    <div>
                        <div class="palette-sub-label">Text Color</div>
                        <div class="color-input-group">
                            <input type="color" class="color-picker-input" id="slot-text-picker-${slot.key}" value="${textColor}" oninput="onSlotColorChange('${slot.key}', 'text', this.value)">
                            <input type="text" class="color-text-input" id="slot-text-val-${slot.key}" value="${textColor}" oninput="onSlotColorChange('${slot.key}', 'text', this.value)">
                        </div>
                    </div>
                </div>
                <div class="palette-slot-inputs">
                    <div>
                        <div class="palette-sub-label">Font Size</div>
                        <select id="slot-fontsize-val-${slot.key}" onchange="onSlotColorChange('${slot.key}', 'fontSize', this.value)">
                            <option value="11" ${fontSize == 11 ? 'selected' : ''}>11px (Tiny)</option>
                            <option value="13" ${fontSize == 13 ? 'selected' : ''}>13px (Small)</option>
                            <option value="16" ${fontSize == 16 ? 'selected' : ''}>16px (Default)</option>
                            <option value="18" ${fontSize == 18 ? 'selected' : ''}>18px (Large)</option>
                            <option value="22" ${fontSize == 22 ? 'selected' : ''}>22px (Extra Large)</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    });

    editor.innerHTML = html;
}

function onSlotColorChange(slotKey, type, val) {
    const picker = document.getElementById(`slot-${type}-picker-${slotKey}`);
    const text = document.getElementById(`slot-${type}-val-${slotKey}`);
    if (picker && picker.value !== val) picker.value = val;
    if (text && text.value !== val) text.value = val;

    const fillType = document.getElementById(`slot-filltype-val-${slotKey}`)?.value || 'linear';
    const bg1 = document.getElementById(`slot-bg1-val-${slotKey}`)?.value || '#2980b9';
    const bg2 = document.getElementById(`slot-bg2-val-${slotKey}`)?.value || '#2573a7';
    const textColor = document.getElementById(`slot-text-val-${slotKey}`)?.value || '#ffffff';
    const preview = document.getElementById(`preview-slot-${slotKey}`);
    if (preview) {
        preview.style.background = getSlotBackgroundCSS(fillType, bg1, bg2);
        preview.style.color = textColor;
    }
}

function onBuilderBgChange(val) {
    const picker = document.getElementById('builder-bg-picker');
    const text = document.getElementById('builder-bg-val');
    if (picker && picker.value !== val) picker.value = val;
    if (text && text.value !== val) text.value = val;
}

function onBuilderBorderColorChange(val) {
    const picker = document.getElementById('builder-border-color-picker');
    const text = document.getElementById('builder-border-color-val');
    if (picker && picker.value !== val) picker.value = val;
    if (text && text.value !== val) text.value = val;
}

function onBuilderBorderStyleChange() {}

function startNewThemeBuilder() {
    currentEditingThemeId = null;
    const nameInput = document.getElementById('builder-theme-name');
    if (nameInput) nameInput.value = 'My Custom Theme';
    onBuilderBgChange('#000000');
    renderThemePaletteEditor();
    switchThemeModalTab('builder');
}

function editCustomTheme(themeId) {
    const themes = getCustomThemes();
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    currentEditingThemeId = themeId;
    const nameInput = document.getElementById('builder-theme-name');
    if (nameInput) nameInput.value = theme.name || 'Custom Theme';
    onBuilderBgChange(theme.backgroundColor || '#000000');
    const bStyle = document.getElementById('builder-border-style');
    const bWidth = document.getElementById('builder-border-width');
    const bRad = document.getElementById('builder-border-radius');
    if (bStyle && theme.borderStyle) bStyle.value = theme.borderStyle;
    if (bWidth && theme.borderWidth) bWidth.value = String(theme.borderWidth);
    if (bRad && theme.borderRadius !== undefined) bRad.value = String(theme.borderRadius);
    onBuilderBorderColorChange(theme.borderColor || '#ffffff');
    renderThemePaletteEditor(theme.palette || {});
    switchThemeModalTab('builder');
}

function captureCurrentLayoutAsTheme() {
    currentEditingThemeId = null;
    const nameInput = document.getElementById('builder-theme-name');
    if (nameInput) nameInput.value = `Captured Style (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    
    // Sample first button's border if configured
    if (typeof currentConfig !== 'undefined') {
        const firstBtn = currentConfig[`p${activePage}-b1`] || {};
        const bStyle = document.getElementById('builder-border-style');
        const bWidth = document.getElementById('builder-border-width');
        const bRad = document.getElementById('builder-border-radius');
        if (bStyle && firstBtn.borderStyle) bStyle.value = firstBtn.borderStyle;
        if (bWidth && firstBtn.borderWidth) bWidth.value = String(firstBtn.borderWidth);
        if (bRad && firstBtn.borderRadius !== undefined) bRad.value = String(firstBtn.borderRadius);
        onBuilderBorderColorChange(firstBtn.borderColor || '#ffffff');
    }

    renderThemePaletteEditor();
    switchThemeModalTab('builder');
}

function saveBuilderTheme() {
    const nameInput = document.getElementById('builder-theme-name');
    const themeName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Custom Theme';
    const themeId = currentEditingThemeId || ('custom-' + Date.now());
    const bgVal = document.getElementById('builder-bg-val')?.value || '#000000';
    const borderStyle = document.getElementById('builder-border-style')?.value || 'brackets';
    const borderWidth = parseInt(document.getElementById('builder-border-width')?.value || 2, 10);
    const borderRadius = parseInt(document.getElementById('builder-border-radius')?.value || 20, 10);
    const borderColor = document.getElementById('builder-border-color-val')?.value || '#ffffff';

    const palette = {};
    DEFAULT_PALETTE_SLOTS.forEach(slot => {
        const fillType = document.getElementById(`slot-filltype-val-${slot.key}`)?.value || slot.fillType || 'linear';
        const bg1 = document.getElementById(`slot-bg1-val-${slot.key}`)?.value || slot.bg1;
        const bg2 = document.getElementById(`slot-bg2-val-${slot.key}`)?.value || slot.bg2;
        const text = document.getElementById(`slot-text-val-${slot.key}`)?.value || slot.text;
        const fontSize = parseInt(document.getElementById(`slot-fontsize-val-${slot.key}`)?.value || slot.fontSize || 16, 10);
        palette[slot.key] = { fillType, bg1, bg2, text, fontSize };
    });

    const updatedTheme = {
        id: themeId,
        name: themeName,
        backgroundColor: bgVal,
        borderStyle,
        borderWidth,
        borderRadius,
        borderColor,
        borderBracketLength: 35,
        palette
    };

    let themes = getCustomThemes();
    const existingIndex = themes.findIndex(t => t.id === themeId);
    if (existingIndex >= 0) {
        themes[existingIndex] = updatedTheme;
    } else {
        themes.push(updatedTheme);
    }
    saveCustomThemes(themes);

    currentEditingThemeId = null;

    // Apply theme
    if (typeof currentConfig !== 'undefined') {
        currentConfig._theme = themeId;
    }
    if (typeof syncThemeUI === 'function') syncThemeUI();
    if (typeof renderPreview === 'function') renderPreview();
    if (typeof renderFormFields === 'function') renderFormFields();
    if (typeof markUnsaved === 'function') markUnsaved();
    closeThemeManagerModal();
}

function applyThemeFromCard(themeId) {
    if (typeof currentConfig !== 'undefined') {
        currentConfig._theme = themeId;
    }
    if (typeof syncThemeUI === 'function') syncThemeUI();
    if (typeof renderPreview === 'function') renderPreview();
    if (typeof renderFormFields === 'function') renderFormFields();
    if (typeof markUnsaved === 'function') markUnsaved();
    renderThemeLibraryCards();
}

function deleteCustomTheme(themeId) {
    let themes = getCustomThemes();
    themes = themes.filter(t => t.id !== themeId);
    saveCustomThemes(themes);
    if (typeof currentConfig !== 'undefined' && currentConfig._theme === themeId) {
        currentConfig._theme = 'default';
        if (typeof syncThemeUI === 'function') syncThemeUI();
        if (typeof renderPreview === 'function') renderPreview();
        if (typeof renderFormFields === 'function') renderFormFields();
        if (typeof markUnsaved === 'function') markUnsaved();
    }
    renderThemeLibraryCards();
}

async function exportCustomTheme(themeId) {
    const themes = getCustomThemes();
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    if (window.api && window.api.exportTheme) {
        await window.api.exportTheme(theme);
    } else {
        const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${theme.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.matrix-theme.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

async function importThemeJSON() {
    if (window.api && window.api.importTheme) {
        const res = await window.api.importTheme();
        if (res && res.theme) {
            const imported = res.theme;
            if (!imported.id || !imported.id.startsWith('custom-')) {
                imported.id = 'custom-' + Date.now();
            }
            if (!imported.name) imported.name = 'Imported Theme';
            const themes = getCustomThemes();
            themes.push(imported);
            saveCustomThemes(themes);
            applyThemeFromCard(imported.id);
        }
    }
}
