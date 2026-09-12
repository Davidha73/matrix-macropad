const defaultConfig = {
    '_theme': 'default',
    '_screensaverTimeout': 300,
    '_screensaverImage': 'icon.png',
    '_brightness': 50,
    'p1-name': 'Editing Tools',
    'p2-name': 'System Controls',
    'p3-name': 'Custom Macros',

    'p1-b1': { label: 'Select All', type: 'shortcut', value: 'select-all', color: '#2980b9' },
    'p1-b2': { label: 'Copy', type: 'shortcut', value: 'copy', color: '#2980b9' },
    'p1-b3': { label: 'Paste', type: 'shortcut', value: 'paste', color: '#2980b9' },
    'p1-b4': { label: 'Undo', type: 'shortcut', value: 'undo', color: '#4b5563' },
    'p1-b5': { label: 'Redo', type: 'shortcut', value: 'redo', color: '#4b5563' },
    'p1-b6': { label: 'Delete', type: 'shortcut', value: 'delete', color: '#e74c3c' },

    'p2-b1': { label: 'Prev', type: 'shortcut', value: 'media-prev', color: '#27ae60' },
    'p2-b2': { label: 'Play/Pause', type: 'shortcut', value: 'media-play', color: '#27ae60' },
    'p2-b3': { label: 'Next', type: 'shortcut', value: 'media-next', color: '#27ae60' },
    'p2-b4': { label: 'Vol Down', type: 'shortcut', value: 'vol-down', color: '#8e44ad' },
    'p2-b5': { label: 'Mute Audio', type: 'shortcut', value: 'vol-mute', color: '#8e44ad' },
    'p2-b6': { label: 'Vol Up', type: 'shortcut', value: 'vol-up', color: '#8e44ad' },

    'p3-b1': { label: 'Custom 1', type: 'text', value: 'Hello World!', color: '#f39c12' },
    'p3-b2': { label: 'Custom 2', type: 'text', value: 'Snippet 2', color: '#f39c12' },
    'p3-b3': { label: 'Google', type: 'url', value: 'https://www.google.com', color: '#f39c12', icon: 'google-logo.jpg' },
    'p3-b4': { label: 'Custom 4', type: 'text', value: '', color: '#4b5563' },
    'p3-b5': { label: 'Custom 5', type: 'text', value: '', color: '#4b5563' },
    'p3-b6': { label: 'Custom 6', type: 'text', value: '', color: '#4b5563' }
};

function getDefaultConfig() {
    return JSON.parse(JSON.stringify(defaultConfig));
}

let currentConfig = getDefaultConfig();
let activePage = 1;
let selectedButtonIndex = 1;
let currentProfileName = 'Default';
let activeSubPageParent = null; // null for root page mode, or 'p1-b1' for sub-page mode
let selectedSubButtonIndex = 1; // 1..6 when in sub-page mode
let tabDragHoverTimer = null;
let tabDragHoverTarget = null;

function handleDropOnPageTab(targetPage, e) {
    if (!window.activeDraggedButton) return;
    const src = window.activeDraggedButton;
    const targetKey = `p${targetPage}-b${src.index}`;
    const isCopy = e && (e.altKey || e.ctrlKey);

    const srcCfg = JSON.parse(JSON.stringify(getButtonConfigByKey(src.key) || { label: `Button ${src.index}` }));
    const tgtCfg = JSON.parse(JSON.stringify(getButtonConfigByKey(targetKey) || { label: `Button ${src.index}` }));

    if (isCopy) {
        setButtonConfigByKey(targetKey, srcCfg);
    } else {
        setButtonConfigByKey(src.key, tgtCfg);
        setButtonConfigByKey(targetKey, srcCfg);
    }

    selectedButtonIndex = src.index;
    activeSubPageParent = null;
    switchPage(targetPage, true);
    selectButton(src.index, true);
    markUnsaved();
}

function getActiveButtonKey() {
    if (activeSubPageParent) {
        return `${activeSubPageParent}-sub${selectedSubButtonIndex}`;
    }
    return `p${activePage}-b${selectedButtonIndex}`;
}

function getButtonConfigByKey(targetKey) {
    if (!targetKey) return {};
    const subMatch = targetKey.match(/^(p\d+-b\d+)-sub(\d+)$/);
    if (subMatch) {
        const pKey = subMatch[1];
        const sIdx = parseInt(subMatch[2], 10) - 1;
        const parentCfg = currentConfig[pKey];
        if (parentCfg) {
            if (!parentCfg.sub_buttons) {
                parentCfg.sub_buttons = parentCfg.children ? [...parentCfg.children] : [];
            }
            while (parentCfg.sub_buttons.length <= sIdx) {
                const newIdx = parentCfg.sub_buttons.length + 1;
                parentCfg.sub_buttons.push({
                    id: newIdx * 100 + 1,
                    label: `Button ${newIdx}`,
                    type: 'shortcut',
                    value: '',
                    payload: '',
                    color: '#4b5563'
                });
            }
            const sub = parentCfg.sub_buttons[sIdx];
            if (sub) {
                if (sub.bg_color && !sub.color) sub.color = sub.bg_color;
                if (sub.bgColor && !sub.color) sub.color = sub.bgColor;
                if (sub.text_color && !sub.customTextColor) sub.customTextColor = sub.text_color;
                if (sub.textColor && !sub.customTextColor) sub.customTextColor = sub.textColor;
                if (sub.border_color && !sub.borderColor) sub.borderColor = sub.border_color;
                if (sub.border_width !== undefined && sub.borderWidth === undefined) sub.borderWidth = sub.border_width;
                if (sub.border_radius !== undefined && sub.borderRadius === undefined) sub.borderRadius = sub.border_radius;
            }
            return sub;
        }
        return {};
    }
    return currentConfig[targetKey] || defaultConfig[targetKey] || { label: '', color: '#4b5563' };
}

function setButtonConfigByKey(targetKey, newConfig) {
    if (!targetKey) return;
    const subMatch = targetKey.match(/^(p\d+-b\d+)-sub(\d+)$/);
    if (subMatch) {
        const pKey = subMatch[1];
        const sIdx = parseInt(subMatch[2], 10) - 1;
        if (!currentConfig[pKey]) currentConfig[pKey] = { ...(defaultConfig[pKey] || {}) };
        if (!currentConfig[pKey].sub_buttons) {
            currentConfig[pKey].sub_buttons = currentConfig[pKey].children ? [...currentConfig[pKey].children] : [];
        }
        while (currentConfig[pKey].sub_buttons.length <= sIdx) {
            currentConfig[pKey].sub_buttons.push({});
        }
        currentConfig[pKey].sub_buttons[sIdx] = newConfig;
        return;
    }
    currentConfig[targetKey] = newConfig;
}

function enterSubPage(parentKey) {
    try {
        saveCurrentFormInputs();
    } catch (err) {}
    activeSubPageParent = parentKey;
    selectedSubButtonIndex = 1;
    const parentCfg = currentConfig[parentKey] || {};
    if (!parentCfg.sub_buttons) {
        parentCfg.sub_buttons = parentCfg.children ? [...parentCfg.children] : [];
    }
    while (parentCfg.sub_buttons.length < 6) {
        const idx = parentCfg.sub_buttons.length + 1;
        parentCfg.sub_buttons.push({
            id: idx * 100 + (selectedButtonIndex || 1),
            label: `Button ${idx}`,
            type: 'shortcut',
            value: '',
            payload: '',
            color: '#4b5563'
        });
    }
    renderPreviewTabs();
    renderPreview();
    renderFormFields();
    markUnsaved();
}

function exitSubPage() {
    try {
        saveCurrentFormInputs();
    } catch (err) {}
    activeSubPageParent = null;
    renderPreviewTabs();
    renderPreview();
    renderFormFields();
}

function removeSubPage(parentKey) {
    if (currentConfig[parentKey]) {
        delete currentConfig[parentKey].sub_buttons;
        delete currentConfig[parentKey].children;
    }
    if (activeSubPageParent === parentKey) {
        activeSubPageParent = null;
    }
    renderPreviewTabs();
    renderPreview();
    renderFormFields();
    markUnsaved();
}

function selectSubButton(subNum, skipSave = false) {
    if (!skipSave) {
        try {
            saveCurrentFormInputs();
        } catch (err) {
            console.warn('Form save error during sub-button selection:', err);
        }
    }
    selectedSubButtonIndex = subNum;
    const newKey = getActiveButtonKey();
    if (activeShortcutPickerKey) {
        activeShortcutPickerKey = newKey;
        const recordInput = document.getElementById('shortcut-modal-record-input');
        if (recordInput) {
            const cfg = getButtonConfigByKey(newKey) || {};
            recordInput.value = (cfg.type === 'shortcut' ? (cfg.value || '') : '');
        }
        renderShortcutPickerGrid();
    }
    renderPreview();
    renderFormFields();
}

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

function prevPage() {
    if (activeSubPageParent) return;
    if (activePage > 1) {
        switchPage(activePage - 1);
    }
}

function nextPage() {
    if (activeSubPageParent) return;
    const totalPages = getTotalPages();
    if (activePage < totalPages) {
        switchPage(activePage + 1);
    }
}

function renderPreviewTabs() {
    const container = document.getElementById('preview-nav-tabs');
    const viewport = document.querySelector('.preview-track-viewport');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    if (!container || !viewport) return;
    container.innerHTML = '';

    if (activeSubPageParent) {
        if (prevBtn) prevBtn.style.visibility = 'hidden';
        if (nextBtn) nextBtn.style.visibility = 'hidden';
        container.style.transform = 'none';

        const parentCfg = currentConfig[activeSubPageParent] || {};
        const parentLabel = parentCfg.label || activeSubPageParent;
        const subNav = document.createElement('div');
        subNav.className = 'subpage-nav-wrapper';
        subNav.innerHTML = `
            <button type="button" class="subpage-back-btn" onclick="exitSubPage()">
                <span class="material-symbols-outlined">arrow_back</span> Back to Page ${activePage}
            </button>
            <span class="subpage-active-title" title="${parentLabel}">
                <span class="material-symbols-outlined">folder_open</span> Sub-Menu: ${parentLabel}
            </span>
        `;
        container.appendChild(subNav);
        return;
    }

    const totalPages = getTotalPages();
    const viewportWidth = viewport.clientWidth || 250;
    const gap = 6;
    const tabWidth = Math.floor((viewportWidth - (gap * 2)) / 3);

    for (let i = 1; i <= totalPages; i++) {
        const tab = document.createElement('div');
        tab.className = `preview-tab${i === activePage ? ' active' : ''}`;
        tab.id = `ptab-${i}`;
        tab.textContent = currentConfig[`p${i}-name`] || `Page ${i}`;
        tab.style.width = `${tabWidth}px`;
        tab.style.flex = `0 0 ${tabWidth}px`;
        tab.style.visibility = (Math.abs(i - activePage) <= 1) ? 'visible' : 'hidden';
        tab.onclick = () => switchPage(i);

        tab.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!window.activeDraggedButton) return;
            const isCopy = e.altKey || e.ctrlKey;
            e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';
            tab.classList.add('tab-drag-over');

            if (i !== activePage) {
                if (tabDragHoverTarget !== i) {
                    if (tabDragHoverTimer) clearTimeout(tabDragHoverTimer);
                    tabDragHoverTarget = i;
                    tabDragHoverTimer = setTimeout(() => {
                        if (window.activeDraggedButton && tabDragHoverTarget === i) {
                            switchPage(i, true);
                        }
                        tabDragHoverTimer = null;
                        tabDragHoverTarget = null;
                    }, 400);
                }
            } else {
                if (tabDragHoverTimer) {
                    clearTimeout(tabDragHoverTimer);
                    tabDragHoverTimer = null;
                    tabDragHoverTarget = null;
                }
            }
        };

        tab.ondragleave = (e) => {
            if (!tab.contains(e.relatedTarget)) {
                tab.classList.remove('tab-drag-over');
                if (tabDragHoverTarget === i) {
                    if (tabDragHoverTimer) clearTimeout(tabDragHoverTimer);
                    tabDragHoverTimer = null;
                    tabDragHoverTarget = null;
                }
            }
        };

        tab.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            tab.classList.remove('tab-drag-over');
            if (tabDragHoverTimer) {
                clearTimeout(tabDragHoverTimer);
                tabDragHoverTimer = null;
                tabDragHoverTarget = null;
            }
            handleDropOnPageTab(i, e);
        };

        container.appendChild(tab);
    }

    const centerOfActiveTab = (activePage - 1) * (tabWidth + gap) + (tabWidth / 2);
    const centerOfViewport = viewportWidth / 2;
    const offset = centerOfViewport - centerOfActiveTab;
    container.style.transform = `translateX(${Math.round(offset)}px)`;

    if (prevBtn) {
        prevBtn.disabled = (activePage <= 1);
        prevBtn.style.visibility = (activePage <= 1) ? 'hidden' : 'visible';
        prevBtn.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!window.activeDraggedButton || activePage <= 1) return;
            const isCopy = e.altKey || e.ctrlKey;
            e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';
            prevBtn.classList.add('arrow-drag-over');
            if (tabDragHoverTarget !== 'prev') {
                if (tabDragHoverTimer) clearTimeout(tabDragHoverTimer);
                tabDragHoverTarget = 'prev';
                tabDragHoverTimer = setTimeout(() => {
                    if (window.activeDraggedButton && activePage > 1) {
                        prevPage();
                    }
                    tabDragHoverTimer = null;
                    tabDragHoverTarget = null;
                }, 400);
            }
        };
        prevBtn.ondragleave = (e) => {
            if (!prevBtn.contains(e.relatedTarget)) {
                prevBtn.classList.remove('arrow-drag-over');
                if (tabDragHoverTarget === 'prev') {
                    if (tabDragHoverTimer) clearTimeout(tabDragHoverTimer);
                    tabDragHoverTimer = null;
                    tabDragHoverTarget = null;
                }
            }
        };
        prevBtn.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            prevBtn.classList.remove('arrow-drag-over');
            if (tabDragHoverTimer) {
                clearTimeout(tabDragHoverTimer);
                tabDragHoverTimer = null;
                tabDragHoverTarget = null;
            }
            if (activePage > 1 && window.activeDraggedButton) {
                handleDropOnPageTab(activePage - 1, e);
            }
        };
    }
    if (nextBtn) {
        nextBtn.disabled = (activePage >= totalPages);
        nextBtn.style.visibility = (activePage >= totalPages) ? 'hidden' : 'visible';
        nextBtn.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!window.activeDraggedButton || activePage >= totalPages) return;
            const isCopy = e.altKey || e.ctrlKey;
            e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';
            nextBtn.classList.add('arrow-drag-over');
            if (tabDragHoverTarget !== 'next') {
                if (tabDragHoverTimer) clearTimeout(tabDragHoverTimer);
                tabDragHoverTarget = 'next';
                tabDragHoverTimer = setTimeout(() => {
                    if (window.activeDraggedButton && activePage < totalPages) {
                        nextPage();
                    }
                    tabDragHoverTimer = null;
                    tabDragHoverTarget = null;
                }, 400);
            }
        };
        nextBtn.ondragleave = (e) => {
            if (!nextBtn.contains(e.relatedTarget)) {
                nextBtn.classList.remove('arrow-drag-over');
                if (tabDragHoverTarget === 'next') {
                    if (tabDragHoverTimer) clearTimeout(tabDragHoverTimer);
                    tabDragHoverTimer = null;
                    tabDragHoverTarget = null;
                }
            }
        };
        nextBtn.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            nextBtn.classList.remove('arrow-drag-over');
            if (tabDragHoverTimer) {
                clearTimeout(tabDragHoverTimer);
                tabDragHoverTimer = null;
                tabDragHoverTarget = null;
            }
            if (activePage < totalPages && window.activeDraggedButton) {
                handleDropOnPageTab(activePage + 1, e);
            }
        };
    }

    const delBtn = document.getElementById('del-page-btn');
    if (delBtn) delBtn.disabled = (totalPages <= 1);
}

function updatePreviewTabTitles() {
    const totalPages = getTotalPages();
    for (let i = 1; i <= totalPages; i++) {
        const tabEl = document.getElementById(`ptab-${i}`);
        if (tabEl) {
            tabEl.textContent = currentConfig[`p${i}-name`] || `Page ${i}`;
        }
    }
    const delBtn = document.getElementById('del-page-btn');
    if (delBtn) delBtn.disabled = (totalPages <= 1);
}

function selectButton(buttonNum, skipSave = false) {
    if (!skipSave) {
        try {
            saveCurrentFormInputs();
        } catch (err) {
            console.warn('Form save error during button selection:', err);
        }
    }
    activeSubPageParent = null;
    selectedButtonIndex = buttonNum;
    const newKey = `p${activePage}-b${buttonNum}`;
    if (activeShortcutPickerKey) {
        activeShortcutPickerKey = newKey;
        const recordInput = document.getElementById('shortcut-modal-record-input');
        if (recordInput) {
            const cfg = currentConfig[newKey] || {};
            recordInput.value = (cfg.type === 'shortcut' ? (cfg.value || '') : '');
        }
        renderShortcutPickerGrid();
    }
    renderPreview();
    renderFormFields();
}

function switchPage(pageNum, skipSave = false) {
    if (!skipSave) {
        try {
            saveCurrentFormInputs();
        } catch (err) {
            console.warn('Form save error during page switch:', err);
        }
    }
    
    activeSubPageParent = null;
    const totalPages = getTotalPages();
    activePage = Math.max(1, Math.min(totalPages, pageNum));
    
    renderPreviewTabs();
    
    const currentPageName = currentConfig[`p${activePage}-name`] || `Page ${activePage}`;
    const titleEl = document.getElementById('editor-title');
    if (titleEl) titleEl.textContent = `Configure ${currentPageName}`;

    const pageNameInput = document.getElementById('page-name-input');
    if (pageNameInput) pageNameInput.value = currentPageName;

    const moveLeftBtn = document.getElementById('move-left-btn');
    const moveRightBtn = document.getElementById('move-right-btn');
    if (moveLeftBtn) moveLeftBtn.disabled = (activePage <= 1);
    if (moveRightBtn) moveRightBtn.disabled = (activePage >= totalPages);
    
    if (activeShortcutPickerKey) {
        activeShortcutPickerKey = getActiveButtonKey();
        const recordInput = document.getElementById('shortcut-modal-record-input');
        if (recordInput) {
            const cfg = getButtonConfigByKey(activeShortcutPickerKey);
            recordInput.value = (cfg.type === 'shortcut' ? (cfg.value || '') : '');
        }
        renderShortcutPickerGrid();
    }

    renderPreview();
    renderFormFields();
}

function moveCurrentPage(dir) {
    const totalPages = getTotalPages();
    const targetPage = activePage + dir;
    if (targetPage < 1 || targetPage > totalPages) return;

    saveCurrentFormInputs();

    const pageA = activePage;
    const pageB = targetPage;

    const tempName = currentConfig[`p${pageA}-name`];
    const tempButtons = {};
    for (let b = 1; b <= 6; b++) {
        tempButtons[`b${b}`] = currentConfig[`p${pageA}-b${b}`];
    }

    currentConfig[`p${pageA}-name`] = currentConfig[`p${pageB}-name`];
    for (let b = 1; b <= 6; b++) {
        currentConfig[`p${pageA}-b${b}`] = currentConfig[`p${pageB}-b${b}`];
    }

    currentConfig[`p${pageB}-name`] = tempName;
    for (let b = 1; b <= 6; b++) {
        currentConfig[`p${pageB}-b${b}`] = tempButtons[`b${b}`];
    }

    switchPage(targetPage);
    markUnsaved();
}

function addNewPage() {
    saveCurrentFormInputs();
    const newPageNum = getTotalPages() + 1;
    currentConfig[`p${newPageNum}-name`] = `Page ${newPageNum}`;
    for (let b = 1; b <= 6; b++) {
        currentConfig[`p${newPageNum}-b${b}`] = { label: `Button ${b}`, color: '#4b5563', type: 'text', value: '' };
    }
    switchPage(newPageNum);
    markUnsaved();
}

function showConfirmDialog({ title = 'Are you sure?', message = 'Do you want to proceed?', confirmText = 'Confirm', confirmIcon = 'check', onConfirm }) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
        if (confirm(message)) onConfirm();
        return;
    }
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (confirmBtn) {
        confirmBtn.innerHTML = `<span class="material-symbols-outlined">${confirmIcon}</span> ${confirmText}`;
    }

    const closeModal = () => {
        modal.classList.remove('visible');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    confirmBtn.onclick = () => {
        closeModal();
        if (typeof onConfirm === 'function') onConfirm();
    };
    cancelBtn.onclick = closeModal;

    modal.classList.add('visible');
}

function deleteCurrentPage() {
    const totalPages = getTotalPages();
    if (totalPages <= 1) return;
    const pageName = currentConfig[`p${activePage}-name`] || `Page ${activePage}`;
    
    showConfirmDialog({
        title: 'Delete Page',
        message: `Are you sure you want to delete "${pageName}"? This action cannot be undone.`,
        confirmText: 'Delete Page',
        confirmIcon: 'delete',
        onConfirm: () => {
            saveCurrentFormInputs();
            const pageToDelete = activePage;
            const newConfig = {};

            // Copy layout metadata and any non-page keys
            Object.keys(currentConfig).forEach(k => {
                if (!k.startsWith('p')) {
                    newConfig[k] = currentConfig[k];
                }
            });

            let newPageIdx = 1;
            for (let p = 1; p <= totalPages; p++) {
                if (p === pageToDelete) continue;
                newConfig[`p${newPageIdx}-name`] = currentConfig[`p${p}-name`] || `Page ${newPageIdx}`;
                for (let b = 1; b <= 6; b++) {
                    newConfig[`p${newPageIdx}-b${b}`] = currentConfig[`p${p}-b${b}`] || { label: `Button ${b}`, color: '#4b5563', type: 'text', value: '' };
                }
                newPageIdx++;
            }

            currentConfig = newConfig;
            activePage = Math.max(1, Math.min(getTotalPages(), pageToDelete > 1 ? pageToDelete - 1 : 1));
            selectedButtonIndex = 1;
            switchPage(activePage);
            markUnsaved();
        }
    });
}

function onPageNameChange() {
    const pageNameInput = document.getElementById('page-name-input');
    if (pageNameInput) {
        const newName = pageNameInput.value.trim() || `Page ${activePage}`;
        currentConfig[`p${activePage}-name`] = pageNameInput.value;
        
        const titleEl = document.getElementById('editor-title');
        if (titleEl) titleEl.textContent = `Configure ${newName}`;
        
        updatePreviewTabTitles();
    }
}

function openScreenBgPicker() {
    const selectEl = document.getElementById('screen-bg-select');
    const customRow = document.getElementById('custom-screen-bg-row');
    const pageBtns = document.getElementById('page-manage-buttons');
    const picker = document.getElementById('screen-bg-picker');
    
    if (selectEl && selectEl.value !== 'custom') {
        selectEl.value = 'custom';
        const wrapper = selectEl.closest('.custom-select-wrapper');
        if (wrapper) {
            const triggerLabel = wrapper.querySelector('.custom-select-label');
            if (triggerLabel && selectEl.options[selectEl.selectedIndex]) {
                triggerLabel.textContent = selectEl.options[selectEl.selectedIndex].textContent;
            }
        }
    }
    if (customRow) customRow.classList.add('visible');
    if (pageBtns) pageBtns.classList.add('hidden');
    if (picker) {
        if (typeof picker.showPicker === 'function') {
            try {
                picker.showPicker();
            } catch (err) {
                picker.click();
            }
        } else {
            picker.click();
        }
    }
}

function onScreenBgSelectChange() {
    const selectEl = document.getElementById('screen-bg-select');
    const customRow = document.getElementById('custom-screen-bg-row');
    const pageBtns = document.getElementById('page-manage-buttons');
    const picker = document.getElementById('screen-bg-picker');
    const hexInput = document.getElementById('screen-bg-hex');
    
    if (!selectEl) return;
    const val = selectEl.value;
    
    if (val === 'custom') {
        if (customRow) customRow.classList.add('visible');
        if (pageBtns) pageBtns.classList.add('hidden');
        if (hexInput) {
            hexInput.focus();
            hexInput.select();
        }
    } else {
        if (customRow) customRow.classList.remove('visible');
        if (pageBtns) pageBtns.classList.remove('hidden');
        if (picker) picker.value = val;
        if (hexInput) hexInput.value = val.toUpperCase();
        markUnsaved();
    }
}

function onCustomScreenBgInputChange(val) {
    if (!val) return;
    const picker = document.getElementById('screen-bg-picker');
    const hexInput = document.getElementById('screen-bg-hex');
    const selectEl = document.getElementById('screen-bg-select');
    const customRow = document.getElementById('custom-screen-bg-row');
    const pageBtns = document.getElementById('page-manage-buttons');
    
    if (picker && picker.value !== val) picker.value = val;
    if (hexInput && hexInput.value !== val) hexInput.value = val;
    
    if (selectEl) {
        const found = standardBgColors.some(c => c.value.toLowerCase() === (val || '').toLowerCase());
        selectEl.value = found ? val.toLowerCase() : 'custom';
        if (customRow) customRow.classList.toggle('visible', !found);
        if (pageBtns) pageBtns.classList.toggle('hidden', !found);
        
        const wrapper = selectEl.closest('.custom-select-wrapper');
        if (wrapper) {
            const triggerLabel = wrapper.querySelector('.custom-select-label');
            if (triggerLabel && selectEl.options[selectEl.selectedIndex]) {
                triggerLabel.textContent = selectEl.options[selectEl.selectedIndex].textContent;
            }
        }
    }
    markUnsaved();
}

const themeColorDescriptors = {
    default: [
        { value: '#2980b9', label: '🟦 Blue (Edit / Primary)' },
        { value: '#27ae60', label: '🟩 Green (System / Media)' },
        { value: '#8e44ad', label: '🟪 Purple (Utility / Sound)' },
        { value: '#f39c12', label: '🟧 Orange (Accent / Nav)' },
        { value: '#c0392b', label: '🟥 Red (Danger / Action)' },
        { value: '#4b5563', label: '⬛ Grey (Neutral / Dark)' },
        { value: '#181a1f', label: '🔳 Black (Dark / Sleek)' },
        { value: '#ffffff', label: '⬜ White (Light / Clean)' }
    ],
    simple: [
        { value: '#000000', label: '⬛ Pure Black (White Border)' },
        { value: '#181a1f', label: '⬛ Black / Dark (White Border)' },
        { value: '#ffffff', label: '⬜ Inverted White (Black Text)' }
    ],
    cyberpunk: [
        { value: '#00f0ff', label: '🟦 Neon Cyan (Primary / Edit)' },
        { value: '#05ffa1', label: '🟩 Spring Green (System / Media)' },
        { value: '#ff007f', label: '🟪 Neon Magenta (Utility / Sound)' },
        { value: '#ffe600', label: '🟧 Neon Amber (Accent / Nav)' },
        { value: '#ff003c', label: '🟥 Neon Crimson (Danger / Action)' },
        { value: '#241c38', label: '🟪 Deep Violet (Plum / Dark)' },
        { value: '#08050e', label: '⬛ Obsidian Black (Dark / Border)' },
        { value: '#e0f7fa', label: '⬜ Ice Cyan (Light / Glow)' }
    ],
    synthwave: [
        { value: '#01cdfe', label: '🟦 Laser Blue (Primary / Edit)' },
        { value: '#05ffa1', label: '🟩 Mint Turquoise (System / Media)' },
        { value: '#ff71ce', label: '🟪 Electric Violet (Utility / Sound)' },
        { value: '#f9d423', label: '🟧 Hot Pink (Accent / Nav)' },
        { value: '#ff2a6d', label: '🟥 Radical Red (Danger / Action)' },
        { value: '#241734', label: '🟪 Velvet Purple (Neutral / Dark)' },
        { value: '#0f051d', label: '⬛ Twilight Night (Dark / Neon Border)' },
        { value: '#f8f8f2', label: '⬜ Pastel Pink (Light / Soft)' }
    ],
    matrix: [
        { value: '#00ff66', label: '🟩 Terminal Bright Green (Edit)' },
        { value: '#00cc55', label: '🟩 Digital Green (System / Media)' },
        { value: '#009944', label: '🟩 Jade Emerald (Utility / Sound)' },
        { value: '#aaff00', label: '🟩 Phosphor Lime (Accent / Nav)' },
        { value: '#ff3333', label: '🟥 Corrupt Red (System Danger)' },
        { value: '#003311', label: '🟩 Deep Matrix Green (Dark / Code)' },
        { value: '#051105', label: '⬛ Void Black (Green Border)' },
        { value: '#d4ffd4', label: '⬜ Data Stream Pale Green (Light)' }
    ],
    midnight: [
        { value: '#2563eb', label: '🟦 Cobalt Glass (Primary / Edit)' },
        { value: '#059669', label: '🟩 Emerald Glass (System / Media)' },
        { value: '#7c3aed', label: '🟪 Violet Glass (Utility / Sound)' },
        { value: '#d97706', label: '🟧 Amber Glass (Accent / Nav)' },
        { value: '#dc2626', label: '🟥 Ruby Glass (Danger / Action)' },
        { value: '#334155', label: '⬛ Slate Frosted Glass (Neutral / Dark)' },
        { value: '#0f172a', label: '⬛ Midnight Navy Glass (Dark / Glass)' },
        { value: '#f8fafc', label: '⬜ Frost White (Light / Clean)' }
    ],
    monochrome: [
        { value: '#333333', label: '⬛ Charcoal Slate (Primary / Edit)' },
        { value: '#444444', label: '⬛ Ash Gray (System / Media)' },
        { value: '#555555', label: '⬛ Dim Gray (Utility / Sound)' },
        { value: '#777777', label: '⬛ Silver Gray (Accent / Nav)' },
        { value: '#ff4444', label: '🟥 Muted Crimson (Danger / Alert)' },
        { value: '#222222', label: '⬛ Dark Charcoal (Neutral / Dark)' },
        { value: '#000000', label: '⬛ Pure Black (Minimal / Dark)' },
        { value: '#ffffff', label: '⬜ Pure White (Clean / Light)' }
    ]
};

function getColorSelectOptionsHTML(selectedColor, theme) {
    const legacyMap = {
        'c-edit': '#2980b9',
        'c-danger': '#c0392b',
        'c-system': '#27ae60',
        'c-media': '#27ae60',
        'c-util': '#8e44ad',
        'c-accent': '#8e44ad',
        'c-nav': '#f39c12',
        'c-gray': '#4b5563',
        'c-black': '#181a1f',
        'c-white': '#ffffff',
        'c-transparent': 'transparent'
    };
    const normColor = legacyMap[selectedColor] || selectedColor || '#4b5563';
    const list = themeColorDescriptors[theme] || themeColorDescriptors.default;
    let found = false;
    const options = list.map(c => {
        const isSel = (c.value.toLowerCase() === normColor.toLowerCase());
        if (isSel) found = true;
        return `<option value="${c.value}" ${isSel ? 'selected' : ''}>${c.label}</option>`;
    }).join('');
    const transpSel = (normColor === 'transparent') ? 'selected' : '';
    if (transpSel) found = true;
    const customSel = (normColor === 'custom' || (!found && normColor && normColor !== '#4b5563')) ? 'selected' : '';
    return `<option value="transparent" ${transpSel}>🔲 Transparent (Clear)</option>${options}<option value="custom" ${customSel}>🎨 Custom...</option>`;
}

const standardTextColors = [
    { value: '#ffffff', label: '⬜ Pure White' },
    { value: '#000000', label: '⬛ Pure Black' },
    { value: '#e2e8f0', label: '⬜ Platinum Gray' },
    { value: '#94a3b8', label: '⬜ Slate Gray' },
    { value: '#00f0ff', label: '🟦 Neon Cyan' },
    { value: '#05ffa1', label: '🟩 Spring Green' },
    { value: '#ffe600', label: '🟨 Bright Yellow' },
    { value: '#f39c12', label: '🟧 Amber Orange' },
    { value: '#ff007f', label: '🟪 Neon Pink' },
    { value: '#ff003c', label: '🟥 Crimson Red' },
    { value: '#38bdf8', label: '🟦 Sky Blue' },
    { value: '#a855f7', label: '🟪 Vivid Purple' }
];

function isCustomTextColor(color) {
    if (!color) return false;
    return !standardTextColors.some(c => c.value.toLowerCase() === color.toLowerCase());
}

function isCustomIconColor(color) {
    if (!color || color === 'same_as_text') return false;
    return !standardTextColors.some(c => c.value.toLowerCase() === color.toLowerCase());
}

function resolveIconColorPreview(cfg) {
    if (cfg && cfg.customIconColor && cfg.customIconColor !== 'same_as_text' && cfg.customIconColor.startsWith('#')) {
        return cfg.customIconColor;
    }
    return (cfg && cfg.customTextColor && cfg.customTextColor.startsWith('#')) ? cfg.customTextColor : '#ffffff';
}

function getTextColorSelectOptionsHTML(selectedColor) {
    const curLower = (selectedColor || '#ffffff').toLowerCase();
    let found = false;
    const options = standardTextColors.map(c => {
        const isSel = (c.value.toLowerCase() === curLower);
        if (isSel) found = true;
        return `<option value="${c.value}" ${isSel ? 'selected' : ''}>${c.label}</option>`;
    }).join('');
    const customSel = (!found && selectedColor) ? 'selected' : '';
    return `${options}<option value="custom" ${customSel}>🎨 Custom...</option>`;
}

function getIconColorSelectOptionsHTML(selectedColor) {
    const isSameAsText = (!selectedColor || selectedColor === 'same_as_text');
    const curLower = isSameAsText ? '' : selectedColor.toLowerCase();
    let found = isSameAsText;
    const sameOption = `<option value="same_as_text" ${isSameAsText ? 'selected' : ''}>✨ Same as text</option>`;
    const options = standardTextColors.map(c => {
        const isSel = (!isSameAsText && c.value.toLowerCase() === curLower);
        if (isSel) found = true;
        return `<option value="${c.value}" ${isSel ? 'selected' : ''}>${c.label}</option>`;
    }).join('');
    const customSel = (!found && selectedColor && selectedColor !== 'same_as_text') ? 'selected' : '';
    return `${sameOption}${options}<option value="custom" ${customSel}>🎨 Custom...</option>`;
}

const standardBorderColors = [
    { value: '#ffffff', label: '⬜ Pure White' },
    { value: '#000000', label: '⬛ Pure Black' },
    { value: '#e2e8f0', label: '⬜ Platinum Gray' },
    { value: '#94a3b8', label: '⬜ Slate Gray' },
    { value: '#00f0ff', label: '🟦 Neon Cyan' },
    { value: '#05ffa1', label: '🟩 Spring Green' },
    { value: '#ffe600', label: '🟨 Bright Yellow' },
    { value: '#f39c12', label: '🟧 Amber Orange' },
    { value: '#ff007f', label: '🟪 Neon Pink' },
    { value: '#ff003c', label: '🟥 Crimson Red' },
    { value: '#38bdf8', label: '🟦 Sky Blue' },
    { value: '#a855f7', label: '🟪 Vivid Purple' }
];

function isCustomBorderColor(color) {
    if (!color) return false;
    return !standardBorderColors.some(c => c.value.toLowerCase() === color.toLowerCase());
}

function getBorderColorSelectOptionsHTML(selectedColor) {
    const curLower = (selectedColor || '#ffffff').toLowerCase();
    let found = false;
    const options = standardBorderColors.map(c => {
        const isSel = (c.value.toLowerCase() === curLower);
        if (isSel) found = true;
        return `<option value="${c.value}" ${isSel ? 'selected' : ''}>${c.label}</option>`;
    }).join('');
    const customSel = (!found && selectedColor) ? 'selected' : '';
    return `${options}<option value="custom" ${customSel}>🎨 Custom...</option>`;
}

const standardBgColors = [
    { value: '#0f1115', label: '⬛ Obsidian Dark' },
    { value: '#000000', label: '⬛ Pure OLED Black' },
    { value: '#111827', label: '⬛ Slate Night Dark' },
    { value: '#181a1f', label: '⬛ Charcoal Graphite' },
    { value: '#0b0813', label: '🟪 Cyberpunk Dark' },
    { value: '#1a0826', label: '🟪 Synthwave Dark' },
    { value: '#03140b', label: '🟩 Matrix Terminal' },
    { value: '#060913', label: '🟦 Deep Midnight Navy' },
    { value: '#1e1e2e', label: '🟪 Mocha Dark' },
    { value: '#1e293b', label: '🟦 Steel Navy' },
    { value: '#2b1d0c', label: '🟧 Amber Coffee Dark' },
    { value: '#2a0808', label: '🟥 Crimson Maroon' }
];

function isCustomBgColor(color) {
    if (!color) return false;
    return !standardBgColors.some(c => c.value.toLowerCase() === color.toLowerCase());
}

function getScreenBgSelectOptionsHTML(selectedColor) {
    const curLower = (selectedColor || '#0f1115').toLowerCase();
    let found = false;
    const options = standardBgColors.map(c => {
        const isSel = (c.value.toLowerCase() === curLower);
        if (isSel) found = true;
        return `<option value="${c.value}" ${isSel ? 'selected' : ''}>${c.label}</option>`;
    }).join('');
    const customSel = (!found && selectedColor) ? 'selected' : '';
    return `${options}<option value="custom" ${customSel}>🎨 Custom...</option>`;
}

function getShortcutSelectHTML(key, currentValue) {
    let optionsHTML = `<option value="">-- Select Shortcut --</option>`;
    let found = false;

    shortcutOptions.forEach(grp => {
        optionsHTML += `<optgroup label="${grp.group}">`;
        grp.items.forEach(item => {
            const sel = (item.value.toLowerCase() === (currentValue || '').toLowerCase());
            if (sel) found = true;
            optionsHTML += `<option value="${item.value}" ${sel ? 'selected' : ''}>${item.label}</option>`;
        });
        optionsHTML += `</optgroup>`;
    });

    optionsHTML += `<optgroup label="Custom Keypress">
        <option value="custom" ${!found && currentValue ? 'selected' : ''}>Custom (Press Keys Below)...</option>
    </optgroup>`;

    return optionsHTML;
}

function getMacroShortcutOptionsHTML() {
    let optionsHTML = `<option value="">-- Add Shortcut / Action to Macro --</option>`;
    shortcutOptions.forEach(grp => {
        optionsHTML += `<optgroup label="${grp.group}">`;
        grp.items.forEach(item => {
            optionsHTML += `<option value="${item.value}">${item.label}</option>`;
        });
        if (grp.group === 'Launch Applications & Tools') {
            const customExample = isHostMac ? "RUN open '/Applications/AppName.app'" : "RUN 'C:\\\\path\\\\to\\\\app.exe'";
            optionsHTML += `<option value="${customExample}">Custom App Path (${isHostMac ? "RUN open '/path'" : "RUN 'path'"}...</option>`;
        }
        optionsHTML += `</optgroup>`;
    });
    return optionsHTML;
}

const sectionCollapseState = {
    action: false,
    label: true,
    folder: true,
    color: true,
    border: true
};

function toggleAccordionSection(sectionId) {
    sectionCollapseState[sectionId] = !sectionCollapseState[sectionId];
    const sectionEl = document.getElementById(`accordion-section-${sectionId}`);
    if (sectionEl) {
        sectionEl.classList.toggle('collapsed', sectionCollapseState[sectionId]);
    }
}

function renderFormFields() {
    const container = document.getElementById('settings-fields');
    if (!container) return;
    container.innerHTML = '';

    const key = getActiveButtonKey();
    const cfg = getButtonConfigByKey(key);
    const isSub = !!activeSubPageParent;
    const cardTitle = isSub ? `Sub-Button ${selectedSubButtonIndex} Settings` : `Button ${selectedButtonIndex} Settings`;
    const cardSubtitle = isSub 
        ? `Sub-Menu for Page ${activePage} • Button ${selectedButtonIndex} (Slot ${selectedSubButtonIndex} of 6)`
        : `Slot: Page ${activePage} • Button ${selectedButtonIndex}`;

    const item = document.createElement('div');
    item.className = 'setting-card';
    item.innerHTML = `
        <div class="setting-card-header">
            <h3>${cardTitle}</h3>
            <span class="button-indicator">${cardSubtitle}</span>
        </div>

        <!-- 1. Action & Trigger Section -->
        <div class="config-accordion-section ${sectionCollapseState.action ? 'collapsed' : ''}" id="accordion-section-action">
            <div class="accordion-header" onclick="toggleAccordionSection('action')">
                <div class="accordion-title-group">
                    <span class="material-symbols-outlined section-icon">bolt</span>
                    <span>Action & Trigger</span>
                </div>
                <span class="material-symbols-outlined accordion-chevron">expand_more</span>
            </div>
            <div class="accordion-body">
                <label>Action Type</label>
                <select id="type-${key}" onchange="onTypeChange('${key}')">
                    <option value="url" ${cfg.type === 'url' ? 'selected' : ''}>Web URL</option>
                    <option value="text" ${cfg.type === 'text' ? 'selected' : ''}>Text Snippet</option>
                    <option value="shortcut" ${cfg.type === 'shortcut' ? 'selected' : ''}>System Shortcut</option>
                    <option value="macro" ${cfg.type === 'macro' ? 'selected' : ''}>Macro</option>
                    <option value="toggle" ${cfg.type === 'toggle' ? 'selected' : ''}>🔀 Multi-State Toggle</option>
                    ${!isSub ? `<option value="subpage" ${(cfg.type === 'subpage' || cfg.type === 'folder') ? 'selected' : ''}>📁 Sub-Page</option>` : ''}
                    <option value="clock" ${cfg.type === 'clock' ? 'selected' : ''}>Live Clock</option>
                    <option value="date" ${cfg.type === 'date' ? 'selected' : ''}>Live Date</option>
                    <option value="stopwatch" ${cfg.type === 'stopwatch' ? 'selected' : ''}>Stopwatch</option>
                    <option value="timer" ${cfg.type === 'timer' || cfg.type === 'countdown' ? 'selected' : ''}>Timer</option>
                </select>

                <div id="shortcut-row-${key}" class="shortcut-row ${cfg.type === 'shortcut' ? 'visible' : ''}">
                    <div class="field-col shortcut-field-col">
                        <label>Assigned Shortcut / Hotkey</label>
                        <div class="shortcut-trigger-card" onclick="openShortcutPickerModal('${key}')">
                            <div class="shortcut-trigger-info">
                                <span class="material-symbols-outlined shortcut-trigger-icon">keyboard</span>
                                <div class="shortcut-trigger-text">
                                    <span class="shortcut-trigger-title" id="shortcut-display-title-${key}">${getShortcutDisplayLabel(cfg.value)}</span>
                                    <span class="shortcut-trigger-sub" id="shortcut-display-sub-${key}">${getShortcutDisplaySub(cfg.value)}</span>
                                </div>
                            </div>
                            <button type="button" class="btn shortcut-change-btn">
                                <span class="material-symbols-outlined">tune</span>
                                <span>Choose Shortcut</span>
                            </button>
                        </div>
                        <input type="hidden" id="shortcut-val-${key}" value="${cfg.type === 'shortcut' ? (cfg.value || '') : ''}">
                    </div>
                </div>

                <div id="macro-editor-container-${key}" class="macro-container ${cfg.type === 'macro' ? 'visible' : ''}">
                    <label>Add Preset Shortcut Step</label>
                    <select id="macro-shortcut-select-${key}" onchange="onMacroShortcutSelectChange('${key}')">
                        ${getMacroShortcutOptionsHTML()}
                    </select>

                    <label>Macro Script (Steps run sequentially)</label>
                    <div class="macro-textarea-wrapper">
                        <textarea id="macro-val-${key}" placeholder="Example:&#10;Win+R&#10;DELAY 150&#10;TYPE notepad&#10;DELAY 100&#10;Enter" oninput="saveCurrentFormInputs()">${cfg.type === 'macro' ? (cfg.value || '') : ''}</textarea>
                        <button type="button" class="textarea-clear-btn" title="Clear Script" onclick="clearInput('macro-val-${key}', 'save')">✕</button>
                    </div>
                    <div class="macro-helpers">
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', ${isHostMac ? "'RUN open -a \\'TextEdit\\''" : "'RUN \\'notepad\\''"})">+ RUN 'app'</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', 'DELAY 400')">+ Delay (400ms)</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', 'TYPE \\'text\\'')">+ TYPE 'text'</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', 'Enter')">+ Enter</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', 'Tab')">+ Tab</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', 'Space')">+ Space</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', 'Escape')">+ Escape</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', ${isHostMac ? "'Cmd+N'" : "'Ctrl+N'"})">+ ${isHostMac ? 'Cmd+N' : 'Ctrl+N'}</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', ${isHostMac ? "'Cmd+Space'" : "'Win+R'"})">+ ${isHostMac ? 'Cmd+Space' : 'Win+R'}</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', ${isHostMac ? "'Cmd+C'" : "'Ctrl+C'"})">+ ${isHostMac ? 'Cmd+C' : 'Ctrl+C'}</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', ${isHostMac ? "'Cmd+V'" : "'Ctrl+V'"})">+ ${isHostMac ? 'Cmd+V' : 'Ctrl+V'}</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', 'FnX')">+ FnX</button>
                        <button type="button" class="macro-help-btn" onclick="insertMacroStep('${key}', ${isHostMac ? "'Cmd+FnX'" : "'Ctrl+FnX'"})">+ ${isHostMac ? 'Cmd+FnX' : 'Ctrl+FnX'}</button>
                    </div>
                </div>

                <div id="widget-container-${key}" class="widget-container ${cfg.type === 'clock' || cfg.type === 'date' || cfg.type === 'timer' || cfg.type === 'countdown' ? 'visible' : ''}">
                    <div id="clock-options-${key}" class="${cfg.type === 'clock' ? '' : 'hidden'}">
                        <div class="widget-row">
                            <div class="field-col">
                                <label>Time Format</label>
                                <select id="clock-format-${key}" onchange="saveCurrentFormInputs()">
                                    <option value="12h-sec" ${(cfg.format || '12h-sec') === '12h-sec' ? 'selected' : ''}>12-Hour with Seconds (3:45:00 PM)</option>
                                    <option value="12h" ${cfg.format === '12h' ? 'selected' : ''}>Short 12-Hour (3:45 PM)</option>
                                    <option value="24h-sec" ${cfg.format === '24h-sec' ? 'selected' : ''}>24-Hour with Seconds (15:45:00)</option>
                                    <option value="24h" ${cfg.format === '24h' ? 'selected' : ''}>Short 24-Hour (15:45)</option>
                                    <option value="utc" ${cfg.format === 'utc' ? 'selected' : ''}>UTC Time (15:45:00 UTC)</option>
                                </select>
                            </div>
                            <div class="field-col">
                                <label>Tap Action</label>
                                <select id="clock-action-${key}" onchange="saveCurrentFormInputs()">
                                    <option value="display" ${(cfg.value || 'display') === 'display' ? 'selected' : ''}>Display Only</option>
                                    <option value="type" ${cfg.value === 'type' ? 'selected' : ''}>Type Current Time</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div id="date-options-${key}" class="${cfg.type === 'date' ? '' : 'hidden'}">
                        <div class="widget-row">
                            <div class="field-col">
                                <label>Date Format</label>
                                <select id="date-format-${key}" onchange="saveCurrentFormInputs()">
                                    <option value="standard" ${(cfg.format || 'standard') === 'standard' ? 'selected' : ''}>Standard (Mon, Aug 21)</option>
                                    <option value="full" ${cfg.format === 'full' ? 'selected' : ''}>Full Date (Monday, 21 August 2026)</option>
                                    <option value="uk" ${cfg.format === 'uk' ? 'selected' : ''}>UK / EU (DD/MM/YYYY)</option>
                                    <option value="us" ${cfg.format === 'us' ? 'selected' : ''}>US (MM/DD/YYYY)</option>
                                    <option value="iso" ${cfg.format === 'iso' ? 'selected' : ''}>ISO 8601 (YYYY-MM-DD)</option>
                                    <option value="short" ${cfg.format === 'short' ? 'selected' : ''}>Short (Aug 21)</option>
                                    <option value="day-only" ${cfg.format === 'day-only' ? 'selected' : ''}>Day of Week (Monday)</option>
                                </select>
                            </div>
                            <div class="field-col">
                                <label>Tap Action</label>
                                <select id="date-action-${key}" onchange="saveCurrentFormInputs()">
                                    <option value="display" ${(cfg.value || 'display') === 'display' ? 'selected' : ''}>Display Only</option>
                                    <option value="type" ${cfg.value === 'type' ? 'selected' : ''}>Type Current Date</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div id="timer-options-${key}" class="${cfg.type === 'timer' || cfg.type === 'countdown' ? '' : 'hidden'}">
                        <div class="widget-row timer-widget-row">
                            <div class="field-col timer-duration-col">
                                <label>Countdown Duration</label>
                                <div class="timer-input-group">
                                    <input type="number" id="timer-duration-${key}" class="timer-duration-input" min="1" max="86400" value="${cfg.duration || 300}" placeholder="300" oninput="saveCurrentFormInputs()">
                                    <span class="timer-unit-label">sec</span>
                                </div>
                            </div>
                            <div class="field-col timer-presets-col">
                                <label>Quick Presets</label>
                                <div class="timer-presets-row">
                                    <button type="button" class="timer-preset-chip" onclick="setTimerDurationPreset('${key}', 60)">1m</button>
                                    <button type="button" class="timer-preset-chip" onclick="setTimerDurationPreset('${key}', 180)">3m</button>
                                    <button type="button" class="timer-preset-chip" onclick="setTimerDurationPreset('${key}', 300)">5m</button>
                                    <button type="button" class="timer-preset-chip" onclick="setTimerDurationPreset('${key}', 600)">10m</button>
                                    <button type="button" class="timer-preset-chip" onclick="setTimerDurationPreset('${key}', 900)">15m</button>
                                    <button type="button" class="timer-preset-chip" onclick="setTimerDurationPreset('${key}', 1500)">25m</button>
                                    <button type="button" class="timer-preset-chip" onclick="setTimerDurationPreset('${key}', 1800)">30m</button>
                                    <button type="button" class="timer-preset-chip" onclick="setTimerDurationPreset('${key}', 3600)">1h</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="single-val-container-${key}" class="single-val-container ${cfg.type === 'url' || cfg.type === 'text' ? 'visible' : ''}">
                    <label id="val-label-${key}">${cfg.type === 'text' ? 'Text Snippet' : 'Web URL'}</label>
                    <div class="input-clear-wrapper">
                        <input type="text" id="val-${key}" value="${cfg.value || ''}" placeholder="${cfg.type === 'text' ? 'Text snippet...' : 'https://...'}" oninput="saveCurrentFormInputs()">
                        <button type="button" class="input-clear-btn" title="Clear" onclick="clearInput('val-${key}', 'save')">✕</button>
                    </div>
                </div>

                <div id="toggle-editor-container-${key}" class="toggle-container ${cfg.type === 'toggle' ? 'visible' : ''}">
                    <div class="toggle-header-row">
                        <div class="toggle-segmented-control">
                            <button type="button" class="toggle-state-tab-btn ${currentToggleEditTab === 'A' ? 'active' : ''}" id="toggle-tab-a-${key}" onclick="switchToggleEditTab('${key}', 'A')">
                                <span class="toggle-state-badge state-a">A</span> State A (Default)
                            </button>
                            <button type="button" class="toggle-state-tab-btn ${currentToggleEditTab === 'B' ? 'active' : ''}" id="toggle-tab-b-${key}" onclick="switchToggleEditTab('${key}', 'B')">
                                <span class="toggle-state-badge state-b">B</span> State B (Active)
                            </button>
                        </div>
                        <button type="button" class="toggle-test-btn" onclick="toggleButtonPreviewState('${key}')" title="Simulate tapping this toggle button">
                            <span class="material-symbols-outlined">sync_alt</span>
                            <span>Test Toggle (Now: ${(cfg.toggleState === 1) ? 'B' : 'A'})</span>
                        </button>
                    </div>

                    <div class="field-col">
                        <label>Quick Toggle Preset</label>
                        <select id="toggle-preset-${key}" onchange="applyTogglePreset('${key}', this.value)">
                            <option value="">Choose a Preset...</option>
                            <option value="mic">🎙️ Microphone (Muted ⇄ Active)</option>
                            <option value="media">⏯️ Media Player (Play ⇄ Pause)</option>
                            <option value="obs">🔴 Stream/OBS (Rec Off ⇄ Recording)</option>
                            <option value="theme">🌓 Dark / Light Theme</option>
                            <option value="volume">🔊 Audio Volume (Muted ⇄ Unmuted)</option>
                        </select>
                    </div>

                    <!-- State A Panel -->
                    <div class="toggle-state-panel ${currentToggleEditTab === 'A' ? '' : 'hidden'}" id="toggle-panel-a-${key}">
                        <div class="label-icon-row">
                            <div>
                                <label>State A Label</label>
                                <input type="text" id="toggle-label-a-${key}" value="${(cfg.stateA ? cfg.stateA.label : cfg.label) || '[mic_off] Muted'}" placeholder="[mic_off] Muted" oninput="saveCurrentFormInputs()">
                            </div>
                            <div>
                                <label>Button Color</label>
                                <div class="color-picker-wrapper">
                                    <input type="color" id="toggle-color-a-${key}" value="${(cfg.stateA ? cfg.stateA.color : cfg.color) || '#e74c3c'}" oninput="saveCurrentFormInputs()">
                                </div>
                            </div>
                            <div>
                                <label>Text Color</label>
                                <div class="color-picker-wrapper">
                                    <input type="color" id="toggle-textcolor-a-${key}" value="${(cfg.stateA ? cfg.stateA.textColor : cfg.textColor) || '#ffffff'}" oninput="saveCurrentFormInputs()">
                                </div>
                            </div>
                        </div>
                        <div class="field-col">
                            <label>State A Action Type</label>
                            <select id="toggle-action-type-a-${key}" onchange="onToggleActionTypeChange('${key}', 'A')">
                                <option value="shortcut" ${((cfg.stateA ? cfg.stateA.actionType : 'shortcut') || 'shortcut') === 'shortcut' ? 'selected' : ''}>System Shortcut</option>
                                <option value="macro" ${(cfg.stateA ? cfg.stateA.actionType : '') === 'macro' ? 'selected' : ''}>Macro Script</option>
                                <option value="text" ${(cfg.stateA ? cfg.stateA.actionType : '') === 'text' ? 'selected' : ''}>Text Snippet</option>
                                <option value="url" ${(cfg.stateA ? cfg.stateA.actionType : '') === 'url' ? 'selected' : ''}>Web URL</option>
                            </select>
                        </div>
                        <div id="toggle-action-val-row-a-${key}">
                            <label>State A Action Value / Shortcut</label>
                            <input type="text" id="toggle-val-a-${key}" value="${(cfg.stateA ? cfg.stateA.value : cfg.value) || 'Ctrl+Shift+M'}" placeholder="Ctrl+Shift+M or text..." oninput="saveCurrentFormInputs()">
                        </div>
                    </div>

                    <!-- State B Panel -->
                    <div class="toggle-state-panel ${currentToggleEditTab === 'B' ? '' : 'hidden'}" id="toggle-panel-b-${key}">
                        <div class="label-icon-row">
                            <div>
                                <label>State B Label</label>
                                <input type="text" id="toggle-label-b-${key}" value="${(cfg.stateB ? cfg.stateB.label : '') || '[mic] Active'}" placeholder="[mic] Active" oninput="saveCurrentFormInputs()">
                            </div>
                            <div>
                                <label>Button Color</label>
                                <div class="color-picker-wrapper">
                                    <input type="color" id="toggle-color-b-${key}" value="${(cfg.stateB ? cfg.stateB.color : '') || '#27ae60'}" oninput="saveCurrentFormInputs()">
                                </div>
                            </div>
                            <div>
                                <label>Text Color</label>
                                <div class="color-picker-wrapper">
                                    <input type="color" id="toggle-textcolor-b-${key}" value="${(cfg.stateB ? cfg.stateB.textColor : '') || '#ffffff'}" oninput="saveCurrentFormInputs()">
                                </div>
                            </div>
                        </div>
                        <div class="field-col">
                            <label>State B Action Type</label>
                            <select id="toggle-action-type-b-${key}" onchange="onToggleActionTypeChange('${key}', 'B')">
                                <option value="shortcut" ${((cfg.stateB ? cfg.stateB.actionType : 'shortcut') || 'shortcut') === 'shortcut' ? 'selected' : ''}>System Shortcut</option>
                                <option value="macro" ${(cfg.stateB ? cfg.stateB.actionType : '') === 'macro' ? 'selected' : ''}>Macro Script</option>
                                <option value="text" ${(cfg.stateB ? cfg.stateB.actionType : '') === 'text' ? 'selected' : ''}>Text Snippet</option>
                                <option value="url" ${(cfg.stateB ? cfg.stateB.actionType : '') === 'url' ? 'selected' : ''}>Web URL</option>
                            </select>
                        </div>
                        <div id="toggle-action-val-row-b-${key}">
                            <label>State B Action Value / Shortcut</label>
                            <input type="text" id="toggle-val-b-${key}" value="${(cfg.stateB ? cfg.stateB.value : '') || 'Ctrl+Shift+M'}" placeholder="Ctrl+Shift+M or text..." oninput="saveCurrentFormInputs()">
                        </div>
                    </div>
                </div>

                <div class="section-undo-row">
                    <button type="button" class="btn-batch-style btn-section-undo" title="Undo Action & Trigger changes (revert to last save)" onclick="undoSectionChanges('action')">
                        <span class="material-symbols-outlined batch-icon">undo</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 2. Label & Iconography Section -->
        <div class="config-accordion-section ${sectionCollapseState.label ? 'collapsed' : ''}" id="accordion-section-label">
            <div class="accordion-header" onclick="toggleAccordionSection('label')">
                <div class="accordion-title-group">
                    <span class="material-symbols-outlined section-icon">title</span>
                    <span>Label & Iconography</span>
                </div>
                <span class="material-symbols-outlined accordion-chevron">expand_more</span>
            </div>
            <div class="accordion-body">
                <div class="label-icon-row">
                    <div class="field-col">
                        <label>Button Text Label</label>
                        <div class="input-clear-wrapper">
                            <input type="text" id="label-${key}" value="${cfg.label || ''}" placeholder="e.g. Select All" oninput="onInputChange('${key}')">
                            <button type="button" class="input-clear-btn" title="Clear" onclick="clearInput('label-${key}', 'onInputChange', '${key}')">✕</button>
                        </div>
                    </div>
                    <div class="field-col">
                        <label>Material Vector Icon</label>
                        <div class="material-icon-control-row">
                            <button type="button" class="pick-material-icon-btn" onclick="openIconPickerModal('${key}')">
                                <span class="material-symbols-outlined">${cfg.materialIcon || 'add_circle'}</span>
                                <span>${cfg.materialIcon || 'Choose Icon...'}</span>
                            </button>
                            <button type="button" class="remove-material-icon-btn ${cfg.materialIcon ? 'visible' : ''}" id="remove-mat-icon-${key}" title="Remove Material Icon" onclick="removeMaterialIcon('${key}')">
                                <span class="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    </div>
                    <div class="field-col">
                        <label>Font Size</label>
                        <select id="font-size-select-${key}" onchange="onFontSizeSelectChange('${key}')">
                            <option value="28" ${cfg.fontSize == 28 ? 'selected' : ''}>Extra Small</option>
                            <option value="36" ${cfg.fontSize == 36 ? 'selected' : ''}>Small</option>
                            <option value="44" ${cfg.fontSize == 44 ? 'selected' : ''}>Medium-Small</option>
                            <option value="52" ${cfg.fontSize == 52 ? 'selected' : ''}>Medium</option>
                            <option value="60" ${cfg.fontSize == 60 ? 'selected' : ''}>Standard</option>
                            <option value="default" ${!cfg.fontSize || cfg.fontSize === 'default' || cfg.fontSize == 68 ? 'selected' : ''}>Normal (Default)</option>
                            <option value="76" ${cfg.fontSize == 76 ? 'selected' : ''}>Large</option>
                            <option value="84" ${cfg.fontSize == 84 ? 'selected' : ''}>Extra Large</option>
                            <option value="96" ${cfg.fontSize == 96 ? 'selected' : ''}>Huge</option>
                            <option value="112" ${cfg.fontSize == 112 ? 'selected' : ''}>Max</option>
                            ${cfg.fontSize && ![28,36,44,52,60,68,76,84,96,112].includes(Number(cfg.fontSize)) ? `<option value="${cfg.fontSize}" selected>${cfg.fontSize}px (Custom)</option>` : ''}
                        </select>
                    </div>
                </div>

                <div class="color-icon-row">
                    <div class="field-col">
                        <label>Custom Image File</label>
                        <div class="icon-controls">
                            <button type="button" class="icon-btn select-img" onclick="chooseImage('${key}')"><span class="material-symbols-outlined">folder_open</span> Browse...</button>
                            <input type="text" class="image-name-input" id="img-name-${key}" value="${getImageNameDisplay(cfg)}" placeholder="No image loaded" readonly title="${getImageNameDisplay(cfg)}">
                            <button type="button" class="icon-btn remove-img ${cfg.icon ? 'visible' : ''}" id="remove-img-${key}" title="Remove Image" 
                                onclick="removeImage('${key}')"><span class="material-symbols-outlined">close</span></button>
                        </div>
                    </div>
                    <div class="field-col icon-fit-row ${cfg.icon ? 'visible' : ''}" id="icon-fit-row-${key}">
                        <label>Image Display Style</label>
                        <select id="icon-fit-${key}" onchange="onIconFitChange('${key}')">
                            <option value="contain" ${(cfg.iconFit || 'contain') === 'contain' ? 'selected' : ''}>Fit Icon (Proportional)</option>
                            <option value="cover" ${cfg.iconFit === 'cover' ? 'selected' : ''}>Fill Button (Edge-to-Edge)</option>
                        </select>
                    </div>
                </div>

                <div class="section-undo-row">
                    <button type="button" class="btn-batch-style btn-section-undo" title="Undo Label & Iconography changes (revert to last save)" onclick="undoSectionChanges('label')">
                        <span class="material-symbols-outlined batch-icon">undo</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 3. Appearance & Colors Section -->
        <div class="config-accordion-section ${sectionCollapseState.color ? 'collapsed' : ''}" id="accordion-section-color">
            <div class="accordion-header" onclick="toggleAccordionSection('color')">
                <div class="accordion-title-group">
                    <span class="material-symbols-outlined section-icon">palette</span>
                    <span>Appearance & Colors</span>
                </div>
                <span class="material-symbols-outlined accordion-chevron">expand_more</span>
            </div>
            <div class="accordion-body">
                <div class="custom-color-grid">
                    <div class="field-col">
                        <label>Button Color Theme</label>
                        <div class="color-picker-wrapper">
                            <span class="color-chip-preview ${cfg.color === 'custom' ? 'c-custom' : ''} ${cfg.color === 'transparent' ? 'c-transparent' : ''}" id="color-chip-${key}" style="${cfg.color === 'custom' ? `--chip-custom-bg: ${getCustomBackgroundCSS(cfg)};` : (cfg.color && cfg.color.startsWith('#') ? `background: ${cfg.color};` : (cfg.color === 'transparent' ? 'background: transparent;' : ''))}"></span>
                            <select id="color-${key}" onchange="onColorChange('${key}')">
                                ${getColorSelectOptionsHTML(cfg.color || '#4b5563', currentConfig._theme || 'default')}
                            </select>
                        </div>
                    </div>
                    <div class="field-col">
                        <label>Button Text Color</label>
                        <div class="color-picker-wrapper text-color-wrapper">
                            <span class="color-chip-preview text-chip" id="text-color-chip-${key}" style="--chip-text-color: ${cfg.customTextColor || '#ffffff'};" onclick="openTextColorPicker('${key}')" title="Click to choose custom color"></span>
                            <select id="text-color-select-${key}" onchange="onTextColorSelectChange('${key}')">
                                ${getTextColorSelectOptionsHTML(cfg.customTextColor || '#ffffff')}
                            </select>
                            <div class="custom-text-color-inline ${isCustomTextColor(cfg.customTextColor || '#ffffff') ? 'visible' : ''}" id="custom-text-color-row-${key}">
                                <input type="color" class="color-picker-input" id="custom-text-picker-${key}" value="${cfg.customTextColor || '#ffffff'}" oninput="onCustomTextInputChange('${key}', this.value)" title="Choose custom color">
                                <input type="text" class="color-text-input text-color-hex-input" id="custom-text-val-${key}" value="${cfg.customTextColor || '#ffffff'}" oninput="onCustomTextInputChange('${key}', this.value)" placeholder="#HEX">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="custom-color-grid" style="margin-top: 10px;">
                    <div class="field-col">
                        <label>Button Icon Color</label>
                        <div class="color-picker-wrapper text-color-wrapper">
                            <span class="color-chip-preview text-chip" id="icon-color-chip-${key}" style="--chip-text-color: ${resolveIconColorPreview(cfg)};" onclick="openIconColorPicker('${key}')" title="Click to choose custom color"></span>
                            <select id="icon-color-select-${key}" onchange="onIconColorSelectChange('${key}')">
                                ${getIconColorSelectOptionsHTML(cfg.customIconColor || 'same_as_text')}
                            </select>
                            <div class="custom-text-color-inline ${isCustomIconColor(cfg.customIconColor) ? 'visible' : ''}" id="custom-icon-color-row-${key}">
                                <input type="color" class="color-picker-input" id="custom-icon-picker-${key}" value="${cfg.customIconColor && cfg.customIconColor.startsWith('#') ? cfg.customIconColor : (cfg.customTextColor || '#ffffff')}" oninput="onCustomIconInputChange('${key}', this.value)" title="Choose custom color">
                                <input type="text" class="color-text-input text-color-hex-input" id="custom-icon-val-${key}" value="${cfg.customIconColor && cfg.customIconColor.startsWith('#') ? cfg.customIconColor : (cfg.customTextColor || '#ffffff')}" oninput="onCustomIconInputChange('${key}', this.value)" placeholder="#HEX">
                            </div>
                        </div>
                    </div>
                    <div class="field-col">
                        <label>Corner Radius</label>
                        <select id="border-radius-${key}" onchange="onBorderRadiusChange('${key}')">
                            <option value="0" ${cfg.borderRadius === 0 ? 'selected' : ''}>Sharp</option>
                            <option value="8" ${cfg.borderRadius == 8 ? 'selected' : ''}>Subtle</option>
                            <option value="16" ${cfg.borderRadius == 16 ? 'selected' : ''}>Rounded</option>
                            <option value="24" ${(!cfg.borderRadius || cfg.borderRadius === 'default' || cfg.borderRadius == 24 || cfg.borderRadius == 20) ? 'selected' : ''}>Classic (Default)</option>
                            <option value="36" ${cfg.borderRadius == 36 ? 'selected' : ''}>Curved</option>
                            <option value="48" ${cfg.borderRadius == 48 ? 'selected' : ''}>Large</option>
                            <option value="64" ${cfg.borderRadius == 64 ? 'selected' : ''}>Extra Large</option>
                            <option value="80" ${cfg.borderRadius == 80 ? 'selected' : ''}>Pill</option>
                            <option value="120" ${cfg.borderRadius == 120 ? 'selected' : ''}>Full Oval</option>
                        </select>
                    </div>
                </div>

                <div class="custom-color-panel ${cfg.color === 'custom' ? 'visible' : ''}" id="custom-color-panel-${key}">
                    <div class="custom-color-grid">
                        <div class="field-col">
                            <label>Color Style</label>
                            <select id="custom-type-${key}" onchange="onCustomColorTypeChange('${key}')">
                                <option value="vertical" ${((cfg.customColorType || 'linear') !== 'solid' && (cfg.customAngle !== 90)) ? 'selected' : ''}>Vertical Gradient (Top to Bottom)</option>
                                <option value="horizontal" ${((cfg.customColorType || 'linear') !== 'solid' && cfg.customAngle == 90) ? 'selected' : ''}>Horizontal Gradient (Left to Right)</option>
                                <option value="solid" ${cfg.customColorType === 'solid' ? 'selected' : ''}>Solid Color</option>
                            </select>
                        </div>
                    </div>

                    <div class="custom-color-grid gradient-pair-grid ${(cfg.customColorType || 'linear') === 'solid' ? 'solid-mode' : ''}" id="gradient-pair-grid-${key}">
                        <div class="field-col">
                            <label id="custom-color1-label-${key}">${(cfg.customColorType || 'linear') === 'solid' ? 'Button Color' : 'Start Color'}</label>
                            <div class="color-input-group">
                                <input type="color" class="color-picker-input" id="custom-color1-picker-${key}" value="${cfg.customColor1 || '#2980b9'}" oninput="onCustomColor1InputChange('${key}', this.value)">
                                <input type="text" class="color-text-input" id="custom-color1-val-${key}" value="${cfg.customColor1 || '#2980b9'}" oninput="onCustomColor1InputChange('${key}', this.value)">
                            </div>
                        </div>
                        <div class="color-swap-col" id="custom-color-swap-col-${key}" style="${(cfg.customColorType || 'linear') === 'solid' ? 'display: none;' : ''}">
                            <button type="button" class="color-swap-btn" title="Swap Start & End Colors" onclick="swapCustomGradientColors('${key}')">
                                <span class="material-symbols-outlined">swap_horiz</span>
                            </button>
                        </div>
                        <div class="field-col" id="custom-color2-group-${key}" style="${(cfg.customColorType || 'linear') === 'solid' ? 'display: none;' : ''}">
                            <label>End Color</label>
                            <div class="color-input-group">
                                <input type="color" class="color-picker-input" id="custom-color2-picker-${key}" value="${cfg.customColor2 || '#2573a7'}" oninput="onCustomColor2InputChange('${key}', this.value)">
                                <input type="text" class="color-text-input" id="custom-color2-val-${key}" value="${cfg.customColor2 || '#2573a7'}" oninput="onCustomColor2InputChange('${key}', this.value)">
                            </div>
                        </div>
                    </div>

                    <div class="gradient-presets-container">
                        <label>Quick Palette Presets</label>
                        <div class="gradient-presets-row" id="gradient-presets-row-${key}">
                            ${renderCustomColorPresetsHTML(key, (cfg.customColorType || 'linear') === 'solid' ? 'solid' : 'linear')}
                        </div>
                    </div>
                </div>

                <div class="style-batch-actions">
                    <button type="button" class="btn-batch-style" title="Apply color theme and custom gradient settings to all buttons on Page ${activePage}" onclick="applySectionToPage('color')">
                        <span class="material-symbols-outlined batch-icon">content_copy</span> Apply to Page ${activePage}
                    </button>
                    <button type="button" class="btn-batch-style" title="Apply color theme and custom gradient settings to all buttons across every page" onclick="applySectionToAllPages('color')">
                        <span class="material-symbols-outlined batch-icon">auto_awesome_motion</span> Apply to All Pages
                    </button>
                    <button type="button" class="btn-batch-style btn-section-undo" title="Undo Appearance & Color changes (revert to last save)" onclick="undoSectionChanges('color')">
                        <span class="material-symbols-outlined batch-icon">undo</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 4. Border Framing Section -->
        <div class="config-accordion-section ${sectionCollapseState.border ? 'collapsed' : ''}" id="accordion-section-border">
            <div class="accordion-header" onclick="toggleAccordionSection('border')">
                <div class="accordion-title-group">
                    <span class="material-symbols-outlined section-icon">border_style</span>
                    <span>Border Framing</span>
                </div>
                <span class="material-symbols-outlined accordion-chevron">expand_more</span>
            </div>
            <div class="accordion-body">
                <div class="border-controls-grid">
                    <div class="field-col">
                        <label>Border Style</label>
                        <select id="border-style-${key}" onchange="onBorderStyleChange('${key}')">
                            <option value="none" ${(!cfg.borderStyle || cfg.borderStyle === 'none') ? 'selected' : ''}>None (Default)</option>
                            <option value="solid" ${cfg.borderStyle === 'solid' ? 'selected' : ''}>Solid</option>
                            <option value="dashed" ${cfg.borderStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                            <option value="dotted" ${cfg.borderStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
                            <option value="double" ${cfg.borderStyle === 'double' ? 'selected' : ''}>Double</option>
                            <option value="brackets" ${cfg.borderStyle === 'brackets' ? 'selected' : ''}>Corner Brackets (Reticle)</option>
                            <option value="glow" ${cfg.borderStyle === 'glow' ? 'selected' : ''}>Neon Glow</option>
                        </select>
                    </div>
                    <div class="field-col" id="border-width-col-${key}" style="${(!cfg.borderStyle || cfg.borderStyle === 'none') ? 'display: none;' : ''}">
                        <label>Border Width</label>
                        <select id="border-width-${key}" onchange="onBorderWidthChange('${key}')">
                            <option value="1" ${cfg.borderWidth == 1 ? 'selected' : ''}>1px</option>
                            <option value="2" ${(!cfg.borderWidth || cfg.borderWidth == 2) ? 'selected' : ''}>2px</option>
                            <option value="3" ${cfg.borderWidth == 3 ? 'selected' : ''}>3px</option>
                            <option value="4" ${cfg.borderWidth == 4 ? 'selected' : ''}>4px</option>
                            <option value="6" ${cfg.borderWidth == 6 ? 'selected' : ''}>6px</option>
                            <option value="8" ${cfg.borderWidth == 8 ? 'selected' : ''}>8px</option>
                        </select>
                    </div>
                    <div class="field-col" id="border-color-col-${key}" style="${(!cfg.borderStyle || cfg.borderStyle === 'none') ? 'display: none;' : ''}">
                        <label>Border Color</label>
                        <div class="color-picker-wrapper border-color-wrapper">
                            <select id="border-color-select-${key}" onchange="onBorderColorSelectChange('${key}')">
                                ${getBorderColorSelectOptionsHTML(cfg.borderColor || '#ffffff')}
                            </select>
                            <div class="custom-border-color-inline ${isCustomBorderColor(cfg.borderColor || '#ffffff') ? 'visible' : ''}" id="custom-border-color-row-${key}">
                                <input type="color" class="color-picker-input" id="border-color-picker-${key}" value="${cfg.borderColor || '#ffffff'}" oninput="onBorderColorInputChange('${key}', this.value)" title="Choose custom border color">
                                <input type="text" class="color-text-input border-color-hex-input" id="border-color-val-${key}" value="${cfg.borderColor || '#ffffff'}" oninput="onBorderColorInputChange('${key}', this.value)" placeholder="#HEX">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="dash-spacing-row ${cfg.borderStyle === 'dashed' ? 'visible' : ''}" id="dash-spacing-row-${key}">
                    <div class="field-col">
                        <label>Dash Preset</label>
                        <select id="dash-preset-${key}" onchange="onDashPresetChange('${key}')">
                            <option value="tight" ${(cfg.borderDashGap == 4) ? 'selected' : ''}>Tight (4px gap)</option>
                            <option value="standard" ${(!cfg.borderDashGap || cfg.borderDashGap == 8) ? 'selected' : ''}>Standard (8px gap)</option>
                            <option value="wide" ${(cfg.borderDashGap == 14) ? 'selected' : ''}>Wide (14px gap)</option>
                            <option value="sparse" ${(cfg.borderDashGap == 24) ? 'selected' : ''}>Sparse (24px gap)</option>
                            <option value="brackets" ${(cfg.borderDashGap == 90) ? 'selected' : ''}>Corner Brackets / Simple Theme (90px gap)</option>
                            <option value="custom" ${![4,8,14,24,90].includes(Number(cfg.borderDashGap || 8)) ? 'selected' : ''}>Custom Gap</option>
                        </select>
                    </div>
                    <div class="dash-slider-group">
                        <div class="dash-slider-header">
                            <label>Dash Spacing (Gap)</label>
                            <span id="dash-gap-val-${key}">${cfg.borderDashGap !== undefined ? cfg.borderDashGap : 8}px</span>
                        </div>
                        <input type="range" min="2" max="120" step="2" value="${cfg.borderDashGap !== undefined ? cfg.borderDashGap : 8}" id="dash-gap-slider-${key}" oninput="onDashGapSliderChange('${key}', this.value)">
                    </div>
                </div>

                <div class="bracket-length-row ${cfg.borderStyle === 'brackets' ? 'visible' : ''}" id="bracket-length-row-${key}">
                    <div class="field-col">
                        <label>Bracket Length</label>
                        <select id="bracket-preset-${key}" onchange="onBracketPresetChange('${key}')">
                            <option value="20" ${(cfg.borderBracketLength == 20) ? 'selected' : ''}>Compact (20%)</option>
                            <option value="30" ${(cfg.borderBracketLength == 30) ? 'selected' : ''}>Standard (30%)</option>
                            <option value="35" ${(!cfg.borderBracketLength || cfg.borderBracketLength == 35) ? 'selected' : ''}>Simple Theme (35%)</option>
                            <option value="40" ${(cfg.borderBracketLength == 40) ? 'selected' : ''}>Extended (40%)</option>
                            <option value="custom" ${![20,30,35,40].includes(Number(cfg.borderBracketLength || 35)) ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div class="dash-slider-group">
                        <div class="dash-slider-header">
                            <label>Arm Coverage</label>
                            <span id="bracket-len-val-${key}">${cfg.borderBracketLength !== undefined ? cfg.borderBracketLength : 35}%</span>
                        </div>
                        <input type="range" min="15" max="45" step="1" value="${cfg.borderBracketLength !== undefined ? cfg.borderBracketLength : 35}" id="bracket-len-slider-${key}" oninput="onBracketSliderChange('${key}', this.value)">
                    </div>
                </div>

                <div class="style-batch-actions">
                    <button type="button" class="btn-batch-style" title="Apply border and corner framing to all buttons on Page ${activePage}" onclick="applySectionToPage('border')">
                        <span class="material-symbols-outlined batch-icon">content_copy</span> Apply to Page ${activePage}
                    </button>
                    <button type="button" class="btn-batch-style" title="Apply border and corner framing to all buttons across every page" onclick="applySectionToAllPages('border')">
                        <span class="material-symbols-outlined batch-icon">auto_awesome_motion</span> Apply to All Pages
                    </button>
                    <button type="button" class="btn-batch-style btn-section-undo" title="Undo Border & Framing changes (revert to last save)" onclick="undoSectionChanges('border')">
                        <span class="material-symbols-outlined batch-icon">undo</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    container.appendChild(item);
    initCustomSelects(container);
}

function clearInput(elementId, action, key) {
    const el = document.getElementById(elementId);
    if (el) {
        el.value = '';
        el.focus();
        if (action === 'onPageNameChange') {
            onPageNameChange();
        } else if (action === 'onInputChange' && key) {
            onInputChange(key);
        } else {
            saveCurrentFormInputs();
        }
        markUnsaved();
    }
}

async function chooseImage(key) {
    try {
        if (window.api && window.api.selectImage) {
            const res = await window.api.selectImage();
            if (res && res.dataUrl) {
                applyImage(key, res.dataUrl, res.fileName);
                return;
            }
        }
    } catch (err) {
        console.warn('Native dialog error, falling back to input file:', err);
    }

    // Browser file input fallback
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                applyImage(key, evt.target.result, file.name);
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

function resizeImageToCanvas(src, maxW = 242, maxH = 186) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            if (w > maxW || h > maxH) {
                const aspect = w / h;
                if (w > maxW) {
                    w = maxW;
                    h = Math.round(w / aspect);
                }
                if (h > maxH) {
                    h = maxH;
                    w = Math.round(h * aspect);
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
}

function getImageNameDisplay(cfg) {
    if (!cfg || !cfg.icon || !isImageFile(cfg.icon)) return '';
    if (cfg.iconOriginalName) return cfg.iconOriginalName;
    if (typeof cfg.icon === 'string') {
        if (cfg.icon.startsWith('data:')) {
            return 'Custom Image (Loaded)';
        }
        return cfg.icon.replace(/^assets\//, '');
    }
    return 'Custom Image';
}

async function applyImage(key, pathOrDataUrl, originalFileName) {
    const target = getButtonConfigByKey(key);
    delete target.materialIcon;
    const optimized = await resizeImageToCanvas(pathOrDataUrl);
    target.icon = optimized;
    const displayName = originalFileName || 'Custom Image';
    target.iconOriginalName = displayName;
    const nameInput = document.getElementById(`img-name-${key}`);
    if (nameInput) {
        nameInput.value = displayName;
        nameInput.title = displayName;
    }
    const removeBtn = document.getElementById(`remove-img-${key}`);
    if (removeBtn) removeBtn.classList.add('visible');
    const fitRow = document.getElementById(`icon-fit-row-${key}`);
    if (fitRow) fitRow.classList.add('visible');
    renderPreview();
    saveCurrentFormInputs();
    markUnsaved();
}

function removeImage(key) {
    const target = getButtonConfigByKey(key);
    delete target.icon;
    delete target.iconOriginalName;
    const nameInput = document.getElementById(`img-name-${key}`);
    if (nameInput) {
        nameInput.value = '';
        nameInput.title = '';
    }
    const removeBtn = document.getElementById(`remove-img-${key}`);
    if (removeBtn) removeBtn.classList.remove('visible');
    const fitRow = document.getElementById(`icon-fit-row-${key}`);
    if (fitRow) fitRow.classList.remove('visible');
    renderPreview();
    saveCurrentFormInputs();
    markUnsaved();
}

function onIconFitChange(key) {
    const fitEl = document.getElementById(`icon-fit-${key}`);
    if (fitEl) {
        const target = getButtonConfigByKey(key);
        target.iconFit = fitEl.value;
        renderPreview();
        saveCurrentFormInputs();
    }
}

function insertEmoji(key, emoji) {
    const labelInput = document.getElementById(`label-${key}`);
    if (labelInput) {
        if (!labelInput.value.includes(emoji)) {
            labelInput.value = `${labelInput.value} ${emoji}`.trim();
        }
        onInputChange(key);
    }
}

function onEmojiSelectChange(key) {
    const selectEl = document.getElementById(`emoji-select-${key}`);
    if (selectEl && selectEl.value) {
        insertEmoji(key, selectEl.value);
        selectEl.selectedIndex = 0;
    }
}

function onShortcutSelectChange(key) {
    const selectEl = document.getElementById(`shortcut-select-${key}`);
    const valEl = document.getElementById(`shortcut-val-${key}`);
    const labelEl = document.getElementById(`label-${key}`);

    if (selectEl && valEl) {
        if (selectEl.value && selectEl.value !== 'custom') {
            valEl.value = selectEl.value;

            const selectedText = selectEl.options[selectEl.selectedIndex]?.text || '';
            const cleanName = selectedText.replace(/\s*\([^)]*\)/, '').trim();

            if (labelEl && cleanName && cleanName !== '-- Select Shortcut --') {
                labelEl.value = cleanName;
                if (!currentConfig[key]) {
                    currentConfig[key] = { ...(defaultConfig[key] || { color: '#4b5563' }) };
                }
                currentConfig[key].label = cleanName;
                renderPreview();
            }
        }
    }
    saveCurrentFormInputs();
}

function onTypeChange(key) {
    const typeEl = document.getElementById(`type-${key}`);
    const shortcutRow = document.getElementById(`shortcut-row-${key}`);
    const macroContainer = document.getElementById(`macro-editor-container-${key}`);
    const widgetContainer = document.getElementById(`widget-container-${key}`);
    const clockOptions = document.getElementById(`clock-options-${key}`);
    const dateOptions = document.getElementById(`date-options-${key}`);
    const timerOptions = document.getElementById(`timer-options-${key}`);
    const singleValContainer = document.getElementById(`single-val-container-${key}`);
    const valEl = document.getElementById(`val-${key}`);
    const valLabel = document.getElementById(`val-label-${key}`);
    const labelInput = document.getElementById(`label-${key}`);

    if (typeEl) {
        const type = typeEl.value;
        const toggleContainer = document.getElementById(`toggle-editor-container-${key}`);
        if (shortcutRow) shortcutRow.classList.toggle('visible', type === 'shortcut');
        if (macroContainer) macroContainer.classList.toggle('visible', type === 'macro');
        if (toggleContainer) toggleContainer.classList.toggle('visible', type === 'toggle');
        if (widgetContainer) widgetContainer.classList.toggle('visible', type === 'clock' || type === 'date' || type === 'timer' || type === 'countdown');
        if (clockOptions) clockOptions.classList.toggle('hidden', type !== 'clock');
        if (dateOptions) dateOptions.classList.toggle('hidden', type !== 'date');
        if (timerOptions) timerOptions.classList.toggle('hidden', type !== 'timer' && type !== 'countdown');
        if (singleValContainer) singleValContainer.classList.toggle('visible', type === 'url' || type === 'text');

        if (type === 'toggle') {
            const target = getButtonConfigByKey(key);
            if (!target.stateA) {
                target.stateA = { label: target.label || '[mic_off] Muted', actionType: 'shortcut', value: target.value || 'Ctrl+Shift+M', color: target.color || '#e74c3c', textColor: target.textColor || '#ffffff' };
            }
            if (!target.stateB) {
                target.stateB = { label: '[mic] Active', actionType: 'shortcut', value: target.value || 'Ctrl+Shift+M', color: '#27ae60', textColor: '#ffffff' };
            }
            if (target.toggleState === undefined) target.toggleState = 0;
            const activeDef = target.toggleState === 1 ? target.stateB : target.stateA;
            target.label = activeDef.label;
            target.color = activeDef.color;
            target.customColor1 = activeDef.color;
            target.textColor = activeDef.textColor;
            target.customTextColor = activeDef.textColor;
            target.value = activeDef.value;
        }

        if (type === 'subpage' || type === 'folder') {
            if (labelInput && (!labelInput.value || labelInput.value.startsWith('Button '))) labelInput.value = 'Sub-Page';
            const target = getButtonConfigByKey(key);
            if (!target.sub_buttons || target.sub_buttons.length < 6) {
                if (!target.sub_buttons) target.sub_buttons = target.children ? [...target.children] : [];
                while (target.sub_buttons.length < 6) {
                    const idx = target.sub_buttons.length + 1;
                    target.sub_buttons.push({
                        id: idx * 100 + (selectedButtonIndex || 1),
                        label: `Sub ${idx}`,
                        type: 'shortcut',
                        value: '',
                        payload: '',
                        color: '#4b5563'
                    });
                }
            }
        } else {
            const target = getButtonConfigByKey(key);
            delete target.sub_buttons;
            delete target.children;
        }

        if (type === 'url') {
            if (valLabel) valLabel.textContent = 'Web URL';
            if (valEl) {
                valEl.placeholder = 'https://...';
                if (!valEl.value || valEl.value.trim() === '') {
                    valEl.value = 'https://';
                }
            }
        } else if (type === 'text') {
            if (valLabel) valLabel.textContent = 'Text Snippet';
            if (valEl) valEl.placeholder = 'Text snippet...';
        } else if (type === 'clock') {
            if (labelInput && (!labelInput.value || labelInput.value.startsWith('Button '))) labelInput.value = 'Clock';
        } else if (type === 'date') {
            if (labelInput && (!labelInput.value || labelInput.value.startsWith('Button '))) labelInput.value = 'Date';
        } else if (type === 'stopwatch') {
            if (labelInput && (!labelInput.value || labelInput.value.startsWith('Button '))) labelInput.value = 'Stopwatch';
        } else if (type === 'timer' || type === 'countdown') {
            if (labelInput && (!labelInput.value || labelInput.value.startsWith('Button '))) labelInput.value = 'Timer';
            const target = getButtonConfigByKey(key);
            if (!target.duration) target.duration = 300;
            if (!target.timerDuration) target.timerDuration = 300;
            const durInput = document.getElementById(`timer-duration-${key}`);
            if (durInput && !durInput.value) durInput.value = 300;
        }
    }
    saveCurrentFormInputs();
    renderPreview();
}

function setTimerDurationPreset(key, secs) {
    const input = document.getElementById(`timer-duration-${key}`);
    if (input) {
        input.value = secs;
    }
    const target = getButtonConfigByKey(key);
    target.duration = secs;
    target.timerDuration = secs;
    target.value = String(secs);
    target.payload = String(secs);
    saveCurrentFormInputs();
    renderPreview();
}

function onTimerModeChange(key) {
    const modeEl = document.getElementById(`timer-mode-${key}`);
    const customCol = document.getElementById(`custom-seconds-col-${key}`);
    if (modeEl && customCol) {
        customCol.classList.toggle('hidden', modeEl.value !== 'custom');
    }
    saveCurrentFormInputs();
}

let currentToggleEditTab = 'A';

function switchToggleEditTab(key, tab) {
    currentToggleEditTab = tab;
    const tabA = document.getElementById(`toggle-tab-a-${key}`);
    const tabB = document.getElementById(`toggle-tab-b-${key}`);
    const panelA = document.getElementById(`toggle-panel-a-${key}`);
    const panelB = document.getElementById(`toggle-panel-b-${key}`);
    if (tabA) tabA.classList.toggle('active', tab === 'A');
    if (tabB) tabB.classList.toggle('active', tab === 'B');
    if (panelA) panelA.classList.toggle('hidden', tab !== 'A');
    if (panelB) panelB.classList.toggle('hidden', tab !== 'B');
}

function onToggleActionTypeChange(key, stateLetter) {
    saveCurrentFormInputs();
    renderPreview();
}

function applyTogglePreset(key, preset) {
    if (!preset) return;
    const presets = {
        mic: {
            stateA: { label: '[mic_off] Muted', actionType: 'shortcut', value: 'Ctrl+Shift+M', color: '#e74c3c', textColor: '#ffffff' },
            stateB: { label: '[mic] Active', actionType: 'shortcut', value: 'Ctrl+Shift+M', color: '#27ae60', textColor: '#ffffff' }
        },
        media: {
            stateA: { label: '[play_arrow] Play', actionType: 'shortcut', value: 'media-play', color: '#27ae60', textColor: '#ffffff' },
            stateB: { label: '[pause] Pause', actionType: 'shortcut', value: 'media-play', color: '#f39c12', textColor: '#ffffff' }
        },
        obs: {
            stateA: { label: '[fiber_manual_record] Rec Off', actionType: 'shortcut', value: 'Ctrl+F9', color: '#4b5563', textColor: '#ffffff' },
            stateB: { label: '[stop] Recording', actionType: 'shortcut', value: 'Ctrl+F9', color: '#c0392b', textColor: '#ffffff' }
        },
        theme: {
            stateA: { label: '[dark_mode] Dark', actionType: 'shortcut', value: 'theme-toggle', color: '#1f2937', textColor: '#38bdf8' },
            stateB: { label: '[light_mode] Light', actionType: 'shortcut', value: 'theme-toggle', color: '#f8fafc', textColor: '#0f172a' }
        },
        volume: {
            stateA: { label: '[volume_off] Muted', actionType: 'shortcut', value: 'vol-mute', color: '#8e44ad', textColor: '#ffffff' },
            stateB: { label: '[volume_up] Unmuted', actionType: 'shortcut', value: 'vol-mute', color: '#2980b9', textColor: '#ffffff' }
        }
    };
    const p = presets[preset];
    if (!p) return;
    const cfg = getButtonConfigByKey(key);
    cfg.stateA = JSON.parse(JSON.stringify(p.stateA));
    cfg.stateB = JSON.parse(JSON.stringify(p.stateB));
    const curState = (cfg.toggleState === 1) ? 1 : 0;
    const active = curState === 1 ? cfg.stateB : cfg.stateA;
    cfg.label = active.label;
    cfg.color = active.color;
    cfg.customColor1 = active.color;
    cfg.textColor = active.textColor;
    cfg.customTextColor = active.textColor;
    cfg.value = active.value;
    renderFormFields();
    renderPreview();
    markUnsaved();
}

async function toggleButtonPreviewState(key) {
    const cfg = getButtonConfigByKey(key);
    if (!cfg || cfg.type !== 'toggle') return;
    
    try { saveCurrentFormInputs(); } catch (_) {}
    
    if (!cfg.stateA) {
        cfg.stateA = { label: cfg.label || '[mic_off] Muted', actionType: 'shortcut', value: cfg.value || 'Ctrl+Shift+M', color: cfg.color || '#e74c3c', textColor: '#ffffff' };
    }
    if (!cfg.stateB) {
        cfg.stateB = { label: '[mic] Active', actionType: 'shortcut', value: cfg.value || 'Ctrl+Shift+M', color: '#27ae60', textColor: '#ffffff' };
    }

    const curState = (cfg.toggleState === 1) ? 1 : 0;
    const nextState = (curState === 0) ? 1 : 0;
    const nextDef = (nextState === 0) ? cfg.stateA : cfg.stateB;

    cfg.toggleState = nextState;
    cfg.label = nextDef.label || cfg.label;
    cfg.color = nextDef.color || cfg.color;
    cfg.customColor1 = nextDef.color || cfg.color;
    cfg.textColor = nextDef.textColor || cfg.textColor;
    cfg.customTextColor = nextDef.textColor || cfg.textColor;
    cfg.value = nextDef.value || cfg.value;

    if (window.api && window.api.toggleButtonState) {
        try {
            await window.api.toggleButtonState(key);
        } catch (err) {
            console.warn("Toggle IPC trigger error:", err);
        }
    }

    renderPreview();
    renderFormFields();
    markUnsaved();
}
window.toggleButtonPreviewState = toggleButtonPreviewState;

if (typeof window !== 'undefined' && window.api && window.api.onButtonToggled) {
    window.api.onButtonToggled((data) => {
        if (data && data.key && data.config) {
            currentConfig[data.key] = data.config;
            renderPreview();
            renderFormFields();
        }
    });
}

function insertMacroStep(key, step) {
    const textarea = document.getElementById(`macro-val-${key}`);
    if (textarea) {
        const val = textarea.value.trim();
        textarea.value = val ? `${val}\n${step}` : step;
        saveCurrentFormInputs();
    }
}

function onMacroShortcutSelectChange(key) {
    const selectEl = document.getElementById(`macro-shortcut-select-${key}`);
    if (selectEl && selectEl.value) {
        insertMacroStep(key, selectEl.value);
        selectEl.selectedIndex = 0;
    }
}

function handleHotkeyRecording(e, key) {
    const typeEl = document.getElementById(`type-${key}`);
    if (!typeEl || typeEl.value !== 'shortcut') return;

    // Allow Tab to move focus
    if (e.key === 'Tab') return;

    e.preventDefault();
    e.stopPropagation();

    const inputEl = document.getElementById(`shortcut-val-${key}`);
    if (!inputEl) return;

    // Clear on Backspace or Delete
    if (e.key === 'Backspace' || e.key === 'Delete') {
        inputEl.value = '';
        saveCurrentFormInputs();
        return;
    }

    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.altKey) modifiers.push('Alt');
    if (e.metaKey) modifiers.push('Win');

    let mainKey = '';
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        if (e.key === ' ') mainKey = 'Space';
        else if (e.key.length === 1) mainKey = e.key.toUpperCase();
        else mainKey = e.key;
    }

    const parts = [...modifiers];
    if (mainKey && !parts.includes(mainKey)) parts.push(mainKey);

    if (parts.length > 0) {
        inputEl.value = parts.join('+');
        saveCurrentFormInputs();
    }
}

function onColorChange(key) {
    const colorEl = document.getElementById(`color-${key}`);
    const chipEl = document.getElementById(`color-chip-${key}`);
    const panelEl = document.getElementById(`custom-color-panel-${key}`);
    if (colorEl) {
        if (!currentConfig[key]) {
            currentConfig[key] = { ...(defaultConfig[key] || {}) };
        }
        currentConfig[key].color = colorEl.value;
        if (panelEl) {
            panelEl.classList.toggle('visible', colorEl.value === 'custom');
        }
        if (chipEl) {
            if (colorEl.value === 'custom') {
                chipEl.className = 'color-chip-preview c-custom';
                chipEl.style.setProperty('--chip-custom-bg', getCustomBackgroundCSS(currentConfig[key]));
                chipEl.style.backgroundColor = '';
            } else if (colorEl.value === 'transparent') {
                chipEl.className = 'color-chip-preview c-transparent';
                chipEl.style.backgroundColor = '';
                chipEl.style.removeProperty('--chip-custom-bg');
            } else if (colorEl.value && colorEl.value.startsWith('#')) {
                chipEl.className = 'color-chip-preview';
                chipEl.style.backgroundColor = colorEl.value;
                chipEl.style.removeProperty('--chip-custom-bg');
            } else {
                chipEl.className = `color-chip-preview ${colorEl.value}`;
                chipEl.style.backgroundColor = '';
                chipEl.style.removeProperty('--chip-custom-bg');
            }
        }
        saveCurrentFormInputs();
        renderPreview();
    }
}

const customColorPresets = {
    linear: [
        { title: 'Sunset Orange', c1: '#f39c12', c2: '#e74c3c', angle: 180, textColor: '#ffffff' },
        { title: 'Cyber Neon', c1: '#00f0ff', c2: '#0077fe', angle: 180, textColor: '#000000' },
        { title: 'Synth Magenta', c1: '#ff007f', c2: '#9b00e8', angle: 180, textColor: '#ffffff' },
        { title: 'Emerald Forest', c1: '#00b09b', c2: '#96c93d', angle: 180, textColor: '#ffffff' },
        { title: 'Vibrant Flame', c1: '#8a2387', c2: '#f27121', angle: 180, textColor: '#ffffff' },
        { title: 'Midnight Ruby', c1: '#200122', c2: '#6f0000', angle: 180, textColor: '#ffffff' },
        { title: 'Deep Navy', c1: '#141e30', c2: '#243b55', angle: 180, textColor: '#ffffff' },
        { title: 'Matrix Green', c1: '#11998e', c2: '#38ef7d', angle: 180, textColor: '#000000' }
    ],
    solid: [
        { title: 'Royal Blue', c1: '#2980b9', textColor: '#ffffff' },
        { title: 'Emerald Green', c1: '#27ae60', textColor: '#ffffff' },
        { title: 'Crimson Red', c1: '#c0392b', textColor: '#ffffff' },
        { title: 'Vibrant Purple', c1: '#8e44ad', textColor: '#ffffff' },
        { title: 'Amber Orange', c1: '#d35400', textColor: '#ffffff' },
        { title: 'Charcoal Dark', c1: '#2c3e50', textColor: '#ffffff' },
        { title: 'Obsidian Black', c1: '#121417', textColor: '#00f0ff' },
        { title: 'Pure White', c1: '#f8fafc', textColor: '#0f172a' }
    ]
};

function renderCustomColorPresetsHTML(key, type) {
    const list = customColorPresets[type] || customColorPresets.linear;
    return list.map(p => {
        let style = (type === 'solid') ? `background: ${p.c1};` : `background: linear-gradient(${p.angle || 180}deg, ${p.c1}, ${p.c2});`;
        const c2Arg = p.c2 ? `'${p.c2}'` : `null`;
        const angleArg = p.angle !== undefined ? p.angle : 180;
        const textArg = `'${p.textColor || '#ffffff'}'`;
        return `<button type="button" class="gradient-preset-btn" style="${style}" title="${p.title}" onclick="applyCustomGradientPreset('${key}', '${p.c1}', ${c2Arg}, ${angleArg}, ${textArg})"></button>`;
    }).join('');
}

function onCustomColorTypeChange(key) {
    const typeEl = document.getElementById(`custom-type-${key}`);
    const color1Label = document.getElementById(`custom-color1-label-${key}`);
    const color2Group = document.getElementById(`custom-color2-group-${key}`);
    const presetsRow = document.getElementById(`gradient-presets-row-${key}`);
    if (typeEl) {
        const val = typeEl.value; // 'vertical', 'horizontal', or 'solid'
        const isSolid = val === 'solid';
        const swapCol = document.getElementById(`custom-color-swap-col-${key}`);
        const pairGrid = document.getElementById(`gradient-pair-grid-${key}`);
        if (color1Label) color1Label.textContent = isSolid ? 'Button Color' : 'Start Color';
        if (color2Group) color2Group.style.display = isSolid ? 'none' : '';
        if (swapCol) swapCol.style.display = isSolid ? 'none' : '';
        if (pairGrid) pairGrid.classList.toggle('solid-mode', isSolid);
        if (presetsRow) presetsRow.innerHTML = renderCustomColorPresetsHTML(key, isSolid ? 'solid' : 'linear');
        if (!currentConfig[key]) currentConfig[key] = {};
        currentConfig[key].customColorType = isSolid ? 'solid' : 'linear';
        currentConfig[key].customAngle = (val === 'horizontal') ? 90 : 180;
    }
    saveCurrentFormInputs();
    updateCustomChip(key);
    renderPreview();
}

function swapCustomGradientColors(key) {
    if (!currentConfig[key]) {
        currentConfig[key] = { ...(defaultConfig[key] || {}) };
    }
    const c1 = currentConfig[key].customColor1 || '#2980b9';
    const c2 = currentConfig[key].customColor2 || '#2573a7';

    currentConfig[key].customColor1 = c2;
    currentConfig[key].customColor2 = c1;

    const p1 = document.getElementById(`custom-color1-picker-${key}`);
    const t1 = document.getElementById(`custom-color1-val-${key}`);
    const p2 = document.getElementById(`custom-color2-picker-${key}`);
    const t2 = document.getElementById(`custom-color2-val-${key}`);

    if (p1) p1.value = c2;
    if (t1) t1.value = c2;
    if (p2) p2.value = c1;
    if (t2) t2.value = c1;

    saveCurrentFormInputs();
    updateCustomChip(key);
    renderPreview();
    markUnsaved();
}

function onCustomColor1InputChange(key, val) {
    const picker = document.getElementById(`custom-color1-picker-${key}`);
    const text = document.getElementById(`custom-color1-val-${key}`);
    if (picker && picker.value !== val) picker.value = val;
    if (text && text.value !== val) text.value = val;
    saveCurrentFormInputs();
    updateCustomChip(key);
    renderPreview();
}

function onCustomColor2InputChange(key, val) {
    const picker = document.getElementById(`custom-color2-picker-${key}`);
    const text = document.getElementById(`custom-color2-val-${key}`);
    if (picker && picker.value !== val) picker.value = val;
    if (text && text.value !== val) text.value = val;
    saveCurrentFormInputs();
    updateCustomChip(key);
    renderPreview();
}

function openTextColorPicker(key) {
    const selectEl = document.getElementById(`text-color-select-${key}`);
    const customRow = document.getElementById(`custom-text-color-row-${key}`);
    const picker = document.getElementById(`custom-text-picker-${key}`);
    if (selectEl && selectEl.value !== 'custom') {
        selectEl.value = 'custom';
        const wrapper = selectEl.closest('.custom-select-wrapper');
        if (wrapper) {
            const triggerLabel = wrapper.querySelector('.custom-select-label');
            if (triggerLabel && selectEl.options[selectEl.selectedIndex]) {
                triggerLabel.textContent = selectEl.options[selectEl.selectedIndex].textContent;
            }
        }
    }
    if (customRow) customRow.classList.add('visible');
    if (picker) {
        if (typeof picker.showPicker === 'function') {
            try {
                picker.showPicker();
            } catch (err) {
                picker.click();
            }
        } else {
            picker.click();
        }
    }
}

function onTextColorSelectChange(key) {
    const selectEl = document.getElementById(`text-color-select-${key}`);
    const chipEl = document.getElementById(`text-color-chip-${key}`);
    const customRow = document.getElementById(`custom-text-color-row-${key}`);
    const picker = document.getElementById(`custom-text-picker-${key}`);
    const hexInput = document.getElementById(`custom-text-val-${key}`);
    
    if (!selectEl) return;
    const val = selectEl.value;
    
    if (val === 'custom') {
        if (customRow) customRow.classList.add('visible');
        if (hexInput) {
            hexInput.focus();
            hexInput.select();
        }
    } else {
        if (customRow) customRow.classList.remove('visible');
        if (picker) picker.value = val;
        if (hexInput) hexInput.value = val;
        if (chipEl) chipEl.style.setProperty('--chip-text-color', val);
        const iconChipEl = document.getElementById(`icon-color-chip-${key}`);
        const iconSelectEl = document.getElementById(`icon-color-select-${key}`);
        if (iconChipEl && (!iconSelectEl || iconSelectEl.value === 'same_as_text')) {
            iconChipEl.style.setProperty('--chip-text-color', val);
        }
        if (!currentConfig[key]) currentConfig[key] = {};
        currentConfig[key].customTextColor = val;
        saveCurrentFormInputs();
        renderPreview();
    }
}

function onCustomTextInputChange(key, val) {
    const picker = document.getElementById(`custom-text-picker-${key}`);
    const hexInput = document.getElementById(`custom-text-val-${key}`);
    const chipEl = document.getElementById(`text-color-chip-${key}`);
    const selectEl = document.getElementById(`text-color-select-${key}`);
    const customRow = document.getElementById(`custom-text-color-row-${key}`);
    
    if (picker && picker.value !== val) picker.value = val;
    if (hexInput && hexInput.value !== val) hexInput.value = val;
    if (chipEl) chipEl.style.setProperty('--chip-text-color', val);
    const iconChipEl = document.getElementById(`icon-color-chip-${key}`);
    const iconSelectEl = document.getElementById(`icon-color-select-${key}`);
    if (iconChipEl && (!iconSelectEl || iconSelectEl.value === 'same_as_text')) {
        iconChipEl.style.setProperty('--chip-text-color', val);
    }
    
    if (selectEl) {
        const found = standardTextColors.some(c => c.value.toLowerCase() === (val || '').toLowerCase());
        selectEl.value = found ? val.toLowerCase() : 'custom';
        if (customRow) {
            customRow.classList.toggle('visible', !found);
        }
        const wrapper = selectEl.closest('.custom-select-wrapper');
        if (wrapper) {
            const triggerLabel = wrapper.querySelector('.custom-select-label');
            if (triggerLabel && selectEl.options[selectEl.selectedIndex]) {
                triggerLabel.textContent = selectEl.options[selectEl.selectedIndex].textContent;
            }
        }
    }
    if (!currentConfig[key]) currentConfig[key] = {};
    currentConfig[key].customTextColor = val;
    saveCurrentFormInputs();
    renderPreview();
}

function openIconColorPicker(key) {
    const selectEl = document.getElementById(`icon-color-select-${key}`);
    const customRow = document.getElementById(`custom-icon-color-row-${key}`);
    const picker = document.getElementById(`custom-icon-picker-${key}`);
    if (selectEl && selectEl.value !== 'custom') {
        selectEl.value = 'custom';
        const wrapper = selectEl.closest('.custom-select-wrapper');
        if (wrapper) {
            const triggerLabel = wrapper.querySelector('.custom-select-label');
            if (triggerLabel && selectEl.options[selectEl.selectedIndex]) {
                triggerLabel.textContent = selectEl.options[selectEl.selectedIndex].textContent;
            }
        }
    }
    if (customRow) customRow.classList.add('visible');
    if (picker) {
        if (typeof picker.showPicker === 'function') {
            try {
                picker.showPicker();
            } catch (err) {
                picker.click();
            }
        } else {
            picker.click();
        }
    }
}

function onIconColorSelectChange(key) {
    const selectEl = document.getElementById(`icon-color-select-${key}`);
    const chipEl = document.getElementById(`icon-color-chip-${key}`);
    const customRow = document.getElementById(`custom-icon-color-row-${key}`);
    const picker = document.getElementById(`custom-icon-picker-${key}`);
    const hexInput = document.getElementById(`custom-icon-val-${key}`);
    
    if (!selectEl) return;
    const val = selectEl.value;
    
    if (val === 'custom') {
        if (customRow) customRow.classList.add('visible');
        if (hexInput) {
            hexInput.focus();
            hexInput.select();
        }
    } else {
        if (customRow) customRow.classList.remove('visible');
        if (val === 'same_as_text') {
            const textVal = (currentConfig[key] && currentConfig[key].customTextColor) ? currentConfig[key].customTextColor : '#ffffff';
            if (chipEl) chipEl.style.setProperty('--chip-text-color', textVal);
            if (picker) picker.value = textVal;
            if (hexInput) hexInput.value = textVal;
            if (currentConfig[key]) delete currentConfig[key].customIconColor;
        } else {
            if (picker) picker.value = val;
            if (hexInput) hexInput.value = val;
            if (chipEl) chipEl.style.setProperty('--chip-text-color', val);
            if (!currentConfig[key]) currentConfig[key] = {};
            currentConfig[key].customIconColor = val;
        }
        saveCurrentFormInputs();
        renderPreview();
    }
}

function onCustomIconInputChange(key, val) {
    const picker = document.getElementById(`custom-icon-picker-${key}`);
    const hexInput = document.getElementById(`custom-icon-val-${key}`);
    const chipEl = document.getElementById(`icon-color-chip-${key}`);
    const selectEl = document.getElementById(`icon-color-select-${key}`);
    const customRow = document.getElementById(`custom-icon-color-row-${key}`);
    
    if (picker && picker.value !== val) picker.value = val;
    if (hexInput && hexInput.value !== val) hexInput.value = val;
    if (chipEl) chipEl.style.setProperty('--chip-text-color', val);
    
    if (selectEl) {
        const found = standardTextColors.some(c => c.value.toLowerCase() === (val || '').toLowerCase());
        selectEl.value = found ? val.toLowerCase() : 'custom';
        if (customRow) {
            customRow.classList.toggle('visible', !found);
        }
        const wrapper = selectEl.closest('.custom-select-wrapper');
        if (wrapper) {
            const triggerLabel = wrapper.querySelector('.custom-select-label');
            if (triggerLabel && selectEl.options[selectEl.selectedIndex]) {
                triggerLabel.textContent = selectEl.options[selectEl.selectedIndex].textContent;
            }
        }
    }
    if (!currentConfig[key]) currentConfig[key] = {};
    currentConfig[key].customIconColor = val;
    saveCurrentFormInputs();
    renderPreview();
}

function onCustomAngleChange(key, val) {
    const angle = parseInt(val, 10) || 180;
    if (currentConfig[key]) {
        currentConfig[key].customAngle = angle;
    }
    const selectEl = document.getElementById(`custom-angle-select-${key}`);
    if (selectEl && selectEl.value !== String(angle)) selectEl.value = String(angle);
    saveCurrentFormInputs();
    updateCustomChip(key);
    renderPreview();
}

function updateCustomChip(key) {
    const chipEl = document.getElementById(`color-chip-${key}`);
    if (chipEl && currentConfig[key]?.color === 'custom') {
        chipEl.style.setProperty('--chip-custom-bg', getCustomBackgroundCSS(currentConfig[key]));
    }
}

function applyCustomGradientPreset(key, c1, c2, angle, textColor) {
    const typeEl = document.getElementById(`custom-type-${key}`);
    const type = typeEl ? typeEl.value : 'linear';
    if (c1) onCustomColor1InputChange(key, c1);
    if (c2 && type !== 'solid') onCustomColor2InputChange(key, c2);
    if (angle !== undefined && type === 'linear') {
        const angleSelect = document.getElementById(`custom-angle-select-${key}`);
        const finalAngle = angle == 90 ? 90 : 180;
        if (angleSelect) angleSelect.value = String(finalAngle);
        onCustomAngleChange(key, finalAngle);
    }
    onCustomTextInputChange(key, textColor || '#ffffff');
    renderPreview();
}

function onBorderStyleChange(key) {
    const styleEl = document.getElementById(`border-style-${key}`);
    const widthCol = document.getElementById(`border-width-col-${key}`);
    const colorCol = document.getElementById(`border-color-col-${key}`);
    const dashRow = document.getElementById(`dash-spacing-row-${key}`);
    const bracketRow = document.getElementById(`bracket-length-row-${key}`);
    if (styleEl) {
        const isNone = styleEl.value === 'none';
        const isDashed = styleEl.value === 'dashed';
        const isBrackets = styleEl.value === 'brackets';
        if (widthCol) widthCol.style.display = isNone ? 'none' : '';
        if (colorCol) colorCol.style.display = isNone ? 'none' : '';
        if (dashRow) dashRow.classList.toggle('visible', isDashed);
        if (bracketRow) bracketRow.classList.toggle('visible', isBrackets);
    }
    saveCurrentFormInputs();
}

function onBracketPresetChange(key) {
    const select = document.getElementById(`bracket-preset-${key}`);
    const slider = document.getElementById(`bracket-len-slider-${key}`);
    const valEl = document.getElementById(`bracket-len-val-${key}`);
    if (select) {
        if (select.value === 'custom') return;
        const val = parseInt(select.value, 10);
        if (slider) slider.value = val;
        if (valEl) valEl.textContent = `${val}%`;
        if (!currentConfig[key]) currentConfig[key] = {};
        currentConfig[key].borderBracketLength = val;
        saveCurrentFormInputs();
    }
}

function onBracketSliderChange(key, val) {
    const valEl = document.getElementById(`bracket-len-val-${key}`);
    const select = document.getElementById(`bracket-preset-${key}`);
    if (valEl) valEl.textContent = `${val}%`;
    if (select) select.value = 'custom';
    if (!currentConfig[key]) currentConfig[key] = {};
    currentConfig[key].borderBracketLength = parseInt(val, 10);
    saveCurrentFormInputs();
}

function onDashPresetChange(key) {
    const select = document.getElementById(`dash-preset-${key}`);
    const slider = document.getElementById(`dash-gap-slider-${key}`);
    const valEl = document.getElementById(`dash-gap-val-${key}`);
    if (select) {
        let gap = 8;
        let len = 12;
        if (select.value === 'tight') { gap = 4; len = 8; }
        else if (select.value === 'standard') { gap = 8; len = 12; }
        else if (select.value === 'wide') { gap = 14; len = 16; }
        else if (select.value === 'sparse') { gap = 24; len = 20; }
        else if (select.value === 'brackets') { gap = 90; len = 45; }
        else if (select.value === 'custom') { return; }

        if (slider) slider.value = gap;
        if (valEl) valEl.textContent = `${gap}px`;
        if (!currentConfig[key]) currentConfig[key] = {};
        currentConfig[key].borderDashGap = gap;
        currentConfig[key].borderDashLength = len;
        saveCurrentFormInputs();
    }
}

function onDashGapSliderChange(key, val) {
    const valEl = document.getElementById(`dash-gap-val-${key}`);
    const select = document.getElementById(`dash-preset-${key}`);
    if (valEl) valEl.textContent = `${val}px`;
    if (select) select.value = 'custom';
    if (!currentConfig[key]) currentConfig[key] = {};
    const gapNum = parseInt(val, 10);
    currentConfig[key].borderDashGap = gapNum;
    if (gapNum >= 40) {
        currentConfig[key].borderDashLength = Math.round(gapNum * 0.5);
    } else {
        currentConfig[key].borderDashLength = Math.max(6, Math.round(gapNum * 1.3));
    }
    saveCurrentFormInputs();
}

function onBorderWidthChange(key) {
    saveCurrentFormInputs();
}

function onBorderRadiusChange(key) {
    saveCurrentFormInputs();
}

function onBorderColorSelectChange(key) {
    const selectEl = document.getElementById(`border-color-select-${key}`);
    const customRow = document.getElementById(`custom-border-color-row-${key}`);
    const picker = document.getElementById(`border-color-picker-${key}`);
    const hexInput = document.getElementById(`border-color-val-${key}`);
    
    if (!selectEl) return;
    const val = selectEl.value;
    
    if (val === 'custom') {
        if (customRow) customRow.classList.add('visible');
        if (hexInput) {
            hexInput.focus();
            hexInput.select();
        }
    } else {
        if (customRow) customRow.classList.remove('visible');
        if (picker) picker.value = val;
        if (hexInput) hexInput.value = val;
        if (!currentConfig[key]) currentConfig[key] = {};
        currentConfig[key].borderColor = val;
        saveCurrentFormInputs();
        renderPreview();
    }
}

function onBorderColorInputChange(key, val) {
    const picker = document.getElementById(`border-color-picker-${key}`);
    const hexInput = document.getElementById(`border-color-val-${key}`);
    const selectEl = document.getElementById(`border-color-select-${key}`);
    const customRow = document.getElementById(`custom-border-color-row-${key}`);
    
    if (picker && picker.value !== val) picker.value = val;
    if (hexInput && hexInput.value !== val) hexInput.value = val;
    
    if (selectEl) {
        const found = standardBorderColors.some(c => c.value.toLowerCase() === (val || '').toLowerCase());
        selectEl.value = found ? val.toLowerCase() : 'custom';
        if (customRow) {
            customRow.classList.toggle('visible', !found);
        }
        const wrapper = selectEl.closest('.custom-select-wrapper');
        if (wrapper) {
            const triggerLabel = wrapper.querySelector('.custom-select-label');
            if (triggerLabel && selectEl.options[selectEl.selectedIndex]) {
                triggerLabel.textContent = selectEl.options[selectEl.selectedIndex].textContent;
            }
        }
    }
    if (!currentConfig[key]) currentConfig[key] = {};
    currentConfig[key].borderColor = val;
    saveCurrentFormInputs();
    renderPreview();
}

function extractCurrentSectionSettings(section) {
    saveCurrentFormInputs();
    const curKey = getActiveButtonKey();
    const src = getButtonConfigByKey(curKey);

    if (section === 'action') {
        return {
            type: src.type,
            value: src.value,
            payload: src.payload || src.value,
            format: src.format,
            timerMode: src.timerMode,
            timerDuration: src.timerDuration
        };
    } else if (section === 'label') {
        return {
            fontSize: src.fontSize,
            iconFit: src.iconFit
        };
    } else if (section === 'color') {
        return {
            color: src.color || '#4b5563',
            customColorType: src.customColorType,
            customColor1: src.customColor1,
            customColor2: src.customColor2,
            customAngle: src.customAngle,
            customTextColor: src.customTextColor,
            customIconColor: src.customIconColor,
            borderRadius: src.borderRadius
        };
    } else if (section === 'border') {
        return {
            borderStyle: src.borderStyle || 'none',
            borderWidth: src.borderWidth,
            borderRadius: src.borderRadius,
            borderColor: src.borderColor,
            borderDashGap: src.borderDashGap,
            borderDashLength: src.borderDashLength,
            borderBracketLength: src.borderBracketLength
        };
    }
    return {};
}

function applyStylesToButton(targetKey, styles) {
    const target = getButtonConfigByKey(targetKey);
    Object.assign(target, styles);
}

function applySectionToPage(section) {
    const settings = extractCurrentSectionSettings(section);
    if (activeSubPageParent) {
        for (let b = 1; b <= 6; b++) {
            applyStylesToButton(`${activeSubPageParent}-sub${b}`, settings);
        }
    } else {
        for (let b = 1; b <= 6; b++) {
            applyStylesToButton(`p${activePage}-b${b}`, settings);
        }
    }
    renderPreview();
    renderFormFields();
    markUnsaved();
}

function applySectionToAllPages(section) {
    const settings = extractCurrentSectionSettings(section);
    const total = getTotalPages();
    for (let p = 1; p <= total; p++) {
        for (let b = 1; b <= 6; b++) {
            applyStylesToButton(`p${p}-b${b}`, settings);
        }
    }
    renderPreview();
    renderFormFields();
    markUnsaved();
}

function undoSectionChanges(section) {
    if (!lastSavedConfig) return;
    saveCurrentFormInputs();
    const curKey = getActiveButtonKey();
    let savedBtn = {};
    const subMatch = curKey.match(/^(p\d+-b\d+)-sub(\d+)$/);
    if (subMatch) {
        const pKey = subMatch[1];
        const sIdx = parseInt(subMatch[2], 10) - 1;
        const savedParent = lastSavedConfig[pKey];
        if (savedParent && savedParent.sub_buttons && savedParent.sub_buttons[sIdx]) {
            savedBtn = savedParent.sub_buttons[sIdx];
        }
    } else {
        savedBtn = lastSavedConfig[curKey] || defaultConfig[curKey] || {};
    }

    const target = getButtonConfigByKey(curKey);

    if (section === 'action') {
        target.type = savedBtn.type !== undefined ? savedBtn.type : 'shortcut';
        target.value = savedBtn.value !== undefined ? savedBtn.value : '';
        target.payload = savedBtn.payload !== undefined ? savedBtn.payload : target.value;
        target.label = savedBtn.label !== undefined ? savedBtn.label : '';
        target.format = savedBtn.format;
        target.timerMode = savedBtn.timerMode;
        target.timerDuration = savedBtn.timerDuration;
    } else if (section === 'label') {
        target.label = savedBtn.label !== undefined ? savedBtn.label : '';
        target.materialIcon = savedBtn.materialIcon !== undefined ? savedBtn.materialIcon : '';
        target.fontSize = savedBtn.fontSize;
        target.icon = savedBtn.icon;
        target.iconOriginalName = savedBtn.iconOriginalName;
        target.iconFit = savedBtn.iconFit;
    } else if (section === 'color') {
        target.color = savedBtn.color !== undefined ? savedBtn.color : '#4b5563';
        target.customColorType = savedBtn.customColorType;
        target.customColor1 = savedBtn.customColor1;
        target.customColor2 = savedBtn.customColor2;
        target.customAngle = savedBtn.customAngle;
        target.customTextColor = savedBtn.customTextColor;
        target.customIconColor = savedBtn.customIconColor;
        target.borderRadius = savedBtn.borderRadius;
    } else if (section === 'border') {
        target.borderStyle = savedBtn.borderStyle !== undefined ? savedBtn.borderStyle : 'none';
        target.borderWidth = savedBtn.borderWidth;
        target.borderRadius = savedBtn.borderRadius;
        target.borderColor = savedBtn.borderColor;
        target.borderDashGap = savedBtn.borderDashGap;
        target.borderDashLength = savedBtn.borderDashLength;
        target.borderBracketLength = savedBtn.borderBracketLength;
    } else if (section === 'folder') {
        target.sub_buttons = savedBtn.sub_buttons ? JSON.parse(JSON.stringify(savedBtn.sub_buttons)) : undefined;
        target.children = savedBtn.children ? JSON.parse(JSON.stringify(savedBtn.children)) : undefined;
    }

    renderPreview();
    renderFormFields();
    markUnsaved();
}

function onFontSizeSelectChange(key) {
    const select = document.getElementById(`font-size-select-${key}`);
    if (!select) return;
    const target = getButtonConfigByKey(key);

    if (select.value === 'default' || select.value === '68') {
        delete target.fontSize;
    } else {
        target.fontSize = parseInt(select.value, 10);
    }

    renderPreview();
    markUnsaved();
}

function onInputChange(key) {
    const labelInput = document.getElementById(`label-${key}`);
    if (labelInput) {
        const target = getButtonConfigByKey(key);
        target.label = labelInput.value;
        renderPreview();
    }
}

function saveCurrentFormInputs() {
    const container = document.getElementById('settings-fields');
    if (!container || !container.children || container.children.length === 0) return;

    const key = getActiveButtonKey();
    const currentTarget = getButtonConfigByKey(key);
    const labelEl = document.getElementById(`label-${key}`);
    const typeEl = document.getElementById(`type-${key}`);
    const valEl = document.getElementById(`val-${key}`);
    const shortcutValEl = document.getElementById(`shortcut-val-${key}`);
    const macroValEl = document.getElementById(`macro-val-${key}`);
    const colorEl = document.getElementById(`color-${key}`);

    if (labelEl && typeEl) {
        const type = typeEl.value;
        let finalVal = '';
        let format = undefined;
        let timerMode = undefined;
        let timerDuration = undefined;

        if (type === 'subpage' || type === 'folder') {
            finalVal = 'FOLDER';
        } else if (type === 'macro') {
            finalVal = macroValEl ? macroValEl.value : '';
        } else if (type === 'shortcut') {
            finalVal = shortcutValEl ? shortcutValEl.value : '';
        } else if (type === 'clock') {
            const formatEl = document.getElementById(`clock-format-${key}`);
            const actionEl = document.getElementById(`clock-action-${key}`);
            format = formatEl ? formatEl.value : '12h-sec';
            finalVal = actionEl ? actionEl.value : 'display';
        } else if (type === 'date') {
            const formatEl = document.getElementById(`date-format-${key}`);
            const actionEl = document.getElementById(`date-action-${key}`);
            format = formatEl ? formatEl.value : 'standard';
            finalVal = actionEl ? actionEl.value : 'display';
        } else if (type === 'stopwatch') {
            finalVal = '00:00';
            currentTarget.duration = 0;
        } else if (type === 'timer' || type === 'countdown') {
            const durEl = document.getElementById(`timer-duration-${key}`);
            const dur = durEl ? parseInt(durEl.value, 10) : (currentTarget.duration || currentTarget.timerDuration || 300);
            const validDur = isNaN(dur) || dur <= 0 ? 300 : dur;
            currentTarget.duration = validDur;
            timerDuration = validDur;
            finalVal = String(validDur);
        } else if (type === 'toggle') {
            const labelAEl = document.getElementById(`toggle-label-a-${key}`);
            const typeAEl = document.getElementById(`toggle-action-type-a-${key}`);
            const valAEl = document.getElementById(`toggle-val-a-${key}`);
            const colorAEl = document.getElementById(`toggle-color-a-${key}`);
            const textColorAEl = document.getElementById(`toggle-textcolor-a-${key}`);

            const labelBEl = document.getElementById(`toggle-label-b-${key}`);
            const typeBEl = document.getElementById(`toggle-action-type-b-${key}`);
            const valBEl = document.getElementById(`toggle-val-b-${key}`);
            const colorBEl = document.getElementById(`toggle-color-b-${key}`);
            const textColorBEl = document.getElementById(`toggle-textcolor-b-${key}`);

            const stateA = {
                label: labelAEl ? labelAEl.value : (currentTarget.stateA ? currentTarget.stateA.label : '[mic_off] Muted'),
                actionType: typeAEl ? typeAEl.value : (currentTarget.stateA ? currentTarget.stateA.actionType : 'shortcut'),
                value: valAEl ? valAEl.value : (currentTarget.stateA ? currentTarget.stateA.value : 'Ctrl+Shift+M'),
                color: colorAEl ? colorAEl.value : (currentTarget.stateA ? currentTarget.stateA.color : '#e74c3c'),
                textColor: textColorAEl ? textColorAEl.value : (currentTarget.stateA ? currentTarget.stateA.textColor : '#ffffff')
            };

            const stateB = {
                label: labelBEl ? labelBEl.value : (currentTarget.stateB ? currentTarget.stateB.label : '[mic] Active'),
                actionType: typeBEl ? typeBEl.value : (currentTarget.stateB ? currentTarget.stateB.actionType : 'shortcut'),
                value: valBEl ? valBEl.value : (currentTarget.stateB ? currentTarget.stateB.value : 'Ctrl+Shift+M'),
                color: colorBEl ? colorBEl.value : (currentTarget.stateB ? currentTarget.stateB.color : '#27ae60'),
                textColor: textColorBEl ? textColorBEl.value : (currentTarget.stateB ? currentTarget.stateB.textColor : '#ffffff')
            };

            currentTarget.stateA = stateA;
            currentTarget.stateB = stateB;
            if (currentTarget.toggleState === undefined) currentTarget.toggleState = 0;

            const activeDef = currentTarget.toggleState === 1 ? stateB : stateA;
            currentTarget.label = activeDef.label;
            currentTarget.color = activeDef.color;
            currentTarget.customColor1 = activeDef.color;
            currentTarget.customColorType = 'solid';
            currentTarget.textColor = activeDef.textColor;
            currentTarget.customTextColor = activeDef.textColor;
            finalVal = activeDef.value;
            if (labelEl) labelEl.value = currentTarget.label;
        } else {
            finalVal = valEl ? valEl.value : '';
        }

        const iconFitEl = document.getElementById(`icon-fit-${key}`);
        const iconFit = iconFitEl ? iconFitEl.value : (currentTarget.iconFit || 'contain');
        const themeEl = document.getElementById('theme-select');
        if (themeEl) currentConfig._theme = themeEl.value;
        const screensaverEl = document.getElementById('screensaver-select');
        if (screensaverEl) currentConfig._screensaverTimeout = parseInt(screensaverEl.value, 10);
        const brightnessSlider = document.getElementById('brightness-slider');
        if (brightnessSlider) currentConfig._brightness = parseInt(brightnessSlider.value, 10);

        const fontSizeSelect = document.getElementById(`font-size-select-${key}`);
        let fontSize = currentTarget.fontSize;
        if (fontSizeSelect) {
            if (fontSizeSelect.value === 'default' || fontSizeSelect.value === '68') {
                fontSize = undefined;
            } else if (fontSizeSelect.value) {
                fontSize = parseInt(fontSizeSelect.value, 10);
            }
        }

        const customTypeEl = document.getElementById(`custom-type-${key}`);
        const customColor1El = document.getElementById(`custom-color1-val-${key}`);
        const customColor2El = document.getElementById(`custom-color2-val-${key}`);
        const customTextEl = document.getElementById(`custom-text-val-${key}`);

        let customColorType = 'linear';
        let customAngle = 180;
        if (customTypeEl) {
            if (customTypeEl.value === 'solid') {
                customColorType = 'solid';
            } else if (customTypeEl.value === 'horizontal') {
                customColorType = 'linear';
                customAngle = 90;
            } else {
                customColorType = 'linear';
                customAngle = 180;
            }
        } else if (currentTarget.customColorType === 'solid') {
            customColorType = 'solid';
        } else if (currentTarget.customAngle == 90) {
            customAngle = 90;
        }

        const customColor1 = customColor1El ? customColor1El.value : (currentTarget.customColor1 || '#2980b9');
        const customColor2 = customColor2El ? customColor2El.value : (currentTarget.customColor2 || '#2573a7');
        const customTextColor = customTextEl ? customTextEl.value : (currentTarget.customTextColor || '#ffffff');
        const customIconEl = document.getElementById(`custom-icon-val-${key}`);
        const iconColorSelect = document.getElementById(`icon-color-select-${key}`);
        let customIconColor = currentTarget.customIconColor;
        if (iconColorSelect) {
            if (iconColorSelect.value === 'same_as_text') {
                customIconColor = undefined;
            } else if (iconColorSelect.value === 'custom') {
                customIconColor = customIconEl ? customIconEl.value : (currentTarget.customIconColor || '#ffffff');
            } else {
                customIconColor = iconColorSelect.value;
            }
        }

        const borderStyleEl = document.getElementById(`border-style-${key}`);
        const borderWidthEl = document.getElementById(`border-width-${key}`);
        const borderRadiusEl = document.getElementById(`border-radius-${key}`);
        const borderColorEl = document.getElementById(`border-color-val-${key}`);
        const borderColorSelect = document.getElementById(`border-color-select-${key}`);

        const borderStyle = borderStyleEl ? borderStyleEl.value : (currentTarget.borderStyle || 'none');
        const borderWidth = borderWidthEl ? parseInt(borderWidthEl.value, 10) : (currentTarget.borderWidth || 2);
        let borderRadius = currentTarget.borderRadius;
        if (borderRadiusEl) {
            borderRadius = borderRadiusEl.value === 'default' ? undefined : parseInt(borderRadiusEl.value, 10);
        }
        let borderColor = currentTarget.borderColor || '#ffffff';
        if (borderColorSelect) {
            if (borderColorSelect.value === 'custom') {
                borderColor = borderColorEl ? borderColorEl.value : (currentTarget.borderColor || '#ffffff');
            } else {
                borderColor = borderColorSelect.value;
            }
        } else if (borderColorEl) {
            borderColor = borderColorEl.value;
        }
        const borderDashGap = currentTarget.borderDashGap !== undefined ? currentTarget.borderDashGap : 8;
        const borderDashLength = currentTarget.borderDashLength !== undefined ? currentTarget.borderDashLength : 12;
        const borderBracketLength = currentTarget.borderBracketLength !== undefined ? currentTarget.borderBracketLength : 35;
        const colorMap = {
            'c-nav': '#f39c12',
            'c-edit': '#2980b9',
            'c-media': '#27ae60',
            'c-danger': '#e74c3c',
            'c-gray': '#4b5563',
            'c-accent': '#8e44ad',
            'c-system': '#27ae60',
            'c-util': '#8e44ad'
        };

        let rawSelectedColor = colorEl ? colorEl.value : (currentTarget.color || '#4b5563');
        const selectedColor = colorMap[rawSelectedColor] || rawSelectedColor || '#4b5563';
        const isCustomColor = selectedColor === 'custom';

        if (type !== 'subpage' && type !== 'folder') {
            delete currentTarget.sub_buttons;
            delete currentTarget.children;
        }

        const updatedConfig = {
            ...currentTarget,
            label: (type === 'toggle' ? currentTarget.label : (labelEl ? labelEl.value : '')),
            type: type,
            value: finalVal,
            payload: finalVal,
            format: format,
            timerMode: timerMode,
            timerDuration: timerDuration,
            duration: (type === 'timer' || type === 'countdown') ? timerDuration : undefined,
            color: (type === 'toggle' ? currentTarget.color : selectedColor),
            iconFit: iconFit,
            fontSize: fontSize,
            customColorType: (type === 'toggle' ? 'solid' : (isCustomColor ? customColorType : undefined)),
            customColor1: (type === 'toggle' ? currentTarget.customColor1 : (isCustomColor ? customColor1 : undefined)),
            customColor2: (type === 'toggle' ? undefined : (isCustomColor ? customColor2 : undefined)),
            customAngle: (type === 'toggle' ? undefined : (isCustomColor ? customAngle : undefined)),
            customTextColor: (type === 'toggle' ? currentTarget.customTextColor : customTextColor),
            customIconColor: customIconColor,
            borderStyle: borderStyle,
            borderWidth: borderWidth,
            borderRadius: borderRadius,
            borderColor: borderColor,
            borderDashGap: borderDashGap,
            borderDashLength: borderDashLength,
            borderBracketLength: borderBracketLength
        };

        // Strip undefined keys
        Object.keys(updatedConfig).forEach(k => {
            if (updatedConfig[k] === undefined) delete updatedConfig[k];
        });

        setButtonConfigByKey(key, updatedConfig);

        renderPreview();
        markUnsaved();
    }
}

function onScreensaverAnimChange() {
    const select = document.getElementById('screensaver-anim-select');
    if (select) {
        currentConfig._screensaverAnim = select.value;
        saveCurrentFormInputs();
        markUnsaved();
    }
}

function onScreensaverChange() {
    const select = document.getElementById('screensaver-select');
    if (select) {
        currentConfig._screensaverTimeout = parseInt(select.value, 10);
        saveCurrentFormInputs();
        markUnsaved();
    }
}

function onPageNameChange() {
    const input = document.getElementById('page-name-input');
    if (input) {
        currentConfig[`p${activePage}-name`] = input.value;
        const titleEl = document.getElementById('editor-title');
        if (titleEl) titleEl.textContent = `Configure ${input.value || 'Page ' + activePage}`;
        updatePreviewTabTitles();
        renderPreviewTabs();
        markUnsaved();
    }
}

function clearInput(inputId, callbackName) {
    const input = document.getElementById(inputId);
    if (input) {
        input.value = '';
        if (callbackName === 'onPageNameChange') {
            onPageNameChange();
        } else if (typeof window[callbackName] === 'function') {
            window[callbackName]();
        }
    }
}

function onBrightnessChange(val) {
    const num = parseInt(val, 10);
    currentConfig._brightness = isNaN(num) ? 100 : num;
    const valEl = document.getElementById('brightness-val');
    if (valEl) valEl.textContent = `${currentConfig._brightness}%`;
    saveCurrentFormInputs();
    markUnsaved();
}

function onVolumeChange(val) {
    const num = parseInt(val, 10);
    currentConfig._volume = isNaN(num) ? 80 : num;
    const valEl = document.getElementById('volume-val');
    if (valEl) valEl.textContent = `${currentConfig._volume}%`;
    saveCurrentFormInputs();
    markUnsaved();
}

function onThemeChange() {
    const select = document.getElementById('theme-select');
    if (select) {
        const themeId = select.value;
        currentConfig._theme = themeId;

        // Apply theme styles across all buttons in all pages
        for (let p = 1; p <= 8; p++) {
            for (let b = 1; b <= 6; b++) {
                const key = `p${p}-b${b}`;
                if (currentConfig[key]) {
                    delete currentConfig[key].customColorType;
                    delete currentConfig[key].customColor1;
                    delete currentConfig[key].customColor2;
                    delete currentConfig[key].customAngle;
                    delete currentConfig[key].customTextColor;

                    if (themeId === 'simple') {
                        currentConfig[key].color = '#000000';
                        currentConfig[key].borderColor = '#ffffff';
                        currentConfig[key].borderStyle = 'solid';
                        currentConfig[key].borderWidth = 2;
                    } else if (themeId === 'matrix') {
                        currentConfig[key].color = '#00ff66';
                        currentConfig[key].borderColor = '#00ff66';
                        currentConfig[key].borderStyle = 'solid';
                        currentConfig[key].borderWidth = 2;
                    } else if (themeId === 'cyberpunk') {
                        currentConfig[key].color = '#00f0ff';
                        currentConfig[key].borderColor = '#00f0ff';
                    } else if (themeId === 'synthwave') {
                        currentConfig[key].color = '#01cdfe';
                        currentConfig[key].borderColor = '#ff71ce';
                    } else if (themeId === 'midnight') {
                        currentConfig[key].color = '#2563eb';
                        currentConfig[key].borderColor = '#3b82f6';
                    } else if (themeId === 'monochrome') {
                        currentConfig[key].color = '#333333';
                        currentConfig[key].borderColor = '#ffffff';
                    } else {
                        currentConfig[key].color = '#2980b9';
                        currentConfig[key].borderColor = '#ffffff';
                    }
                }
            }
        }

        applyThemeToPreview(themeId);
        renderFormFields();
        renderPreview();
        markUnsaved();
    }
}


function updateColorDropdownOptions() {
    const key = `p${activePage}-b${selectedButtonIndex}`;
    const colorSelect = document.getElementById(`color-${key}`);
    const chipEl = document.getElementById(`color-chip-${key}`);
    if (colorSelect) {
        const curVal = colorSelect.value || currentConfig[key]?.color || '#4b5563';
        colorSelect.innerHTML = getColorSelectOptionsHTML(curVal, currentConfig._theme || 'default');
        if (chipEl) {
            if (curVal === 'custom') {
                chipEl.className = 'color-chip-preview c-custom';
                chipEl.style.setProperty('--chip-custom-bg', getCustomBackgroundCSS(currentConfig[key] || {}));
                chipEl.style.backgroundColor = '';
            } else if (curVal && curVal.startsWith('#')) {
                chipEl.className = 'color-chip-preview';
                chipEl.style.backgroundColor = curVal;
                chipEl.style.removeProperty('--chip-custom-bg');
            } else {
                chipEl.className = `color-chip-preview ${curVal}`;
                chipEl.style.backgroundColor = '';
                chipEl.style.removeProperty('--chip-custom-bg');
            }
        }
    }
}

function applyThemeToPreview(theme) {
    if (typeof injectCustomThemesCSS === 'function') {
        injectCustomThemesCSS(getCustomThemes());
    }
    document.body.setAttribute('data-theme', theme || 'default');
}

function syncThemeUI() {
    const theme = currentConfig._theme || 'default';
    if (typeof populateThemeSelectOptions === 'function') {
        populateThemeSelectOptions();
    }
    const select = document.getElementById('theme-select');
    if (select) select.value = theme;
    const screensaverSelect = document.getElementById('screensaver-select');
    if (screensaverSelect) screensaverSelect.value = String(currentConfig._screensaverTimeout ?? 300);
    const screensaverAnimSelect = document.getElementById('screensaver-anim-select');
    if (screensaverAnimSelect) screensaverAnimSelect.value = currentConfig._screensaverAnim || 'bouncing_clock';
    const brightnessSlider = document.getElementById('brightness-slider');
    const brightnessVal = document.getElementById('brightness-val');
    const brightness = currentConfig._brightness ?? 50;
    if (brightnessSlider) brightnessSlider.value = brightness;
    if (brightnessVal) brightnessVal.textContent = `${brightness}%`;
    const volumeSlider = document.getElementById('volume-slider');
    const volumeVal = document.getElementById('volume-val');
    const volume = currentConfig._volume ?? 33;
    if (volumeSlider) volumeSlider.value = volume;
    if (volumeVal) volumeVal.textContent = `${volume}%`;

    const clickSelect = document.getElementById('sound-click-select');
    if (clickSelect) clickSelect.value = currentConfig._soundClick || 'default';
    const notifSelect = document.getElementById('sound-notif-select');
    if (notifSelect) notifSelect.value = currentConfig._soundNotif || 'default';
    const alarmSelect = document.getElementById('sound-alarm-select');
    if (alarmSelect) alarmSelect.value = currentConfig._soundAlarm || 'default';

    const bgVal = currentConfig._bgColor || '#0f1115';
    const bgSelect = document.getElementById('screen-bg-select');
    const customBgRow = document.getElementById('custom-screen-bg-row');
    const pageBtns = document.getElementById('page-manage-buttons');
    const screenBgPicker = document.getElementById('screen-bg-picker');
    const screenBgHex = document.getElementById('screen-bg-hex');
    
    if (bgSelect) {
        bgSelect.innerHTML = getScreenBgSelectOptionsHTML(bgVal);
        const isCustom = isCustomBgColor(bgVal);
        bgSelect.value = isCustom ? 'custom' : bgVal.toLowerCase();
        if (customBgRow) customBgRow.classList.toggle('visible', isCustom);
        if (pageBtns) pageBtns.classList.toggle('hidden', isCustom);
        
        const wrapper = bgSelect.closest('.custom-select-wrapper');
        if (wrapper) {
            const triggerLabel = wrapper.querySelector('.custom-select-label');
            if (triggerLabel && bgSelect.options[bgSelect.selectedIndex]) {
                triggerLabel.textContent = bgSelect.options[bgSelect.selectedIndex].textContent;
            }
        }
    }
    if (screenBgPicker) screenBgPicker.value = bgVal;
    if (screenBgHex) screenBgHex.value = bgVal.toUpperCase();

    applyThemeToPreview(theme);
    updateColorDropdownOptions();
}

async function init() {
    try {
        if (window.api && window.api.getConfig) {
            const fetchedConfig = await window.api.getConfig();
            if (fetchedConfig && Object.keys(fetchedConfig).length > 0) {
                currentConfig = JSON.parse(JSON.stringify(fetchedConfig));
            }
        }
    } catch (err) {
        console.error("Failed to load config:", err);
    }
    lastSavedConfig = JSON.parse(JSON.stringify(currentConfig));
    updateLayoutBadge();
    syncThemeUI();
    switchPage(1);
    initCustomSelects();
    markSaved();
}

if (window.api && window.api.onConfigUpdated) {
    window.api.onConfigUpdated((cfg) => {
        if (cfg) {
            currentConfig = JSON.parse(JSON.stringify(cfg));
            lastSavedConfig = JSON.parse(JSON.stringify(currentConfig));
            updateLayoutBadge();
            syncThemeUI();
            updatePreviewTabTitles();
            renderFormFields();
            renderPreview();
            markSaved();
        }
    });
}






document.addEventListener('input', (e) => {
    if (e.target && e.target.matches && e.target.matches('input, select, textarea')) {
        markUnsaved();
    }
});

document.addEventListener('change', (e) => {
    if (e.target && e.target.matches && e.target.matches('input, select, textarea')) {
        markUnsaved();
    }
});

window.addEventListener('resize', renderPreviewTabs);

/* --- CUSTOM FLOATING DROPDOWN COMPONENT CONTROLLER --- */
function initCustomSelects(root = document) {
    const selects = root.querySelectorAll('select');
    selects.forEach(select => {
        // If already wrapped, just refresh trigger and options
        let wrapper = select.closest('.custom-select-wrapper');
        if (wrapper) {
            if (typeof wrapper._updateLabel === 'function') wrapper._updateLabel();
            if (typeof wrapper._renderOptions === 'function') wrapper._renderOptions();
            return;
        }

        select.style.display = 'none';

        wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        if (select.id) wrapper.id = `custom-wrapper-${select.id}`;
        
        select.classList.forEach(cls => wrapper.classList.add(cls));

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'custom-select-trigger';

        const label = document.createElement('span');
        label.className = 'custom-select-label';
        
        const updateLabel = () => {
            const selectedOpt = select.options[select.selectedIndex];
            label.textContent = selectedOpt ? selectedOpt.textContent : '';
        };
        updateLabel();

        const chevron = document.createElement('span');
        chevron.className = 'material-symbols-outlined custom-select-chevron';
        chevron.textContent = 'expand_more';

        trigger.appendChild(label);
        trigger.appendChild(chevron);

        const menu = document.createElement('div');
        menu.className = 'custom-select-menu';

        const renderOptions = () => {
            menu.innerHTML = '';

            const appendOption = (opt, targetContainer) => {
                const optEl = document.createElement('div');
                const isSelected = opt.selected || opt.value === select.value;
                optEl.className = `custom-select-option ${isSelected ? 'selected' : ''}`;
                optEl.setAttribute('data-value', opt.value);
                
                const optText = document.createElement('span');
                optText.textContent = opt.textContent;
                optEl.appendChild(optText);

                if (isSelected) {
                    const check = document.createElement('span');
                    check.className = 'material-symbols-outlined check-icon';
                    check.textContent = 'check';
                    optEl.appendChild(check);
                }

                optEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    updateLabel();
                    closeAllCustomSelects();
                    renderOptions();
                });

                targetContainer.appendChild(optEl);
            };

            Array.from(select.children).forEach(child => {
                if (child.tagName === 'OPTGROUP') {
                    const grpEl = document.createElement('div');
                    grpEl.className = 'custom-select-group';
                    
                    const header = document.createElement('div');
                    header.className = 'custom-select-group-header';
                    header.textContent = child.label || 'Group';
                    grpEl.appendChild(header);

                    Array.from(child.children).forEach(opt => {
                        appendOption(opt, grpEl);
                    });

                    menu.appendChild(grpEl);
                } else if (child.tagName === 'OPTION') {
                    appendOption(child, menu);
                }
            });
        };

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = wrapper.classList.contains('open');
            closeAllCustomSelects();
            if (!isOpen) {
                renderOptions();
                wrapper.classList.add('open');
            }
        });

        select.addEventListener('change', () => {
            updateLabel();
            renderOptions();
        });

        wrapper._updateLabel = updateLabel;
        wrapper._renderOptions = renderOptions;

        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        wrapper.appendChild(trigger);
        wrapper.appendChild(menu);
    });
}

function closeAllCustomSelects() {
    document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
}

document.addEventListener('click', closeAllCustomSelects);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllCustomSelects();
});

// ========================================================
// CUSTOM FRAMELESS WINDOW CONTROLS & BRANDING
// ========================================================
function minimizeAppWindow() {
    if (window.api && window.api.minimizeWindow) {
        window.api.minimizeWindow();
    }
}

async function toggleMaximizeAppWindow() {
    if (window.api && window.api.maximizeWindow) {
        window.api.maximizeWindow();
        setTimeout(updateMaximizeButtonIcon, 100);
    }
}

function closeAppWindow() {
    if (window.api && window.api.closeWindow) {
        window.api.closeWindow();
    }
}

async function updateMaximizeButtonIcon() {
    const maxIcon = document.getElementById('win-max-icon');
    if (!maxIcon || !window.api || !window.api.isWindowMaximized) return;
    try {
        const isMax = await window.api.isWindowMaximized();
        maxIcon.textContent = isMax ? 'filter_none' : 'crop_square';
    } catch (e) {}
}

// ========================================================
// APP UI THEME (LIGHT / DARK)
// ========================================================
function initAppTheme() {
    const savedTheme = localStorage.getItem('matrix_app_ui_theme') || 'dark';
    setAppTheme(savedTheme);
}

function setAppTheme(theme) {
    const isLight = (theme === 'light');
    if (isLight) {
        document.body.setAttribute('data-app-theme', 'light');
    } else {
        document.body.removeAttribute('data-app-theme');
    }
    const icon = document.getElementById('app-theme-toggle-icon');
    if (icon) {
        icon.textContent = isLight ? 'dark_mode' : 'light_mode';
    }
    const btn = document.getElementById('app-theme-toggle-btn');
    if (btn) {
        btn.title = isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme';
    }
    localStorage.setItem('matrix_app_ui_theme', isLight ? 'light' : 'dark');
}

function toggleAppTheme() {
    const currentTheme = document.body.getAttribute('data-app-theme') === 'light' ? 'light' : 'dark';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    setAppTheme(nextTheme);
}

async function initAppVersion() {
    const versionEl = document.getElementById('header-app-version') || document.querySelector('.header-app-version');
    if (!versionEl) return;
    if (window.api && window.api.getAppVersion) {
        try {
            const version = await window.api.getAppVersion();
            if (version) {
                versionEl.textContent = `v${version}`;
            }
        } catch (e) {
            console.error('Failed to load app version:', e);
        }
    }
}

let isCheckingUpdates = false;

async function checkForUpdates() {
    if (isCheckingUpdates) return;
    const btn = document.getElementById('check-updates-btn');
    if (btn) {
        btn.classList.add('checking');
        btn.title = 'Checking for updates...';
    }
    isCheckingUpdates = true;

    try {
        if (!window.api || !window.api.checkForUpdates) {
            showUpdateToast('Update checker is not available in this environment.', 'info');
            return;
        }

        const res = await window.api.checkForUpdates();
        if (!res) {
            showUpdateToast('Unable to check for updates.', 'error');
            return;
        }

        if (res.status === 'update-available') {
            if (btn) btn.classList.add('has-update');
            const newVer = res.latestVersion ? `v${res.latestVersion}` : 'A new update';
            const actionUrl = res.releaseUrl;
            showUpdateToast(
                `${newVer} is available!`,
                'success',
                actionUrl ? 'View' : null,
                actionUrl ? () => window.open(actionUrl, '_blank') : null
            );
        } else if (res.status === 'up-to-date') {
            const curVer = res.currentVersion ? ` (v${res.currentVersion})` : '';
            showUpdateToast(`Matrix Macropad is up to date${curVer}`, 'info');
        } else if (res.status === 'dev') {
            showUpdateToast(`Development mode: running v${res.currentVersion || 'local'}`, 'info');
        } else {
            showUpdateToast(res.message || 'Failed to check for updates.', 'error');
        }
    } catch (err) {
        console.error('Update check failed:', err);
        showUpdateToast('Failed to check for updates.', 'error');
    } finally {
        isCheckingUpdates = false;
        if (btn) {
            btn.classList.remove('checking');
            btn.title = 'Check for Updates';
        }
    }
}

function showUpdateToast(message, type = 'info', actionText = null, actionCallback = null) {
    const existing = document.querySelector('.update-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `update-toast toast-${type}`;

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined toast-icon';
    icon.textContent = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');
    toast.appendChild(icon);

    const msg = document.createElement('span');
    msg.textContent = message;
    toast.appendChild(msg);

    if (actionText && actionCallback) {
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'update-toast-action';
        actionBtn.textContent = actionText;
        actionBtn.onclick = () => {
            actionCallback();
            toast.remove();
        };
        toast.appendChild(actionBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'update-toast-close';
    closeBtn.title = 'Dismiss';
    const closeIcon = document.createElement('span');
    closeIcon.className = 'material-symbols-outlined';
    closeIcon.textContent = 'close';
    closeBtn.appendChild(closeIcon);
    closeBtn.onclick = () => toast.remove();
    toast.appendChild(closeBtn);

    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, actionText ? 8000 : 4000);
}

init();
initAppTheme();
initAppVersion();
setTimeout(updateMaximizeButtonIcon, 300);

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        window.location.reload();
    } else if (e.key === 'F5') {
        window.location.reload();
    }
});

// --- Sound Manager Modal & Audio Preview ---
function formatSoundLabel(filename) {
    if (!filename) return '';
    let name = filename.replace(/\.wav$/i, '');
    if (/^message/i.test(name)) {
        name = name.replace(/^message/i, 'Notification ');
    } else {
        name = name.replace(/([a-zA-Z])(\d)/g, '$1 $2');
    }
    return name.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function populateSoundSelect(selectEl, sounds, currentValue, defaultLabel, categoryRegex) {
    if (!selectEl) return;
    let val = currentValue || 'default';
    selectEl.innerHTML = '';

    const defOpt = document.createElement('option');
    defOpt.value = 'default';
    defOpt.textContent = defaultLabel || 'Default';
    selectEl.appendChild(defOpt);

    let matchingSounds = [];
    if (Array.isArray(sounds) && sounds.length > 0) {
        if (categoryRegex) {
            matchingSounds = sounds.filter(f => categoryRegex.test(f));
        }
        if (matchingSounds.length === 0 && !categoryRegex) {
            matchingSounds = sounds;
        }
    }

    if (matchingSounds.length === 0) {
        if (categoryRegex && categoryRegex.test('click')) {
            matchingSounds = ['click1.wav', 'click2.wav', 'click3.wav', 'click4.wav'];
        } else if (categoryRegex && (categoryRegex.test('message') || categoryRegex.test('notif'))) {
            matchingSounds = ['message1.wav', 'message2.wav', 'message3.wav', 'message4.wav'];
        } else if (categoryRegex && categoryRegex.test('alarm')) {
            matchingSounds = ['alarm1.wav', 'alarm2.wav', 'alarm3.wav', 'alarm4.wav'];
        }
    }

    // Natural ascending sort (1, 2, 3, 4...)
    matchingSounds.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    matchingSounds.forEach(file => {
        const opt = document.createElement('option');
        opt.value = file;
        opt.textContent = formatSoundLabel(file);
        selectEl.appendChild(opt);
    });

    // If current value is not valid in matching sounds or on SD card, fall back to default
    if (val !== 'default' && val !== 'mute') {
        if (!matchingSounds.includes(val)) {
            const isKnownHardwareSound = Array.isArray(sounds) && sounds.includes(val);
            if (!isKnownHardwareSound) {
                val = 'default';
            } else {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = formatSoundLabel(val);
                selectEl.appendChild(opt);
            }
        }
    }

    const muteOpt = document.createElement('option');
    muteOpt.value = 'mute';
    muteOpt.textContent = 'Mute (No Sound)';
    selectEl.appendChild(muteOpt);

    selectEl.value = val;

    if (selectEl.id === 'sound-click-select') currentConfig._soundClick = val;
    else if (selectEl.id === 'sound-notif-select') currentConfig._soundNotif = val;
    else if (selectEl.id === 'sound-alarm-select') currentConfig._soundAlarm = val;

    const wrapper = selectEl.closest('.custom-select-wrapper');
    if (wrapper) {
        if (typeof wrapper._updateLabel === 'function') wrapper._updateLabel();
        if (typeof wrapper._renderOptions === 'function') wrapper._renderOptions();
    }
}

if (window.api && window.api.onHardwareSoundsUpdated) {
    window.api.onHardwareSoundsUpdated((sounds) => {
        const clickSelect = document.getElementById('sound-click-select');
        const notifSelect = document.getElementById('sound-notif-select');
        const alarmSelect = document.getElementById('sound-alarm-select');
        populateSoundSelect(clickSelect, sounds, currentConfig._soundClick, 'Default Click', /^click/i);
        populateSoundSelect(notifSelect, sounds, currentConfig._soundNotif, 'Default Notification', /^(message|notif)/i);
        populateSoundSelect(alarmSelect, sounds, currentConfig._soundAlarm, 'Default Alarm', /^(alarm|timer)/i);
    });
}

async function openSoundManagerModal() {
    const modal = document.getElementById('sound-manager-modal');
    if (!modal) return;

    const clickSelect = document.getElementById('sound-click-select');
    const notifSelect = document.getElementById('sound-notif-select');
    const alarmSelect = document.getElementById('sound-alarm-select');

    if (window.api && window.api.getHardwareSounds) {
        try {
            const sounds = await window.api.getHardwareSounds();
            populateSoundSelect(clickSelect, sounds, currentConfig._soundClick, 'Default Click', /^click/i);
            populateSoundSelect(notifSelect, sounds, currentConfig._soundNotif, 'Default Notification', /^(message|notif)/i);
            populateSoundSelect(alarmSelect, sounds, currentConfig._soundAlarm, 'Default Alarm', /^(alarm|timer)/i);
        } catch (e) {
            console.warn('Failed to load SD card sounds:', e);
        }
    }

    if (clickSelect) clickSelect.value = currentConfig._soundClick || 'default';
    if (notifSelect) notifSelect.value = currentConfig._soundNotif || 'default';
    if (alarmSelect) alarmSelect.value = currentConfig._soundAlarm || 'default';

    initCustomSelects(modal);
    modal.classList.add('visible');
}

function closeSoundManagerModal() {
    const modal = document.getElementById('sound-manager-modal');
    if (modal) modal.classList.remove('visible');
}

function onSoundSelectChange(type, value) {
    if (type === 'click') currentConfig._soundClick = value;
    else if (type === 'notif') currentConfig._soundNotif = value;
    else if (type === 'alarm') currentConfig._soundAlarm = value;
    markUnsaved();

    if (window.api && window.api.setHardwareSound) {
        window.api.setHardwareSound({
            click: currentConfig._soundClick || 'default',
            notif: currentConfig._soundNotif || 'default',
            alarm: currentConfig._soundAlarm || 'default'
        });
    }
}

async function previewSound(type) {
    let selectedFile = null;
    if (type === 'click') selectedFile = document.getElementById('sound-click-select')?.value || currentConfig._soundClick;
    else if (type === 'notif') selectedFile = document.getElementById('sound-notif-select')?.value || currentConfig._soundNotif;
    else if (type === 'alarm') selectedFile = document.getElementById('sound-alarm-select')?.value || currentConfig._soundAlarm;

    if (window.api && window.api.previewHardwareSound) {
        try {
            const played = await window.api.previewHardwareSound(type, selectedFile);
            if (played) return;
        } catch (e) {
            console.warn('Hardware preview not available:', e);
        }
    }

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        const masterGain = audioCtx.createGain();
        const vol = (currentConfig._volume ?? 33) / 100;
        masterGain.gain.setValueAtTime(Math.max(0.05, vol * 0.4), now);
        masterGain.connect(audioCtx.destination);

        if (type === 'click') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(180, now + 0.035);
            gain.gain.setValueAtTime(1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.04);
        } else if (type === 'notif') {
            [1320, 1760].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                const t = now + idx * 0.09;
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(0.8, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(t);
                osc.stop(t + 0.2);
            });
        } else if (type === 'alarm') {
            [880, 1174, 1480].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                const t = now + idx * 0.08;
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(0.4, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(t);
                osc.stop(t + 0.16);
            });
        }
    } catch (e) {
        console.warn('Audio preview error:', e);
    }
}


