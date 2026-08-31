/**
 * Matrix Macropad — ESP32-S3 Hardware Bridge UI Sync
 * Listens to background Node.js serial streaming status and updates Settings badges.
 */

function initHardwareStatusBridge() {
    if (window.api && typeof window.api.onHardwareStatus === 'function') {
        window.api.onHardwareStatus((status) => {
            if (status) updateHardwareStatusUI(status.connected, status.port || 'COM5');
        });
    }
    if (window.api && typeof window.api.getHardwareStatus === 'function') {
        window.api.getHardwareStatus().then(status => {
            if (status) updateHardwareStatusUI(status.connected, status.port || 'COM5');
        });
    }
}

function updateHardwareStatusUI(connected, boardName = 'COM5') {
    const badge = document.getElementById('hardware-status-badge');

    if (badge) {
        if (connected) {
            badge.textContent = `Connected (${boardName})`;
            badge.classList.add('badge-connected');
            badge.classList.remove('badge-disconnected');
        } else {
            badge.textContent = 'Disconnected';
            badge.classList.add('badge-disconnected');
            badge.classList.remove('badge-connected');
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initHardwareStatusBridge();
});
