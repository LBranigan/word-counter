// App boot module. (Historical name: this used to handle Firebase Google
// sign-in. The Firebase project was deleted in 2026 and login was removed —
// the app now starts directly. The filename is kept so app.js imports stay
// unchanged.)
import { debugLog } from './utils.js';

// DOM elements
const loadingScreen = document.getElementById('loading-screen');
const loadingStatus = document.getElementById('loading-status');
const appContainer = document.getElementById('app-container');
const apiSettingsBtn = document.getElementById('api-settings-btn');

// Update loading status message
function updateLoadingStatus(message) {
    if (loadingStatus) {
        loadingStatus.textContent = message;
    }
}

// Called by app.js when initialization is complete
function showAppReady() {
    loadingScreen.style.display = 'none';
    appContainer.style.display = 'block';
}

function boot() {
    debugLog('Starting app (no sign-in required)');

    if (apiSettingsBtn) {
        apiSettingsBtn.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('openApiSettings'));
        });
    }

    loadingScreen.style.display = 'flex';
    updateLoadingStatus('Loading...');

    // app.js listens for this event and runs its initialization
    window.dispatchEvent(new CustomEvent('userAuthenticated', { detail: { user: null } }));
}

export { showAppReady, updateLoadingStatus };

// Boot after all module scripts have evaluated, so app.js has registered
// its 'userAuthenticated' listener before the event is dispatched.
if (document.readyState === 'complete') {
    boot();
} else {
    document.addEventListener('DOMContentLoaded', boot);
}
