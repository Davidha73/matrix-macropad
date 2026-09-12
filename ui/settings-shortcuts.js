// ========================================================
// SETTINGS: SHORTCUT & HOTKEY PICKER CONTROLLER
// ========================================================

const isHostMac = (typeof window !== 'undefined' && window.api && window.api.platform === 'darwin') ||
    (typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent));

const macShortcutOptions = [
    { group: 'Launch Applications & Tools', items: [
        { label: 'Open Finder', value: 'RUN open -a Finder' },
        { label: 'Open Terminal', value: 'RUN open -a Terminal' },
        { label: 'Open TextEdit (Notepad)', value: 'RUN open -a TextEdit' },
        { label: 'Open Calculator', value: 'RUN open -a Calculator' },
        { label: 'Open Activity Monitor (Task Manager)', value: 'RUN open -a "Activity Monitor"' },
        { label: 'Open Safari', value: 'RUN open -a Safari' },
        { label: 'Open Notes', value: 'RUN open -a Notes' },
        { label: 'Open System Settings', value: 'RUN open -a "System Settings"' },
        { label: 'Open Screenshot Utility', value: 'RUN open -a Screenshot' },
        { label: 'Open Music', value: 'RUN open -a Music' },
        { label: 'Open Mail', value: 'RUN open -a Mail' },
        { label: 'Open Calendar', value: 'RUN open -a Calendar' },
        { label: 'Open Messages', value: 'RUN open -a Messages' },
        { label: 'Open App Store', value: 'RUN open -a "App Store"' },
        { label: 'Open Macropad Settings', value: 'macropad-settings' }
    ]},
    { group: 'macOS System & Tools', items: [
        { label: 'Spotlight Search (Cmd+Space)', value: 'Cmd+Space' },
        { label: 'Screenshot Area (Cmd+Shift+4)', value: 'Cmd+Shift+4' },
        { label: 'Screen Capture Toolbar (Cmd+Shift+5)', value: 'Cmd+Shift+5' },
        { label: 'Finder (Cmd+Opt+Space)', value: 'Cmd+Alt+Space' },
        { label: 'Emoji & Symbols (Ctrl+Cmd+Space)', value: 'Ctrl+Cmd+Space' },
        { label: 'Mission Control (Ctrl+Up)', value: 'Ctrl+Up' },
        { label: 'Application Windows (Ctrl+Down)', value: 'Ctrl+Down' },
        { label: 'Show Desktop (Cmd+F3)', value: 'Cmd+F3' },
        { label: 'Lock Screen (Ctrl+Cmd+Q)', value: 'Ctrl+Cmd+Q' },
        { label: 'Force Quit Applications (Cmd+Opt+Esc)', value: 'Cmd+Alt+Escape' },
        { label: 'System Settings (Cmd+,)', value: 'Cmd+Comma' }
    ]},
    { group: 'Editing & Clipboard', items: [
        { label: 'Cut (Cmd+X)', value: 'Cmd+X' },
        { label: 'Copy (Cmd+C)', value: 'Cmd+C' },
        { label: 'Paste (Cmd+V)', value: 'Cmd+V' },
        { label: 'Select All (Cmd+A)', value: 'Cmd+A' },
        { label: 'Undo (Cmd+Z)', value: 'Cmd+Z' },
        { label: 'Redo (Cmd+Shift+Z)', value: 'Cmd+Shift+Z' },
        { label: 'Delete', value: 'Delete' },
        { label: 'Save (Cmd+S)', value: 'Cmd+S' },
        { label: 'Find (Cmd+F)', value: 'Cmd+F' }
    ]},
    { group: 'Media & Volume', items: [
        { label: 'Play / Pause', value: 'media-play' },
        { label: 'Next Track', value: 'media-next' },
        { label: 'Previous Track', value: 'media-prev' },
        { label: 'Volume Up', value: 'vol-up' },
        { label: 'Volume Down', value: 'vol-down' },
        { label: 'Mute Audio', value: 'vol-mute' }
    ]},
    { group: 'Window & App Controls', items: [
        { label: 'New Window / Document (Cmd+N)', value: 'Cmd+N' },
        { label: 'Quit Application (Cmd+Q)', value: 'Cmd+Q' },
        { label: 'Close Window (Cmd+W)', value: 'Cmd+W' },
        { label: 'Close All Windows (Cmd+Opt+W)', value: 'Cmd+Alt+W' },
        { label: 'New Window / Tab (Cmd+T)', value: 'Cmd+T' },
        { label: 'Reopen Closed Tab (Cmd+Shift+T)', value: 'Cmd+Shift+T' },
        { label: 'Switch App (Cmd+Tab)', value: 'Cmd+Tab' },
        { label: 'Hide Current App (Cmd+H)', value: 'Cmd+H' },
        { label: 'Hide Other Apps (Cmd+Opt+H)', value: 'Cmd+Alt+H' },
        { label: 'Toggle Full Screen (Ctrl+Cmd+F)', value: 'Ctrl+Cmd+F' },
        { label: 'Minimize Window (Cmd+M)', value: 'Cmd+M' }
    ]},
    { group: 'Browser & Navigation', items: [
        { label: 'Refresh Page (Cmd+R)', value: 'Cmd+R' },
        { label: 'Hard Reload (Cmd+Shift+R)', value: 'Cmd+Shift+R' },
        { label: 'Developer Tools (Cmd+Opt+I)', value: 'Cmd+Alt+I' },
        { label: 'Zoom In (Cmd+=)', value: 'Cmd+Plus' },
        { label: 'Zoom Out (Cmd+-)', value: 'Cmd+Minus' },
        { label: 'Reset Zoom (Cmd+0)', value: 'Cmd+0' }
    ]}
];

const winShortcutOptions = [
    { group: 'Launch Applications & Tools', items: [
        { label: 'Open File Explorer', value: 'RUN explorer' },
        { label: 'Open Notepad', value: 'RUN notepad' },
        { label: 'Open Calculator', value: 'RUN calc' },
        { label: 'Open Task Manager', value: 'RUN taskmgr' },
        { label: 'Open Command Prompt', value: 'RUN cmd' },
        { label: 'Open Windows Terminal', value: 'RUN wt' },
        { label: 'Open PowerShell', value: 'RUN powershell' },
        { label: 'Open Paint', value: 'RUN mspaint' },
        { label: 'Open Snipping Tool', value: 'RUN snippingtool' },
        { label: 'Open Windows Settings', value: 'RUN ms-settings:' },
        { label: 'Open Control Panel', value: 'RUN control' },
        { label: 'Open Macropad Settings', value: 'macropad-settings' }
    ]},
    { group: 'Windows System & Tools', items: [
        { label: 'Screen Snipping Tool (Win+Shift+S)', value: 'Win+Shift+S' },
        { label: 'File Explorer (Win+E)', value: 'Win+E' },
        { label: 'Clipboard History (Win+V)', value: 'Win+V' },
        { label: 'Show Desktop (Win+D)', value: 'Win+D' },
        { label: 'Task View (Win+Tab)', value: 'Win+Tab' },
        { label: 'Settings (Win+I)', value: 'Win+I' },
        { label: 'Run Dialog (Win+R)', value: 'Win+R' },
        { label: 'Emoji Picker (Win+.)', value: 'Win+Period' },
        { label: 'Lock Computer (Win+L)', value: 'Win+L' },
        { label: 'Snap Window Left (Win+Left)', value: 'Win+Left' },
        { label: 'Snap Window Right (Win+Right)', value: 'Win+Right' },
        { label: 'Maximize Window (Win+Up)', value: 'Win+Up' },
        { label: 'Minimize Window (Win+Down)', value: 'Win+Down' },
        { label: 'Action Center / Notifications (Win+N)', value: 'Win+N' },
        { label: 'Quick Settings / Wi-Fi (Win+A)', value: 'Win+A' }
    ]},
    { group: 'Editing & Clipboard', items: [
        { label: 'Cut (Ctrl+X)', value: 'Ctrl+X' },
        { label: 'Copy (Ctrl+C)', value: 'Ctrl+C' },
        { label: 'Paste (Ctrl+V)', value: 'Ctrl+V' },
        { label: 'Select All (Ctrl+A)', value: 'Ctrl+A' },
        { label: 'Undo (Ctrl+Z)', value: 'Ctrl+Z' },
        { label: 'Redo (Ctrl+Y)', value: 'Ctrl+Y' },
        { label: 'Delete', value: 'Delete' },
        { label: 'Save (Ctrl+S)', value: 'Ctrl+S' },
        { label: 'Find (Ctrl+F)', value: 'Ctrl+F' }
    ]},
    { group: 'Media & Volume', items: [
        { label: 'Play / Pause', value: 'media-play' },
        { label: 'Next Track', value: 'media-next' },
        { label: 'Previous Track', value: 'media-prev' },
        { label: 'Volume Up', value: 'vol-up' },
        { label: 'Volume Down', value: 'vol-down' },
        { label: 'Mute Audio', value: 'vol-mute' }
    ]},
    { group: 'Window & App Controls', items: [
        { label: 'New Window / Document (Ctrl+N)', value: 'Ctrl+N' },
        { label: 'Close Window (Alt+F4)', value: 'Alt+F4' },
        { label: 'Close Tab (Ctrl+W)', value: 'Ctrl+W' },
        { label: 'New Tab (Ctrl+T)', value: 'Ctrl+T' },
        { label: 'Reopen Closed Tab (Ctrl+Shift+T)', value: 'Ctrl+Shift+T' },
        { label: 'Switch App (Alt+Tab)', value: 'Alt+Tab' },
        { label: 'Cycle All Windows (Alt+Esc)', value: 'Alt+Escape' },
        { label: 'Task Manager (Ctrl+Shift+Esc)', value: 'Ctrl+Shift+Esc' }
    ]},
    { group: 'Browser & Navigation', items: [
        { label: 'Refresh (F5)', value: 'F5' },
        { label: 'Hard Refresh (Ctrl+F5)', value: 'Ctrl+F5' },
        { label: 'Developer Tools (F12)', value: 'F12' },
        { label: 'Zoom In (Ctrl+=)', value: 'Ctrl+Plus' },
        { label: 'Zoom Out (Ctrl+-)', value: 'Ctrl+Minus' },
        { label: 'Reset Zoom (Ctrl+0)', value: 'Ctrl+0' }
    ]}
];

const shortcutOptions = isHostMac ? macShortcutOptions : winShortcutOptions;
const allKnownShortcutOptions = [...macShortcutOptions, ...winShortcutOptions];

let activeShortcutPickerKey = null;
let activeShortcutCategory = 'All';

function getShortcutDisplayLabel(val) {
    if (!val) return 'No Shortcut Assigned';
    const strVal = String(val).toLowerCase();
    for (const grp of shortcutOptions) {
        const found = grp.items.find(item => String(item.value).toLowerCase() === strVal);
        if (found) return found.label;
    }
    for (const grp of allKnownShortcutOptions) {
        const found = grp.items.find(item => String(item.value).toLowerCase() === strVal);
        if (found) return found.label;
    }
    return `Custom: ${val}`;
}

function getShortcutDisplaySub(val) {
    if (!val) return 'Click to browse system tools, hotkeys, and app launchers';
    const strVal = String(val).toLowerCase();
    for (const grp of shortcutOptions) {
        const found = grp.items.find(item => String(item.value).toLowerCase() === strVal);
        if (found) return `${grp.group} • ${found.value}`;
    }
    for (const grp of allKnownShortcutOptions) {
        const found = grp.items.find(item => String(item.value).toLowerCase() === strVal);
        if (found) return `${grp.group} • ${found.value}`;
    }
    return `Custom Key Combination: ${val}`;
}

function openShortcutPickerModal(key) {
    activeShortcutPickerKey = key;
    activeShortcutCategory = 'All';
    const modal = document.getElementById('shortcut-picker-modal');
    if (!modal) return;

    const searchInput = document.getElementById('shortcut-picker-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder = isHostMac
            ? 'Search shortcuts (e.g. Spotlight, Copy, Screenshot, Cmd+Space)...'
            : 'Search shortcuts (e.g. Snipping, Copy, Volume, Win+E, Task View)...';
    }

    const recordInput = document.getElementById('shortcut-modal-record-input');
    if (recordInput) {
        const cfg = getButtonConfigByKey(key) || {};
        recordInput.value = (cfg.type === 'shortcut' ? (cfg.value || '') : '');
    }

    renderShortcutCategories();
    renderShortcutPickerGrid();
    modal.classList.add('visible');
    if (searchInput) searchInput.focus();
}

function closeShortcutPickerModal() {
    const modal = document.getElementById('shortcut-picker-modal');
    if (modal) modal.classList.remove('visible');
    activeShortcutPickerKey = null;
}

function renderShortcutCategories() {
    const catContainer = document.getElementById('shortcut-picker-categories');
    if (!catContainer) return;
    catContainer.innerHTML = '';

    const categories = ['All', ...shortcutOptions.map(g => g.group)];
    categories.forEach(cat => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = `icon-cat-tab ${cat === activeShortcutCategory ? 'active' : ''}`;
        tab.textContent = cat;
        tab.onclick = () => {
            activeShortcutCategory = cat;
            renderShortcutCategories();
            renderShortcutPickerGrid();
        };
        catContainer.appendChild(tab);
    });
}

function renderShortcutPickerGrid() {
    const grid = document.getElementById('shortcut-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const searchInput = document.getElementById('shortcut-picker-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let itemsToShow = [];
    shortcutOptions.forEach(grp => {
        if (activeShortcutCategory === 'All' || activeShortcutCategory === grp.group) {
            grp.items.forEach(item => {
                const itemLabel = String(item.label || '').toLowerCase();
                const itemVal = String(item.value || '').toLowerCase();
                const grpName = String(grp.group || '').toLowerCase();
                if (!query || itemLabel.includes(query) || itemVal.includes(query) || grpName.includes(query)) {
                    itemsToShow.push({ ...item, group: grp.group });
                }
            });
        }
    });

    if (itemsToShow.length === 0) {
        grid.innerHTML = `<div class="icon-picker-empty">No shortcuts found matching "${query}"</div>`;
        return;
    }

    const currentVal = activeShortcutPickerKey 
        ? String(getButtonConfigByKey(activeShortcutPickerKey).value || '').toLowerCase() 
        : '';

    itemsToShow.forEach(item => {
        const card = document.createElement('button');
        card.type = 'button';
        const isSelected = (String(item.value).toLowerCase() === currentVal);
        card.className = `shortcut-card-btn ${isSelected ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="shortcut-card-content">
                <div class="shortcut-card-title">${item.label}</div>
                <div class="shortcut-card-group">${item.group}</div>
            </div>
            <div class="shortcut-card-badge">${item.value}</div>
        `;
        card.onclick = () => selectShortcutItem(item.value);
        grid.appendChild(card);
    });
}

function filterShortcutPicker() {
    renderShortcutPickerGrid();
}

function clearShortcutPickerSearch() {
    const searchInput = document.getElementById('shortcut-picker-search');
    if (searchInput) {
        searchInput.value = '';
        renderShortcutPickerGrid();
        searchInput.focus();
    }
}

function selectShortcutItem(val, customLabel) {
    if (!activeShortcutPickerKey) return;
    const key = activeShortcutPickerKey;
    closeShortcutPickerModal();

    const target = getButtonConfigByKey(key);

    // Determine clean label to set on the button
    let displayLabel = customLabel;
    if (!displayLabel) {
        const strVal = String(val || '').toLowerCase();
        for (const grp of shortcutOptions) {
            const found = grp.items.find(item => String(item.value).toLowerCase() === strVal);
            if (found) {
                displayLabel = found.label.replace(/\s*\([^)]*\)/, '').trim();
                break;
            }
        }
    }
    if (!displayLabel) displayLabel = val;

    target.label = displayLabel;
    target.type = 'shortcut';
    target.value = val;
    target.payload = val;

    renderPreview();
    renderFormFields();
    markUnsaved();
}

function handleModalHotkeyRecord(e) {
    e.preventDefault();
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push(isHostMac ? 'Opt' : 'Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push(isHostMac ? 'Cmd' : 'Win');

    let key = e.key;
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        e.target.value = parts.join('+');
        return;
    }

    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();

    if (!parts.includes(key)) {
        parts.push(key);
    }
    e.target.value = parts.join('+');
}

function applyModalCustomHotkey() {
    const input = document.getElementById('shortcut-modal-record-input');
    if (!input || !input.value.trim()) return;
    selectShortcutItem(input.value.trim());
}
