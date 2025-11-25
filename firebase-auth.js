// Firebase Authentication Handler
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, signOut } from './firebase-config.js';
import { migrateLocalStorageToFirestore } from './firebase-db.js';

// Global user state
let currentUser = null;

// DOM elements
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const googleSignInBtn = document.getElementById('google-sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
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
            // User is signed in
            currentUser = user;
            console.log('User signed in:', user.email);

            // Update UI with user info
            updateUserProfile(user);

            // Hide login screen, show app
            loginScreen.classList.add('hidden');
            appContainer.style.display = 'block';

            // Migrate localStorage data to Firestore (if any)
            await migrateLocalStorageToFirestore(user.uid);

            // Dispatch custom event that app is ready
            window.dispatchEvent(new CustomEvent('userAuthenticated', { detail: { user } }));
        } else {
            // User is signed out
            currentUser = null;
            console.log('User signed out');

            // Show login screen, hide app
            loginScreen.classList.remove('hidden');
            appContainer.style.display = 'none';
        }
    });
}

// Handle Google Sign-In
async function handleGoogleSignIn() {
    try {
        googleSignInBtn.disabled = true;
        googleSignInBtn.textContent = 'Signing in...';

        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        console.log('Successfully signed in:', user.email);
    } catch (error) {
        console.error('Sign-in error:', error);

        let errorMessage = 'Failed to sign in. Please try again.';

        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in cancelled.';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Pop-up blocked. Please allow pop-ups for this site.';
        }

        alert(errorMessage);

        // Reset button
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = `
            <svg class="google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
        `;
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

// Export init function
export { initAuth };

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
