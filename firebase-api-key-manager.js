// Firebase API Key Manager
// Handles saving/loading Google Cloud API keys to user's Firebase profile

import { db, doc, getDoc, setDoc } from './firebase-config.js';
import { getCurrentUser } from './firebase-auth.js';

// Save Google Cloud API key to user's Firestore profile
export async function saveApiKeyToFirebase(apiKey) {
    try {
        const user = getCurrentUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        const userConfigRef = doc(db, 'users', user.uid, 'config', 'apiKeys');

        await setDoc(userConfigRef, {
            googleCloudApiKey: apiKey,
            updatedAt: Date.now()
        }, { merge: true });

        console.log('API key saved to Firebase successfully');
        return true;
    } catch (error) {
        console.error('Error saving API key to Firebase:', error);
        return false;
    }
}

// Load Google Cloud API key from user's Firestore profile
export async function loadApiKeyFromFirebase() {
    try {
        const user = getCurrentUser();
        if (!user) {
            return null;
        }

        const userConfigRef = doc(db, 'users', user.uid, 'config', 'apiKeys');
        const docSnap = await getDoc(userConfigRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log('API key loaded from Firebase');
            return data.googleCloudApiKey || null;
        }

        return null;
    } catch (error) {
        console.error('Error loading API key from Firebase:', error);
        return null;
    }
}

// Validate Google Cloud Vision API key
export async function validateApiKey(apiKey) {
    try {
        // Test the API key with a minimal request
        const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requests: [{
                    image: {
                        content: testImage.split(',')[1]
                    },
                    features: [{
                        type: 'TEXT_DETECTION',
                        maxResults: 1
                    }]
                }]
            })
        });

        const data = await response.json();

        // Check for errors
        if (data.error) {
            console.error('API key validation failed:', data.error);
            return {
                valid: false,
                error: data.error.message || 'Invalid API key'
            };
        }

        // If we get a response (even with no text), the key is valid
        return {
            valid: true,
            message: 'API key is valid'
        };

    } catch (error) {
        console.error('Error validating API key:', error);
        return {
            valid: false,
            error: 'Failed to validate API key. Please check your connection.'
        };
    }
}

// Track API usage in Firestore
export async function trackApiUsage(apiType, details = {}) {
    try {
        const user = getCurrentUser();
        if (!user) return;

        const usageRef = doc(db, 'users', user.uid, 'usage', apiType);
        const docSnap = await getDoc(usageRef);

        const now = Date.now();
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        let usageData = {
            totalCalls: 0,
            monthlyUsage: {}
        };

        if (docSnap.exists()) {
            usageData = docSnap.data();
        }

        // Update total calls
        usageData.totalCalls = (usageData.totalCalls || 0) + 1;

        // Update monthly usage
        if (!usageData.monthlyUsage) {
            usageData.monthlyUsage = {};
        }
        if (!usageData.monthlyUsage[currentMonth]) {
            usageData.monthlyUsage[currentMonth] = {
                calls: 0,
                firstCall: now,
                lastCall: now
            };
        }

        usageData.monthlyUsage[currentMonth].calls += 1;
        usageData.monthlyUsage[currentMonth].lastCall = now;

        // Add details if provided
        if (Object.keys(details).length > 0) {
            usageData.lastCallDetails = details;
        }

        await setDoc(usageRef, usageData);
        console.log(`${apiType} usage tracked successfully`);

    } catch (error) {
        console.error('Error tracking API usage:', error);
        // Don't throw - usage tracking failure shouldn't break the app
    }
}

// Get usage statistics
export async function getUsageStats() {
    try {
        const user = getCurrentUser();
        if (!user) return null;

        const visionUsageRef = doc(db, 'users', user.uid, 'usage', 'vision');
        const speechUsageRef = doc(db, 'users', user.uid, 'usage', 'speech');

        const [visionSnap, speechSnap] = await Promise.all([
            getDoc(visionUsageRef),
            getDoc(speechUsageRef)
        ]);

        const currentMonth = new Date().toISOString().slice(0, 7);

        const visionData = visionSnap.exists() ? visionSnap.data() : { totalCalls: 0, monthlyUsage: {} };
        const speechData = speechSnap.exists() ? speechSnap.data() : { totalCalls: 0, monthlyUsage: {} };

        return {
            vision: {
                total: visionData.totalCalls || 0,
                thisMonth: visionData.monthlyUsage?.[currentMonth]?.calls || 0,
                freeTierLimit: 1000,
                percentUsed: ((visionData.monthlyUsage?.[currentMonth]?.calls || 0) / 1000 * 100).toFixed(1)
            },
            speech: {
                total: speechData.totalCalls || 0,
                thisMonth: speechData.monthlyUsage?.[currentMonth]?.calls || 0,
                freeTierLimit: 60, // minutes
                percentUsed: ((speechData.monthlyUsage?.[currentMonth]?.calls || 0) / 60 * 100).toFixed(1)
            }
        };

    } catch (error) {
        console.error('Error getting usage stats:', error);
        return null;
    }
}

// Export all functions
export default {
    saveApiKeyToFirebase,
    loadApiKeyFromFirebase,
    validateApiKey,
    trackApiUsage,
    getUsageStats
};
