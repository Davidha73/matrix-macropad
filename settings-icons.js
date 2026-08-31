// ========================================================
// SETTINGS: MATERIAL ICONS & ASSET CONTROLLER
// ========================================================

const materialIconCatalog = [
    { category: 'Apps & Launchers', icons: ['edit_note', 'calculate', 'palette', 'brush', 'monitoring', 'analytics', 'folder', 'folder_open', 'terminal', 'code', 'screenshot', 'crop', 'description', 'settings', 'build', 'tune', 'apps', 'dashboard', 'widgets', 'mail', 'chat', 'calendar_month', 'music_note', 'storefront', 'travel_explore'] },
    { category: 'Media & Playback', icons: ['play_arrow', 'pause', 'play_pause', 'stop', 'skip_previous', 'skip_next', 'fast_forward', 'fast_rewind', 'replay', 'shuffle', 'repeat', 'equalizer', 'radio', 'movie', 'music_note', 'queue_music', 'volume_up', 'volume_down', 'volume_mute', 'volume_off'] },
    { category: 'Audio & Sound', icons: ['volume_up', 'volume_down', 'volume_mute', 'volume_off', 'mic', 'mic_off', 'headphones', 'hearing', 'speaker', 'surround_sound', 'spatial_audio', 'graphic_eq'] },
    { category: 'Editing & Clipboard', icons: ['close', 'cancel', 'clear', 'highlight_off', 'check', 'done', 'check_circle', 'add', 'remove', 'content_cut', 'content_copy', 'content_paste', 'undo', 'redo', 'select_all', 'edit', 'delete', 'save', 'refresh', 'find_in_page', 'text_fields', 'format_bold', 'format_italic', 'format_list_bulleted', 'format_quote', 'link', 'link_off'] },
    { category: 'Navigation & Web', icons: ['close', 'arrow_back', 'arrow_forward', 'arrow_left', 'arrow_right', 'chevron_left', 'chevron_right', 'arrow_upward', 'arrow_downward', 'language', 'home', 'public', 'open_in_new', 'tab', 'tab_close', 'link', 'bookmark', 'search', 'explore', 'folder', 'folder_open', 'refresh', 'sync'] },
    { category: 'System & Tools', icons: ['close', 'cancel', 'exit_to_app', 'logout', 'settings', 'build', 'tune', 'terminal', 'code', 'lock', 'lock_open', 'power_settings_new', 'power_off', 'restart_alt', 'desktop_windows', 'laptop', 'smartphone', 'videocam', 'camera_alt', 'screenshot', 'bolt', 'rocket_launch', 'timer', 'hourglass_top', 'hourglass_bottom', 'hourglass_empty', 'schedule', 'notifications', 'sports_esports', 'shield', 'info', 'warning', 'help'] }
];

function isImageFile(icon) {
    if (!icon || typeof icon !== 'string') return false;
    if (icon.startsWith('data:image/') || icon.startsWith('data:application/') || icon.startsWith('http://') || icon.startsWith('https://')) return true;
    return /\.(png|jpg|jpeg|svg|webp|bmp|gif|ico)$/i.test(icon);
}

let activeIconPickerKey = null;
let activeIconCategory = 'All';

function openIconPickerModal(key) {
    activeIconPickerKey = key;
    activeIconCategory = 'All';
    renderIconPickerCategories();
    renderIconPickerGrid();
    const modal = document.getElementById('icon-picker-modal');
    if (modal) modal.classList.add('visible');
    const searchInput = document.getElementById('icon-picker-search');
    if (searchInput) {
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 50);
    }
}

function closeIconPickerModal() {
    const modal = document.getElementById('icon-picker-modal');
    if (modal) modal.classList.remove('visible');
    activeIconPickerKey = null;
}

function renderIconPickerCategories() {
    const container = document.getElementById('icon-picker-categories');
    if (!container) return;
    container.innerHTML = '';

    const categories = ['All', ...materialIconCatalog.map(c => c.category)];
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `icon-cat-tab${cat === activeIconCategory ? ' active' : ''}`;
        btn.textContent = cat;
        btn.onclick = () => {
            activeIconCategory = cat;
            renderIconPickerCategories();
            renderIconPickerGrid();
        };
        container.appendChild(btn);
    });
}

function renderIconPickerGrid() {
    const grid = document.getElementById('icon-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const searchInput = document.getElementById('icon-picker-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let iconsToShow = [];
    materialIconCatalog.forEach(cat => {
        if (activeIconCategory === 'All' || activeIconCategory === cat.category) {
            cat.icons.forEach(name => {
                if (!iconsToShow.includes(name)) {
                    if (!query || name.toLowerCase().includes(query)) {
                        iconsToShow.push(name);
                    }
                }
            });
        }
    });

    if (iconsToShow.length === 0) {
        grid.innerHTML = `<div class="icon-picker-empty">No icons found matching "${query}"</div>`;
        return;
    }

    iconsToShow.forEach(iconName => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'icon-card-btn';
        card.title = iconName;
        card.innerHTML = `
            <span class="material-symbols-outlined">${iconName}</span>
            <span class="icon-card-label">${iconName.replace(/_/g, ' ')}</span>
        `;
        card.onclick = () => selectMaterialIcon(iconName);
        grid.appendChild(card);
    });
}

function filterIconPicker() {
    renderIconPickerGrid();
}

function clearIconPickerSearch() {
    const searchInput = document.getElementById('icon-picker-search');
    if (searchInput) {
        searchInput.value = '';
        renderIconPickerGrid();
        searchInput.focus();
    }
}

function selectMaterialIcon(iconName) {
    if (!activeIconPickerKey) return;
    const target = getButtonConfigByKey(activeIconPickerKey);
    target.materialIcon = iconName;
    target.icon = iconName;
    saveCurrentFormInputs();
    renderPreview();
    renderFormFields();
    markUnsaved();
    closeIconPickerModal();
}

function removeMaterialIcon(key) {
    const target = getButtonConfigByKey(key);
    delete target.materialIcon;
    saveCurrentFormInputs();
    renderPreview();
    renderFormFields();
    markUnsaved();
}
