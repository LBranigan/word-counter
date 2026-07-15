// API Key Manager — embedded key with on-device (localStorage) fallback.
// (Historical name: keys used to be stored in Firebase/Firestore. The
// Firebase project was deleted in 2026; function names and the filename are
// kept so app.js imports stay unchanged.)
import { VISION_API_KEY } from './vision-key.js';
import { debugLog, debugError, API_USAGE_CONSTANTS } from './utils.js';

const KEY_STORAGE = 'googleCloudVisionApiKey';
const USAGE_STORAGE = 'wordAnalyzerApiUsage';

// Save Google Cloud API key on this device
export async function saveApiKeyToFirebase(apiKey) {
    try {
        localStorage.setItem(KEY_STORAGE, apiKey);
        debugLog('API key saved on this device');
        return true;
    } catch (error) {
        debugError('Error saving API key:', error);
        return false;
    }
}

// Load the API key: embedded key wins, otherwise the one saved on this device
export async function loadApiKeyFromFirebase() {
    if (VISION_API_KEY) {
        return VISION_API_KEY;
    }
    return localStorage.getItem(KEY_STORAGE) || null;
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
            debugError('API key validation failed:', data.error);
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
        debugError('Error validating API key:', error);
        return {
            valid: false,
            error: 'Failed to validate API key. Please check your connection.'
        };
    }
}

function readUsage() {
    try {
        return JSON.parse(localStorage.getItem(USAGE_STORAGE)) || {};
    } catch {
        return {};
    }
}

// Track API usage on this device
export async function trackApiUsage(apiType, details = {}) {
    try {
        const usage = readUsage();
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        const typeUsage = usage[apiType] || { totalCalls: 0, monthlyUsage: {} };
        typeUsage.totalCalls = (typeUsage.totalCalls || 0) + 1;
        typeUsage.monthlyUsage = typeUsage.monthlyUsage || {};
        typeUsage.monthlyUsage[currentMonth] = (typeUsage.monthlyUsage[currentMonth] || 0) + 1;
        if (Object.keys(details).length > 0) {
            typeUsage.lastCallDetails = details;
        }
        usage[apiType] = typeUsage;

        localStorage.setItem(USAGE_STORAGE, JSON.stringify(usage));
        debugLog(`${apiType} usage tracked`);
    } catch (error) {
        debugError('Error tracking API usage:', error);
        // Don't throw - usage tracking failure shouldn't break the app
    }
}

// Get usage statistics
export async function getUsageStats() {
    try {
        const usage = readUsage();
        const currentMonth = new Date().toISOString().slice(0, 7);

        const visionMonth = usage.vision?.monthlyUsage?.[currentMonth] || 0;
        const speechMonth = usage.speech?.monthlyUsage?.[currentMonth] || 0;

        return {
            vision: {
                total: usage.vision?.totalCalls || 0,
                thisMonth: visionMonth,
                freeTierLimit: API_USAGE_CONSTANTS.VISION_FREE_TIER_LIMIT,
                percentUsed: (visionMonth / API_USAGE_CONSTANTS.VISION_FREE_TIER_LIMIT * 100).toFixed(1)
            },
            speech: {
                total: usage.speech?.totalCalls || 0,
                thisMonth: speechMonth,
                freeTierLimit: API_USAGE_CONSTANTS.SPEECH_FREE_TIER_LIMIT, // minutes
                percentUsed: (speechMonth / API_USAGE_CONSTANTS.SPEECH_FREE_TIER_LIMIT * 100).toFixed(1)
            }
        };
    } catch (error) {
        debugError('Error getting usage stats:', error);
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
