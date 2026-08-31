// ========================================================
// SETTINGS: PROFILE I/O, FILE OPERATIONS & STATE MANAGER
// ========================================================

let lastSavedConfig = null;

function markUnsaved() {
    const saveBtn = document.getElementById('save-btn') || document.querySelector('.btn.save');
    if (saveBtn) {
        saveBtn.textContent = 'Save Layout';
    }
}

function markSaved() {
    const saveBtn = document.getElementById('save-btn') || document.querySelector('.btn.save');
    if (saveBtn) {
        saveBtn.textContent = 'Saved';
    }
}

function updateLayoutBadge(name) {
    const badge = document.getElementById('current-layout-name');
    if (badge) {
        const rawName = name || currentConfig._layoutName || 'Default (Active)';
        badge.textContent = rawName.replace(/\.json$/i, '');
    }
}

async function loadLayoutFile() {
    if (window.api && window.api.importProfile) {
        const res = await window.api.importProfile();
        if (res && res.data) {
            currentConfig = JSON.parse(JSON.stringify(res.data));
            currentConfig._layoutName = res.fileName || `${res.profileName}.json`;
            currentConfig._activeFilePath = res.filePath;
            updateLayoutBadge(res.fileName || `${res.profileName}.json`);
            syncThemeUI();
            updatePreviewTabTitles();
            renderFormFields();
            renderPreview();
            const currentPageName = currentConfig[`p${activePage}-name`] || `Page ${activePage}`;
            const titleEl = document.getElementById('editor-title');
            if (titleEl) titleEl.textContent = `Configure ${currentPageName}`;
            const pageNameInput = document.getElementById('page-name-input');
            if (pageNameInput) pageNameInput.value = currentPageName;
            markSaved();
        }
    }
}

async function saveLayoutFile() {
    saveCurrentFormInputs();
    if (window.api && window.api.exportProfile) {
        const res = await window.api.exportProfile(JSON.parse(JSON.stringify(currentConfig)));
        if (res && res.fileName) {
            currentConfig._layoutName = res.fileName;
            currentConfig._activeFilePath = res.filePath;
            updateLayoutBadge(res.fileName);
            markSaved();
        }
    }
}

function restoreDefaultLayout() {
    if (!confirm('Are you sure you want to reset all pages and buttons to the default factory layout? Any unsaved changes will be lost.')) return;

    currentConfig = getDefaultConfig();
    updateLayoutBadge('Default (Active)');
    activePage = 1;
    selectedButtonIndex = 1;
    syncThemeUI();
    updatePreviewTabTitles();
    renderFormFields();
    renderPreview();
    const currentPageName = currentConfig[`p1-name`] || 'Page 1';
    const titleEl = document.getElementById('editor-title');
    if (titleEl) titleEl.textContent = `Configure ${currentPageName}`;
    const pageNameInput = document.getElementById('page-name-input');
    if (pageNameInput) pageNameInput.value = currentPageName;
    markUnsaved();
}

async function saveSettings() {
    saveCurrentFormInputs();
    if (window.api && window.api.saveConfig) {
        await window.api.saveConfig(JSON.parse(JSON.stringify(currentConfig)));
    }
    lastSavedConfig = JSON.parse(JSON.stringify(currentConfig));
    markSaved();
}

function handleCloseRequest() {
    saveCurrentFormInputs();
    const hasUnsaved = lastSavedConfig && (JSON.stringify(currentConfig) !== JSON.stringify(lastSavedConfig));
    if (hasUnsaved) {
        const modal = document.getElementById('unsaved-modal');
        if (modal) modal.classList.add('visible');
    } else {
        window.close();
    }
}

function dismissUnsavedModal() {
    const modal = document.getElementById('unsaved-modal');
    if (modal) modal.classList.remove('visible');
}

function closeWithoutSaving() {
    dismissUnsavedModal();
    window.close();
}

async function saveAndClose() {
    await saveSettings();
    dismissUnsavedModal();
    window.close();
}
