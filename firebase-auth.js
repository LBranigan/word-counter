// Firebase Authentication Handler
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, signOut } from './firebase-config.js';
import { migrateLocalStorageToFirestore } from './firebase-db.js';

// Global user state
let currentUser = null;
let userClickedSignIn = false;  // Track if user explicitly clicked sign-in
let cachedUser = null;  // Store user from previous session

// DOM elements
const loginScreen = document.getElementById('login-screen');
const loadingScreen = document.getElementById('loading-screen');
const loadingStatus = document.getElementById('loading-status');
const appContainer = document.getElementById('app-container');
const googleSignInBtn = document.getElementById('google-sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const apiSettingsBtn = document.getElementById('api-settings-btn');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const userProfileDisplay = document.getElementById('user-profile-display');
const userMenuBtn = document.getElementById('user-menu-btn');
const userMenu = document.querySelector('.user-menu');

// Initialize authentication
function initAuth() {
    // Set up Google Sign-In button
    googleSignInBtn.addEventListener('click', handleGoogleSignIn);

    // Set up Sign-Out button
    signOutBtn.addEventListener('click', handleSignOut);

    // Set up API Settings button
    if (apiSettingsBtn) {
        apiSettingsBtn.addEventListener('click', handleApiSettings);
    }

    // Set up user menu dropdown toggle
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('open');
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (userMenu && !userMenu.contains(e.target)) {
            userMenu.classList.remove('open');
        }
    });

    // Listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in (either fresh login or returning session)
            currentUser = user;
            console.log('User detected:', user.email);

            // If user hasn't clicked sign-in yet, just update the button and wait
            if (!userClickedSignIn) {
                cachedUser = user;
                updateSignInButtonForReturningUser(user);
                return;  // Don't proceed to app yet - wait for button click
            }

            // User clicked sign-in, proceed to app
            await proceedToApp(user);
        } else {
            // User is signed out
            currentUser = null;
            cachedUser = null;
            userClickedSignIn = false;
            console.log('User signed out');

            // Show login screen, hide app and loading screen
            loginScreen.classList.remove('hidden');
            loadingScreen.style.display = 'none';
            appContainer.style.display = 'none';

            // Reset button to default state
            resetSignInButton();
        }
    });
}

// Update sign-in button for returning users
function updateSignInButtonForReturningUser(user) {
    const displayName = user.displayName || user.email;
    const firstName = displayName.split(' ')[0];

    googleSignInBtn.innerHTML = `
        <img src="${user.photoURL || ''}" class="returning-user-photo" alt="" style="width: 24px; height: 24px; border-radius: 50%; ${user.photoURL ? '' : 'display: none;'}">
        Continue as ${firstName}
    `;
    googleSignInBtn.classList.add('returning-user');
}

// Reset sign-in button to default
function resetSignInButton() {
    googleSignInBtn.innerHTML = `
        <svg class="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
    `;
    googleSignInBtn.classList.remove('returning-user');
    googleSignInBtn.disabled = false;
}

// Proceed to app after user clicks sign-in
async function proceedToApp(user) {
    // Update UI with user info
    updateUserProfile(user);

    // Show loading screen, hide login screen
    loginScreen.classList.add('hidden');
    loadingScreen.style.display = 'flex';
    updateLoadingStatus('Checking your settings...');

    // Migrate localStorage data to Firestore (if any)
    updateLoadingStatus('Syncing data...');
    await migrateLocalStorageToFirestore(user.uid);

    // Dispatch custom event for app initialization
    // App will call showAppReady() when done loading
    updateLoadingStatus('Loading your classroom...');
    window.dispatchEvent(new CustomEvent('userAuthenticated', { detail: { user } }));
}

// Update loading status message
function updateLoadingStatus(message) {
    if (loadingStatus) {
        loadingStatus.textContent = message;
    }
}

// Called by app.js when initialization is complete
function showAppReady() {
    // Hide loading screen, show app
    loadingScreen.style.display = 'none';
    appContainer.style.display = 'block';
}

// Handle API Settings click
function handleApiSettings() {
    // Close the dropdown
    if (userMenu) userMenu.classList.remove('open');

    // Dispatch event for app.js to handle
    window.dispatchEvent(new CustomEvent('openApiSettings'));
}

// Handle Google Sign-In
async function handleGoogleSignIn() {
    userClickedSignIn = true;
    googleSignInBtn.disabled = true;

    // If user is already authenticated (returning user), just proceed to app
    if (cachedUser) {
        googleSignInBtn.textContent = 'Loading...';
        await proceedToApp(cachedUser);
        return;
    }

    // New user - show Google sign-in popup
    try {
        googleSignInBtn.textContent = 'Signing in...';

        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        console.log('Successfully signed in:', user.email);
        // onAuthStateChanged will handle the rest since userClickedSignIn is true
    } catch (error) {
        console.error('Sign-in error:', error);
        userClickedSignIn = false;  // Reset flag on error

        let errorMessage = 'Failed to sign in. Please try again.';

        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in cancelled.';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Pop-up blocked. Please allow pop-ups for this site.';
        }

        alert(errorMessage);

        // Reset button
        resetSignInButton();
    }
}

// Handle Sign-Out
async function handleSignOut() {
    // Close the dropdown first
    if (userMenu) userMenu.classList.remove('open');

    if (confirm('Are you sure you want to sign out?')) {
        try {
            await signOut(auth);
            console.log('Successfully signed out');
        } catch (error) {
            console.error('Sign-out error:', error);
            alert('Failed to sign out. Please try again.');
        }
    }
}

// Update user profile display in header
function updateUserProfile(user) {
    if (user.photoURL) {
        userPhoto.src = user.photoURL;
        userPhoto.style.display = 'block';
    } else {
        userPhoto.style.display = 'none';
    }

    userName.textContent = user.displayName || user.email;
    userProfileDisplay.style.display = 'flex';
}

// Get current authenticated user
export function getCurrentUser() {
    return currentUser;
}

// Export functions
export { initAuth, showAppReady, updateLoadingStatus };

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
