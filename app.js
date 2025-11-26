// Firebase Database Functions
import {
    getAllStudents,
    saveAllStudents,
    addStudent,
    getStudent,
    updateStudent,
    deleteStudent,
    addAssessmentToStudent,
    deleteAssessment,
    getStudentStats,
    initializeSampleStudents
} from './firebase-db.js';

// Firebase API Key Manager
import {
    saveApiKeyToFirebase,
    loadApiKeyFromFirebase,
    validateApiKey,
    trackApiUsage,
    getUsageStats
} from './firebase-api-key-manager.js';

// Firebase Auth (for loading screen control)
import {
    showAppReady,
    updateLoadingStatus
} from './firebase-auth.js';

// Utilities: XSS sanitization, debug logging, and constants
import {
    escapeHtml,
    escapeJsonForAttribute,
    debugLog,
    debugError,
    debugWarn,
    CAMERA_CONSTANTS,
    AUDIO_CONSTANTS,
    CANVAS_CONSTANTS,
    ANALYSIS_CONSTANTS,
    ACCURACY_THRESHOLDS,
    API_USAGE_CONSTANTS,
    UI_CONSTANTS,
    getAccuracyClassification,
    getCardAccuracyClass,
    getUsageStatusClass
} from './utils.js';

// App State
const state = {
    apiKey: null,
    stream: null,
    capturedImage: null,
    ocrData: null,
    selectedWords: new Set(),
    isDrawing: false,
    wasDragged: false,
    startPoint: null,
    endPoint: null,
    // Zoom and pan state
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartPoint: null,
    // Audio recording state
    audioStream: null,
    mediaRecorder: null,
    audioChunks: [],
    recordingTimer: null,
    recordingStartTime: null,
    recordingDuration: 0,
    recordedAudioBlob: null,
    audioMimeType: 'audio/webm;codecs=opus', // Default, updated during recording
    audioSampleRate: 48000, // Default, updated from actual audio track
    audioChannelCount: 1, // Default, updated from actual audio track
    // Analysis results
    latestAnalysis: null,
    latestExpectedWords: null,
    latestSpokenWords: null,
    latestProsodyMetrics: null,
    latestErrorPatterns: null,
    // Step management
    currentStep: 'setup',
    completedSteps: new Set(),
    stepsOrder: ['setup', 'audio', 'capture', 'highlight', 'results'],
    // Current student being assessed
    currentAssessmentStudentId: null,
    // Track if current assessment was already saved (prevents duplicates)
    assessmentAlreadySaved: false,
    // Audio skip mode (word count only)
    audioSkipped: false,
    // Historical assessment viewing
    viewingHistoricalAssessment: false,
    historicalAssessmentStudent: null,
    historicalAssessmentDate: null,
    historicalAssessmentStudentId: null
};

// Image cache for canvas rendering performance
const imageCache = {
    img: null,
    src: null,
    loading: false,

    // Load image and cache it, returns promise
    load(src) {
        // If same source and already loaded, return cached image
        if (this.src === src && this.img && this.img.complete) {
            return Promise.resolve(this.img);
        }

        // If already loading this source, wait for it
        if (this.loading && this.src === src) {
            return new Promise((resolve) => {
                const checkLoaded = setInterval(() => {
                    if (this.img && this.img.complete) {
                        clearInterval(checkLoaded);
                        resolve(this.img);
                    }
                }, 10);
            });
        }

        // Load new image
        this.loading = true;
        this.src = src;

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.img = img;
                this.loading = false;
                resolve(img);
            };
            img.onerror = () => {
                this.loading = false;
                debugError('Failed to load image');
            };
            img.src = src;
        });
    },

    // Clear the cache
    clear() {
        this.img = null;
        this.src = null;
        this.loading = false;
    }
};

// Word Tooltip Manager
const wordTooltipManager = {
    tooltip: null,
    touchTimer: null,
    hideTimer: null,
    activeElement: null,
    isTouchDevice: false,

    init() {
        // Create tooltip element
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'word-tooltip';
        document.body.appendChild(this.tooltip);

        // Add global event listeners
        document.addEventListener('mouseover', this.handleMouseOver.bind(this));
        document.addEventListener('mouseout', this.handleMouseOut.bind(this));
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        document.addEventListener('touchmove', this.handleTouchMove.bind(this));
        document.addEventListener('click', this.handleClick.bind(this));
    },

    handleMouseOver(e) {
        // Ignore mouse events on touch devices
        if (this.isTouchDevice) return;

        const wordSpan = e.target.closest('[data-word-info]');
        if (wordSpan) {
            this.showTooltip(wordSpan, e);
        }
    },

    handleMouseOut(e) {
        // Ignore mouse events on touch devices
        if (this.isTouchDevice) return;

        const wordSpan = e.target.closest('[data-word-info]');
        if (wordSpan) {
            this.hideTooltip();
        }
    },

    handleTouchStart(e) {
        this.isTouchDevice = true;
        const wordSpan = e.target.closest('[data-word-info]');
        if (wordSpan) {
            this.activeElement = wordSpan;
            // Clear any existing hide timer
            if (this.hideTimer) {
                clearTimeout(this.hideTimer);
                this.hideTimer = null;
            }
            // Show tooltip immediately on tap (no delay)
            this.showTooltip(wordSpan, e.touches[0]);
        }
    },

    handleTouchEnd(e) {
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }
        // Only set hide timer if tooltip is visible
        if (this.tooltip.classList.contains('visible')) {
            // Clear any existing hide timer
            if (this.hideTimer) {
                clearTimeout(this.hideTimer);
            }
            // Hide tooltip after 5 seconds on mobile
            this.hideTimer = setTimeout(() => this.hideTooltip(), 5000);
        }
    },

    handleTouchMove(e) {
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }
    },

    handleClick(e) {
        // On touch devices, ignore click events on word spans (handled by touch)
        if (this.isTouchDevice) {
            const wordSpan = e.target.closest('[data-word-info]');
            if (wordSpan) return; // Let touch handle it
        }

        const wordSpan = e.target.closest('[data-word-info]');
        if (!wordSpan && this.tooltip.classList.contains('visible')) {
            this.hideTooltip();
        }
    },

    showTooltip(element, event) {
        try {
            const data = JSON.parse(element.dataset.wordInfo);
            this.tooltip.innerHTML = this.buildTooltipContent(data);
            this.tooltip.classList.add('visible');

            // Position tooltip
            const x = event.clientX || event.pageX;
            const y = event.clientY || event.pageY;
            this.positionTooltip(x, y);
        } catch (err) {
            debugError('Error showing tooltip:', err);
        }
    },

    hideTooltip() {
        this.tooltip.classList.remove('visible');
        this.activeElement = null;
    },

    positionTooltip(x, y) {
        const tooltip = this.tooltip;
        const padding = 15;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Get tooltip dimensions
        tooltip.style.left = '0';
        tooltip.style.top = '0';
        const tooltipRect = tooltip.getBoundingClientRect();

        // Calculate position
        let left = x + padding;
        let top = y + padding;

        // Adjust if tooltip goes off-screen
        if (left + tooltipRect.width > viewportWidth - padding) {
            left = x - tooltipRect.width - padding;
        }
        if (top + tooltipRect.height > viewportHeight - padding) {
            top = y - tooltipRect.height - padding;
        }

        // Ensure minimum position
        left = Math.max(padding, left);
        top = Math.max(padding, top);

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    },

    buildTooltipContent(data) {
        const statusLabels = {
            correct: 'Correct',
            skipped: 'Skipped',
            misread: 'Misread',
            substituted: 'Substituted'
        };

        let html = `<div class="word-tooltip-header ${data.status}">${statusLabels[data.status] || data.status}</div>`;

        html += `<div class="word-tooltip-row">
            <span class="word-tooltip-label">Expected:</span>
            <span class="word-tooltip-value">"${data.expected}"</span>
        </div>`;

        if (data.status !== 'correct' && data.status !== 'skipped' && data.spoken) {
            html += `<div class="word-tooltip-row">
                <span class="word-tooltip-label">Heard:</span>
                <span class="word-tooltip-value">"${data.spoken}"</span>
            </div>`;
        }

        if (data.status === 'correct' && data.confidence) {
            html += `<div class="word-tooltip-row">
                <span class="word-tooltip-label">Confidence:</span>
                <span class="word-tooltip-value">${(data.confidence * 100).toFixed(0)}%</span>
            </div>`;
        }

        if (data.reason) {
            html += `<div class="word-tooltip-reason">${data.reason}</div>`;
        }

        return html;
    }
};

// DOM Elements
const setupSection = document.getElementById('setup-section');
const cameraSection = document.getElementById('camera-section');
const imageSection = document.getElementById('image-section');
const camera = document.getElementById('camera');
const cameraCanvas = document.getElementById('camera-canvas');
const selectionCanvas = document.getElementById('selection-canvas');
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const captureBtn = document.getElementById('capture-btn');
const retakeBtn = document.getElementById('retake-btn');
const resetSelectionBtn = document.getElementById('reset-selection-btn');
const exportOutput = document.getElementById('export-output');
const uploadBtnCamera = document.getElementById('upload-btn-camera');
const uploadBtnImage = document.getElementById('upload-btn-image');
const fileInputCamera = document.getElementById('file-input-camera');
const fileInputImage = document.getElementById('file-input-image');
const wordCountDisplay = document.getElementById('word-count');
const statusDisplay = document.getElementById('status');

// Audio Recording Elements
const recordAudioBtn = document.getElementById('record-audio-btn');
const recordAudioBtnImage = document.getElementById('record-audio-btn-image');
const audioModal = document.getElementById('audio-modal');
const recordingModal = document.getElementById('recording-modal');
const audioDurationInput = document.getElementById('audio-duration');
const audioBitrateInput = document.getElementById('audio-bitrate');
const startRecordingBtn = document.getElementById('start-recording-btn');
const cancelRecordingBtn = document.getElementById('cancel-recording-btn');
const stopRecordingBtn = document.getElementById('stop-recording-btn');
const recordingTimer = document.getElementById('recording-timer');
const progressBar = document.getElementById('progress-bar');
const audioPlaybackSection = document.getElementById('audio-playback-section');
const audioPlayer = document.getElementById('audio-player');
const downloadAudioBtn = document.getElementById('download-audio-btn');
const analyzeAudioBtn = document.getElementById('analyze-audio-btn');
const autoDetectBtn = document.getElementById('auto-detect-btn');
const redoAutodetectBtn = document.getElementById('redo-autodetect-btn');

// New Step Navigation Elements
const breadcrumbNav = document.getElementById('breadcrumb-nav');
const audioSection = document.getElementById('audio-section');
const resultsSection = document.getElementById('results-section');
const skipAudioBtn = document.getElementById('skip-audio-btn');
const nextToCaptureBtn = document.getElementById('next-to-capture-btn');
const backToAudioBtn = document.getElementById('back-to-audio-btn');
const nextToHighlightBtn = document.getElementById('next-to-highlight-btn');
const backToCaptureBtn = document.getElementById('back-to-capture-btn');
const backToEditBtn = document.getElementById('back-to-edit-btn');
const startNewAnalysisBtn = document.getElementById('start-new-analysis-btn');
const historicalAssessmentBanner = document.getElementById('historical-assessment-banner');
const historicalStudentName = document.getElementById('historical-student-name');
const historicalAssessmentDate = document.getElementById('historical-assessment-date');
const backToProfileBtn = document.getElementById('back-to-profile-btn');
const goToAudioBtn = document.getElementById('go-to-audio-btn');
const miniPreviewCanvas = document.getElementById('mini-preview-canvas');
const audioPlayerMain = document.getElementById('audio-player-main');
const audioPlayerSection = document.getElementById('audio-player-section');
const downloadAudioBtnMain = document.getElementById('download-audio-btn-main');
const rerecordAudioBtn = document.getElementById('rerecord-audio-btn');
const selectionWordCount = document.getElementById('selection-word-count');
const reqAudio = document.getElementById('req-audio');
const reqSelection = document.getElementById('req-selection');
const resultsContainer = document.getElementById('results-container');

// Highlight Loading Overlay Elements
const highlightLoadingOverlay = document.getElementById('highlight-loading-overlay');
const highlightLoadingStatus = document.getElementById('highlight-loading-status');
const loadingStep1 = document.getElementById('loading-step-1');
const loadingStep2 = document.getElementById('loading-step-2');
const loadingStep3 = document.getElementById('loading-step-3');

// Initialize
async function init() {
    // Check if API key is already saved in Firebase (or fallback to localStorage for migration)
    const firebaseKey = await loadApiKeyFromFirebase();
    const localKey = localStorage.getItem('googleCloudVisionApiKey');

    if (firebaseKey) {
        state.apiKey = firebaseKey;
        showCameraSection();
    } else if (localKey) {
        // Migrate from localStorage to Firebase
        state.apiKey = localKey;
        await saveApiKeyToFirebase(localKey);
        localStorage.removeItem('googleCloudVisionApiKey'); // Clean up old storage
        showCameraSection();
    }

    // Display usage stats if API key exists
    // DISABLED: API usage widget removed per user request
    // if (state.apiKey) {
    //     displayUsageStats();
    // }

    // Event listeners
    if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', saveApiKey);
    if (captureBtn) captureBtn.addEventListener('click', capturePhoto);
    if (retakeBtn) retakeBtn.addEventListener('click', retakePhoto);
    if (resetSelectionBtn) resetSelectionBtn.addEventListener('click', resetSelection);
    if (uploadBtnCamera && fileInputCamera) uploadBtnCamera.addEventListener('click', () => fileInputCamera.click());
    if (uploadBtnImage && fileInputImage) uploadBtnImage.addEventListener('click', () => fileInputImage.click());
    if (fileInputCamera) fileInputCamera.addEventListener('change', handleFileUpload);
    if (fileInputImage) fileInputImage.addEventListener('change', handleFileUpload);

    // Audio recording event listeners
    if (recordAudioBtn) recordAudioBtn.addEventListener('click', openAudioModal);
    if (recordAudioBtnImage) recordAudioBtnImage.addEventListener('click', openAudioModal);
    if (startRecordingBtn) startRecordingBtn.addEventListener('click', startRecording);
    if (cancelRecordingBtn) cancelRecordingBtn.addEventListener('click', closeAudioModal);
    if (stopRecordingBtn) stopRecordingBtn.addEventListener('click', stopRecording);
    if (downloadAudioBtn) downloadAudioBtn.addEventListener('click', downloadRecordedAudio);
    if (analyzeAudioBtn) analyzeAudioBtn.addEventListener('click', analyzeRecordedAudio);
    if (autoDetectBtn) autoDetectBtn.addEventListener('click', autoDetectSpokenWords);
    if (redoAutodetectBtn) redoAutodetectBtn.addEventListener('click', runAutoDetectOnEntry);

    // Zoom controls event listeners
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);

    // Step navigation event listeners
    if (skipAudioBtn) skipAudioBtn.addEventListener('click', skipAudioRecording);
    if (nextToCaptureBtn) nextToCaptureBtn.addEventListener('click', () => goToStep('capture'));
    if (backToAudioBtn) backToAudioBtn.addEventListener('click', () => goToStep('audio'));
    if (nextToHighlightBtn) nextToHighlightBtn.addEventListener('click', () => goToStep('highlight'));
    if (backToCaptureBtn) backToCaptureBtn.addEventListener('click', () => goToStep('capture'));
    if (backToEditBtn) backToEditBtn.addEventListener('click', () => goToStep('highlight'));
    if (startNewAnalysisBtn) startNewAnalysisBtn.addEventListener('click', startNewAnalysis);
    if (backToProfileBtn) backToProfileBtn.addEventListener('click', returnToStudentProfile);
    if (goToAudioBtn) goToAudioBtn.addEventListener('click', () => goToStep('audio'));
    if (rerecordAudioBtn) rerecordAudioBtn.addEventListener('click', openAudioModal);
    if (downloadAudioBtnMain) downloadAudioBtnMain.addEventListener('click', downloadRecordedAudio);

    // Breadcrumb click handlers
    setupBreadcrumbClickHandlers();

    // Initialize breadcrumb update
    updateBreadcrumb();

    // Initialize word tooltip manager
    wordTooltipManager.init();

    // Browser history integration for back/forward button support
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.step) {
            // Navigate without adding another history entry
            goToStep(event.state.step, false);
        } else {
            // No state = initial page, go to audio step
            goToStep('audio', false);
        }
    });

    // Initialize browser history state
    const hashStep = window.location.hash.slice(1);
    const validSteps = ['audio', 'capture', 'highlight', 'results'];
    if (hashStep && validSteps.includes(hashStep) && canAccessStep(hashStep)) {
        // Restore step from URL hash
        history.replaceState({ step: hashStep }, '', `#${hashStep}`);
        goToStep(hashStep, false);
    } else {
        // Set initial history state
        history.replaceState({ step: state.currentStep }, '', `#${state.currentStep}`);
    }
}

// Save API Key with validation
async function saveApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) {
        alert('Please enter your API key');
        return;
    }

    // Disable button and show loading state
    saveApiKeyBtn.disabled = true;
    saveApiKeyBtn.textContent = 'Validating...';

    // Validate the API key
    const validation = await validateApiKey(key);

    if (!validation.valid) {
        // Show error
        alert(`Invalid API key: ${validation.error}\n\nPlease check your key and try again.`);
        saveApiKeyBtn.disabled = false;
        saveApiKeyBtn.textContent = 'Save & Start';
        return;
    }

    // Save to Firebase
    const saved = await saveApiKeyToFirebase(key);

    if (saved) {
        state.apiKey = key;
        saveApiKeyBtn.textContent = '✓ Valid & Saved!';

        // Show success briefly then proceed
        setTimeout(() => {
            showCameraSection();
        }, 1000);
    } else {
        alert('Failed to save API key. Please try again.');
        saveApiKeyBtn.disabled = false;
        saveApiKeyBtn.textContent = 'Save & Start';
    }
}

// Display usage statistics
// DISABLED: API usage widget removed per user request
/*
async function displayUsageStats() {
    try {
        const stats = await getUsageStats();
        if (!stats) return;

        debugLog('API Usage Stats:', stats);

        // Create or update usage display in header
        let usageDisplay = document.getElementById('api-usage-display');
        if (!usageDisplay) {
            usageDisplay = document.createElement('div');
            usageDisplay.id = 'api-usage-display';
            usageDisplay.className = 'api-usage-display';

            const headerActions = document.querySelector('.header-actions');
            if (headerActions) {
                // Insert before word count
                const wordCountHeader = document.querySelector('.word-count-header');
                if (wordCountHeader) {
                    headerActions.insertBefore(usageDisplay, wordCountHeader);
                } else {
                    headerActions.appendChild(usageDisplay);
                }
            }
        }

        const visionPercent = parseFloat(stats.vision.percentUsed);
        const speechPercent = parseFloat(stats.speech.percentUsed);

        let visionClass = 'usage-good';
        if (visionPercent > 80) visionClass = 'usage-warning';
        if (visionPercent > 95) visionClass = 'usage-danger';

        let speechClass = 'usage-good';
        if (speechPercent > 80) speechClass = 'usage-warning';
        if (speechPercent > 95) speechClass = 'usage-danger';

        usageDisplay.innerHTML = `
            <div class="usage-title">API Usage (This Month)</div>
            <div class="usage-stats">
                <div class="usage-item ${visionClass}">
                    <span class="usage-icon">👁️</span>
                    <span class="usage-value">${stats.vision.thisMonth}/${stats.vision.freeTierLimit}</span>
                </div>
                <div class="usage-item ${speechClass}">
                    <span class="usage-icon">🎤</span>
                    <span class="usage-value">${stats.speech.thisMonth}/${stats.speech.freeTierLimit}</span>
                </div>
            </div>
        `;

        usageDisplay.title = `Vision API: ${stats.vision.thisMonth} of ${stats.vision.freeTierLimit} free calls used (${stats.vision.percentUsed}%)\nSpeech API: ${stats.speech.thisMonth} of ${stats.speech.freeTierLimit} free minutes used (${stats.speech.percentUsed}%)`;

    } catch (error) {
        debugError('Error displaying usage stats:', error);
    }
}
*/

// Show Camera Section
function showCameraSection() {
    setupSection.classList.remove('active');
    audioSection.classList.add('active');
    state.completedSteps.add('setup');
    goToStep('audio');
}

// ============ STEP MANAGEMENT & NAVIGATION ============

// Navigate to a specific step
function goToStep(step, addToHistory = true) {
    // Update current step
    state.currentStep = step;

    // Add to browser history (unless navigating via popstate)
    if (addToHistory && ['audio', 'capture', 'highlight', 'results'].includes(step)) {
        history.pushState({ step: step }, '', `#${step}`);
    }

    // Hide all sections
    setupSection.classList.remove('active');
    cameraSection.classList.remove('active');
    audioSection.classList.remove('active');
    imageSection.classList.remove('active');
    resultsSection.classList.remove('active');

    // Also hide Class Overview and Student Profile sections
    if (classOverviewSection) classOverviewSection.classList.remove('active');
    if (studentProfileSection) studentProfileSection.classList.remove('active');

    // Show the appropriate section
    const sectionMap = {
        'setup': setupSection,
        'capture': cameraSection,
        'audio': audioSection,
        'highlight': imageSection,
        'results': resultsSection
    };

    const targetSection = sectionMap[step];
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Special handling for capture section - initialize camera
    if (step === 'capture') {
        initCamera();
    }

    // Special handling for highlight section
    // Note: Auto-detect is triggered from processOCR() after OCR completes,
    // not here, because OCR runs asynchronously after goToStep is called

    // Update breadcrumb and button states
    updateBreadcrumb();
    updateButtonStates();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ HIGHLIGHT LOADING OVERLAY FUNCTIONS ============

/**
 * Show the highlight loading overlay
 */
function showHighlightLoadingOverlay() {
    if (highlightLoadingOverlay) {
        highlightLoadingOverlay.style.display = 'flex';
        // Reset step indicators
        resetLoadingSteps();
        updateLoadingStep(1);
    }
}

/**
 * Hide the highlight loading overlay
 */
function hideHighlightLoadingOverlay() {
    if (highlightLoadingOverlay) {
        highlightLoadingOverlay.style.display = 'none';
    }
}

/**
 * Reset all loading step indicators
 */
function resetLoadingSteps() {
    [loadingStep1, loadingStep2, loadingStep3].forEach(step => {
        if (step) {
            step.classList.remove('active', 'completed');
            const indicator = step.querySelector('.step-indicator');
            if (indicator) {
                indicator.classList.remove('active', 'completed');
            }
        }
    });
}

/**
 * Update loading step indicator (1, 2, or 3)
 * @param {number} stepNum - The step number to activate (1-3)
 */
function updateLoadingStep(stepNum) {
    const steps = [loadingStep1, loadingStep2, loadingStep3];
    const statusMessages = [
        'Transcribing audio...',
        'Matching words to text...',
        'Highlighting selection...'
    ];

    steps.forEach((step, index) => {
        if (step) {
            const indicator = step.querySelector('.step-indicator');
            if (index + 1 < stepNum) {
                // Completed
                step.classList.remove('active');
                step.classList.add('completed');
                if (indicator) {
                    indicator.classList.remove('active');
                    indicator.classList.add('completed');
                }
            } else if (index + 1 === stepNum) {
                // Active
                step.classList.remove('completed');
                step.classList.add('active');
                if (indicator) {
                    indicator.classList.remove('completed');
                    indicator.classList.add('active');
                }
            } else {
                // Not yet reached
                step.classList.remove('active', 'completed');
                if (indicator) {
                    indicator.classList.remove('active', 'completed');
                }
            }
        }
    });

    // Update status text
    if (highlightLoadingStatus && stepNum >= 1 && stepNum <= 3) {
        highlightLoadingStatus.textContent = statusMessages[stepNum - 1];
    }
}

/**
 * Auto-detect spoken words when entering the highlight step
 * This is a wrapper that handles the loading overlay
 */
async function runAutoDetectOnEntry() {
    // Show loading overlay
    showHighlightLoadingOverlay();

    try {
        await autoDetectSpokenWordsWithOverlay();
    } catch (error) {
        debugError('Auto-detect on entry failed:', error);
        showStatus('Auto-detection failed. You can manually select words.', 'error');
    } finally {
        // Hide loading overlay
        hideHighlightLoadingOverlay();
    }
}

// Update breadcrumb visual state
function updateBreadcrumb() {
    // Show breadcrumb after setup
    if (state.completedSteps.has('setup')) {
        breadcrumbNav.classList.add('visible');
    }

    const steps = document.querySelectorAll('.breadcrumb-step');
    steps.forEach(stepEl => {
        const stepName = stepEl.getAttribute('data-step');
        const stepIcon = stepEl.querySelector('.step-icon');

        // Remove all states
        stepEl.classList.remove('completed', 'current', 'available', 'locked');

        if (state.completedSteps.has(stepName)) {
            // Completed step
            stepEl.classList.add('completed');
            stepIcon.textContent = '✓';
        } else if (stepName === state.currentStep) {
            // Current step
            stepEl.classList.add('current');
            const stepIndex = state.stepsOrder.indexOf(stepName);
            stepIcon.textContent = stepIndex;
        } else if (canAccessStep(stepName)) {
            // Available step
            stepEl.classList.add('available');
            const stepIndex = state.stepsOrder.indexOf(stepName);
            stepIcon.textContent = stepIndex;
        } else {
            // Locked step
            stepEl.classList.add('locked');
            const stepIndex = state.stepsOrder.indexOf(stepName);
            stepIcon.textContent = stepIndex;
            stepEl.setAttribute('data-tooltip', getStepRequirementMessage(stepName));
        }
    });
}

// Check if a step can be accessed
function canAccessStep(step) {
    switch (step) {
        case 'setup':
            return true;
        case 'capture':
            return state.completedSteps.has('setup');
        case 'audio':
            return state.capturedImage !== null;
        case 'highlight':
            return state.capturedImage !== null && state.ocrData !== null;
        case 'results':
            return state.latestAnalysis !== null;
        default:
            return false;
    }
}

// Get requirement message for locked steps
function getStepRequirementMessage(step) {
    switch (step) {
        case 'audio':
            return 'Capture image first';
        case 'highlight':
            return 'Capture and process image first';
        case 'results':
            return 'Complete analysis first';
        default:
            return 'Complete previous steps';
    }
}

// Setup click handlers for breadcrumb steps
function setupBreadcrumbClickHandlers() {
    const steps = document.querySelectorAll('.breadcrumb-step');
    steps.forEach(stepEl => {
        stepEl.addEventListener('click', () => {
            const stepName = stepEl.getAttribute('data-step');
            if (canAccessStep(stepName)) {
                goToStep(stepName);
            }
        });
    });
}

// Update button states based on requirements
function updateButtonStates() {
    // Audio section: Enable next button if audio recorded
    if (nextToCaptureBtn) {
        const hasAudio = state.recordedAudioBlob !== null;
        nextToCaptureBtn.disabled = !hasAudio;
        if (!hasAudio) {
            nextToCaptureBtn.setAttribute('data-tooltip', 'Record audio first');
        } else {
            nextToCaptureBtn.removeAttribute('data-tooltip');
        }
    }

    // Capture section: Enable next button if image captured
    if (nextToHighlightBtn) {
        const hasImage = state.capturedImage !== null && state.ocrData !== null;
        nextToHighlightBtn.disabled = !hasImage;
        if (!hasImage) {
            nextToHighlightBtn.setAttribute('data-tooltip', 'Capture image first');
        } else {
            nextToHighlightBtn.removeAttribute('data-tooltip');
        }
    }

    // Highlight section: Update requirements checklist
    updateRequirementsChecklist();

    // Enable/disable analyze button
    if (analyzeAudioBtn) {
        const canAnalyze = state.recordedAudioBlob !== null &&
                          state.selectedWords.size > 0 &&
                          state.ocrData !== null;
        analyzeAudioBtn.disabled = !canAnalyze;
        if (!canAnalyze) {
            let reasons = [];
            if (!state.recordedAudioBlob) reasons.push('record audio');
            if (state.selectedWords.size === 0) reasons.push('highlight text');
            analyzeAudioBtn.setAttribute('data-tooltip', `Please ${reasons.join(' and ')}`);
        } else {
            analyzeAudioBtn.removeAttribute('data-tooltip');
        }
    }

    // Enable/disable auto-detect button (BETA) - kept for backwards compatibility
    // Requires: audio recorded + OCR data (image processed)
    if (autoDetectBtn) {
        const canAutoDetect = state.recordedAudioBlob !== null &&
                             state.ocrData !== null &&
                             state.ocrData.words &&
                             state.ocrData.words.length > 0;
        autoDetectBtn.disabled = !canAutoDetect;
        if (!canAutoDetect) {
            let reasons = [];
            if (!state.recordedAudioBlob) reasons.push('record audio');
            if (!state.ocrData || !state.ocrData.words || state.ocrData.words.length === 0) reasons.push('capture image');
            autoDetectBtn.setAttribute('title', `Please ${reasons.join(' and ')} first`);
        } else {
            autoDetectBtn.setAttribute('title', 'Automatically detect which words were spoken (Beta feature)');
        }
    }

    // Enable/disable redo autodetect button
    // Requires: audio recorded + OCR data (image processed) + not in audio-skip mode
    if (redoAutodetectBtn) {
        const canRedo = state.recordedAudioBlob !== null &&
                       state.ocrData !== null &&
                       state.ocrData.words &&
                       state.ocrData.words.length > 0 &&
                       !state.audioSkipped;
        redoAutodetectBtn.disabled = !canRedo;
        if (!canRedo) {
            redoAutodetectBtn.setAttribute('title', 'Audio recording required for auto-detection');
        } else {
            redoAutodetectBtn.setAttribute('title', 'Run auto-detection again');
        }
    }
}

// Update requirements checklist in highlight section
function updateRequirementsChecklist() {
    // Update audio requirement
    if (reqAudio) {
        const hasAudio = state.recordedAudioBlob !== null;
        const audioIcon = reqAudio.querySelector('.req-icon');
        const audioBtn = reqAudio.querySelector('.link-btn');
        if (hasAudio) {
            audioIcon.textContent = '✅';
            reqAudio.classList.add('complete');
            reqAudio.classList.remove('incomplete');
            if (audioBtn) audioBtn.style.display = 'none';
        } else {
            audioIcon.textContent = '❌';
            reqAudio.classList.add('incomplete');
            reqAudio.classList.remove('complete');
            if (audioBtn) audioBtn.style.display = 'inline';
        }
    }

    // Update selection requirement
    if (reqSelection) {
        const hasSelection = state.selectedWords.size > 0;
        const selIcon = reqSelection.querySelector('.req-icon');
        if (hasSelection) {
            selIcon.textContent = '✅';
            reqSelection.classList.add('complete');
            reqSelection.classList.remove('incomplete');
        } else {
            selIcon.textContent = '❌';
            reqSelection.classList.add('incomplete');
            reqSelection.classList.remove('complete');
        }
    }

    // Update word count in checklist
    if (selectionWordCount) {
        selectionWordCount.textContent = state.selectedWords.size;
    }
}

// Update mini preview in audio section
function updateMiniPreview() {
    if (!miniPreviewCanvas || !state.capturedImage) return;

    // Draw the preview
    redrawPreviewCanvas();

    // Setup toggle expand/collapse functionality
    setupPreviewToggle();
}

// Redraw the preview canvas with current size
function redrawPreviewCanvas() {
    const ctx = miniPreviewCanvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        const maxWidth = 700;
        const maxHeight = miniPreviewCanvas.classList.contains('expanded') ? 800 : 400;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        miniPreviewCanvas.width = img.width * scale;
        miniPreviewCanvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, miniPreviewCanvas.width, miniPreviewCanvas.height);
    };
    img.src = state.capturedImage;
}

// Setup toggle button for preview (only once)
let previewToggleSetup = false;
function setupPreviewToggle() {
    if (previewToggleSetup) return;

    const toggleBtn = document.getElementById('toggle-preview-size-btn');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        const toggleText = document.getElementById('toggle-preview-text');
        const isExpanded = miniPreviewCanvas.classList.toggle('expanded');

        if (toggleText) {
            toggleText.textContent = isExpanded ? 'Collapse' : 'Expand';
        }

        // Redraw canvas with new size
        redrawPreviewCanvas();
    });

    previewToggleSetup = true;
}

// Start new analysis
function startNewAnalysis() {
    // Confirm before clearing all data
    const hasData = state.capturedImage || state.recordedAudioBlob || state.selectedWords.size > 0;
    if (hasData) {
        const confirmed = confirm(
            'Start a new assessment?\n\n' +
            'This will clear:\n' +
            '• Current recording\n' +
            '• Captured image\n' +
            '• Text selection\n' +
            '• Analysis results\n\n' +
            'Continue?'
        );
        if (!confirmed) return;
    }

    // Reset state (except API key)
    const savedApiKey = state.apiKey;
    Object.assign(state, {
        apiKey: savedApiKey,
        stream: null,
        capturedImage: null,
        ocrData: null,
        selectedWords: new Set(),
        zoom: 1,
        panX: 0,
        panY: 0,
        recordedAudioBlob: null,
        audioMimeType: 'audio/webm;codecs=opus',
        audioSampleRate: 48000,
        audioChannelCount: 1,
        latestAnalysis: null,
        latestExpectedWords: null,
        latestSpokenWords: null,
        latestErrorPatterns: null,
        currentStep: 'audio',
        completedSteps: new Set(['setup']),
        currentAssessmentStudentId: null,
        assessmentAlreadySaved: false,
        audioSkipped: false,
        viewingHistoricalAssessment: false,
        historicalAssessmentStudent: null,
        historicalAssessmentDate: null,
        historicalAssessmentStudentId: null
    });

    // Clear image cache
    imageCache.clear();

    // Hide historical assessment banner
    if (historicalAssessmentBanner) {
        historicalAssessmentBanner.style.display = 'none';
    }

    // Show regular results actions
    const resultsActions = document.querySelector('.results-actions');
    if (resultsActions) {
        resultsActions.style.display = 'flex';
    }

    // Show save assessment section
    const saveSection = document.querySelector('.save-assessment-section');
    if (saveSection) {
        saveSection.style.display = 'block';
    }

    // Clear displays
    wordCountDisplay.textContent = '0';
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (exportOutput) exportOutput.innerHTML = '';

    // Clear student selection
    if (assessmentStudentSelect) assessmentStudentSelect.value = '';
    hideSelectedStudentDisplay();
    hideCurrentStudentIndicator();

    // Reset save section visibility
    const saveAssessmentSection = document.querySelector('.save-assessment-section');
    if (saveAssessmentSection) saveAssessmentSection.style.display = 'block';
    if (studentSelect) {
        studentSelect.disabled = false;
        studentSelect.value = '';
    }
    if (saveAssessmentBtn) {
        saveAssessmentBtn.disabled = true;
        saveAssessmentBtn.innerHTML = '<span class="icon">💾</span> Save to Profile';
    }
    if (saveStatus) saveStatus.className = 'save-status';

    // Reset preview toggle setup flag
    previewToggleSetup = false;

    // Go to audio step (first step after setup)
    goToStep('audio');
}

// Skip audio recording (word count only mode)
function skipAudioRecording() {
    // Set skip flag
    state.audioSkipped = true;

    // Mark audio as completed (even though skipped)
    state.completedSteps.add('audio');

    // Go directly to capture step
    goToStep('capture');

    // Update button states
    updateButtonStates();
}

// ============ END STEP MANAGEMENT ============

// Initialize Camera
async function initCamera() {
    try {
        // Request high resolution using 'ideal' only (no 'min' which can cause failures)
        // This matches the original working configuration
        state.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        camera.srcObject = state.stream;

        // Wait for video to be ready and check resolution
        camera.onloadedmetadata = async () => {
            debugLog(`Camera resolution: ${camera.videoWidth}x${camera.videoHeight}`);

            // If resolution is lower than expected, try to request higher
            if (camera.videoWidth < 1280 || camera.videoHeight < 720) {
                const videoTrack = state.stream.getVideoTracks()[0];
                if (videoTrack) {
                    try {
                        await videoTrack.applyConstraints({
                            width: { ideal: 1920 },
                            height: { ideal: 1080 }
                        });
                        setTimeout(() => {
                            debugLog(`After applyConstraints: ${camera.videoWidth}x${camera.videoHeight}`);
                            if (camera.videoWidth < 1280 || camera.videoHeight < 720) {
                                showStatus(`Low camera resolution (${camera.videoWidth}x${camera.videoHeight}). For better OCR, use "Upload Image" instead.`, 'warning');
                            }
                        }, 500);
                    } catch (e) {
                        debugLog('Could not apply higher resolution:', e.message);
                        showStatus(`Low camera resolution (${camera.videoWidth}x${camera.videoHeight}). For better OCR, use "Upload Image" instead.`, 'warning');
                    }
                }
            }
        };
    } catch (error) {
        alert('Camera access denied. Please allow camera permissions.');
        debugError('Camera error:', error);
    }
}

// Handle File Upload
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        state.capturedImage = event.target.result;

        // Stop camera stream if active
        if (state.stream) {
            state.stream.getTracks().forEach(track => track.stop());
        }

        // Mark capture step as complete
        state.completedSteps.add('capture');

        // Switch to highlight section
        goToStep('highlight');

        // Process OCR in background
        processOCR();
    };
    reader.readAsDataURL(file);

    // Reset file input
    e.target.value = '';
}

// Capture Photo
function capturePhoto() {
    const context = cameraCanvas.getContext('2d');
    cameraCanvas.width = camera.videoWidth;
    cameraCanvas.height = camera.videoHeight;

    debugLog(`Capturing photo at resolution: ${camera.videoWidth}x${camera.videoHeight}`);

    // Warn if resolution is too low for good OCR
    if (camera.videoWidth < 1280 || camera.videoHeight < 720) {
        debugWarn('Low resolution capture - OCR quality may be affected');
        debugWarn('Consider using "Upload Image" for better quality');
    }

    context.drawImage(camera, 0, 0);

    // Use maximum quality for JPEG
    state.capturedImage = cameraCanvas.toDataURL('image/jpeg', 1.0);

    // Stop camera stream
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
    }

    // Mark capture step as complete
    state.completedSteps.add('capture');

    // Switch to highlight section
    goToStep('highlight');

    // Process OCR in background
    processOCR();
}

// Process OCR using Google Cloud Vision API
async function processOCR() {
    showStatus('Processing image with Google Cloud Vision...', 'processing');

    try {
        // Extract base64 image data (remove data:image/jpeg;base64, prefix)
        const base64Image = state.capturedImage.split(',')[1];

        // Call Google Cloud Vision API
        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${state.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requests: [
                        {
                            image: {
                                content: base64Image
                            },
                            features: [
                                {
                                    type: 'DOCUMENT_TEXT_DETECTION',
                                    maxResults: 1
                                }
                            ]
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        if (!data.responses || !data.responses[0]) {
            throw new Error('No response from Vision API');
        }

        const result = data.responses[0];

        // Track successful Vision API usage
        trackApiUsage('vision', { timestamp: Date.now() });

        if (!result.fullTextAnnotation) {
            showStatus('No text detected. Please try again with clearer image.', 'error');
            return;
        }

        // Extract words with bounding boxes
        const words = [];
        const pages = result.fullTextAnnotation.pages || [];

        pages.forEach(page => {
            page.blocks.forEach(block => {
                block.paragraphs.forEach(paragraph => {
                    paragraph.words.forEach(word => {
                        const vertices = word.boundingBox.vertices;
                        const text = word.symbols.map(s => s.text).join('');

                        // Filter out punctuation-only "words"
                        // Only include if text contains at least one letter or number
                        const hasAlphanumeric = /[a-zA-Z0-9]/.test(text);

                        if (!hasAlphanumeric) {
                            debugLog('Filtering out punctuation-only:', text);
                            return; // Skip this word
                        }

                        // Convert vertices to bbox format (x0, y0, x1, y1)
                        const xs = vertices.map(v => v.x || 0);
                        const ys = vertices.map(v => v.y || 0);

                        words.push({
                            text: text,
                            bbox: {
                                x0: Math.min(...xs),
                                y0: Math.min(...ys),
                                x1: Math.max(...xs),
                                y1: Math.max(...ys)
                            },
                            confidence: word.confidence || 1
                        });
                    });
                });
            });
        });

        debugLog('=== VISION API RESULTS ===');
        debugLog('Total words found:', words.length);
        debugLog('First 10 words:', words.slice(0, 10).map(w => w.text));

        state.ocrData = { words: words };

        if (words.length === 0) {
            showStatus('No text detected. Please try again.', 'error');
            return;
        }

        // Draw image and word boxes on canvas
        drawImageWithWords();

        // Update breadcrumb now that OCR is complete
        updateBreadcrumb();

        // Update button states (enables auto-detect if audio is recorded)
        updateButtonStates();

        // Auto-detect spoken words if audio was recorded (not in word-count-only mode)
        const canAutoDetect = state.recordedAudioBlob !== null &&
                             state.ocrData !== null &&
                             state.ocrData.words &&
                             state.ocrData.words.length > 0 &&
                             !state.audioSkipped &&
                             state.currentStep === 'highlight';

        if (canAutoDetect) {
            // Run auto-detect automatically after OCR completes
            runAutoDetectOnEntry();
        } else {
            showStatus(`Detected ${words.length} words. Select the text that was read aloud.`, '');
        }

    } catch (error) {
        debugError('Vision API error:', error);

        if (error.message.includes('API key')) {
            showStatus('Invalid API key. Please check your settings.', 'error');
            // Clear saved key
            localStorage.removeItem('googleCloudVisionApiKey');
            setTimeout(() => {
                imageSection.classList.remove('active');
                setupSection.classList.add('active');
                // Hide Class Overview and Student Profile sections
                if (classOverviewSection) classOverviewSection.classList.remove('active');
                if (studentProfileSection) studentProfileSection.classList.remove('active');
            }, 2000);
        } else {
            showStatus('Error processing image: ' + error.message, 'error');
        }
    }
}

// Draw Image and Word Boundaries
function drawImageWithWords() {
    const img = new Image();
    img.onload = function() {
        const canvas = document.getElementById('selection-canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');

        // Apply zoom and pan transformations
        ctx.setTransform(state.zoom, 0, 0, state.zoom, state.panX, state.panY);

        ctx.drawImage(img, 0, 0);

        // Draw word boundaries (green boxes for all detected words)
        if (state.ocrData && state.ocrData.words) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
            ctx.lineWidth = 1 / state.zoom; // Adjust line width for zoom

            state.ocrData.words.forEach(word => {
                const { x0, y0, x1, y1 } = word.bbox;
                ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
            });
        }

        setupCanvasInteraction();
    };
    img.src = state.capturedImage;
}

// Track if listeners are already attached
let listenersAttached = false;

// Setup Canvas Touch/Mouse Interaction
function setupCanvasInteraction() {
    const canvas = document.getElementById('selection-canvas');

    // Remove old listeners if they exist
    if (listenersAttached) {
        canvas.removeEventListener('touchstart', handleStart);
        canvas.removeEventListener('touchmove', handleMove);
        canvas.removeEventListener('touchend', handleEnd);
        canvas.removeEventListener('mousedown', handleStart);
        canvas.removeEventListener('mousemove', handleMove);
        canvas.removeEventListener('mouseup', handleEnd);
        canvas.removeEventListener('click', handleWordClick);
    }

    // Touch events
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd, { passive: false });

    // Mouse events
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);

    // Prevent context menu on right-click (for panning)
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    // Click event for deselecting words
    canvas.addEventListener('click', handleWordClick);

    listenersAttached = true;
}

function handleWordClick(e) {
    const clickPoint = getCanvasPoint(e);
    const clickedWordIndex = findWordAtPoint(clickPoint);

    if (clickedWordIndex !== -1) {
        if (state.selectedWords.has(clickedWordIndex)) {
            // Word is selected, so deselect it
            state.selectedWords.delete(clickedWordIndex);
            debugLog('Deselected word at index:', clickedWordIndex);
        } else {
            // Word is not selected, so select it
            state.selectedWords.add(clickedWordIndex);
            debugLog('Selected word at index:', clickedWordIndex);
        }
        updateWordCount();
        redrawCanvas();
    }
}

function handleStart(e) {
    // Check if right mouse button for panning (do this BEFORE preventDefault)
    if (e.button === 2 || e.shiftKey) {
        e.preventDefault();
        state.isPanning = true;
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        state.panStartPoint = { x: clientX, y: clientY };
        debugLog('Started panning at:', state.panStartPoint);
        return;
    }

    e.preventDefault();
    state.isDrawing = true;
    state.wasDragged = false;
    state.startPoint = getCanvasPoint(e);
    state.endPoint = state.startPoint;

    debugLog('Started drawing at:', state.startPoint);
}

function handleMove(e) {
    e.preventDefault();

    // Handle panning
    if (state.isPanning && state.panStartPoint) {
        const currentX = e.clientX || (e.touches && e.touches[0].clientX);
        const currentY = e.clientY || (e.touches && e.touches[0].clientY);

        const deltaX = currentX - state.panStartPoint.x;
        const deltaY = currentY - state.panStartPoint.y;

        state.panX += deltaX;
        state.panY += deltaY;

        state.panStartPoint = { x: currentX, y: currentY };

        redrawCanvas();
        return;
    }

    if (!state.isDrawing) return;

    state.wasDragged = true;
    state.endPoint = getCanvasPoint(e);
    drawSelectionLine();
}

function handleEnd(e) {
    // Handle pan end
    if (state.isPanning) {
        state.isPanning = false;
        state.panStartPoint = null;
        return;
    }

    if (!state.isDrawing) return;
    e.preventDefault();

    state.isDrawing = false;
    state.endPoint = getCanvasPoint(e);

    debugLog('Ended at:', state.endPoint);

    // Calculate drag distance to distinguish taps from drags
    const dragDistance = Math.sqrt(
        Math.pow(state.endPoint.x - state.startPoint.x, 2) +
        Math.pow(state.endPoint.y - state.startPoint.y, 2)
    );
    const MIN_DRAG_DISTANCE = 15; // Minimum pixels to count as a drag

    // If it was a significant drag, select words between points
    if (state.wasDragged && dragDistance >= MIN_DRAG_DISTANCE) {
        // Select words between start and end
        selectWordsBetweenPoints();

        // Redraw with highlighted words
        redrawCanvas();
    } else {
        // It was a tap/click, not a drag - toggle word selection
        // This handles touch devices where click event doesn't fire due to preventDefault
        const tapPoint = getCanvasPoint(e);
        const tappedWordIndex = findWordAtPoint(tapPoint);

        if (tappedWordIndex !== -1) {
            if (state.selectedWords.has(tappedWordIndex)) {
                // Word is selected, so deselect it
                state.selectedWords.delete(tappedWordIndex);
                debugLog('Tap deselected word at index:', tappedWordIndex);
            } else {
                // Word is not selected, so select it
                state.selectedWords.add(tappedWordIndex);
                debugLog('Tap selected word at index:', tappedWordIndex);
            }
            updateWordCount();
            redrawCanvas();
        }
    }
}

function getCanvasPoint(e) {
    const canvas = document.getElementById('selection-canvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;

    // For touch events, use touches if available, otherwise use changedTouches (for touchend)
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // Convert screen coordinates to canvas coordinates
    const screenX = (clientX - rect.left) * scaleX;
    const screenY = (clientY - rect.top) * scaleY;

    // Account for zoom and pan transformations
    return {
        x: (screenX - state.panX) / state.zoom,
        y: (screenY - state.panY) / state.zoom
    };
}

function drawSelectionLine() {
    redrawCanvas();

    const canvas = document.getElementById('selection-canvas');
    const ctx = canvas.getContext('2d');

    // Apply zoom and pan transformations
    ctx.setTransform(state.zoom, 0, 0, state.zoom, state.panX, state.panY);

    // Draw thick line from start to end
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.lineWidth = 8 / state.zoom; // Adjust line width for zoom
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(state.startPoint.x, state.startPoint.y);
    ctx.lineTo(state.endPoint.x, state.endPoint.y);
    ctx.stroke();

    // Draw larger circles at start and end for better visibility
    ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3 / state.zoom; // Adjust line width for zoom

    // Start circle
    ctx.beginPath();
    ctx.arc(state.startPoint.x, state.startPoint.y, 15 / state.zoom, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // End circle
    ctx.beginPath();
    ctx.arc(state.endPoint.x, state.endPoint.y, 15 / state.zoom, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
}

function selectWordsBetweenPoints() {
    if (!state.ocrData || !state.ocrData.words || !state.startPoint || !state.endPoint) {
        debugLog('Missing data for selection');
        return;
    }

    debugLog('Total words available:', state.ocrData.words.length);

    // Find closest word to start point
    let startWordIndex = findClosestWordIndex(state.startPoint);
    // Find closest word to end point
    let endWordIndex = findClosestWordIndex(state.endPoint);

    debugLog('Start word index:', startWordIndex);
    debugLog('End word index:', endWordIndex);

    if (startWordIndex === -1 || endWordIndex === -1) {
        debugLog('Could not find start or end word');
        showStatus('Could not find words. Try clicking closer to text.', 'error');
        return;
    }

    // Swap if needed
    if (startWordIndex > endWordIndex) {
        [startWordIndex, endWordIndex] = [endWordIndex, startWordIndex];
    }

    debugLog('Selecting words from', startWordIndex, 'to', endWordIndex);

    // Select all words in range
    for (let i = startWordIndex; i <= endWordIndex; i++) {
        state.selectedWords.add(i);
    }

    debugLog('Total selected words:', state.selectedWords.size);
    updateWordCount();
}

function findWordAtPoint(point) {
    if (!state.ocrData || !state.ocrData.words) return -1;

    // Check if point is inside any word's bounding box
    for (let i = 0; i < state.ocrData.words.length; i++) {
        const { x0, y0, x1, y1 } = state.ocrData.words[i].bbox;

        if (point.x >= x0 && point.x <= x1 && point.y >= y0 && point.y <= y1) {
            return i;
        }
    }

    return -1;
}

function findClosestWordIndex(point) {
    if (!state.ocrData || !state.ocrData.words) return -1;

    let closestIndex = -1;
    let minDistance = Infinity;

    state.ocrData.words.forEach((word, index) => {
        const { x0, y0, x1, y1 } = word.bbox;

        // Use word center
        const wordCenterX = (x0 + x1) / 2;
        const wordCenterY = (y0 + y1) / 2;

        const distance = Math.sqrt(
            Math.pow(point.x - wordCenterX, 2) +
            Math.pow(point.y - wordCenterY, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
        }
    });

    if (closestIndex !== -1) {
        debugLog('Found word:', state.ocrData.words[closestIndex].text, 'at distance:', minDistance);
    }

    return closestIndex;
}

// Track pending animation frame for debouncing
let pendingRedrawFrame = null;

function redrawCanvas() {
    // Use requestAnimationFrame for smooth rendering and debouncing
    if (pendingRedrawFrame) {
        cancelAnimationFrame(pendingRedrawFrame);
    }

    pendingRedrawFrame = requestAnimationFrame(() => {
        pendingRedrawFrame = null;
        performCanvasRedraw();
    });
}

// Actual canvas drawing logic (separated for clarity)
function performCanvasRedraw() {
    if (!state.capturedImage) return;

    // Use cached image for better performance
    imageCache.load(state.capturedImage).then(img => {
        const canvas = document.getElementById('selection-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply zoom and pan transformations
        ctx.setTransform(state.zoom, 0, 0, state.zoom, state.panX, state.panY);

        ctx.drawImage(img, 0, 0);

        // Draw word boundaries
        if (state.ocrData && state.ocrData.words) {
            state.ocrData.words.forEach((word, index) => {
                const { x0, y0, x1, y1 } = word.bbox;

                if (state.selectedWords.has(index)) {
                    // Highlight selected words - bright yellow
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
                    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
                    ctx.strokeStyle = 'rgba(255, 200, 0, 0.9)';
                    ctx.lineWidth = 3 / state.zoom;
                    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                } else {
                    // Subtle boundaries for unselected words
                    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
                    ctx.lineWidth = 1 / state.zoom;
                    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                }
            });
        }
    });
}

// Zoom Functions
function zoomIn() {
    state.zoom = Math.min(state.zoom * 1.2, 5); // Max zoom 5x
    redrawCanvas();
}

function zoomOut() {
    state.zoom = Math.max(state.zoom / 1.2, 0.5); // Min zoom 0.5x
    redrawCanvas();
}

function resetZoom() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    redrawCanvas();
}

function updateWordCount() {
    wordCountDisplay.textContent = state.selectedWords.size;
    // Update button states and requirements checklist
    updateButtonStates();
}

function resetSelection() {
    state.selectedWords.clear();
    state.startPoint = null;
    state.endPoint = null;
    updateWordCount();
    redrawCanvas();
}

// ============ AUTO-DETECT SPOKEN WORDS (BETA FEATURE) ============

/**
 * Auto-detect which words from the captured text were spoken in the audio.
 * This is a BETA feature that:
 * 1. Runs speech-to-text on the recorded audio
 * 2. Matches spoken words against OCR-detected words
 * 3. Finds the FIRST and LAST detected words (shown with teal emphasis)
 * 4. Highlights ALL words between first and last (inclusive)
 *
 * Note: Even if a student stumbles or misses words in between,
 * the entire passage they attempted is highlighted since they
 * were "supposed to" read those words.
 */
async function autoDetectSpokenWords() {
    // Validate requirements
    if (!state.recordedAudioBlob) {
        showStatus('Please record audio first.', 'error');
        return;
    }

    if (!state.ocrData || !state.ocrData.words || state.ocrData.words.length === 0) {
        showStatus('Please capture an image first.', 'error');
        return;
    }

    if (!state.apiKey) {
        showStatus('API key is required for auto-detection.', 'error');
        return;
    }

    // Clear any existing selection
    state.selectedWords.clear();
    updateWordCount();

    showStatus('🤖 Auto-detecting spoken words... (Step 1/3: Transcribing audio)', 'processing');

    try {
        // Step 1: Run speech-to-text to get spoken words
        const spokenWords = await runSpeechToTextForAutoDetect();

        if (!spokenWords || spokenWords.length === 0) {
            showStatus('No speech detected in the audio. Please try recording again.', 'error');
            return;
        }

        debugLog('=== AUTO-DETECT: Spoken words from STT ===');
        debugLog('Spoken words:', spokenWords.map(w => w.word));

        showStatus('🤖 Auto-detecting spoken words... (Step 2/3: Matching words)', 'processing');

        // Step 2: Match spoken words against OCR words
        const ocrWords = state.ocrData.words.map(w => w.text);
        debugLog('OCR words:', ocrWords);

        const matchResult = findSpokenRangeInOCR(spokenWords, ocrWords);

        if (matchResult.firstIndex === -1 || matchResult.lastIndex === -1) {
            showStatus('Could not match spoken words to the text. Try speaking more clearly or capturing a clearer image.', 'error');
            return;
        }

        showStatus('🤖 Auto-detecting spoken words... (Step 3/3: Highlighting)', 'processing');

        // Step 3: Select all words from first to last match (inclusive)
        // This ensures all words in the reading passage are highlighted, even if some were stumbled/missed
        const firstWord = ocrWords[matchResult.firstIndex];
        const lastWord = ocrWords[matchResult.lastIndex];

        debugLog(`Auto-selecting words from index ${matchResult.firstIndex} to ${matchResult.lastIndex}`);
        debugLog(`First detected word: "${firstWord}"`);
        debugLog(`Last detected word: "${lastWord}"`);

        // Select ALL words between first and last (inclusive)
        for (let i = matchResult.firstIndex; i <= matchResult.lastIndex; i++) {
            state.selectedWords.add(i);
        }

        updateWordCount();
        redrawCanvas();

        const totalSelected = matchResult.lastIndex - matchResult.firstIndex + 1;

        showStatus(
            `✅ Auto-detected ${totalSelected} words! ` +
            `From "${firstWord}" to "${lastWord}"`,
            ''
        );

        // Store the spoken words for later analysis
        state.latestSpokenWords = spokenWords;

    } catch (error) {
        debugError('Auto-detect error:', error);
        showStatus('Error during auto-detection: ' + error.message, 'error');
    }
}

/**
 * Auto-detect spoken words with loading overlay (called automatically on step entry).
 * Similar to autoDetectSpokenWords but updates loading overlay instead of status messages.
 */
async function autoDetectSpokenWordsWithOverlay() {
    // Validate requirements (silently fail - user can still manually select)
    if (!state.recordedAudioBlob || !state.ocrData || !state.ocrData.words ||
        state.ocrData.words.length === 0 || !state.apiKey) {
        return;
    }

    // Clear any existing selection
    state.selectedWords.clear();
    updateWordCount();

    // Step 1: Transcribing audio
    updateLoadingStep(1);

    // Step 1: Run speech-to-text to get spoken words
    const spokenWords = await runSpeechToTextForAutoDetect();

    if (!spokenWords || spokenWords.length === 0) {
        showStatus('No speech detected. You can manually select words.', '');
        return;
    }

    debugLog('=== AUTO-DETECT: Spoken words from STT ===');
    debugLog('Spoken words:', spokenWords.map(w => w.word));

    // Step 2: Matching words
    updateLoadingStep(2);

    // Small delay to show step transition
    await new Promise(resolve => setTimeout(resolve, 300));

    const ocrWords = state.ocrData.words.map(w => w.text);
    debugLog('OCR words:', ocrWords);

    const matchResult = findSpokenRangeInOCR(spokenWords, ocrWords);

    if (matchResult.firstIndex === -1 || matchResult.lastIndex === -1) {
        showStatus('Could not match words. You can manually select text.', '');
        return;
    }

    // Step 3: Highlighting
    updateLoadingStep(3);

    // Small delay to show step transition
    await new Promise(resolve => setTimeout(resolve, 300));

    const firstWord = ocrWords[matchResult.firstIndex];
    const lastWord = ocrWords[matchResult.lastIndex];

    debugLog(`Auto-selecting words from index ${matchResult.firstIndex} to ${matchResult.lastIndex}`);
    debugLog(`First detected word: "${firstWord}"`);
    debugLog(`Last detected word: "${lastWord}"`);

    // Select ALL words between first and last (inclusive)
    for (let i = matchResult.firstIndex; i <= matchResult.lastIndex; i++) {
        state.selectedWords.add(i);
    }

    updateWordCount();
    redrawCanvas();

    const totalSelected = matchResult.lastIndex - matchResult.firstIndex + 1;

    showStatus(
        `✅ Auto-detected ${totalSelected} words! ` +
        `From "${firstWord}" to "${lastWord}". You can adjust the selection if needed.`,
        ''
    );

    // Store the spoken words for later analysis
    state.latestSpokenWords = spokenWords;
}

/**
 * Run Speech-to-Text API specifically for auto-detection.
 * Returns array of spoken word objects with word and confidence.
 */
async function runSpeechToTextForAutoDetect() {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(state.recordedAudioBlob);

        reader.onerror = () => {
            reject(new Error('Error reading audio file'));
        };

        reader.onloadend = async () => {
            try {
                const base64Audio = reader.result.split(',')[1];

                // Determine encoding and sample rate based on recorded format
                let encoding = 'ENCODING_UNSPECIFIED';
                let sampleRate = state.audioSampleRate || 48000;

                if (state.audioMimeType) {
                    if (state.audioMimeType.includes('opus')) {
                        encoding = 'WEBM_OPUS';
                        // OPUS typically uses 48000, but use captured rate if available
                        sampleRate = state.audioSampleRate || 48000;
                    } else if (state.audioMimeType.includes('mp4') || state.audioMimeType.includes('aac')) {
                        encoding = 'ENCODING_UNSPECIFIED'; // Let API auto-detect for AAC
                        sampleRate = state.audioSampleRate || 44100;
                    }
                }

                const channelCount = state.audioChannelCount || 1;
                debugLog('Speech API - encoding:', encoding, 'sampleRate:', sampleRate, 'channels:', channelCount);

                const requestBody = {
                    config: {
                        encoding: encoding,
                        sampleRateHertz: sampleRate,
                        audioChannelCount: channelCount,
                        languageCode: 'en-US',
                        enableAutomaticPunctuation: true,
                        enableWordConfidence: true,
                        enableWordTimeOffsets: true,
                    },
                    audio: {
                        content: base64Audio
                    }
                };

                const response = await fetch(
                    `https://speech.googleapis.com/v1/speech:recognize?key=${state.apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    }
                );

                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error.message || 'Speech API error');
                }

                if (!data.results || data.results.length === 0) {
                    resolve([]);
                    return;
                }

                // Track API usage
                trackApiUsage('speech', {
                    duration: state.recordingDuration,
                    timestamp: Date.now()
                });

                // Extract words
                const wordInfo = [];
                data.results.forEach(result => {
                    if (result.alternatives && result.alternatives[0].words) {
                        result.alternatives[0].words.forEach(wordData => {
                            if (wordData && wordData.word) {
                                wordInfo.push({
                                    word: wordData.word,
                                    confidence: wordData.confidence || 1.0,
                                    startTime: wordData.startTime,
                                    endTime: wordData.endTime
                                });
                            }
                        });
                    }
                });

                resolve(wordInfo);

            } catch (error) {
                reject(error);
            }
        };
    });
}

/**
 * Find the range of OCR words that match the spoken words.
 * Uses improved sequence alignment with fuzzy matching.
 *
 * @param {Array} spokenWords - Array of {word, confidence} from speech-to-text
 * @param {Array} ocrWords - Array of word strings from OCR
 * @returns {Object} {firstIndex, lastIndex, matchedCount}
 */
function findSpokenRangeInOCR(spokenWords, ocrWords) {
    // Normalize spoken words (remove filler words, clean up)
    const cleanSpoken = spokenWords
        .filter(w => w && w.word && !isFillerWord(w.word))
        .map(w => normalizeWordForMatching(w.word))
        .filter(w => w.length > 0);

    // Normalize OCR words
    const cleanOCR = ocrWords.map(w => normalizeWordForMatching(w));

    debugLog('=== IMPROVED MATCHING ALGORITHM ===');
    debugLog('Clean spoken words:', cleanSpoken);
    debugLog('Clean OCR words:', cleanOCR);

    if (cleanSpoken.length === 0 || cleanOCR.length === 0) {
        return { firstIndex: -1, lastIndex: -1, matchedCount: 0 };
    }

    // Build a similarity matrix between spoken and OCR words
    const similarityMatrix = buildSimilarityMatrix(cleanSpoken, cleanOCR);

    // Use dynamic programming to find the best alignment
    const alignment = findBestAlignment(cleanSpoken, cleanOCR, similarityMatrix);

    debugLog('Alignment result:', alignment);

    if (alignment.firstOCRIndex === -1 || alignment.lastOCRIndex === -1) {
        // Fallback: Try anchor-based matching
        return findRangeByAnchors(cleanSpoken, cleanOCR);
    }

    return {
        firstIndex: alignment.firstOCRIndex,
        lastIndex: alignment.lastOCRIndex,
        matchedCount: alignment.matchedCount
    };
}

/**
 * Build a similarity matrix between spoken and OCR words
 */
function buildSimilarityMatrix(spoken, ocr) {
    const matrix = [];
    for (let s = 0; s < spoken.length; s++) {
        matrix[s] = [];
        for (let o = 0; o < ocr.length; o++) {
            matrix[s][o] = calculateWordSimilarity(spoken[s], ocr[o]);
        }
    }
    return matrix;
}

/**
 * Calculate similarity between two words (0 to 1)
 */
function calculateWordSimilarity(word1, word2) {
    if (!word1 || !word2) return 0;
    if (word1 === word2) return 1.0;

    // Check phonetic similarity first
    const phonetic1 = getPhoneticCode(word1);
    const phonetic2 = getPhoneticCode(word2);
    if (phonetic1 && phonetic2 && phonetic1 === phonetic2) {
        return 0.95;  // High similarity for phonetic matches
    }

    // Check for common OCR/STT confusions
    if (areCommonConfusions(word1, word2)) {
        return 0.9;
    }

    // Check prefix matching (for truncated words)
    const minLen = Math.min(word1.length, word2.length);
    const maxLen = Math.max(word1.length, word2.length);

    if (minLen >= 3) {
        // Check if one starts with the other
        if (word1.startsWith(word2) || word2.startsWith(word1)) {
            return 0.7 + (0.25 * minLen / maxLen);
        }
        // Check if first 3+ characters match
        const prefixLen = Math.min(4, minLen);
        if (word1.substring(0, prefixLen) === word2.substring(0, prefixLen)) {
            return 0.6 + (0.3 * minLen / maxLen);
        }
    }

    // Levenshtein-based similarity
    const distance = levenshteinDistance(word1, word2);
    const similarity = 1 - (distance / maxLen);

    // Boost similarity for longer words (they're less likely to match by chance)
    const lengthBonus = Math.min(0.1, maxLen * 0.01);

    return Math.min(1.0, similarity + lengthBonus);
}

/**
 * Simple phonetic encoding (Soundex-like)
 */
function getPhoneticCode(word) {
    if (!word || word.length < 2) return null;

    // Simplified phonetic encoding
    let code = word[0].toUpperCase();

    const phonemeMap = {
        'b': '1', 'f': '1', 'p': '1', 'v': '1',
        'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
        'd': '3', 't': '3',
        'l': '4',
        'm': '5', 'n': '5',
        'r': '6'
    };

    let lastCode = '';
    for (let i = 1; i < word.length && code.length < 4; i++) {
        const char = word[i].toLowerCase();
        const phoneCode = phonemeMap[char];
        if (phoneCode && phoneCode !== lastCode) {
            code += phoneCode;
            lastCode = phoneCode;
        } else if (!phonemeMap[char]) {
            lastCode = '';
        }
    }

    // Pad with zeros
    while (code.length < 4) {
        code += '0';
    }

    return code;
}

/**
 * Check for common OCR and speech-to-text confusions
 */
function areCommonConfusions(word1, word2) {
    // Common character confusions in OCR
    const ocrConfusions = [
        ['0', 'o'], ['1', 'l'], ['1', 'i'], ['5', 's'],
        ['8', 'b'], ['rn', 'm'], ['cl', 'd'], ['vv', 'w']
    ];

    // Apply OCR confusion substitutions
    let normalized1 = word1.toLowerCase();
    let normalized2 = word2.toLowerCase();

    for (const [from, to] of ocrConfusions) {
        const alt1a = normalized1.replace(new RegExp(from, 'g'), to);
        const alt1b = normalized1.replace(new RegExp(to, 'g'), from);
        const alt2a = normalized2.replace(new RegExp(from, 'g'), to);
        const alt2b = normalized2.replace(new RegExp(to, 'g'), from);

        if (alt1a === normalized2 || alt1b === normalized2 ||
            normalized1 === alt2a || normalized1 === alt2b) {
            return true;
        }
    }

    // Common word confusions in speech
    const wordConfusions = [
        ['the', 'a'], ['the', 'uh'], ['and', 'an'], ['to', 'too', 'two'],
        ['there', 'their', 'theyre'], ['its', 'it\'s'], ['your', 'youre'],
        ['were', 'where', 'we\'re'], ['then', 'than']
    ];

    for (const group of wordConfusions) {
        if (group.includes(normalized1) && group.includes(normalized2)) {
            return true;
        }
    }

    return false;
}

/**
 * Find best alignment using dynamic programming
 */
function findBestAlignment(spoken, ocr, similarityMatrix) {
    const m = spoken.length;
    const n = ocr.length;

    // DP table: dp[i][j] = best score aligning spoken[0..i-1] ending at ocr[j-1]
    // We want to find a contiguous range in OCR that best matches spoken sequence

    const MATCH_THRESHOLD = 0.55;  // Lowered threshold for matching
    const SKIP_PENALTY = 0.3;      // Penalty for skipping an OCR word
    const GAP_PENALTY = 0.4;       // Penalty for missing a spoken word

    // Track best ending positions for each OCR position
    let bestScore = 0;
    let bestEndOCR = -1;
    let bestStartOCR = -1;
    let bestMatchCount = 0;

    // Try each possible starting position in OCR
    for (let startOCR = 0; startOCR < n; startOCR++) {
        // DP for this starting position
        // dp[s] = {score, matchCount, lastOCR, firstOCR} for matching spoken[0..s-1]
        const dp = new Array(m + 1).fill(null).map(() => ({
            score: 0,
            matchCount: 0,
            lastOCR: startOCR - 1,
            firstOCR: -1  // Track the first matched OCR index
        }));

        for (let s = 0; s < m; s++) {
            // Try matching spoken[s] with each OCR word from lastOCR+1 onwards
            const prevState = dp[s];

            for (let o = prevState.lastOCR + 1; o < n; o++) {
                const sim = similarityMatrix[s][o];

                if (sim >= MATCH_THRESHOLD) {
                    // Calculate score including skip penalty for gaps
                    const skippedOCR = o - prevState.lastOCR - 1;
                    const skipPenalty = skippedOCR * SKIP_PENALTY;
                    const newScore = prevState.score + sim - skipPenalty;

                    if (newScore > dp[s + 1].score) {
                        dp[s + 1] = {
                            score: newScore,
                            matchCount: prevState.matchCount + 1,
                            lastOCR: o,
                            // Track first match: if this is the first match, record it
                            firstOCR: prevState.firstOCR === -1 ? o : prevState.firstOCR
                        };
                    }
                }
            }

            // Also allow skipping this spoken word (gap in spoken)
            if (dp[s].score - GAP_PENALTY > dp[s + 1].score) {
                dp[s + 1] = {
                    score: dp[s].score - GAP_PENALTY,
                    matchCount: dp[s].matchCount,
                    lastOCR: dp[s].lastOCR,
                    firstOCR: dp[s].firstOCR
                };
            }
        }

        // Check if this starting position gives better result
        const finalState = dp[m];
        if (finalState.matchCount >= 2 && finalState.score > bestScore) {
            bestScore = finalState.score;
            bestEndOCR = finalState.lastOCR;
            bestStartOCR = finalState.firstOCR;  // Use tracked first match
            bestMatchCount = finalState.matchCount;
        }
    }

    debugLog('DP alignment:', { bestStartOCR, bestEndOCR, bestScore, bestMatchCount });

    return {
        firstOCRIndex: bestStartOCR,
        lastOCRIndex: bestEndOCR,
        matchedCount: bestMatchCount,
        score: bestScore
    };
}

/**
 * Fallback: Find range by anchor words (distinctive words that appear once)
 */
function findRangeByAnchors(spoken, ocr) {
    debugLog('Using anchor-based fallback...');

    // Find distinctive words (longer words, appear once in OCR)
    const ocrWordCounts = {};
    ocr.forEach(w => { ocrWordCounts[w] = (ocrWordCounts[w] || 0) + 1; });

    const anchors = [];

    // Look for anchor matches
    for (let s = 0; s < spoken.length; s++) {
        const spokenWord = spoken[s];
        if (spokenWord.length < 4) continue;  // Skip short words

        for (let o = 0; o < ocr.length; o++) {
            const ocrWord = ocr[o];
            if (ocrWordCounts[ocrWord] > 2) continue;  // Skip very common words

            const sim = calculateWordSimilarity(spokenWord, ocrWord);
            if (sim >= 0.6) {
                anchors.push({ spokenIdx: s, ocrIdx: o, similarity: sim });
            }
        }
    }

    if (anchors.length === 0) {
        debugLog('No anchors found');
        return { firstIndex: -1, lastIndex: -1, matchedCount: 0 };
    }

    // Sort by spoken index and find consistent range
    anchors.sort((a, b) => a.spokenIdx - b.spokenIdx);

    // Find longest increasing subsequence of OCR indices
    let bestStart = anchors[0].ocrIdx;
    let bestEnd = anchors[0].ocrIdx;
    let currentStart = anchors[0].ocrIdx;
    let currentEnd = anchors[0].ocrIdx;
    let matchCount = 1;
    let bestMatchCount = 1;

    for (let i = 1; i < anchors.length; i++) {
        if (anchors[i].ocrIdx > currentEnd) {
            currentEnd = anchors[i].ocrIdx;
            matchCount++;
            if (matchCount > bestMatchCount) {
                bestMatchCount = matchCount;
                bestStart = currentStart;
                bestEnd = currentEnd;
            }
        } else if (anchors[i].ocrIdx < currentStart) {
            // Reset
            currentStart = anchors[i].ocrIdx;
            currentEnd = anchors[i].ocrIdx;
            matchCount = 1;
        }
    }

    debugLog('Anchor result:', { bestStart, bestEnd, bestMatchCount });

    return {
        firstIndex: bestStart,
        lastIndex: bestEnd,
        matchedCount: bestMatchCount
    };
}

/**
 * Normalize word for matching (more aggressive than regular normalize)
 */
function normalizeWordForMatching(word) {
    if (!word || typeof word !== 'string') return '';

    // Lowercase and remove punctuation
    let normalized = word.toLowerCase().replace(/[^\w]/g, '');

    // Handle common contractions
    normalized = normalized
        .replace(/n't$/, 'not')
        .replace(/'re$/, 'are')
        .replace(/'ve$/, 'have')
        .replace(/'ll$/, 'will')
        .replace(/'d$/, 'would')
        .replace(/'s$/, '');  // Remove possessive/is

    // Convert numbers to words for small numbers
    const numberWords = {
        '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
        '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
        '10': 'ten', '11': 'eleven', '12': 'twelve'
    };
    if (numberWords[normalized]) {
        normalized = numberWords[normalized];
    }

    return normalized;
}

/**
 * Check if two words are similar enough for auto-detection matching.
 */
function wordsAreSimilarForAutoDetect(word1, word2) {
    return calculateWordSimilarity(word1, word2) >= 0.55;
}

// ============ END AUTO-DETECT SPOKEN WORDS ============

function retakePhoto() {
    // Confirm before clearing image data
    const hasSelection = state.selectedWords.size > 0;
    if (hasSelection) {
        const confirmed = confirm(
            'Retake photo?\n\n' +
            'This will clear your current text selection.\n\n' +
            'Continue?'
        );
        if (!confirmed) return;
    }

    // Reset state
    state.selectedWords.clear();
    state.ocrData = null;
    state.capturedImage = null;
    state.startPoint = null;
    state.endPoint = null;
    updateWordCount();

    // Switch back to camera
    imageSection.classList.remove('active');
    cameraSection.classList.add('active');

    // Hide Class Overview and Student Profile sections
    if (classOverviewSection) classOverviewSection.classList.remove('active');
    if (studentProfileSection) studentProfileSection.classList.remove('active');

    // Restart camera
    initCamera();
}

function showStatus(message, type = '') {
    statusDisplay.textContent = message;
    statusDisplay.className = 'status ' + type;
}

function exportSelectedWords() {
    if (!state.ocrData || !state.ocrData.words || state.selectedWords.size === 0) {
        alert('No words selected. Please select words first.');
        return;
    }

    // Get selected words in order
    const selectedIndices = Array.from(state.selectedWords).sort((a, b) => a - b);
    const selectedWordTexts = selectedIndices.map(index => state.ocrData.words[index].text);

    // Create plain text content for download
    const plainText = selectedWordTexts.join(' ');
    const wordCount = selectedWordTexts.length;

    // Build file content
    const fileContent = `Selected Words Export
====================
Word Count: ${wordCount}
Date: ${new Date().toLocaleString()}

--- Words (space-separated) ---
${plainText}

--- Word List ---
${selectedWordTexts.map((word, i) => `${i + 1}. ${word}`).join('\n')}
`;

    // Create and download the file
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected-words-${wordCount}-words-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Audio Recording Functions
function openAudioModal() {
    audioModal.classList.add('active');
}

function closeAudioModal() {
    audioModal.classList.remove('active');
}

async function startRecording() {
    const duration = parseFloat(audioDurationInput.value);

    if (duration < 0.5 || duration > 2) {
        alert('Please select a valid duration (30 seconds, 1 minute, or 2 minutes)');
        return;
    }

    try {
        // Request microphone access
        // Note: On Android, aggressive noise suppression can filter out voice
        // We use 'ideal' constraints so they're preferences, not requirements
        const audioConstraints = {
            audio: {
                channelCount: { ideal: 1 },
                sampleRate: { ideal: 16000 },  // Good for speech recognition
                echoCancellation: { ideal: false },  // Can interfere with voice on mobile
                noiseSuppression: { ideal: false },  // Can filter out voice on Android
                autoGainControl: { ideal: true }     // Helps with quiet microphones
            }
        };

        debugLog('Requesting microphone with constraints:', JSON.stringify(audioConstraints));

        try {
            state.audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        } catch (constraintError) {
            // If constraints fail, try with minimal constraints
            debugLog('Detailed constraints failed, trying simple audio request');
            state.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        // Log what we actually got and capture sample rate + channel count
        const audioTrack = state.audioStream.getAudioTracks()[0];
        if (audioTrack) {
            const settings = audioTrack.getSettings();
            debugLog('Audio track settings:', JSON.stringify(settings));
            // Capture actual sample rate for Speech-to-Text API
            if (settings.sampleRate) {
                state.audioSampleRate = settings.sampleRate;
                debugLog('Captured audio sample rate:', state.audioSampleRate);
            }
            // Capture actual channel count for Speech-to-Text API
            if (settings.channelCount) {
                state.audioChannelCount = settings.channelCount;
                debugLog('Captured audio channel count:', state.audioChannelCount);
            }
        }

        // Initialize MediaRecorder with user-selected bitrate
        // Google Speech-to-Text inline audio has practical limits around 40-50 seconds
        // Lower bitrate = smaller files = more reliable processing
        const selectedBitrate = parseInt(audioBitrateInput.value);
        debugLog('Recording with bitrate:', selectedBitrate, 'bps');

        // Determine supported audio format (iOS Safari doesn't support WebM)
        let mimeType = null;
        let actualMimeType = null;

        // List of formats to try in order of preference
        const formatOptions = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/mp4;codecs=mp4a.40.2',
            'audio/aac',
            'audio/ogg;codecs=opus',
            ''  // Empty string = browser default
        ];

        for (const format of formatOptions) {
            if (format === '' || MediaRecorder.isTypeSupported(format)) {
                mimeType = format || undefined;
                actualMimeType = format || 'default';
                debugLog(`Using audio format: ${actualMimeType}`);
                break;
            }
        }

        const options = {
            audioBitsPerSecond: selectedBitrate
        };

        if (mimeType) {
            options.mimeType = mimeType;
        }

        state.mediaRecorder = new MediaRecorder(state.audioStream, options);
        state.audioChunks = [];
        state.recordingDuration = duration * 60; // Convert to seconds
        state.audioMimeType = actualMimeType; // Store for API call

        debugLog('MediaRecorder created with state:', state.mediaRecorder.state);

        // Collect audio data - request data every second for better reliability on mobile
        state.mediaRecorder.ondataavailable = (event) => {
            debugLog('Audio data available:', event.data.size, 'bytes');
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        };

        // Handle recording errors
        state.mediaRecorder.onerror = (event) => {
            debugError('MediaRecorder error:', event.error);
            alert('Recording error: ' + (event.error?.message || 'Unknown error'));
            stopRecording();
        };

        // Handle recording stop
        state.mediaRecorder.onstop = () => {
            debugLog('Recording stopped, chunks:', state.audioChunks.length);

            // Use the actual mime type from the recorder, or fall back to a generic type
            const blobType = state.mediaRecorder?.mimeType || state.audioMimeType || 'audio/webm';
            const audioBlob = new Blob(state.audioChunks, { type: blobType });
            debugLog('Created audio blob:', audioBlob.size, 'bytes, type:', blobType);

            state.recordedAudioBlob = audioBlob;

            // Show audio playback section
            displayRecordedAudio(audioBlob);

            // Clean up
            if (state.audioStream) {
                state.audioStream.getTracks().forEach(track => track.stop());
            }
            state.audioStream = null;
            state.mediaRecorder = null;
            state.audioChunks = [];
        };

        // Start recording - request data every 1 second for mobile reliability
        state.mediaRecorder.start(1000);
        state.recordingStartTime = Date.now();

        // Close duration modal and show recording modal
        closeAudioModal();
        recordingModal.classList.add('active');

        // Start timer
        updateRecordingTimer();

        // Auto-stop after duration
        setTimeout(() => {
            if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
                stopRecording();
            }
        }, state.recordingDuration * 1000);

    } catch (error) {
        debugError('Error accessing microphone:', error);
        alert('Could not access microphone. Please check permissions.');
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
        state.mediaRecorder.stop();
        clearInterval(state.recordingTimer);
        recordingModal.classList.remove('active');
    }
}

function updateRecordingTimer() {
    state.recordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
        const remaining = state.recordingDuration - elapsed;

        if (remaining <= 0) {
            clearInterval(state.recordingTimer);
            return;
        }

        // Update timer display
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        recordingTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Update progress bar
        const progress = (elapsed / state.recordingDuration) * 100;
        progressBar.style.width = `${progress}%`;
    }, 100);
}

function displayRecordedAudio(audioBlob) {
    const url = URL.createObjectURL(audioBlob);

    // Helper to fix audio duration (WebM blobs often have incorrect duration metadata)
    function fixAudioDuration(audioElement) {
        // Force the browser to load metadata properly
        audioElement.preload = 'metadata';

        // Handle the case where duration is Infinity or incorrect
        const handleMetadata = () => {
            if (audioElement.duration === Infinity || isNaN(audioElement.duration)) {
                // Seek to a large value to force duration calculation
                audioElement.currentTime = 1e101;
                audioElement.addEventListener('timeupdate', function seekBack() {
                    audioElement.currentTime = 0;
                    audioElement.removeEventListener('timeupdate', seekBack);
                }, { once: true });
            }
        };

        audioElement.addEventListener('loadedmetadata', handleMetadata);
        audioElement.addEventListener('durationchange', () => {
            // Duration is now correct, ensure we're at the start
            if (audioElement.duration !== Infinity && !isNaN(audioElement.duration)) {
                if (audioElement.currentTime > audioElement.duration) {
                    audioElement.currentTime = 0;
                }
            }
        });
    }

    // Update the main audio player in the audio section
    if (audioPlayerMain) {
        audioPlayerMain.src = url;
        audioPlayerMain.load(); // Force reload
        fixAudioDuration(audioPlayerMain);
        if (audioPlayerSection) {
            audioPlayerSection.style.display = 'block';
        }
    }

    // Also update the old audio player for backward compatibility
    audioPlayer.src = url;
    audioPlayer.load(); // Force reload
    fixAudioDuration(audioPlayer);
    audioPlaybackSection.classList.add('active');

    // Mark audio step as complete
    state.completedSteps.add('audio');

    // Update button states
    updateButtonStates();
    updateBreadcrumb();

    // Scroll to audio section if we're on it
    if (state.currentStep === 'audio' && audioPlayerSection) {
        audioPlayerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function downloadRecordedAudio() {
    if (!state.recordedAudioBlob) {
        alert('No audio recording available');
        return;
    }

    const url = URL.createObjectURL(state.recordedAudioBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    alert('Audio file downloaded successfully!');
}

async function analyzeRecordedAudio() {
    // If audio was skipped, show word count only results
    if (state.audioSkipped) {
        displayWordCountOnlyResults();
        return;
    }

    if (!state.recordedAudioBlob) {
        alert('No audio recording available');
        return;
    }

    // Check if image has been captured
    if (!state.capturedImage || !state.ocrData) {
        alert('Capture an image and highlight the text to analyze errors');
        return;
    }

    // Check if text has been highlighted
    if (state.selectedWords.size === 0) {
        alert('Highlight the text to analyze errors');
        return;
    }

    if (!state.apiKey) {
        alert('API key is required for audio analysis');
        return;
    }

    // Check if we already have spoken words from auto-detect (avoid redundant API call)
    if (state.latestSpokenWords && state.latestSpokenWords.length > 0) {
        debugLog('Using cached spoken words from auto-detect, skipping Speech-to-Text API call');
        showStatus('Analyzing pronunciation...', 'processing');

        // Use cached data directly
        performPronunciationAnalysis(state.latestSpokenWords);
        return;
    }

    // No cached data - need to call Speech-to-Text API
    showStatus('Converting audio to speech using Google Speech-to-Text...', 'processing');

    try {
        // Convert WebM to base64
        const reader = new FileReader();
        reader.readAsDataURL(state.recordedAudioBlob);

        reader.onerror = () => {
            debugError('File reader error:', reader.error);
            showStatus('Error reading audio file. Please try recording again.', 'error');
        };

        reader.onloadend = async () => {
            try {
                const base64Audio = reader.result.split(',')[1];

                // Detailed debugging information
                const fileSizeBytes = state.recordedAudioBlob.size;
                const fileSizeKB = fileSizeBytes / 1024;
                const fileSizeMB = fileSizeBytes / (1024 * 1024);

                debugLog('=== AUDIO FILE DEBUG INFO ===');
                debugLog('Audio blob size (bytes):', fileSizeBytes);
                debugLog('Audio blob size (KB):', fileSizeKB.toFixed(2));
                debugLog('Audio blob size (MB):', fileSizeMB.toFixed(2));
                debugLog('Audio blob type:', state.recordedAudioBlob.type);
                debugLog('Base64 audio length:', base64Audio.length);
                debugLog('Recording duration (seconds):', state.recordingDuration);
                debugLog('Recording duration (minutes):', (state.recordingDuration / 60).toFixed(2));

                // Check file size (Google has ~10MB limit for synchronous recognition)
                if (fileSizeMB > 9.5) {
                    throw new Error(`Audio file too large (${fileSizeMB.toFixed(1)}MB). Please record shorter audio or reduce quality.`);
                }

                // Determine the correct encoding and sample rate based on recorded format
                let encoding = 'ENCODING_UNSPECIFIED';
                let sampleRate = state.audioSampleRate || 48000;

                if (state.audioMimeType) {
                    if (state.audioMimeType.includes('opus')) {
                        encoding = 'WEBM_OPUS';
                        // OPUS typically uses 48000, but use captured rate if available
                        sampleRate = state.audioSampleRate || 48000;
                    } else if (state.audioMimeType.includes('mp4') || state.audioMimeType.includes('aac')) {
                        encoding = 'ENCODING_UNSPECIFIED'; // Let API auto-detect for AAC
                        sampleRate = state.audioSampleRate || 44100;
                    }
                }

                const channelCount = state.audioChannelCount || 1;
                debugLog('Audio mime type:', state.audioMimeType);
                debugLog('Using audio encoding:', encoding, 'sampleRate:', sampleRate, 'channels:', channelCount);

                // Prepare API request
                const requestBody = {
                    config: {
                        encoding: encoding,
                        sampleRateHertz: sampleRate,
                        audioChannelCount: channelCount,
                        languageCode: 'en-US',
                        enableAutomaticPunctuation: true,
                        enableWordConfidence: true,
                        enableWordTimeOffsets: true,
                    },
                    audio: {
                        content: base64Audio
                    }
                };

                debugLog('Sending request to Speech-to-Text API...');

                // Note: Google's Long Running Recognize API requires GCS URI (not base64)
                // So we only use synchronous API with inline base64 audio
                // Practical limits: ~40-50 seconds for reliable inline audio processing
                if (state.recordingDuration > 45) {
                    showStatus('Warning: Audio longer than 45 seconds may fail. Processing...', 'processing');
                }

                // Call synchronous Speech-to-Text API with word-level details
                const response = await fetch(
                    `https://speech.googleapis.com/v1/speech:recognize?key=${state.apiKey}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(requestBody)
                    }
                );

                debugLog('Response status:', response.status);
                debugLog('Response headers:', response.headers);

                const data = await response.json();
                debugLog('API Response:', data);

                if (data.error) {
                    debugError('API Error:', data.error);
                    let errorMessage = data.error.message || 'Unknown API error';

                    // Check for common errors
                    if (errorMessage.includes('API key')) {
                        errorMessage = 'Invalid API key or Speech-to-Text API not enabled. Please enable the Cloud Speech-to-Text API in your Google Cloud Console.';
                    } else if (errorMessage.includes('PERMISSION_DENIED')) {
                        errorMessage = 'Speech-to-Text API is not enabled. Please enable it in Google Cloud Console.';
                    } else if (errorMessage.includes('duration limit') || errorMessage.includes('Inline audio exceeds') || errorMessage.includes('GCS URI')) {
                        errorMessage = 'Audio recording too long for inline processing. Please record for 30 seconds instead, or use a shorter passage.';
                    } else if (errorMessage.includes('audio')) {
                        errorMessage = 'Audio format error: ' + errorMessage;
                    }

                    throw new Error(errorMessage);
                }

                if (!data.results || data.results.length === 0) {
                    debugWarn('No speech detected in results');
                    showStatus('No speech detected in the audio. Please try recording again with clearer audio.', 'error');
                    return;
                }

                // Track successful Speech API usage
                trackApiUsage('speech', {
                    duration: state.recordingDuration,
                    timestamp: Date.now()
                });

            // Extract word-level information with timing
            const wordInfo = [];
            data.results.forEach(result => {
                if (result.alternatives && result.alternatives[0].words) {
                    result.alternatives[0].words.forEach(wordData => {
                        // Validate that wordData has a word property before adding
                        if (wordData && wordData.word) {
                            wordInfo.push({
                                word: wordData.word,
                                confidence: wordData.confidence || 1.0,
                                startTime: wordData.startTime,
                                endTime: wordData.endTime
                            });
                        } else {
                            debugWarn('Skipping incomplete word data:', wordData);
                        }
                    });
                }
            });

            debugLog('Word-level info with timing:', wordInfo);

            // Use the reusable function for analysis and display
            performPronunciationAnalysis(wordInfo);

            } catch (innerError) {
                debugError('Inner error during audio analysis:', innerError);
                showStatus('Error analyzing audio: ' + innerError.message, 'error');
            }
        };

    } catch (error) {
        debugError('Outer Speech-to-Text error:', error);
        showStatus('Error analyzing audio: ' + error.message, 'error');
    }
}

/**
 * Perform pronunciation analysis using spoken word data.
 * This function is reusable - can be called with cached data from auto-detect
 * or fresh data from a new API call.
 * @param {Array} wordInfo - Array of spoken word objects with word, confidence, startTime, endTime
 */
function performPronunciationAnalysis(wordInfo) {
    // Get expected text from highlighted words
    const selectedIndices = Array.from(state.selectedWords).sort((a, b) => a - b);
    const expectedWords = selectedIndices.map(index => state.ocrData.words[index].text);

    // Analyze pronunciation by comparing expected vs spoken words
    const analysis = analyzePronunciation(expectedWords, wordInfo);

    // Analyze error patterns
    const errorPatterns = analyzeErrorPatterns(analysis, expectedWords);
    debugLog('Error patterns detected:', errorPatterns);

    // Calculate prosody metrics (WPM, prosody score)
    const prosodyMetrics = calculateProsodyMetrics(
        expectedWords,
        wordInfo,
        analysis,
        state.recordingDuration
    );

    // Store analysis results for PDF export
    state.latestAnalysis = analysis;
    state.latestExpectedWords = expectedWords;
    state.latestSpokenWords = wordInfo;
    state.latestProsodyMetrics = prosodyMetrics;
    state.latestErrorPatterns = errorPatterns;

    // Display results with pronunciation analysis
    displayPronunciationResults(expectedWords, wordInfo, analysis, prosodyMetrics);

    const totalErrors = analysis.errors.skippedWords.length +
                      analysis.errors.misreadWords.length +
                      analysis.errors.substitutedWords.length;
    showStatus(`Analysis complete! ${totalErrors} pronunciation error(s) detected.`, '');

    // Scroll to results
    exportOutput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Pronunciation Analysis Functions

// Calculate Levenshtein distance for fuzzy word matching
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[len1][len2];
}

// Convert digit to word form
function digitToWord(digit) {
    const numberWords = {
        '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
        '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
        '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
        '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
        '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '30': 'thirty',
        '40': 'forty', '50': 'fifty', '60': 'sixty', '70': 'seventy',
        '80': 'eighty', '90': 'ninety', '100': 'hundred', '1000': 'thousand'
    };
    return numberWords[digit] || digit;
}

// Convert word to digit form
function wordToDigit(word) {
    const wordNumbers = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
        'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
        'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
        'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
        'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000'
    };
    return wordNumbers[word] || word;
}

// Phonetic equivalences for proper names and common speech recognition patterns
// Maps normalized forms that sound alike when spoken
const phoneticEquivalences = {
    // Proper names that get simplified by speech recognition
    'graham': ['gram', 'grahm', 'graeme'],
    'michael': ['mike', 'micheal', 'mikael'],
    'stephen': ['steven', 'stefan'],
    'catherine': ['katherine', 'kathryn', 'katharine'],
    'anne': ['ann', 'an'],
    'sara': ['sarah', 'sera'],
    'jon': ['john', 'juan'],
    'marc': ['mark'],
    'brian': ['bryan', 'brion'],
    'eric': ['erik', 'erick'],
    'geoffrey': ['jeffrey', 'geoffry'],
    'philip': ['phillip', 'filip'],
    'mathew': ['matthew', 'mathieu'],
    'allan': ['alan', 'allen'],
    'neil': ['neal', 'niel'],
    'stuart': ['stewart', 'steward'],
    'leah': ['lea', 'lia'],
    'rebecca': ['rebekah', 'rebeca'],
    'hannah': ['hanna', 'hana'],
    'rachel': ['rachael', 'raquel'],
    'megan': ['meghan', 'meagan'],
    'caitlin': ['katelyn', 'kaitlyn', 'caitlyn'],
    'ashley': ['ashlee', 'ashleigh'],
    'haley': ['hailey', 'hayley', 'hailee'],
    'mackenzie': ['mckenzie', 'makenzie'],

    // Words where silent letters cause transcription issues
    'knight': ['night', 'nite'],
    'know': ['no'],
    'knew': ['new', 'nu'],
    'write': ['right', 'rite'],
    'wrote': ['rote'],
    'whole': ['hole'],
    'hour': ['our'],
    'heir': ['air', 'ere'],
    'wrap': ['rap'],
    'wring': ['ring'],
    'gnaw': ['naw'],
    'gnat': ['nat'],
    'gnome': ['nome'],
    'psalm': ['sam', 'salm'],
    'island': ['iland'],
    'aisle': ['isle', 'ile'],
    'debt': ['det'],
    'doubt': ['dout'],
    'subtle': ['suttle', 'sutle'],
    'comb': ['come', 'cohm'],
    'tomb': ['toom', 'tume'],
    'climb': ['clime'],
    'lamb': ['lam'],
    'could': ['cud', 'coud'],
    'would': ['wud', 'wood'],
    'should': ['shud', 'shoud'],

    // Common contractions and their expansions
    'cannot': ['cant', 'can not'],
    'will not': ['wont', 'won\'t'],
    'do not': ['dont', 'don\'t'],

    // Words that sound similar
    'their': ['there', 'theyre', 'they\'re'],
    'your': ['youre', 'you\'re', 'yore'],
    'its': ['it\'s'],
    'whose': ['whos', 'who\'s'],
    'to': ['too', 'two'],
    'where': ['wear', 'ware'],
    'weather': ['whether'],
    'through': ['threw', 'thru'],
    'though': ['tho'],
    'thought': ['thot'],
};

// Build reverse lookup map for faster checking
const phoneticLookup = new Map();
for (const [primary, equivalents] of Object.entries(phoneticEquivalences)) {
    phoneticLookup.set(primary, new Set([primary, ...equivalents]));
    for (const equiv of equivalents) {
        if (!phoneticLookup.has(equiv)) {
            phoneticLookup.set(equiv, new Set([primary, ...equivalents]));
        } else {
            phoneticLookup.get(equiv).add(primary);
            equivalents.forEach(e => phoneticLookup.get(equiv).add(e));
        }
    }
}

// Check if two words are phonetically equivalent
function arePhoneticEquivalents(word1, word2) {
    const w1 = word1.toLowerCase();
    const w2 = word2.toLowerCase();

    if (w1 === w2) return true;

    const set1 = phoneticLookup.get(w1);
    if (set1 && set1.has(w2)) return true;

    const set2 = phoneticLookup.get(w2);
    if (set2 && set2.has(w1)) return true;

    return false;
}

// Normalize word for comparison (remove punctuation, lowercase, handle numbers)
function normalizeWord(word) {
    if (!word || typeof word !== 'string') return '';

    // Remove punctuation and lowercase
    let normalized = word.toLowerCase().replace(/[^\w]/g, '');

    // If it's a digit, try to convert to word form
    if (/^\d+$/.test(normalized)) {
        const asWord = digitToWord(normalized);
        return asWord;
    }

    // If it's a number word, try to convert to digit form then back
    // This ensures "ten" and "10" both normalize to "ten"
    const asDigit = wordToDigit(normalized);
    if (asDigit !== normalized && /^\d+$/.test(asDigit)) {
        return digitToWord(asDigit);
    }

    return normalized;
}

// Check if two words are similar enough (allowing for minor pronunciation differences)
function wordsAreSimilar(expected, spoken) {
    if (!expected || !spoken) return false;

    const exp = normalizeWord(expected);
    const spk = normalizeWord(spoken);

    if (!exp || !spk) return false;
    if (exp === spk) return true;

    // Check phonetic equivalence first (handles proper names like Graham/gram)
    if (arePhoneticEquivalents(exp, spk)) return true;

    const maxLen = Math.max(exp.length, spk.length);
    if (maxLen === 0) return false;

    const distance = levenshteinDistance(exp, spk);
    const similarity = 1 - (distance / maxLen);

    // Allow up to 40% difference to catch obvious misreads (e.g., "intelloogin" vs "intelligent")
    return similarity >= 0.60;
}

// Detect if word is a filler word indicating hesitation
function isFillerWord(word) {
    if (!word || typeof word !== 'string') return false;
    const fillers = ['um', 'uh', 'er', 'ah', 'hmm', 'like', 'you know'];
    return fillers.includes(normalizeWord(word));
}

// Detect if there's a long pause (hesitation)
function detectHesitation(wordInfo, index) {
    if (index === 0) return false;

    const currentWord = wordInfo[index];
    const previousWord = wordInfo[index - 1];

    // Validate that both words exist
    if (!currentWord || !previousWord) return false;

    // Check if there's timing info and calculate pause
    if (currentWord.startTime && previousWord.endTime) {
        const pauseDuration = parseFloat(currentWord.startTime) - parseFloat(previousWord.endTime);
        // Pause longer than 1 second indicates hesitation
        return pauseDuration > 1.0;
    }

    return false;
}

// Expand currency symbols in text (e.g., "$1" becomes ["1", "dollar"])
function expandCurrencySymbols(words) {
    const expanded = [];

    for (const word of words) {
        // Match currency patterns like $1, $10, $100, etc.
        const dollarMatch = word.match(/^\$(\d+)$/);
        const dollarCentsMatch = word.match(/^\$(\d+)\.(\d+)$/);

        if (dollarCentsMatch) {
            // $1.50 -> ["1", "dollar", "50", "cents"] or ["1", "dollar", "and", "50", "cents"]
            const dollars = dollarCentsMatch[1];
            const cents = dollarCentsMatch[2];
            expanded.push(dollars);
            expanded.push('dollar');
            if (cents !== '00') {
                expanded.push(cents);
                expanded.push('cents');
            }
        } else if (dollarMatch) {
            // $1 -> ["1", "dollar"]
            const amount = dollarMatch[1];
            expanded.push(amount);
            expanded.push('dollar');
        } else {
            expanded.push(word);
        }
    }

    return expanded;
}

// Expand hyphenated spoken words into component parts
// e.g., "run-of-the-mill" → ["run", "of", "the", "mill"]
// This allows proper alignment with OCR text that has these as separate words
function expandSpokenCompounds(spokenWordInfo) {
    const expanded = [];

    for (const spoken of spokenWordInfo) {
        // Check if this spoken word contains hyphens
        if (spoken.word && spoken.word.includes('-')) {
            const parts = spoken.word.split('-').filter(p => p.length > 0);

            // Add each part as a separate "spoken" word with same timing/confidence
            for (let i = 0; i < parts.length; i++) {
                expanded.push({
                    word: parts[i],
                    confidence: spoken.confidence,
                    startTime: spoken.startTime,
                    endTime: spoken.endTime,
                    isCompoundPart: true,
                    originalWord: spoken.word
                });
            }
        } else {
            expanded.push(spoken);
        }
    }

    return expanded;
}

// Analyze pronunciation by comparing expected vs spoken words
function analyzePronunciation(expectedWords, spokenWordInfo) {
    // Preprocess: Expand currency symbols in expected words
    expectedWords = expandCurrencySymbols(expectedWords);

    // Preprocess: Expand hyphenated compounds in spoken words
    // e.g., "run-of-the-mill" → ["run", "of", "the", "mill"]
    spokenWordInfo = expandSpokenCompounds(spokenWordInfo);

    const analysis = {
        aligned: [],
        errors: {
            skippedWords: [],
            misreadWords: [],
            substitutedWords: [],
            hesitations: [],
            repeatedWords: [],
            skippedLines: [],
            repeatedPhrases: []
        },
        correctCount: 0
    };

    let spokenIndex = 0;
    const LOW_CONFIDENCE_THRESHOLD = 0.85;

    // First pass: Detect hesitations and repeated words in spoken text
    for (let i = 0; i < spokenWordInfo.length; i++) {
        const word = spokenWordInfo[i];

        // Skip if word object is invalid
        if (!word || !word.word) continue;

        // Check for filler words or long pauses
        if (isFillerWord(word.word)) {
            analysis.errors.hesitations.push({
                spokenIndex: i,
                type: 'filler',
                word: word.word
            });
        } else if (detectHesitation(spokenWordInfo, i)) {
            analysis.errors.hesitations.push({
                spokenIndex: i,
                type: 'pause',
                word: word.word
            });
        }

        // Check for repeated words
        const prevWord = spokenWordInfo[i - 1];
        if (i > 0 && prevWord && prevWord.word && normalizeWord(spokenWordInfo[i].word) === normalizeWord(prevWord.word)) {
            analysis.errors.repeatedWords.push({
                spokenIndex: i,
                word: word.word
            });
        }
    }

    // Second pass: Filter spoken words (remove fillers and repetitions)
    const cleanSpoken = [];
    for (let i = 0; i < spokenWordInfo.length; i++) {
        const word = spokenWordInfo[i];
        if (!word || !word.word) continue;

        // Skip filler words
        if (isFillerWord(word.word)) continue;

        // Skip repeated words
        const prevWord = cleanSpoken[cleanSpoken.length - 1];
        if (prevWord && normalizeWord(word.word) === normalizeWord(prevWord.word)) continue;

        cleanSpoken.push(word);
    }

    // Third pass: Dynamic programming alignment (optimal sequence alignment)
    // Build DP table: dp[i][j] = best alignment score for expected[0...i-1] vs spoken[0...j-1]
    const m = expectedWords.length;
    const n = cleanSpoken.length;

    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    const path = Array(m + 1).fill(null).map(() => Array(n + 1).fill(null));

    // Initialize: skipping expected words (spoken runs out)
    for (let i = 1; i <= m; i++) {
        dp[i][0] = -i; // Penalty for each skipped expected word
        path[i][0] = 'skip';
    }

    // Initialize: extra spoken words (not used)
    for (let j = 1; j <= n; j++) {
        dp[0][j] = -j * 0.5; // Smaller penalty for extra spoken words
        path[0][j] = 'insert';
    }

    // Fill DP table
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const expected = expectedWords[i - 1];
            const spoken = cleanSpoken[j - 1];

            const expNorm = normalizeWord(expected);
            const spkNorm = normalizeWord(spoken.word);

            let matchScore;
            if (expNorm === spkNorm || arePhoneticEquivalents(expNorm, spkNorm)) {
                matchScore = 1; // Perfect match (including phonetic equivalents)
            } else if (wordsAreSimilar(expected, spoken.word)) {
                matchScore = 0.3; // Partial match (misread)
            } else {
                matchScore = -1; // Mismatch
            }

            // Three options:
            // 1. Match/mismatch: align expected[i-1] with spoken[j-1]
            const matchOption = dp[i - 1][j - 1] + matchScore;

            // 2. Skip expected[i-1] (expected word not said)
            const skipOption = dp[i - 1][j] - 1;

            // 3. Insert spoken[j-1] (extra word spoken)
            const insertOption = dp[i][j - 1] - 0.5;

            // Choose best option
            if (matchOption >= skipOption && matchOption >= insertOption) {
                dp[i][j] = matchOption;
                path[i][j] = 'match';
            } else if (skipOption >= insertOption) {
                dp[i][j] = skipOption;
                path[i][j] = 'skip';
            } else {
                dp[i][j] = insertOption;
                path[i][j] = 'insert';
            }
        }
    }

    // Backtrack to find optimal alignment
    let i = m;
    let j = n;
    const alignment = [];

    while (i > 0 || j > 0) {
        const action = path[i][j];

        if (action === 'match') {
            const expected = expectedWords[i - 1];
            const spoken = cleanSpoken[j - 1];
            const expNorm = normalizeWord(expected);
            const spkNorm = normalizeWord(spoken.word);

            // Check for exact match OR phonetic equivalence (e.g., "Graham" / "gram")
            if (expNorm === spkNorm || arePhoneticEquivalents(expNorm, spkNorm)) {
                alignment.unshift({
                    expected: expected,
                    spoken: spoken.word,
                    status: 'correct',
                    confidence: spoken.confidence,
                    startTime: spoken.startTime,
                    endTime: spoken.endTime,
                    index: i - 1
                });
                analysis.correctCount++;
            } else {
                alignment.unshift({
                    expected: expected,
                    spoken: spoken.word,
                    status: 'misread',
                    errorType: 'misread_word',
                    confidence: spoken.confidence,
                    startTime: spoken.startTime,
                    endTime: spoken.endTime,
                    index: i - 1
                });
                analysis.errors.misreadWords.push({
                    index: i - 1,
                    expected: expected,
                    spoken: spoken.word
                });
            }
            i--;
            j--;
        } else if (action === 'skip') {
            alignment.unshift({
                expected: expectedWords[i - 1],
                spoken: null,
                status: 'skipped',
                errorType: 'skipped_word',
                index: i - 1
            });
            analysis.errors.skippedWords.push(i - 1);
            i--;
        } else if (action === 'insert') {
            // Extra spoken word - ignore it (don't add to alignment)
            j--;
        } else {
            // Reached the beginning
            break;
        }
    }

    analysis.aligned = alignment;

    // Fourth pass: Detect skipped lines (3+ consecutive skipped words)
    let consecutiveSkips = 0;
    let skipStart = -1;

    for (let i = 0; i < analysis.aligned.length; i++) {
        if (analysis.aligned[i].status === 'skipped') {
            if (consecutiveSkips === 0) skipStart = i;
            consecutiveSkips++;
        } else {
            if (consecutiveSkips >= 3) {
                analysis.errors.skippedLines.push({
                    startIndex: skipStart,
                    endIndex: i - 1,
                    count: consecutiveSkips
                });
            }
            consecutiveSkips = 0;
        }
    }

    // Check last sequence
    if (consecutiveSkips >= 3) {
        analysis.errors.skippedLines.push({
            startIndex: skipStart,
            endIndex: analysis.aligned.length - 1,
            count: consecutiveSkips
        });
    }

    // Fifth pass: Detect repeated phrases (2+ consecutive words repeated)
    // Only flag as error if spoken has MORE repetitions than expected

    // Build a map of all 2-word phrases and their occurrence counts
    const spokenPhraseCounts = new Map();
    const expectedPhraseCounts = new Map();

    // Count phrases in spoken text
    for (let i = 0; i < spokenWordInfo.length - 1; i++) {
        if (!spokenWordInfo[i] || !spokenWordInfo[i].word ||
            !spokenWordInfo[i + 1] || !spokenWordInfo[i + 1].word) continue;

        const word1 = normalizeWord(spokenWordInfo[i].word);
        const word2 = normalizeWord(spokenWordInfo[i + 1].word);

        if (!word1 || !word2) continue;

        const phrase = `${word1} ${word2}`;
        spokenPhraseCounts.set(phrase, (spokenPhraseCounts.get(phrase) || 0) + 1);
    }

    // Count phrases in expected text
    for (let i = 0; i < expectedWords.length - 1; i++) {
        const word1 = normalizeWord(expectedWords[i]);
        const word2 = normalizeWord(expectedWords[i + 1]);

        if (!word1 || !word2) continue;

        const phrase = `${word1} ${word2}`;
        expectedPhraseCounts.set(phrase, (expectedPhraseCounts.get(phrase) || 0) + 1);
    }

    // Compare counts and flag phrases that appear more times in spoken than expected
    for (const [phrase, spokenCount] of spokenPhraseCounts.entries()) {
        if (spokenCount > 1) { // Only check phrases that actually repeat
            const expectedCount = expectedPhraseCounts.get(phrase) || 0;

            // Flag as error if spoken has more occurrences than expected
            if (spokenCount > expectedCount) {
                // Find the indices where this phrase appears in spoken text
                const indices = [];
                for (let i = 0; i < spokenWordInfo.length - 1; i++) {
                    if (!spokenWordInfo[i] || !spokenWordInfo[i].word ||
                        !spokenWordInfo[i + 1] || !spokenWordInfo[i + 1].word) continue;

                    const w1 = normalizeWord(spokenWordInfo[i].word);
                    const w2 = normalizeWord(spokenWordInfo[i + 1].word);
                    const testPhrase = `${w1} ${w2}`;

                    if (testPhrase === phrase) {
                        indices.push(i);
                    }
                }

                // Report the first two occurrences
                if (indices.length >= 2) {
                    analysis.errors.repeatedPhrases.push({
                        phrase: `${spokenWordInfo[indices[0]].word} ${spokenWordInfo[indices[0] + 1].word}`,
                        firstIndex: indices[0],
                        secondIndex: indices[1]
                    });
                }
            }
        }
    }

    debugLog('Detailed pronunciation analysis:', analysis);
    return analysis;
}

// ============ ERROR PATTERN ANALYSIS FUNCTIONS ============

// Analyze error patterns across all misread words
function analyzeErrorPatterns(analysis, expectedWords) {
    const patterns = {
        phonicsPatterns: {
            initialSoundErrors: [],
            finalSoundErrors: [],
            vowelPatterns: [],
            consonantBlends: [],
            silentLetters: [],
            rControlledVowels: [],
            digraphs: []
        },
        readingStrategies: {
            firstLetterGuessing: [],
            contextGuessing: [],
            partialDecoding: []
        },
        speechPatterns: {
            rSoundIssues: [],
            sSoundIssues: [],
            lSoundIssues: [],
            thSoundIssues: []
        },
        morphologicalErrors: [],
        visualSimilarityErrors: [],
        summary: {}
    };

    // Safety check - ensure analysis.errors exists
    if (!analysis || !analysis.errors) {
        debugWarn('No analysis errors to process');
        patterns.summary = generatePatternSummary(patterns, analysis);
        return patterns;
    }

    // Analyze each misread word
    const misreadWords = analysis.errors.misreadWords || [];
    misreadWords.forEach(error => {
        // Skip if error object is missing expected or spoken properties
        if (!error) {
            debugWarn('Skipping null error object');
            return;
        }

        const expected = error.expected;
        const spoken = error.spoken;

        if (!expected || typeof expected !== 'string' || !spoken || typeof spoken !== 'string') {
            debugWarn('Skipping malformed misread error:', error);
            return;
        }

        const expectedLower = expected.toLowerCase();
        const actualLower = spoken.toLowerCase();

        // Check phonics patterns
        analyzePhonicsPattern(expectedLower, actualLower, patterns);

        // Check reading strategies
        analyzeReadingStrategy(expectedLower, actualLower, patterns);

        // Check for potential speech issues
        analyzeSpeechPattern(expectedLower, actualLower, patterns);

        // Check visual similarity
        analyzeVisualSimilarity(expectedLower, actualLower, patterns);
    });

    // Analyze skipped words
    const skippedWords = analysis.errors.skippedWords || [];
    skippedWords.forEach(wordIndex => {
        if (expectedWords && wordIndex < expectedWords.length) {
            const word = expectedWords[wordIndex];
            analyzeSkippedWordPattern(word, patterns);
        }
    });

    // Generate summary insights
    patterns.summary = generatePatternSummary(patterns, analysis);

    return patterns;
}

// Analyze phonics-specific patterns
function analyzePhonicsPattern(expected, actual, patterns) {
    // Null check
    if (!expected || !actual) return;

    // Check initial sound errors
    if (expected[0] !== actual[0]) {
        patterns.phonicsPatterns.initialSoundErrors.push({
            expected: expected,
            actual: actual,
            expectedSound: expected[0],
            actualSound: actual[0],
            pattern: getInitialSoundPattern(expected[0], actual[0])
        });
    }

    // Check final sound errors
    if (expected.length > 0 && actual.length > 0) {
        const expLast = expected[expected.length - 1];
        const actLast = actual[actual.length - 1];
        if (expLast !== actLast) {
            patterns.phonicsPatterns.finalSoundErrors.push({
                expected: expected,
                actual: actual,
                expectedSound: expLast,
                actualSound: actLast,
                pattern: 'Final consonant ' + (actual.length < expected.length ? 'deletion' : 'substitution')
            });
        }
    }

    // Check for silent 'e' pattern (CVCe)
    if (expected.endsWith('e') && expected.length > 2) {
        const beforeE = expected[expected.length - 2];
        if (!'aeiou'.includes(beforeE)) {
            // This is a CVCe word
            if (!actual.endsWith('e') || actual.length < expected.length) {
                patterns.phonicsPatterns.silentLetters.push({
                    expected: expected,
                    actual: actual,
                    pattern: 'Silent E confusion (CVCe)',
                    description: 'May be reading with short vowel instead of long vowel'
                });
            }
        }
    }

    // Check for r-controlled vowels
    const rControlledPatterns = ['ar', 'er', 'ir', 'or', 'ur'];
    rControlledPatterns.forEach(pattern => {
        if (expected.includes(pattern)) {
            if (!actual.includes(pattern) || hasRControlledError(expected, actual, pattern)) {
                patterns.phonicsPatterns.rControlledVowels.push({
                    expected: expected,
                    actual: actual,
                    pattern: pattern.toUpperCase() + ' pattern',
                    description: 'R-controlled vowel difficulty'
                });
            }
        }
    });

    // Check for consonant blends
    const blends = ['bl', 'cl', 'fl', 'gl', 'pl', 'sl', 'br', 'cr', 'dr', 'fr', 'gr', 'tr',
                    'sc', 'sk', 'sm', 'sn', 'sp', 'st', 'sw', 'tw', 'scr', 'spl', 'spr', 'str'];
    blends.forEach(blend => {
        if (expected.includes(blend)) {
            if (!actual.includes(blend)) {
                patterns.phonicsPatterns.consonantBlends.push({
                    expected: expected,
                    actual: actual,
                    blend: blend.toUpperCase(),
                    pattern: 'Consonant blend reduction or substitution'
                });
            }
        }
    });

    // Check for digraphs
    const digraphs = ['ch', 'sh', 'th', 'ph', 'wh', 'ck'];
    digraphs.forEach(digraph => {
        if (expected.includes(digraph)) {
            if (!actual.includes(digraph)) {
                patterns.phonicsPatterns.digraphs.push({
                    expected: expected,
                    actual: actual,
                    digraph: digraph.toUpperCase(),
                    pattern: 'Digraph error - may be pronouncing separately'
                });
            }
        }
    });

    // Check vowel patterns
    if (hasVowelError(expected, actual)) {
        const vowelPattern = getVowelPattern(expected, actual);
        if (vowelPattern) {
            patterns.phonicsPatterns.vowelPatterns.push(vowelPattern);
        }
    }
}

// Analyze reading strategy patterns
function analyzeReadingStrategy(expected, actual, patterns) {
    // Null check
    if (!expected || !actual) return;

    // First letter guessing - same initial letter but different word
    if (expected[0] === actual[0] && expected.length > 2 && actual.length > 2) {
        const similarity = calculateSimilarity(expected, actual);
        if (similarity < 0.5) {
            patterns.readingStrategies.firstLetterGuessing.push({
                expected: expected,
                actual: actual,
                pattern: 'Guessing based on first letter',
                description: 'Child may be looking at first letter and guessing rather than decoding full word'
            });
        }
    }

    // Partial decoding - first part correct, rest wrong
    if (expected.length > 4 && actual.length > 4) {
        const firstHalf = Math.floor(expected.length / 2);
        const expFirst = expected.substring(0, firstHalf);
        const actFirst = actual.substring(0, firstHalf);
        if (expFirst === actFirst || calculateSimilarity(expFirst, actFirst) > 0.7) {
            patterns.readingStrategies.partialDecoding.push({
                expected: expected,
                actual: actual,
                pattern: 'Partial decoding + guessing',
                description: 'Child decodes first part correctly but guesses the rest'
            });
        }
    }

    // Context guessing - semantically related but phonetically different
    if (areSemanticallySimilar(expected, actual)) {
        patterns.readingStrategies.contextGuessing.push({
            expected: expected,
            actual: actual,
            pattern: 'Context-based guessing',
            description: 'Child may be using context clues instead of decoding'
        });
    }
}

// Analyze potential speech pattern issues
function analyzeSpeechPattern(expected, actual, patterns) {
    // Null check
    if (!expected || !actual) return;

    // Check for consistent R sound issues
    if (expected.includes('r') && !actual.includes('r')) {
        patterns.speechPatterns.rSoundIssues.push({
            expected: expected,
            actual: actual,
            pattern: 'R sound omission or substitution'
        });
    } else if (expected.includes('r') && actual.includes('w')) {
        patterns.speechPatterns.rSoundIssues.push({
            expected: expected,
            actual: actual,
            pattern: 'R → W substitution (possible rhotacism)'
        });
    }

    // Check for S sound issues (lisp)
    if (expected.includes('s') && hasThSubstitution(expected, actual)) {
        patterns.speechPatterns.sSoundIssues.push({
            expected: expected,
            actual: actual,
            pattern: 'S → TH substitution (possible interdental lisp)'
        });
    }

    // Check for L sound issues
    if (expected.includes('l') && !actual.includes('l')) {
        patterns.speechPatterns.lSoundIssues.push({
            expected: expected,
            actual: actual,
            pattern: 'L sound omission or substitution'
        });
    } else if (expected.includes('l') && (actual.includes('w') || actual.includes('y'))) {
        patterns.speechPatterns.lSoundIssues.push({
            expected: expected,
            actual: actual,
            pattern: 'L → W/Y substitution'
        });
    }

    // Check for TH sound issues
    if (expected.includes('th')) {
        if (actual.includes('d') || actual.includes('t') || actual.includes('f')) {
            patterns.speechPatterns.thSoundIssues.push({
                expected: expected,
                actual: actual,
                pattern: 'TH digraph substitution'
            });
        }
    }
}

// Analyze visual similarity errors
function analyzeVisualSimilarity(expected, actual, patterns) {
    // Null check
    if (!expected || !actual) return;

    const visuallySimilar = [
        ['b', 'd'], ['p', 'q'], ['m', 'n'], ['u', 'n'],
        ['h', 'n'], ['saw', 'was'], ['no', 'on']
    ];

    let isVisual = false;
    visuallySimilar.forEach(pair => {
        if ((expected.includes(pair[0]) && actual.includes(pair[1])) ||
            (expected.includes(pair[1]) && actual.includes(pair[0]))) {
            isVisual = true;
        }
    });

    if (isVisual || (calculateSimilarity(expected, actual) > 0.6 && expected[0] === actual[0])) {
        patterns.visualSimilarityErrors.push({
            expected: expected,
            actual: actual,
            pattern: 'Visual similarity confusion',
            description: 'Words look similar in shape or letter patterns'
        });
    }
}

// Analyze patterns in skipped words
function analyzeSkippedWordPattern(word, patterns) {
    if (!word || typeof word !== 'string') {
        debugWarn('Skipping invalid word in analyzeSkippedWordPattern:', word);
        return;
    }
    word = word.toLowerCase();

    // Check if skipped word has difficult phonics features
    const blends = ['bl', 'cl', 'fl', 'gl', 'pl', 'sl', 'br', 'cr', 'dr', 'fr', 'gr', 'tr', 'scr', 'spl', 'spr', 'str'];
    const hasBlend = blends.some(blend => word.includes(blend));

    if (hasBlend) {
        patterns.phonicsPatterns.consonantBlends.push({
            expected: word,
            actual: '(skipped)',
            pattern: 'Avoidance of consonant blends',
            description: 'Child may skip words with difficult consonant blends'
        });
    }

    // Check for r-controlled vowels
    if (word.includes('ar') || word.includes('er') || word.includes('ir') ||
        word.includes('or') || word.includes('ur')) {
        patterns.phonicsPatterns.rControlledVowels.push({
            expected: word,
            actual: '(skipped)',
            pattern: 'Avoidance of r-controlled vowels'
        });
    }
}

// Helper functions

function getInitialSoundPattern(expected, actual) {
    const voicedPairs = [['b', 'p'], ['d', 't'], ['g', 'k'], ['v', 'f'], ['z', 's']];
    for (let pair of voicedPairs) {
        if ((pair[0] === expected && pair[1] === actual) ||
            (pair[1] === expected && pair[0] === actual)) {
            return 'Voicing error (voiced/voiceless confusion)';
        }
    }

    if (['k', 'g'].includes(expected) && ['t', 'd'].includes(actual)) {
        return 'Fronting (back sound → front sound)';
    }

    return 'Initial consonant substitution';
}

function hasRControlledError(expected, actual, pattern) {
    const expIndex = expected.indexOf(pattern);
    const actIndex = actual.indexOf(pattern);
    return expIndex >= 0 && (actIndex < 0 || expIndex !== actIndex);
}

function hasVowelError(expected, actual) {
    const vowels = 'aeiou';
    let expVowels = '';
    let actVowels = '';

    for (let char of expected) {
        if (vowels.includes(char)) expVowels += char;
    }
    for (let char of actual) {
        if (vowels.includes(char)) actVowels += char;
    }

    return expVowels !== actVowels;
}

function getVowelPattern(expected, actual) {
    // Check for short vs long vowel confusion
    if (expected.endsWith('e') && expected.length > 2) {
        const expVowel = expected[expected.length - 3];
        if ('aeiou'.includes(expVowel)) {
            return {
                expected: expected,
                actual: actual,
                pattern: 'Short vs Long vowel confusion',
                description: 'May not be applying CVCe (magic e) rule'
            };
        }
    }

    // Check for vowel team confusion
    const vowelTeams = ['ai', 'ay', 'ea', 'ee', 'ie', 'oa', 'oe', 'ue', 'ui', 'oi', 'oy', 'ou', 'ow'];
    for (let team of vowelTeams) {
        if (expected.includes(team) && !actual.includes(team)) {
            return {
                expected: expected,
                actual: actual,
                pattern: team.toUpperCase() + ' vowel team error',
                description: 'Vowel team mispronunciation'
            };
        }
    }

    return null;
}

function calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    if (maxLen === 0) return 1.0;

    const distance = levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
}

function hasThSubstitution(expected, actual) {
    // Simple check - could be enhanced with phonetic analysis
    if (!expected || !actual) return false;
    return expected.includes('s') && actual.toLowerCase().includes('th');
}

function areSemanticallySimilar(word1, word2) {
    // Basic semantic similarity - could be enhanced with a proper semantic database
    if (!word1 || !word2) return false;

    const semanticGroups = [
        ['house', 'home', 'building'],
        ['car', 'vehicle', 'auto'],
        ['dog', 'puppy', 'pet'],
        ['cat', 'kitten', 'feline'],
        ['big', 'large', 'huge'],
        ['small', 'tiny', 'little'],
        ['happy', 'glad', 'joyful'],
        ['sad', 'unhappy', 'upset']
    ];

    return semanticGroups.some(group =>
        group.includes(word1.toLowerCase()) && group.includes(word2.toLowerCase())
    );
}

// Generate summary insights from all patterns
function generatePatternSummary(patterns, analysis) {
    const summary = {
        primaryIssues: [],
        recommendations: [],
        severity: 'mild'
    };

    const totalErrors = analysis.errors.skippedWords.length +
                       analysis.errors.misreadWords.length +
                       analysis.errors.substitutedWords.length;

    // Analyze phonics patterns
    if (patterns.phonicsPatterns.initialSoundErrors.length >= 3) {
        summary.primaryIssues.push('Consistent initial sound errors');
        summary.recommendations.push('Focus on initial consonant sounds and phonemic awareness activities');
    }

    if (patterns.phonicsPatterns.finalSoundErrors.length >= 3) {
        summary.primaryIssues.push('Final consonant deletion or substitution');
        summary.recommendations.push('Practice ending sounds; may benefit from speech-language evaluation');
    }

    if (patterns.phonicsPatterns.vowelPatterns.length >= 2) {
        summary.primaryIssues.push('Vowel pattern confusion (short/long, vowel teams)');
        summary.recommendations.push('Systematic vowel instruction needed; focus on CVCe and vowel teams');
    }

    if (patterns.phonicsPatterns.consonantBlends.length >= 2) {
        summary.primaryIssues.push('Difficulty with consonant blends');
        summary.recommendations.push('Practice blending sounds together; start with 2-letter blends before 3-letter');
    }

    if (patterns.phonicsPatterns.rControlledVowels.length >= 2) {
        summary.primaryIssues.push('R-controlled vowel difficulties');
        summary.recommendations.push('Explicit instruction on r-controlled vowels (ar, er, ir, or, ur)');
    }

    if (patterns.phonicsPatterns.silentLetters.length >= 2) {
        summary.primaryIssues.push('Silent letter confusion (especially silent E)');
        summary.recommendations.push('Teach CVCe pattern explicitly; compare CVC vs CVCe words');
    }

    // Analyze reading strategies
    if (patterns.readingStrategies.firstLetterGuessing.length >= 2) {
        summary.primaryIssues.push('Guessing based on first letter instead of full decoding');
        summary.recommendations.push('Encourage sounding out entire word; reduce reliance on guessing strategies');
    }

    if (patterns.readingStrategies.partialDecoding.length >= 2) {
        summary.primaryIssues.push('Partial decoding with guessing at word endings');
        summary.recommendations.push('Practice decoding through entire word; work on syllable division');
    }

    if (patterns.readingStrategies.contextGuessing.length >= 2) {
        summary.primaryIssues.push('Over-reliance on context clues vs. decoding');
        summary.recommendations.push('Balance meaning and decoding; ensure phonics skills are strong');
    }

    // Analyze speech patterns - flag for evaluation
    const speechIssues = [];
    if (patterns.speechPatterns.rSoundIssues.length >= 3) {
        speechIssues.push('R sound difficulties');
    }
    if (patterns.speechPatterns.sSoundIssues.length >= 3) {
        speechIssues.push('S sound difficulties (possible lisp)');
    }
    if (patterns.speechPatterns.lSoundIssues.length >= 3) {
        speechIssues.push('L sound difficulties');
    }
    if (patterns.speechPatterns.thSoundIssues.length >= 2) {
        speechIssues.push('TH sound difficulties');
    }

    if (speechIssues.length > 0) {
        summary.primaryIssues.push('Possible articulation/speech issues: ' + speechIssues.join(', '));
        summary.recommendations.push('⚠️ Consider speech-language pathologist evaluation to distinguish speech vs. reading errors');
    }

    // Visual similarity
    if (patterns.visualSimilarityErrors.length >= 2) {
        summary.primaryIssues.push('Visual confusion with similar-looking letters/words');
        summary.recommendations.push('Practice discriminating visually similar letters (b/d, p/q); use multisensory approaches');
    }

    // Determine severity
    if (totalErrors === 0) {
        summary.severity = 'excellent';
    } else if (totalErrors < 5) {
        summary.severity = 'mild';
    } else if (totalErrors < 10) {
        summary.severity = 'moderate';
    } else {
        summary.severity = 'significant';
    }

    // Add general recommendations based on severity
    if (summary.severity === 'significant') {
        summary.recommendations.unshift('Consider comprehensive reading evaluation');
        summary.recommendations.push('May benefit from intensive phonics intervention program');
    }

    return summary;
}

// ============ END ERROR PATTERN ANALYSIS ============

// Calculate prosody metrics (reading rate, fluency score)
function calculateProsodyMetrics(expectedWords, spokenWordInfo, analysis, recordingDurationSeconds) {
    const metrics = {
        totalWords: expectedWords.length,
        wordsRead: analysis.correctCount + analysis.errors.misreadWords.length,
        accuracy: 0,
        wpm: 0,
        prosodyScore: 0,
        prosodyGrade: '',
        readingTime: 0
    };

    // Calculate actual reading time from timing data
    if (spokenWordInfo && spokenWordInfo.length > 0) {
        const firstWord = spokenWordInfo[0];
        const lastWord = spokenWordInfo[spokenWordInfo.length - 1];

        if (firstWord.startTime && lastWord.endTime) {
            const startSeconds = parseFloat(firstWord.startTime.replace('s', ''));
            const endSeconds = parseFloat(lastWord.endTime.replace('s', ''));
            metrics.readingTime = endSeconds - startSeconds;
        } else {
            // Fallback to recording duration if timing not available
            metrics.readingTime = recordingDurationSeconds || 0;
        }
    } else {
        metrics.readingTime = recordingDurationSeconds || 0;
    }

    // Calculate Words Per Minute (WPM)
    if (metrics.readingTime > 0) {
        const minutes = metrics.readingTime / 60;
        metrics.wpm = Math.round(metrics.wordsRead / minutes);
    }

    // Calculate accuracy percentage
    if (metrics.totalWords > 0) {
        metrics.accuracy = (analysis.correctCount / metrics.totalWords) * 100;
    }

    // Calculate Prosody Score (1-4 scale, common in education)
    // Based on: accuracy, reading rate, and fluency (errors)
    let prosodyScore = 0;

    // Component 1: Accuracy (40% weight)
    let accuracyPoints = 0;
    if (metrics.accuracy >= 98) accuracyPoints = 4;
    else if (metrics.accuracy >= 95) accuracyPoints = 3.5;
    else if (metrics.accuracy >= 90) accuracyPoints = 3;
    else if (metrics.accuracy >= 85) accuracyPoints = 2.5;
    else if (metrics.accuracy >= 75) accuracyPoints = 2;
    else if (metrics.accuracy >= 60) accuracyPoints = 1.5;
    else accuracyPoints = 1;

    // Component 2: Reading Rate (30% weight)
    // Typical rates: grades 3-4: 80-120 WPM, grades 5-6: 100-140 WPM, grades 7+: 120-180 WPM
    let ratePoints = 0;
    if (metrics.wpm >= 100 && metrics.wpm <= 180) ratePoints = 4; // Optimal range
    else if (metrics.wpm >= 80 && metrics.wpm <= 200) ratePoints = 3.5; // Good range
    else if (metrics.wpm >= 60 && metrics.wpm <= 220) ratePoints = 3; // Acceptable
    else if (metrics.wpm >= 40 && metrics.wpm <= 250) ratePoints = 2; // Slow or too fast
    else ratePoints = 1; // Very slow or racing

    // Component 3: Fluency - fewer errors = better prosody (30% weight)
    const totalErrors = analysis.errors.skippedWords.length +
                       analysis.errors.misreadWords.length +
                       analysis.errors.substitutedWords.length +
                       analysis.errors.hesitations.length +
                       analysis.errors.repeatedWords.length;

    const errorRate = metrics.totalWords > 0 ? (totalErrors / metrics.totalWords) : 0;

    let fluencyPoints = 0;
    if (errorRate <= 0.02) fluencyPoints = 4; // 2% or fewer errors
    else if (errorRate <= 0.05) fluencyPoints = 3.5; // 5% or fewer
    else if (errorRate <= 0.10) fluencyPoints = 3; // 10% or fewer
    else if (errorRate <= 0.20) fluencyPoints = 2.5; // 20% or fewer
    else if (errorRate <= 0.30) fluencyPoints = 2; // 30% or fewer
    else fluencyPoints = 1;

    // Calculate weighted prosody score
    prosodyScore = (accuracyPoints * 0.4) + (ratePoints * 0.3) + (fluencyPoints * 0.3);
    metrics.prosodyScore = Math.round(prosodyScore * 10) / 10; // Round to 1 decimal

    // Assign prosody grade
    if (metrics.prosodyScore >= 3.8) metrics.prosodyGrade = 'Excellent';
    else if (metrics.prosodyScore >= 3.0) metrics.prosodyGrade = 'Proficient';
    else if (metrics.prosodyScore >= 2.0) metrics.prosodyGrade = 'Developing';
    else metrics.prosodyGrade = 'Needs Support';

    debugLog('Prosody Metrics:', metrics);
    return metrics;
}

// Display word count only results (when audio is skipped)
function displayWordCountOnlyResults() {
    // Check if text has been highlighted
    if (state.selectedWords.size === 0) {
        alert('Please highlight the text first');
        return;
    }

    // Get selected words
    const selectedWords = Array.from(state.selectedWords).map(index => {
        const wordData = state.ocrData.pages[0].words[index];
        return wordData.symbols.map(s => s.text).join('');
    });

    const totalWords = selectedWords.length;

    // Build results HTML
    const resultsHtml = `
        <div class="word-count-results">
            <h3>📝 Word Count Results</h3>
            <div class="stats-grid" style="max-width: 400px; margin: 2rem auto;">
                <div class="stat-box">
                    <div class="stat-label">Total Words</div>
                    <div class="stat-value">${totalWords}</div>
                </div>
            </div>

            <div class="info-box" style="margin: 2rem auto; max-width: 600px;">
                <p><strong>ℹ️ Word Count Only Mode</strong></p>
                <p>You skipped audio recording. This mode counts words without pronunciation analysis.</p>
                <p>To get accuracy, WPM, and error analysis, record audio first.</p>
            </div>

            <div class="selected-words-display">
                <h4>Selected Words (${totalWords}):</h4>
                <div class="words-list">
                    ${selectedWords.map((word, i) => `<span class="word-item">${i + 1}. ${escapeHtml(word)}</span>`).join(' ')}
                </div>
            </div>
        </div>
    `;

    // Display results
    resultsContainer.innerHTML = resultsHtml;

    // Mark steps as complete
    state.completedSteps.add('highlight');
    state.completedSteps.add('results');
    goToStep('results');
}

// Display pronunciation analysis results
function displayPronunciationResults(expectedWords, spokenWordInfo, analysis, prosodyMetrics) {
    // Build HTML for word-by-word display
    let wordsHtml = '';

    analysis.aligned.forEach(item => {
        const word = item.expected;
        // Sanitize word data for display
        const safeWord = escapeHtml(word);
        const safeSpoken = escapeHtml(item.spoken || '');
        let className = 'word-correct';
        let errorLabel = '';
        let tooltipData = {
            status: item.status,
            expected: word,
            spoken: item.spoken || '',
            confidence: item.confidence || 0,
            reason: ''
        };

        if (item.status === 'correct') {
            className = 'word-correct';
            tooltipData.reason = 'Word was pronounced correctly';
        } else if (item.status === 'skipped') {
            className = 'word-skipped';
            errorLabel = '<span class="error-badge">skipped</span>';
            tooltipData.reason = 'This word was not detected in the audio recording';
        } else if (item.status === 'misread') {
            className = 'word-misread';
            errorLabel = '<span class="error-badge">misread</span>';
            tooltipData.reason = 'The pronunciation was similar but not exact';
        } else if (item.status === 'substituted') {
            className = 'word-substituted';
            errorLabel = '<span class="error-badge">substituted</span>';
            tooltipData.reason = 'A completely different word was spoken';
        }

        // Store data as JSON in data attribute (use escapeJsonForAttribute for safety)
        const dataAttr = `data-word-info='${escapeJsonForAttribute(tooltipData)}'`;
        wordsHtml += `<span class="${className}" ${dataAttr}>${safeWord}${errorLabel}</span> `;
    });

    // Build statistics
    const totalWords = expectedWords.length;
    const correctCount = analysis.correctCount;
    const totalErrors = analysis.errors.skippedWords.length +
                        analysis.errors.misreadWords.length +
                        analysis.errors.substitutedWords.length;
    const accuracy = ((correctCount / totalWords) * 100).toFixed(1);

    // Build error breakdown
    let errorBreakdownHtml = '';

    if (analysis.errors.skippedWords.length > 0) {
        errorBreakdownHtml += `
            <div class="error-category">
                <strong>⏭️ Skipped Words (${analysis.errors.skippedWords.length}):</strong>
                <div class="error-details">Words not read aloud</div>
            </div>
        `;
    }

    if (analysis.errors.misreadWords.length > 0) {
        const misreadList = analysis.errors.misreadWords.map(e =>
            `"${escapeHtml(e.expected)}" → "${escapeHtml(e.spoken)}"`
        ).join(', ');
        errorBreakdownHtml += `
            <div class="error-category">
                <strong>📖 Misread Words (${analysis.errors.misreadWords.length}):</strong>
                <div class="error-details">${misreadList}</div>
            </div>
        `;
    }

    if (analysis.errors.substitutedWords.length > 0) {
        const subList = analysis.errors.substitutedWords.map(e =>
            `"${escapeHtml(e.expected)}" → "${escapeHtml(e.spoken)}"`
        ).join(', ');
        errorBreakdownHtml += `
            <div class="error-category">
                <strong>🔄 Substituted Words (${analysis.errors.substitutedWords.length}):</strong>
                <div class="error-details">${subList}</div>
            </div>
        `;
    }

    if (analysis.errors.hesitations.length > 0) {
        const hesitationList = analysis.errors.hesitations.map(h =>
            h.type === 'filler' ? `"${escapeHtml(h.word)}"` : `pause before "${escapeHtml(h.word)}"`
        ).join(', ');
        errorBreakdownHtml += `
            <div class="error-category">
                <strong>⏸️ Hesitations (${analysis.errors.hesitations.length}):</strong>
                <div class="error-details">${hesitationList}</div>
            </div>
        `;
    }

    if (analysis.errors.repeatedWords.length > 0) {
        const repeatList = analysis.errors.repeatedWords.map(r => `"${escapeHtml(r.word)}"`).join(', ');
        errorBreakdownHtml += `
            <div class="error-category">
                <strong>🔁 Repeated Words (${analysis.errors.repeatedWords.length}):</strong>
                <div class="error-details">${repeatList}</div>
            </div>
        `;
    }

    if (analysis.errors.skippedLines.length > 0) {
        errorBreakdownHtml += `
            <div class="error-category error-critical">
                <strong>📄 Skipped Lines (${analysis.errors.skippedLines.length}):</strong>
                <div class="error-details">${analysis.errors.skippedLines.map(l =>
                    `${l.count} consecutive words skipped`
                ).join(', ')}</div>
            </div>
        `;
    }

    if (analysis.errors.repeatedPhrases.length > 0) {
        const phraseList = analysis.errors.repeatedPhrases.map(p => `"${escapeHtml(p.phrase)}"`).join(', ');
        errorBreakdownHtml += `
            <div class="error-category">
                <strong>🔂 Repeated Phrases (${analysis.errors.repeatedPhrases.length}):</strong>
                <div class="error-details">${phraseList}</div>
            </div>
        `;
    }

    exportOutput.innerHTML = `
        <h3>🎯 Oral Fluency Analysis</h3>
        <div class="audio-analysis-result">
            <div class="download-output-section">
                <button id="download-pdf-btn" class="btn btn-export">
                    <span class="icon">📄</span> Generate PDF
                </button>
                <button id="generate-video-btn" class="btn btn-export">
                    <span class="icon">🎬</span> Generate Video
                </button>
                <button id="view-patterns-btn" class="btn btn-export">
                    <span class="icon">📊</span> View Detailed Patterns
                </button>
                <button id="export-words-btn" class="btn btn-export">
                    <span class="icon">📋</span> Export Words
                </button>
            </div>
            <div id="video-generation-status" class="video-status"></div>

            <div class="stats-grid">
                <div class="stat-box stat-correct">
                    <div class="stat-number">${correctCount}</div>
                    <div class="stat-label">Correct</div>
                </div>
                <div class="stat-box stat-error">
                    <div class="stat-number">${totalErrors}</div>
                    <div class="stat-label">Total Errors</div>
                </div>
                <div class="stat-box stat-accuracy">
                    <div class="stat-number">${accuracy}%</div>
                    <div class="stat-label">Accuracy</div>
                </div>
                ${prosodyMetrics ? `
                <div class="stat-box stat-wpm">
                    <div class="stat-number">${prosodyMetrics.wpm}</div>
                    <div class="stat-label">WPM</div>
                </div>
                <div class="stat-box stat-prosody">
                    <div class="stat-number">${prosodyMetrics.prosodyScore}</div>
                    <div class="stat-label">Prosody (${prosodyMetrics.prosodyGrade})</div>
                </div>
                ` : ''}
            </div>

            <div class="pronunciation-text">
                <h4>📝 Text with Error Highlighting:</h4>
                <div class="analyzed-text">${wordsHtml}</div>
                <div class="legend">
                    <span class="legend-item"><span class="word-correct">Green</span> = Correct</span>
                    <span class="legend-item"><span class="word-skipped">Gray</span> = Skipped</span>
                    <span class="legend-item"><span class="word-misread">Orange</span> = Misread</span>
                    <span class="legend-item"><span class="word-substituted">Red</span> = Substituted</span>
                </div>
                <p class="hint-text">💡 Hover over words to see details</p>
            </div>

            ${errorBreakdownHtml ? `
                <div class="error-breakdown">
                    <h4>📊 Error Breakdown:</h4>
                    ${errorBreakdownHtml}
                </div>
            ` : ''}
        </div>
    `;
    exportOutput.classList.add('active');

    // Update word count display
    wordCountDisplay.textContent = correctCount;

    // Also display in the new results section
    if (resultsContainer) {
        resultsContainer.innerHTML = exportOutput.innerHTML;

        // Re-attach event listeners for the results section
        const downloadPdfBtnResults = resultsContainer.querySelector('#download-pdf-btn');
        const generateVideoBtnResults = resultsContainer.querySelector('#generate-video-btn');
        const statusDivResults = resultsContainer.querySelector('#video-generation-status');

        if (downloadPdfBtnResults) {
            downloadPdfBtnResults.addEventListener('click', downloadAnalysisAsHtml2Pdf);
        }
        if (generateVideoBtnResults) {
            generateVideoBtnResults.addEventListener('click', async function() {
                // Call generateTranscriptVideo with results container context
                await generateTranscriptVideoInContainer(resultsContainer);
            });
        }
        const viewPatternsBtnResults = resultsContainer.querySelector('#view-patterns-btn');
        if (viewPatternsBtnResults) {
            viewPatternsBtnResults.addEventListener('click', viewDetailedPatterns);
        }
        const exportWordsBtnResults = resultsContainer.querySelector('#export-words-btn');
        if (exportWordsBtnResults) {
            exportWordsBtnResults.addEventListener('click', exportSelectedWords);
        }
    }

    // Add event listener for download PDF button in export section
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', downloadAnalysisAsHtml2Pdf);
    }

    // Add event listener for video generation button in export section
    const generateVideoBtn = document.getElementById('generate-video-btn');
    if (generateVideoBtn) {
        generateVideoBtn.addEventListener('click', generateTranscriptVideo);
    }

    // Add event listener for view patterns button in export section
    const viewPatternsBtn = document.getElementById('view-patterns-btn');
    if (viewPatternsBtn) {
        viewPatternsBtn.addEventListener('click', viewDetailedPatterns);
    }

    // Add event listener for export words button
    const exportWordsBtn = document.getElementById('export-words-btn');
    if (exportWordsBtn) {
        exportWordsBtn.addEventListener('click', exportSelectedWords);
    }

    // Auto-save assessment if student was selected
    autoSaveAssessmentIfStudentSelected();

    // Mark highlight and results as complete and navigate to results section
    state.completedSteps.add('highlight');
    state.completedSteps.add('results');
    goToStep('results');
}

// Generate and download analysis as PDF using html2pdf
function downloadAnalysisAsHtml2Pdf() {
    if (!state.latestAnalysis || !state.latestExpectedWords) {
        alert('No analysis data available');
        return;
    }

    const analysis = state.latestAnalysis;
    const prosodyMetrics = state.latestProsodyMetrics || {};
    const patterns = state.latestErrorPatterns;

    // Calculate metrics
    const totalErrors = (analysis.errors?.skippedWords?.length || 0) +
                        (analysis.errors?.misreadWords?.length || 0) +
                        (analysis.errors?.substitutedWords?.length || 0);
    const accuracy = analysis.correctCount > 0
        ? Math.round((analysis.correctCount / (analysis.correctCount + totalErrors)) * 100)
        : 0;

    // Build word-by-word content with inline styles
    let wordsContent = '';
    if (analysis.aligned) {
        analysis.aligned.forEach(item => {
            const word = item.expected;
            let style = 'color: #28a745;'; // correct - green
            if (item.status === 'skipped') style = 'color: #6c757d; text-decoration: line-through;';
            else if (item.status === 'misread') style = 'color: #fd7e14;';
            else if (item.status === 'substituted') style = 'color: #dc3545;';
            wordsContent += `<span style="${style}">${word}</span> `;
        });
    }

    // Build error sections
    let errorsContent = '';
    if (analysis.errors?.skippedWords?.length > 0) {
        errorsContent += `<div style="background: #fff3cd; padding: 8px; border-radius: 4px; margin-bottom: 6px;"><strong>Skipped Words (${analysis.errors.skippedWords.length}):</strong> Words were not read</div>`;
    }
    if (analysis.errors?.misreadWords?.length > 0) {
        const list = analysis.errors.misreadWords.map(e => `"${e.expected}"`).join(', ');
        errorsContent += `<div style="background: #fff3cd; padding: 8px; border-radius: 4px; margin-bottom: 6px;"><strong>Misread Words (${analysis.errors.misreadWords.length}):</strong> ${list}</div>`;
    }
    if (analysis.errors?.substitutedWords?.length > 0) {
        const list = analysis.errors.substitutedWords.map(e => `"${e.expected}" → "${e.spoken}"`).join(', ');
        errorsContent += `<div style="background: #fff3cd; padding: 8px; border-radius: 4px; margin-bottom: 6px;"><strong>Substituted Words (${analysis.errors.substitutedWords.length}):</strong> ${list}</div>`;
    }

    // Build summary sections
    let summaryContent = '';
    if (patterns?.summary?.primaryIssues?.length > 0) {
        summaryContent += `<div style="margin-bottom: 8px;"><strong>Primary Issues:</strong><ul style="margin: 4px 0; padding-left: 20px;">${patterns.summary.primaryIssues.slice(0, 3).map(i => `<li>${i}</li>`).join('')}</ul></div>`;
    }
    if (patterns?.summary?.recommendations?.length > 0) {
        summaryContent += `<div><strong>Recommendations:</strong><ul style="margin: 4px 0; padding-left: 20px;">${patterns.summary.recommendations.slice(0, 3).map(r => `<li>${r}</li>`).join('')}</ul></div>`;
    }

    // Build stats using TABLE layout (not flexbox - flexbox fails on mobile html2canvas)
    // Count how many stat cells we'll have
    let statCount = 3; // Correct, Errors, Accuracy are always shown
    if (prosodyMetrics.wpm) statCount++;
    if (prosodyMetrics.prosodyScore) statCount++;

    let statsHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <tr>
                <td style="text-align: center; padding: 10px; background: #f5f5f5; border-radius: 6px; width: ${100/statCount}%;">
                    <div style="font-size: 20px; font-weight: bold; color: #333;">${analysis.correctCount || 0}</div>
                    <div style="font-size: 9px; color: #666;">Correct</div>
                </td>
                <td style="width: 8px;"></td>
                <td style="text-align: center; padding: 10px; background: #f5f5f5; border-radius: 6px; width: ${100/statCount}%;">
                    <div style="font-size: 20px; font-weight: bold; color: #333;">${totalErrors}</div>
                    <div style="font-size: 9px; color: #666;">Errors</div>
                </td>
                <td style="width: 8px;"></td>
                <td style="text-align: center; padding: 10px; background: #f5f5f5; border-radius: 6px; width: ${100/statCount}%;">
                    <div style="font-size: 20px; font-weight: bold; color: #333;">${accuracy}%</div>
                    <div style="font-size: 9px; color: #666;">Accuracy</div>
                </td>
                ${prosodyMetrics.wpm ? `
                <td style="width: 8px;"></td>
                <td style="text-align: center; padding: 10px; background: #f5f5f5; border-radius: 6px; width: ${100/statCount}%;">
                    <div style="font-size: 20px; font-weight: bold; color: #333;">${prosodyMetrics.wpm}</div>
                    <div style="font-size: 9px; color: #666;">WPM</div>
                </td>` : ''}
                ${prosodyMetrics.prosodyScore ? `
                <td style="width: 8px;"></td>
                <td style="text-align: center; padding: 10px; background: #f5f5f5; border-radius: 6px; width: ${100/statCount}%;">
                    <div style="font-size: 20px; font-weight: bold; color: #333;">${prosodyMetrics.prosodyScore}</div>
                    <div style="font-size: 9px; color: #666;">Prosody</div>
                </td>` : ''}
            </tr>
        </table>
    `;

    // Detect if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (window.innerWidth <= 768);

    // Create a full-screen overlay to hide the rendering process
    const overlay = document.createElement('div');
    overlay.id = 'pdf-generation-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.98); z-index: 10000; display: flex; align-items: center; justify-content: center; flex-direction: column;';
    overlay.innerHTML = `
        <div style="text-align: center;">
            <div style="width: 50px; height: 50px; border: 4px solid #e9ecef; border-top-color: #667eea; border-radius: 50%; animation: pdfspin 1s linear infinite; margin: 0 auto 15px;"></div>
            <p style="color: #667eea; font-size: 16px; font-weight: 600; margin: 0;">Generating PDF...</p>
        </div>
        <style>@keyframes pdfspin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(overlay);

    // Scroll to top before capture
    window.scrollTo(0, 0);

    // Create the content element - positioned at origin, hidden behind the overlay
    // Using position: absolute works for both mobile and desktop
    // The overlay (z-index: 10000) hides the content (z-index: 9999) from the user
    // Note: No min-height - let content determine height to avoid blank second page
    const printContainer = document.createElement('div');
    printContainer.id = 'pdf-content-container';
    printContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 794px; background: #ffffff; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #333; padding: 57px; box-sizing: border-box; z-index: 9999;';

    printContainer.innerHTML = `
        <h1 style="text-align: center; color: #667eea; font-size: 18px; margin: 0 0 5px 0;">Oral Fluency Analysis Report</h1>
        <div style="text-align: center; color: #666; font-size: 10px; margin-bottom: 15px;">Generated on ${new Date().toLocaleDateString()}</div>

        ${statsHtml}

        <div style="font-size: 13px; font-weight: bold; color: #667eea; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin: 12px 0 8px 0;">Text with Error Highlighting</div>
        <div style="line-height: 1.8; margin-bottom: 8px;">${wordsContent}</div>
        <div style="font-size: 9px; color: #666; margin-bottom: 15px;">
            <span style="color:#28a745; margin-right: 10px;">■ Correct</span>
            <span style="color:#6c757d; margin-right: 10px;">■ Skipped</span>
            <span style="color:#fd7e14; margin-right: 10px;">■ Misread</span>
            <span style="color:#dc3545;">■ Substituted</span>
        </div>

        ${errorsContent ? `
        <div style="font-size: 13px; font-weight: bold; color: #667eea; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin: 12px 0 8px 0;">Error Breakdown</div>
        ${errorsContent}
        ` : ''}

        ${summaryContent ? `
        <div style="font-size: 13px; font-weight: bold; color: #667eea; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin: 12px 0 8px 0;">Summary & Recommendations</div>
        <div style="background: #e8f4fd; padding: 10px; border-radius: 4px; font-size: 10px;">${summaryContent}</div>
        ` : ''}

        <div style="text-align: center; color: #999; font-size: 8px; margin-top: 20px; font-style: italic;">
            Generated by Word Analyzer - Oral Fluency Assessment Tool
        </div>
    `;

    document.body.appendChild(printContainer);

    // Delay to ensure DOM is fully rendered
    setTimeout(() => {
        // Configure html2pdf options
        // Use lower scale on mobile to avoid iOS canvas size limits (4096x4096)
        const scale = isMobile ? 1.5 : 2;

        const html2canvasOptions = {
            scale: scale,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
            width: 794,
            height: printContainer.scrollHeight,
            windowWidth: 794,
            windowHeight: printContainer.scrollHeight,
            backgroundColor: '#ffffff'
        };

        const options = {
            margin: 0,
            filename: `oral-fluency-analysis-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: html2canvasOptions,
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'avoid-all' } // Prevent automatic page breaks
        };

        // Generate PDF with proper cleanup
        html2pdf().set(options).from(printContainer).save()
            .then(() => {
                // Clean up
                if (printContainer.parentNode) document.body.removeChild(printContainer);
                if (overlay.parentNode) document.body.removeChild(overlay);
            })
            .catch(err => {
                debugError('PDF generation error:', err);
                // Clean up on error
                if (printContainer.parentNode) document.body.removeChild(printContainer);
                if (overlay.parentNode) document.body.removeChild(overlay);
                alert('Failed to generate PDF: ' + err.message);
            });
    }, 200);
}

// View detailed error patterns in a new window
function viewDetailedPatterns() {
    if (!state.latestErrorPatterns) {
        alert('No error pattern data available. Please run an analysis first.');
        return;
    }

    const patterns = state.latestErrorPatterns;
    const analysis = state.latestAnalysis;
    const prosody = state.latestProsodyMetrics;

    // Build the HTML report
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Detailed Error Patterns Report</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .report-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .report-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px;
            text-align: center;
        }
        .report-header h1 { font-size: 1.8rem; margin-bottom: 8px; }
        .report-header p { opacity: 0.9; }
        .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
        }
        .print-btn:hover { background: #5a6fd6; }
        @media print {
            .print-btn { display: none; }
            body { background: white; padding: 0; }
            .report-container { box-shadow: none; }
        }
        .section {
            padding: 20px 24px;
            border-bottom: 1px solid #eee;
        }
        .section:last-child { border-bottom: none; }
        .section-title {
            font-size: 1.2rem;
            color: #667eea;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }
        .summary-box {
            background: #f8f9ff;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-box .label { font-size: 0.85rem; color: #666; }
        .summary-box .value { font-size: 1.4rem; font-weight: bold; color: #333; }
        .pattern-category {
            background: #fafafa;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .pattern-category h4 {
            color: #444;
            margin-bottom: 10px;
            font-size: 1rem;
        }
        .pattern-list { list-style: none; }
        .pattern-list li {
            padding: 8px 12px;
            background: white;
            border-radius: 6px;
            margin-bottom: 6px;
            border-left: 3px solid #667eea;
        }
        .pattern-word { font-weight: bold; color: #333; }
        .pattern-desc { color: #666; font-size: 0.9rem; }
        .no-data {
            color: #999;
            font-style: italic;
            padding: 12px;
        }
        .issue-list {
            background: #fff3cd;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .issue-list h4 { color: #856404; margin-bottom: 10px; }
        .issue-list ul { margin-left: 20px; }
        .issue-list li { margin-bottom: 6px; }
        .rec-list {
            background: #d4edda;
            border-radius: 8px;
            padding: 16px;
        }
        .rec-list h4 { color: #155724; margin-bottom: 10px; }
        .rec-list ul { margin-left: 20px; }
        .rec-list li { margin-bottom: 6px; }
        .empty-section { color: #999; font-style: italic; }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">Print Report</button>
    <div class="report-container">
        <div class="report-header">
            <h1>Detailed Error Patterns Report</h1>
            <p>Comprehensive Analysis of Reading Errors</p>
        </div>

        <!-- Overview Section -->
        <div class="section">
            <h3 class="section-title">Overview</h3>
            <div class="summary-grid">
                <div class="summary-box">
                    <div class="label">Accuracy</div>
                    <div class="value">${prosody?.accuracy || analysis?.correctCount ? Math.round((analysis.correctCount / (analysis.correctCount + (analysis.errors?.skippedWords?.length || 0) + (analysis.errors?.misreadWords?.length || 0) + (analysis.errors?.substitutedWords?.length || 0))) * 100) : 0}%</div>
                </div>
                <div class="summary-box">
                    <div class="label">WPM</div>
                    <div class="value">${prosody?.wpm || '-'}</div>
                </div>
                <div class="summary-box">
                    <div class="label">Prosody Score</div>
                    <div class="value">${prosody?.prosodyScore || '-'}</div>
                </div>
                <div class="summary-box">
                    <div class="label">Total Errors</div>
                    <div class="value">${(analysis?.errors?.skippedWords?.length || 0) + (analysis?.errors?.misreadWords?.length || 0) + (analysis?.errors?.substitutedWords?.length || 0) + (analysis?.errors?.hesitations?.length || 0) + (analysis?.errors?.repeatedWords?.length || 0)}</div>
                </div>
            </div>
        </div>

        <!-- Primary Issues & Recommendations -->
        <div class="section">
            <h3 class="section-title">Summary</h3>
            ${patterns.summary?.primaryIssues?.length > 0 ? `
            <div class="issue-list">
                <h4>Primary Issues Identified</h4>
                <ul>
                    ${patterns.summary.primaryIssues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
            </div>
            ` : '<p class="no-data">No primary issues identified</p>'}

            ${patterns.summary?.recommendations?.length > 0 ? `
            <div class="rec-list">
                <h4>Teaching Recommendations</h4>
                <ul>
                    ${patterns.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>

        <!-- Phonics Patterns -->
        <div class="section">
            <h3 class="section-title">Phonics Patterns</h3>
            ${buildPatternCategory('Initial Sound Errors', patterns.phonicsPatterns?.initialSoundErrors)}
            ${buildPatternCategory('Final Sound Errors', patterns.phonicsPatterns?.finalSoundErrors)}
            ${buildPatternCategory('Vowel Patterns', patterns.phonicsPatterns?.vowelPatterns)}
            ${buildPatternCategory('Consonant Blends', patterns.phonicsPatterns?.consonantBlends)}
            ${buildPatternCategory('Silent Letters', patterns.phonicsPatterns?.silentLetters)}
            ${buildPatternCategory('R-Controlled Vowels', patterns.phonicsPatterns?.rControlledVowels)}
            ${buildPatternCategory('Digraphs', patterns.phonicsPatterns?.digraphs)}
            ${!hasAnyPhonicsPatterns(patterns) ? '<p class="empty-section">No phonics pattern errors detected</p>' : ''}
        </div>

        <!-- Reading Strategies -->
        <div class="section">
            <h3 class="section-title">Reading Strategy Issues</h3>
            ${buildPatternCategory('First Letter Guessing', patterns.readingStrategies?.firstLetterGuessing)}
            ${buildPatternCategory('Context Guessing', patterns.readingStrategies?.contextGuessing)}
            ${buildPatternCategory('Partial Decoding', patterns.readingStrategies?.partialDecoding)}
            ${!hasAnyReadingStrategies(patterns) ? '<p class="empty-section">No problematic reading strategies detected</p>' : ''}
        </div>

        <!-- Speech Patterns -->
        <div class="section">
            <h3 class="section-title">Speech Sound Patterns</h3>
            ${buildPatternCategory('R Sound Issues', patterns.speechPatterns?.rSoundIssues)}
            ${buildPatternCategory('S Sound Issues', patterns.speechPatterns?.sSoundIssues)}
            ${buildPatternCategory('L Sound Issues', patterns.speechPatterns?.lSoundIssues)}
            ${buildPatternCategory('TH Sound Issues', patterns.speechPatterns?.thSoundIssues)}
            ${!hasAnySpeechPatterns(patterns) ? '<p class="empty-section">No speech sound issues detected</p>' : ''}
        </div>

        <!-- Visual Similarity -->
        ${patterns.visualSimilarityErrors?.length > 0 ? `
        <div class="section">
            <h3 class="section-title">Visual Similarity Errors</h3>
            ${buildPatternCategory('Similar Looking Words', patterns.visualSimilarityErrors)}
        </div>
        ` : ''}

        <!-- Morphological Errors -->
        ${patterns.morphologicalErrors?.length > 0 ? `
        <div class="section">
            <h3 class="section-title">Morphological Errors</h3>
            ${buildPatternCategory('Word Structure Errors', patterns.morphologicalErrors)}
        </div>
        ` : ''}

        <div class="section" style="text-align: center; color: #999; font-size: 0.85rem;">
            Generated by Word Analyzer on ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>
    `;

    // Helper functions embedded in the HTML
    function buildPatternCategory(title, items) {
        if (!items || items.length === 0) return '';
        return `
            <div class="pattern-category">
                <h4>${title} (${items.length})</h4>
                <ul class="pattern-list">
                    ${items.map(item => `
                        <li>
                            <span class="pattern-word">"${item.expected || item.word || ''}" → "${item.actual || item.spoken || ''}"</span>
                            ${item.pattern ? `<br><span class="pattern-desc">${item.pattern}</span>` : ''}
                            ${item.description ? `<br><span class="pattern-desc">${item.description}</span>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    function hasAnyPhonicsPatterns(p) {
        const pp = p.phonicsPatterns;
        return pp && (
            (pp.initialSoundErrors?.length > 0) ||
            (pp.finalSoundErrors?.length > 0) ||
            (pp.vowelPatterns?.length > 0) ||
            (pp.consonantBlends?.length > 0) ||
            (pp.silentLetters?.length > 0) ||
            (pp.rControlledVowels?.length > 0) ||
            (pp.digraphs?.length > 0)
        );
    }

    function hasAnyReadingStrategies(p) {
        const rs = p.readingStrategies;
        return rs && (
            (rs.firstLetterGuessing?.length > 0) ||
            (rs.contextGuessing?.length > 0) ||
            (rs.partialDecoding?.length > 0)
        );
    }

    function hasAnySpeechPatterns(p) {
        const sp = p.speechPatterns;
        return sp && (
            (sp.rSoundIssues?.length > 0) ||
            (sp.sSoundIssues?.length > 0) ||
            (sp.lSoundIssues?.length > 0) ||
            (sp.thSoundIssues?.length > 0)
        );
    }

    // Open in new window
    const newWindow = window.open('', '_blank', 'width=950,height=700');
    if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
    } else {
        alert('Pop-up blocked. Please allow pop-ups for this site to view the detailed patterns report.');
    }
}

// Generate transcript video with synchronized word highlighting
// Generate transcript video (with optional container for scoped element lookup)
async function generateTranscriptVideoInContainer(container) {
    if (!state.latestAnalysis || !state.latestSpokenWords) {
        alert('No analysis data available');
        return;
    }

    if (!state.recordedAudioBlob) {
        if (state.viewingHistoricalAssessment) {
            alert('No audio recording available for this historical assessment. This assessment was saved before audio storage was enabled. New assessments will include audio for video generation.');
        } else {
            alert('No audio recording available');
        }
        return;
    }

    // Use container scope if provided, otherwise use document
    const scope = container || document;
    const statusDiv = scope.querySelector('#video-generation-status');
    const generateBtn = scope.querySelector('#generate-video-btn');

    if (!statusDiv || !generateBtn) {
        debugError('Video generation elements not found');
        return;
    }

    return await generateTranscriptVideoCore(statusDiv, generateBtn);
}

// Legacy wrapper for backward compatibility
async function generateTranscriptVideo() {
    return await generateTranscriptVideoInContainer(document);
}

// Core video generation logic - Uses lazy-loaded module for better performance
async function generateTranscriptVideoCore(statusDiv, generateBtn) {
    try {
        // Show loading state while module loads
        generateBtn.disabled = true;
        statusDiv.innerHTML = '<div class="video-progress">🎬 Loading video generator...</div>';
        statusDiv.style.display = 'block';

        // Lazy load the video generator module
        const { generateVideo } = await import('./modules/video-generator.js');

        // Call the module's video generation function
        await generateVideo(state, statusDiv, generateBtn);
    } catch (error) {
        debugError('Error loading video generator:', error);
        statusDiv.innerHTML = `<div class="error">❌ Error: ${error.message}</div>`;
        generateBtn.disabled = false;
    }
}

// ============ DATABASE / STUDENT MANAGEMENT ============

// Database structure:
// students = {
//   studentId: {
//     id: string,
//     name: string,
//     grade: string,
//     dateAdded: timestamp,
//     assessments: [
//       {
//         id: string,
//         date: timestamp,
//         correctCount: number,
//         totalWords: number,
//         accuracy: number,
//         wpm: number,
//         prosodyScore: number,
//         errors: {...},
//         duration: number
//       }
//     ]
//   }
// }

// Database functions are now imported from firebase-db.js (see top of file)

// ============ UI FUNCTIONS ============

// Get DOM elements for database features
const classOverviewSection = document.getElementById('class-overview-section');
const studentProfileSection = document.getElementById('student-profile-section');
const classOverviewBtn = document.getElementById('class-overview-btn');
const headerLogoLink = document.getElementById('header-logo-link');
const backFromClassBtn = document.getElementById('back-from-class-btn');
const addStudentBtn = document.getElementById('add-student-btn');
const studentsGrid = document.getElementById('students-grid');
const studentSelect = document.getElementById('student-select');
const saveAssessmentBtn = document.getElementById('save-assessment-btn');
const saveStatus = document.getElementById('save-status');
const backToClassBtn = document.getElementById('back-to-class-btn');
const deleteStudentBtn = document.getElementById('delete-student-btn');
const studentProfileName = document.getElementById('student-profile-name');
const studentProfileSubtitle = document.getElementById('student-profile-subtitle');
const studentStatsSummary = document.getElementById('student-stats-summary');
const assessmentHistory = document.getElementById('assessment-history');
const addStudentModal = document.getElementById('add-student-modal');
const studentNameInput = document.getElementById('student-name-input');
const studentGradeInput = document.getElementById('student-grade-input');
const confirmAddStudentBtn = document.getElementById('confirm-add-student-btn');
const cancelAddStudentBtn = document.getElementById('cancel-add-student-btn');

// Assessment student selection elements
const assessmentStudentSelect = document.getElementById('assessment-student-select');
const selectedStudentDisplay = document.getElementById('selected-student-display');
const changeStudentBtn = document.getElementById('change-student-btn');
const quickAddStudentBtn = document.getElementById('quick-add-student-btn');
const currentStudentIndicator = document.getElementById('current-student-indicator');

// Current student being viewed
let currentViewingStudentId = null;

// ============ HTML COMPONENT HELPERS (reduces inline HTML bloat) ============

// Create a stat box component
function createStatBox(label, value, className = '') {
    return `<div class="stat-item ${className}">
        <div class="stat-item-label">${label}</div>
        <div class="stat-item-value">${value}</div>
    </div>`;
}

// Create a summary stat box
function createSummaryStatBox(label, value) {
    return `<div class="summary-stat-box">
        <div class="summary-stat-label">${label}</div>
        <div class="summary-stat-value">${value}</div>
    </div>`;
}

// Create a pattern item (for phonics/reading patterns)
function createPatternItem(label, value) {
    if (!value || value <= 0) return '';
    return `<div class="pattern-item">
        <span class="pattern-label">${label}:</span>
        <span class="pattern-value">${value}</span>
    </div>`;
}

// Create assessment detail item
function createAssessmentDetail(label, value) {
    return `<div class="assessment-detail">
        <div class="assessment-detail-label">${label}</div>
        <div class="assessment-detail-value">${value}</div>
    </div>`;
}

// Get accuracy class based on score
function getAccuracyClass(accuracy) {
    if (accuracy >= 95) return 'excellent';
    if (accuracy >= 85) return 'good';
    if (accuracy >= 75) return 'fair';
    return 'poor';
}

// Get accuracy class for student cards
function getCardAccuracyClass(accuracy) {
    if (accuracy >= 95) return 'good';
    if (accuracy >= 85) return 'warning';
    return 'poor';
}

// ============ END HTML COMPONENT HELPERS ============

// Show Class Overview
async function showClassOverview() {
    // Hide all other sections
    setupSection.classList.remove('active');
    audioSection.classList.remove('active');
    cameraSection.classList.remove('active');
    imageSection.classList.remove('active');
    resultsSection.classList.remove('active');
    studentProfileSection.classList.remove('active');

    // Show class overview
    classOverviewSection.classList.add('active');

    // Hide breadcrumb
    if (breadcrumbNav) {
        breadcrumbNav.classList.remove('visible');
    }

    // Render students
    await renderStudentsGrid();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render students grid
async function renderStudentsGrid() {
    const students = await getAllStudents();
    const studentArray = Object.values(students);

    if (studentArray.length === 0) {
        studentsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👨‍🎓</div>
                <h3>No Students Yet</h3>
                <p>Click "Add Student" to create your first student profile.</p>
            </div>
        `;
        return;
    }

    studentsGrid.innerHTML = studentArray.map(student => {
        const stats = getStudentStats(student);
        // Sanitize user-provided data to prevent XSS
        const safeName = escapeHtml(student.name);
        const safeGrade = escapeHtml(student.grade || 'No grade set');
        const safeId = escapeHtml(student.id);
        const initial = safeName.charAt(0).toUpperCase();
        const accuracyClass = getCardAccuracyClass(stats.latestAccuracy);

        return `
            <div class="student-card" data-student-id="${safeId}">
                <div class="student-card-header">
                    <div class="student-avatar">${initial}</div>
                    <div class="student-info">
                        <h3>${safeName}</h3>
                        <p class="student-grade">${safeGrade}</p>
                    </div>
                </div>
                <div class="student-stats">
                    ${createStatBox('Assessments', stats.totalAssessments)}
                    ${createStatBox('Avg Accuracy', stats.avgAccuracy + '%', accuracyClass)}
                    ${createStatBox('Avg WPM', stats.avgWpm)}
                    ${createStatBox('Prosody', stats.avgProsody)}
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers to student cards
    document.querySelectorAll('.student-card').forEach(card => {
        card.addEventListener('click', () => {
            const studentId = card.getAttribute('data-student-id');
            showStudentProfile(studentId);
        });
    });
}

// Show student profile
async function showStudentProfile(studentId) {
    const student = await getStudent(studentId);
    if (!student) {
        alert('Student not found');
        return;
    }

    currentViewingStudentId = studentId;

    // Hide all sections
    setupSection.classList.remove('active');
    audioSection.classList.remove('active');
    cameraSection.classList.remove('active');
    imageSection.classList.remove('active');
    resultsSection.classList.remove('active');
    classOverviewSection.classList.remove('active');

    // Show student profile
    studentProfileSection.classList.add('active');

    // Update header
    studentProfileName.textContent = student.name;
    studentProfileSubtitle.textContent = `${student.grade || 'Grade not set'} • ${student.assessments.length} assessment${student.assessments.length !== 1 ? 's' : ''}`;

    // Render summary stats
    renderStudentSummary(student);

    // Render assessment history
    renderAssessmentHistory(student);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Aggregate error patterns across all student assessments
function aggregateErrorPatterns(student) {
    const aggregated = {
        totalAssessments: student.assessments.length,
        assessmentsWithPatterns: 0,
        phonicsPatterns: {
            initialSoundErrors: 0,
            finalSoundErrors: 0,
            vowelPatterns: 0,
            consonantBlends: 0,
            rControlledVowels: 0,
            silentLetters: 0,
            digraphs: 0
        },
        readingStrategies: {
            firstLetterGuessing: 0,
            partialDecoding: 0,
            contextGuessing: 0
        },
        speechPatterns: {
            rSoundIssues: 0,
            sSoundIssues: 0,
            lSoundIssues: 0,
            thSoundIssues: 0
        },
        primaryIssues: {},
        recommendations: {},
        severityCounts: {
            excellent: 0,
            mild: 0,
            moderate: 0,
            significant: 0
        }
    };

    student.assessments.forEach(assessment => {
        if (assessment.errorPatterns) {
            aggregated.assessmentsWithPatterns++;
            const patterns = assessment.errorPatterns;

            // Aggregate phonics patterns
            aggregated.phonicsPatterns.initialSoundErrors += patterns.phonicsPatterns.initialSoundErrors.length;
            aggregated.phonicsPatterns.finalSoundErrors += patterns.phonicsPatterns.finalSoundErrors.length;
            aggregated.phonicsPatterns.vowelPatterns += patterns.phonicsPatterns.vowelPatterns.length;
            aggregated.phonicsPatterns.consonantBlends += patterns.phonicsPatterns.consonantBlends.length;
            aggregated.phonicsPatterns.rControlledVowels += patterns.phonicsPatterns.rControlledVowels.length;
            aggregated.phonicsPatterns.silentLetters += patterns.phonicsPatterns.silentLetters.length;
            aggregated.phonicsPatterns.digraphs += patterns.phonicsPatterns.digraphs.length;

            // Aggregate reading strategies
            aggregated.readingStrategies.firstLetterGuessing += patterns.readingStrategies.firstLetterGuessing.length;
            aggregated.readingStrategies.partialDecoding += patterns.readingStrategies.partialDecoding.length;
            aggregated.readingStrategies.contextGuessing += patterns.readingStrategies.contextGuessing.length;

            // Aggregate speech patterns
            aggregated.speechPatterns.rSoundIssues += patterns.speechPatterns.rSoundIssues.length;
            aggregated.speechPatterns.sSoundIssues += patterns.speechPatterns.sSoundIssues.length;
            aggregated.speechPatterns.lSoundIssues += patterns.speechPatterns.lSoundIssues.length;
            aggregated.speechPatterns.thSoundIssues += patterns.speechPatterns.thSoundIssues.length;

            // Track primary issues
            if (patterns.summary.primaryIssues) {
                patterns.summary.primaryIssues.forEach(issue => {
                    aggregated.primaryIssues[issue] = (aggregated.primaryIssues[issue] || 0) + 1;
                });
            }

            // Track recommendations
            if (patterns.summary.recommendations) {
                patterns.summary.recommendations.forEach(rec => {
                    aggregated.recommendations[rec] = (aggregated.recommendations[rec] || 0) + 1;
                });
            }

            // Track severity
            if (patterns.summary.severity) {
                aggregated.severityCounts[patterns.summary.severity]++;
            }
        }
    });

    return aggregated;
}

// Generate macro insights from aggregated patterns
function generateMacroInsights(aggregated) {
    const insights = [];

    if (aggregated.assessmentsWithPatterns === 0) {
        return ['No detailed pattern data available yet. Complete new assessments to see insights.'];
    }

    // Phonics insights
    const totalPhonicsErrors = aggregated.phonicsPatterns.initialSoundErrors +
                               aggregated.phonicsPatterns.finalSoundErrors +
                               aggregated.phonicsPatterns.vowelPatterns +
                               aggregated.phonicsPatterns.consonantBlends +
                               aggregated.phonicsPatterns.rControlledVowels +
                               aggregated.phonicsPatterns.silentLetters +
                               aggregated.phonicsPatterns.digraphs;

    if (totalPhonicsErrors > 0) {
        const avgPerAssessment = (totalPhonicsErrors / aggregated.assessmentsWithPatterns).toFixed(1);

        // Find most common phonics issue
        const phonicsIssues = [
            { name: 'Final sound errors', count: aggregated.phonicsPatterns.finalSoundErrors },
            { name: 'Initial sound errors', count: aggregated.phonicsPatterns.initialSoundErrors },
            { name: 'Vowel pattern confusion', count: aggregated.phonicsPatterns.vowelPatterns },
            { name: 'Consonant blend difficulties', count: aggregated.phonicsPatterns.consonantBlends },
            { name: 'R-controlled vowel errors', count: aggregated.phonicsPatterns.rControlledVowels },
            { name: 'Silent letter confusion', count: aggregated.phonicsPatterns.silentLetters },
            { name: 'Digraph errors', count: aggregated.phonicsPatterns.digraphs }
        ].sort((a, b) => b.count - a.count);

        const topPhonics = phonicsIssues.filter(i => i.count > 0).slice(0, 2);
        if (topPhonics.length > 0) {
            insights.push(`📚 Most common phonics challenges: ${topPhonics.map(i => i.name).join(' and ')} (average ${avgPerAssessment} phonics errors per assessment)`);
        }
    }

    // Reading strategy insights
    const totalStrategyIssues = aggregated.readingStrategies.firstLetterGuessing +
                                aggregated.readingStrategies.partialDecoding +
                                aggregated.readingStrategies.contextGuessing;

    if (totalStrategyIssues >= aggregated.assessmentsWithPatterns * 2) {
        insights.push(`🎯 Student shows reliance on guessing strategies rather than full decoding - focus on systematic phonics instruction`);
    }

    // Speech pattern insights
    const totalSpeechIssues = aggregated.speechPatterns.rSoundIssues +
                              aggregated.speechPatterns.sSoundIssues +
                              aggregated.speechPatterns.lSoundIssues +
                              aggregated.speechPatterns.thSoundIssues;

    if (totalSpeechIssues >= aggregated.assessmentsWithPatterns * 3) {
        const speechIssues = [];
        if (aggregated.speechPatterns.rSoundIssues > aggregated.assessmentsWithPatterns * 2) speechIssues.push('R sounds');
        if (aggregated.speechPatterns.sSoundIssues > aggregated.assessmentsWithPatterns * 2) speechIssues.push('S sounds');
        if (aggregated.speechPatterns.lSoundIssues > aggregated.assessmentsWithPatterns * 2) speechIssues.push('L sounds');
        if (aggregated.speechPatterns.thSoundIssues > aggregated.assessmentsWithPatterns) speechIssues.push('TH sounds');

        if (speechIssues.length > 0) {
            insights.push(`🗣️ Consistent articulation patterns detected (${speechIssues.join(', ')}) - recommend speech-language evaluation`);
        }
    }

    // Progress insights
    if (aggregated.severityCounts.excellent > aggregated.totalAssessments * 0.3) {
        insights.push(`✨ Strong overall performance - ${Math.round((aggregated.severityCounts.excellent / aggregated.totalAssessments) * 100)}% of assessments show excellent accuracy`);
    }

    if (aggregated.severityCounts.significant > aggregated.totalAssessments * 0.3) {
        insights.push(`⚠️ ${Math.round((aggregated.severityCounts.significant / aggregated.totalAssessments) * 100)}% of assessments show significant challenges - intensive intervention recommended`);
    }

    // Most persistent issues
    const issueEntries = Object.entries(aggregated.primaryIssues).sort((a, b) => b[1] - a[1]);
    if (issueEntries.length > 0 && issueEntries[0][1] >= aggregated.assessmentsWithPatterns * 0.5) {
        insights.push(`🔍 Persistent challenge: "${issueEntries[0][0]}" appears in ${issueEntries[0][1]} of ${aggregated.assessmentsWithPatterns} assessments`);
    }

    if (insights.length === 0) {
        insights.push('Continue regular assessments to identify patterns and track progress.');
    }

    return insights;
}

// Render progress chart
function renderProgressChart(student) {
    const canvas = document.getElementById('progress-chart');
    if (!canvas || student.assessments.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth * 2; // High DPI

    // Calculate legend layout early to determine canvas height
    const legendItemWidth = 120;
    const totalLegendWidth = 3 * legendItemWidth; // 3 legend items
    const titleWidth = 280;
    const padding = 60;
    const availableWidth = width - padding - titleWidth - 20;
    const useHorizontalLegend = availableWidth >= totalLegendWidth;

    // Increase height if we need vertical legend layout
    const height = canvas.height = useHorizontalLegend ? 400 : 440;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Sort assessments by date
    const sortedAssessments = [...student.assessments].sort((a, b) => a.date - b.date);
    const assessmentCount = sortedAssessments.length;

    if (assessmentCount === 0) return;

    // Chart dimensions
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2 - (useHorizontalLegend ? 0 : 40);

    // Draw background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(padding, padding, chartWidth, chartHeight);

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
        const y = padding + (chartHeight / 10) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartWidth, y);
        ctx.stroke();
    }

    // Extract data
    const accuracyData = sortedAssessments.map(a => a.accuracy || 0);
    // Cap WPM at 200 for visualization purposes (scale to 0-100 range)
    const wpmData = sortedAssessments.map(a => Math.min((a.wpm || 0) / 2, 100));
    const prosodyData = sortedAssessments.map(a => (a.prosodyScore || 0) * 25); // Scale to 0-100

    // Draw axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + chartHeight);
    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = '#374151';
    ctx.font = '24px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 10; i++) {
        const value = 100 - i * 10;
        const y = padding + (chartHeight / 10) * i;
        ctx.fillText(value, padding - 10, y);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '20px Arial';
    for (let i = 0; i < assessmentCount; i++) {
        const x = padding + (chartWidth / (assessmentCount - 1 || 1)) * i;
        const date = new Date(sortedAssessments[i].date);
        ctx.fillText(`${date.getMonth() + 1}/${date.getDate()}`, x, padding + chartHeight + 15);
    }

    // Helper function to draw line
    function drawLine(data, color, lineWidth = 3) {
        if (data.length === 0) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        data.forEach((value, index) => {
            const x = padding + (chartWidth / (assessmentCount - 1 || 1)) * index;
            const y = padding + chartHeight - (value / 100) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Draw points
        ctx.fillStyle = color;
        data.forEach((value, index) => {
            const x = padding + (chartWidth / (assessmentCount - 1 || 1)) * index;
            const y = padding + chartHeight - (value / 100) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Draw lines for each metric
    drawLine(accuracyData, '#10b981'); // Green - Accuracy
    drawLine(wpmData, '#3b82f6'); // Blue - WPM
    drawLine(prosodyData, '#8b5cf6'); // Purple - Prosody

    // Chart title - on the left
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111827';
    ctx.fillText('Progress Over Time', padding, 35);

    // Draw legend
    const legendItems = [
        { label: 'Accuracy', color: '#10b981' },
        { label: 'WPM', color: '#3b82f6' },
        { label: 'Prosody (×2)', color: '#8b5cf6' }
    ];

    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px Arial';

    if (useHorizontalLegend) {
        // Horizontal layout - right side with equal spacing
        const boxSize = 14;
        const boxToTextGap = 6;
        const itemGap = 24; // Equal gap between items

        // Measure each label width
        const itemWidths = legendItems.map(item => {
            return boxSize + boxToTextGap + ctx.measureText(item.label).width;
        });
        const totalWidth = itemWidths.reduce((a, b) => a + b, 0) + (itemGap * (legendItems.length - 1));

        // Position at right edge
        let x = width - padding - totalWidth;
        const y = 35;

        legendItems.forEach((item, index) => {
            // Draw color box
            ctx.fillStyle = item.color;
            ctx.fillRect(x, y - boxSize/2, boxSize, boxSize);

            // Draw label
            ctx.textAlign = 'left';
            ctx.fillStyle = '#374151';
            ctx.fillText(item.label, x + boxSize + boxToTextGap, y);

            // Move x for next item
            x += itemWidths[index] + itemGap;
        });
    } else {
        // Horizontal layout below chart for mobile - centered
        const legendY = padding + chartHeight + 50;
        const boxSize = 14;
        const boxToTextGap = 6;
        const itemGap = 20;

        // Measure total width
        const itemWidths = legendItems.map(item => {
            return boxSize + boxToTextGap + ctx.measureText(item.label).width;
        });
        const totalWidth = itemWidths.reduce((a, b) => a + b, 0) + (itemGap * (legendItems.length - 1));

        // Center the legend
        let x = (width - totalWidth) / 2;

        legendItems.forEach((item, index) => {
            // Draw color box
            ctx.fillStyle = item.color;
            ctx.fillRect(x, legendY - boxSize/2, boxSize, boxSize);

            // Draw label
            ctx.textAlign = 'left';
            ctx.fillStyle = '#374151';
            ctx.fillText(item.label, x + boxSize + boxToTextGap, legendY);

            // Move x for next item
            x += itemWidths[index] + itemGap;
        });
    }
}

// Render student summary
function renderStudentSummary(student) {
    const stats = getStudentStats(student);
    // Sanitize user-provided data
    const safeName = escapeHtml(student.name);
    const safeGrade = escapeHtml(student.grade || 'Grade not set');
    const initial = safeName.charAt(0).toUpperCase();

    studentStatsSummary.innerHTML = `
        <div class="summary-header">
            <div class="summary-avatar">${initial}</div>
            <div class="summary-info">
                <h3>${safeName}</h3>
                <div class="summary-meta">
                    ${safeGrade} •
                    Added ${new Date(student.dateAdded).toLocaleDateString()}
                </div>
            </div>
        </div>
        <div class="summary-stats-grid">
            ${createSummaryStatBox('Total Assessments', stats.totalAssessments)}
            ${createSummaryStatBox('Avg Accuracy', stats.avgAccuracy + '%')}
            ${createSummaryStatBox('Avg WPM', stats.avgWpm)}
            ${createSummaryStatBox('Avg Prosody', stats.avgProsody)}
            ${createSummaryStatBox('Latest Accuracy', stats.latestAccuracy + '%')}
        </div>
        <div class="progress-chart-container">
            <canvas id="progress-chart"></canvas>
        </div>
        <div id="aggregated-patterns-section"></div>
    `;

    // Render the chart
    setTimeout(() => {
        renderProgressChart(student);
        renderAggregatedPatterns(student);
    }, 100);
}

// Render aggregated pattern analysis
function renderAggregatedPatterns(student) {
    const section = document.getElementById('aggregated-patterns-section');
    if (!section) return;

    const aggregated = aggregateErrorPatterns(student);
    const insights = generateMacroInsights(aggregated);

    if (aggregated.assessmentsWithPatterns === 0) {
        section.innerHTML = `
            <div class="pattern-analysis-card">
                <h3>Pattern Analysis</h3>
                <p class="pattern-note">Complete assessments with the latest version to see detailed error pattern analysis and insights.</p>
            </div>
        `;
        return;
    }

    // Build phonics patterns using helper
    const phonicsHtml = [
        createPatternItem('Initial Sounds', aggregated.phonicsPatterns.initialSoundErrors),
        createPatternItem('Final Sounds', aggregated.phonicsPatterns.finalSoundErrors),
        createPatternItem('Vowel Patterns', aggregated.phonicsPatterns.vowelPatterns),
        createPatternItem('Consonant Blends', aggregated.phonicsPatterns.consonantBlends),
        createPatternItem('R-Controlled Vowels', aggregated.phonicsPatterns.rControlledVowels),
        createPatternItem('Silent Letters', aggregated.phonicsPatterns.silentLetters),
        createPatternItem('Digraphs', aggregated.phonicsPatterns.digraphs)
    ].filter(h => h).join('');

    // Build reading strategies using helper
    const readingHtml = [
        createPatternItem('First Letter Guessing', aggregated.readingStrategies.firstLetterGuessing),
        createPatternItem('Partial Decoding', aggregated.readingStrategies.partialDecoding),
        createPatternItem('Context Guessing', aggregated.readingStrategies.contextGuessing)
    ].filter(h => h).join('');

    // Build speech patterns using helper
    const speechHtml = [
        createPatternItem('R Sound', aggregated.speechPatterns.rSoundIssues),
        createPatternItem('S Sound', aggregated.speechPatterns.sSoundIssues),
        createPatternItem('L Sound', aggregated.speechPatterns.lSoundIssues),
        createPatternItem('TH Sound', aggregated.speechPatterns.thSoundIssues)
    ].filter(h => h).join('');

    section.innerHTML = `
        <div class="pattern-analysis-card">
            <h3>Pattern Analysis Across ${aggregated.assessmentsWithPatterns} Assessment${aggregated.assessmentsWithPatterns > 1 ? 's' : ''}</h3>
            <div class="macro-insights">
                <h4>Key Insights:</h4>
                <ul class="insights-list">
                    ${insights.map(insight => `<li>${insight}</li>`).join('')}
                </ul>
            </div>
            ${phonicsHtml ? `
                <div class="pattern-breakdown">
                    <h4>Phonics Pattern Frequency:</h4>
                    <div class="pattern-grid">${phonicsHtml}</div>
                </div>
            ` : ''}
            ${readingHtml ? `
                <div class="pattern-breakdown">
                    <h4>Reading Strategy Issues:</h4>
                    <div class="pattern-grid">${readingHtml}</div>
                </div>
            ` : ''}
            ${speechHtml ? `
                <div class="pattern-breakdown speech-patterns">
                    <h4>Possible Speech Patterns:</h4>
                    <p class="pattern-note">Note: Consistent patterns may indicate articulation issues</p>
                    <div class="pattern-grid">${speechHtml}</div>
                </div>
            ` : ''}
        </div>
    `;
}

// Render assessment history
function renderAssessmentHistory(student) {
    if (student.assessments.length === 0) {
        assessmentHistory.innerHTML = `
            <div class="no-assessments">
                <p>📊 No assessments yet</p>
                <p>Complete an assessment and save it to this student's profile.</p>
            </div>
        `;
        return;
    }

    // Sort assessments by date (newest first)
    const sortedAssessments = [...student.assessments].sort((a, b) => b.date - a.date);

    assessmentHistory.innerHTML = '<h3>Assessment History</h3>' + sortedAssessments.map(assessment => {
        const date = new Date(assessment.date);
        const dateStr = date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const accuracy = assessment.accuracy || 0;
        const scoreClass = getAccuracyClass(accuracy);
        const totalErrors = (assessment.errors.skippedWords?.length || 0) +
                           (assessment.errors.misreadWords?.length || 0) +
                           (assessment.errors.substitutedWords?.length || 0);

        return `
            <div class="assessment-item">
                <div class="assessment-header">
                    <div class="assessment-date">${dateStr}</div>
                    <div class="assessment-score ${scoreClass}">${accuracy.toFixed(1)}%</div>
                </div>
                <div class="assessment-details">
                    ${createAssessmentDetail('Correct', assessment.correctCount)}
                    ${createAssessmentDetail('Total', assessment.totalWords)}
                    ${createAssessmentDetail('Errors', totalErrors)}
                    ${createAssessmentDetail('WPM', assessment.wpm || 'N/A')}
                    ${createAssessmentDetail('Prosody', assessment.prosodyScore ? assessment.prosodyScore.toFixed(1) : 'N/A')}
                </div>
                <div class="assessment-actions">
                    <button class="btn btn-primary btn-small view-assessment-btn" data-assessment-id="${assessment.id}">View Details</button>
                    <button class="btn btn-danger btn-small delete-assessment-btn" data-assessment-id="${assessment.id}">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Add view handlers
    document.querySelectorAll('.view-assessment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const assessmentId = btn.getAttribute('data-assessment-id');
            viewHistoricalAssessment(currentViewingStudentId, assessmentId);
        });
    });

    // Add delete handlers
    document.querySelectorAll('.delete-assessment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const assessmentId = btn.getAttribute('data-assessment-id');
            if (confirm('Are you sure you want to delete this assessment?')) {
                deleteAssessment(currentViewingStudentId, assessmentId);
                showStudentProfile(currentViewingStudentId); // Refresh
            }
        });
    });
}

// Return to student profile from historical assessment view
function returnToStudentProfile() {
    if (state.historicalAssessmentStudentId) {
        // Reset historical viewing state
        state.viewingHistoricalAssessment = false;

        // Hide historical banner
        if (historicalAssessmentBanner) {
            historicalAssessmentBanner.style.display = 'none';
        }

        // Show regular results actions
        const resultsActions = document.querySelector('.results-actions');
        if (resultsActions) {
            resultsActions.style.display = 'flex';
        }

        // Navigate back to student profile
        showStudentProfile(state.historicalAssessmentStudentId);
    }
}

// View historical assessment
async function viewHistoricalAssessment(studentId, assessmentId) {
    const student = await getStudent(studentId);
    if (!student) {
        alert('Student not found');
        return;
    }

    const assessment = student.assessments.find(a => a.id === assessmentId);
    if (!assessment) {
        alert('Assessment not found');
        return;
    }

    // Check if assessment has the new extended data
    if (!assessment.expectedWords || !assessment.aligned) {
        alert('This assessment was created before the detailed viewing feature was added. Only basic summary data is available.');
        return;
    }

    // Load historical assessment data into state
    state.latestExpectedWords = assessment.expectedWords;
    state.latestSpokenWords = assessment.spokenWords || [];
    state.latestProsodyMetrics = assessment.prosodyMetrics || {
        wpm: assessment.wpm,
        prosodyScore: assessment.prosodyScore
    };
    state.latestAnalysis = {
        aligned: assessment.aligned,
        errors: assessment.errors,
        correctCount: assessment.correctCount
    };
    state.latestErrorPatterns = assessment.errorPatterns || null;
    state.recordingDuration = assessment.duration || 60;

    // Load audio data if available
    if (assessment.audioData) {
        try {
            // Convert base64 data URL back to blob
            const response = await fetch(assessment.audioData);
            state.recordedAudioBlob = await response.blob();
            debugLog('Audio loaded from historical assessment');
        } catch (error) {
            debugWarn('Failed to load historical audio:', error);
            state.recordedAudioBlob = null;
        }
    } else {
        state.recordedAudioBlob = null;
    }

    // Mark that we're viewing a historical assessment
    state.viewingHistoricalAssessment = true;
    state.historicalAssessmentStudent = student.name;
    state.historicalAssessmentDate = new Date(assessment.date);
    state.historicalAssessmentStudentId = studentId; // Store for back navigation

    // Display the results with correct arguments:
    // displayPronunciationResults(expectedWords, spokenWordInfo, analysis, prosodyMetrics)
    displayPronunciationResults(
        state.latestExpectedWords,
        state.latestSpokenWords,
        state.latestAnalysis,
        state.latestProsodyMetrics
    );

    // Navigate to results section
    goToStep('results');

    // Show historical assessment banner
    if (historicalAssessmentBanner) {
        historicalAssessmentBanner.style.display = 'flex';
        historicalStudentName.textContent = student.name;
        historicalAssessmentDate.textContent = state.historicalAssessmentDate.toLocaleString();
    }

    // Keep results actions visible for PDF/video export
    const resultsActions = document.querySelector('.results-actions');
    if (resultsActions) {
        resultsActions.style.display = 'flex';
    }

    // Hide save assessment section for historical views (already saved)
    const saveSection = document.querySelector('.save-assessment-section');
    if (saveSection) {
        saveSection.style.display = 'none';
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update student dropdown in results section
async function updateStudentDropdown() {
    if (!studentSelect) return;

    const students = await getAllStudents();
    const studentArray = Object.values(students).sort((a, b) => a.name.localeCompare(b.name));

    studentSelect.innerHTML = '<option value="">-- Choose Student --</option>' +
        studentArray.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.grade || 'No grade')})</option>`).join('');
}

// Save current assessment to student
async function saveCurrentAssessmentToStudent() {
    const selectedStudentId = studentSelect.value;

    if (!selectedStudentId) {
        saveStatus.textContent = 'Please select a student';
        saveStatus.className = 'save-status error';
        return;
    }

    if (!state.latestAnalysis) {
        saveStatus.textContent = 'No assessment data available';
        saveStatus.className = 'save-status error';
        return;
    }

    // Note: Audio is NOT stored in manual saves to avoid Firestore 1MB document limit
    // Students with many assessments would exceed the limit if audio was included

    // Prepare assessment data (without audio to prevent size overflow)
    const assessmentData = {
        correctCount: state.latestAnalysis.correctCount,
        totalWords: state.latestExpectedWords ? state.latestExpectedWords.length : 0,
        accuracy: state.latestAnalysis.correctCount / (state.latestExpectedWords?.length || 1) * 100,
        wpm: state.latestProsodyMetrics?.wpm || 0,
        prosodyScore: state.latestProsodyMetrics?.prosodyScore || 0,
        errors: state.latestAnalysis.errors,
        duration: state.recordingDuration || 60,
        // Store analysis data for recreating results page
        expectedWords: state.latestExpectedWords || [],
        spokenWords: state.latestSpokenWords || [],
        aligned: state.latestAnalysis.aligned || [],
        prosodyMetrics: state.latestProsodyMetrics || {},
        errorPatterns: state.latestErrorPatterns || null
        // audioData omitted to prevent Firestore document size limit (1MB)
    };

    const success = await addAssessmentToStudent(selectedStudentId, assessmentData);

    if (success) {
        // Mark as saved to prevent duplicates
        state.assessmentAlreadySaved = true;

        const student = await getStudent(selectedStudentId);
        saveStatus.textContent = `✓ Assessment saved to ${student?.name || 'student'}'s profile!`;
        saveStatus.className = 'save-status success';

        // Clear selection after 3 seconds
        setTimeout(() => {
            saveStatus.className = 'save-status';
            studentSelect.value = '';
            saveAssessmentBtn.disabled = true;
        }, 3000);
    } else {
        saveStatus.textContent = 'Failed to save assessment';
        saveStatus.className = 'save-status error';
    }
}

// Open add student modal
function openAddStudentModal() {
    addStudentModal.classList.add('active');
    studentNameInput.value = '';
    studentGradeInput.value = '';
    studentNameInput.focus();
}

// Close add student modal
function closeAddStudentModal() {
    addStudentModal.classList.remove('active');
}

// Confirm add student
async function confirmAddStudent() {
    const name = studentNameInput.value.trim();
    const grade = studentGradeInput.value.trim();

    if (!name) {
        alert('Please enter a student name');
        return;
    }

    try {
        await addStudent(name, grade);
        closeAddStudentModal();
        await renderStudentsGrid();
        updateStudentDropdown();
        updateAssessmentStudentDropdown();
    } catch (error) {
        debugError('Error adding student:', error);
        alert('Failed to add student. Please try again.');
    }
}

// Delete current student
async function deleteCurrentStudent() {
    if (!currentViewingStudentId) return;

    const student = await getStudent(currentViewingStudentId);
    if (!student) return;

    if (confirm(`Are you sure you want to delete ${student.name} and all their assessments? This cannot be undone.`)) {
        await deleteStudent(currentViewingStudentId);
        showClassOverview();
    }
}

// ============ ASSESSMENT STUDENT SELECTION ============

// Update assessment student dropdown
async function updateAssessmentStudentDropdown() {
    if (!assessmentStudentSelect) return;

    const students = await getAllStudents();
    const studentArray = Object.values(students).sort((a, b) => a.name.localeCompare(b.name));

    assessmentStudentSelect.innerHTML = '<option value="">-- Choose Student --</option>' +
        studentArray.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.grade || 'No grade')})</option>`).join('');
}

// Handle assessment student selection
async function selectAssessmentStudent() {
    const studentId = assessmentStudentSelect.value;

    if (!studentId) {
        state.currentAssessmentStudentId = null;
        hideSelectedStudentDisplay();
        hideCurrentStudentIndicator();
        return;
    }

    const student = await getStudent(studentId);
    if (!student) return;

    state.currentAssessmentStudentId = studentId;
    showSelectedStudentDisplay(student);
    showCurrentStudentIndicator(student);
}

// Show selected student badge
function showSelectedStudentDisplay(student) {
    if (!selectedStudentDisplay) return;

    const initial = student.name.charAt(0).toUpperCase();

    selectedStudentDisplay.style.display = 'block';
    selectedStudentDisplay.querySelector('.selected-student-avatar').textContent = initial;
    selectedStudentDisplay.querySelector('.selected-student-name').textContent = student.name;
    selectedStudentDisplay.querySelector('.selected-student-grade').textContent = student.grade || 'No grade set';

    // Hide the dropdown
    assessmentStudentSelect.style.display = 'none';
    if (quickAddStudentBtn) quickAddStudentBtn.style.display = 'none';
}

// Hide selected student badge
function hideSelectedStudentDisplay() {
    if (!selectedStudentDisplay) return;

    selectedStudentDisplay.style.display = 'none';

    // Show the dropdown again
    assessmentStudentSelect.style.display = 'block';
    if (quickAddStudentBtn) quickAddStudentBtn.style.display = 'inline-flex';
}

// Show current student indicator in header
function showCurrentStudentIndicator(student) {
    if (!currentStudentIndicator) return;

    const initial = student.name.charAt(0).toUpperCase();

    currentStudentIndicator.style.display = 'flex';
    currentStudentIndicator.querySelector('.student-initial').textContent = initial;
    currentStudentIndicator.querySelector('.student-name-header').textContent = student.name;
}

// Hide current student indicator in header
function hideCurrentStudentIndicator() {
    if (!currentStudentIndicator) return;
    currentStudentIndicator.style.display = 'none';
}

// Change selected student (reset selection)
function changeSelectedStudent() {
    state.currentAssessmentStudentId = null;
    assessmentStudentSelect.value = '';
    hideSelectedStudentDisplay();
    // Keep header indicator visible until they select a new one
}

// Auto-save assessment after analysis completes
async function autoSaveAssessmentIfStudentSelected() {
    // Skip if no student selected, no analysis, or already saved
    if (!state.currentAssessmentStudentId || !state.latestAnalysis || state.assessmentAlreadySaved) {
        return;
    }

    // Note: Audio is NOT stored to avoid Firestore 1MB document limit
    // Students with many assessments would exceed the limit if audio was included

    // Prepare assessment data (without audio to prevent size overflow)
    const assessmentData = {
        correctCount: state.latestAnalysis.correctCount,
        totalWords: state.latestExpectedWords ? state.latestExpectedWords.length : 0,
        accuracy: state.latestAnalysis.correctCount / (state.latestExpectedWords?.length || 1) * 100,
        wpm: state.latestProsodyMetrics?.wpm || 0,
        prosodyScore: state.latestProsodyMetrics?.prosodyScore || 0,
        errors: state.latestAnalysis.errors,
        duration: state.recordingDuration || 60,
        // Store analysis data for recreating results page
        expectedWords: state.latestExpectedWords || [],
        spokenWords: state.latestSpokenWords || [],
        aligned: state.latestAnalysis.aligned || [],
        prosodyMetrics: state.latestProsodyMetrics || {},
        errorPatterns: state.latestErrorPatterns || null
        // audioData omitted to prevent Firestore document size limit (1MB)
    };

    const success = await addAssessmentToStudent(state.currentAssessmentStudentId, assessmentData);

    if (success) {
        // Mark as saved to prevent duplicates on back/forward navigation
        state.assessmentAlreadySaved = true;

        const student = await getStudent(state.currentAssessmentStudentId);

        // Show success message in the save section
        if (saveStatus) {
            saveStatus.textContent = `✓ Automatically saved to ${student?.name || 'student'}'s profile!`;
            saveStatus.className = 'save-status success';
        }

        // Also hide the save section since it's already saved
        const saveAssessmentSection = document.querySelector('.save-assessment-section');
        if (saveAssessmentSection) {
            saveAssessmentSection.style.display = 'none';
        }

        // Pre-select the student in the dropdown
        if (studentSelect) {
            studentSelect.value = state.currentAssessmentStudentId;
            studentSelect.disabled = true;
        }
        if (saveAssessmentBtn) {
            saveAssessmentBtn.disabled = true;
            saveAssessmentBtn.textContent = '✓ Already Saved';
        }
    }
}

// ============ END ASSESSMENT STUDENT SELECTION ============

// ============ EVENT LISTENERS FOR DATABASE FEATURES ============

// Initialize database features
// Old initDatabaseFeatures removed - replaced with async version below

// ============ END DATABASE FUNCTIONS ============

// Make initDatabaseFeatures async
async function initDatabaseFeaturesAsync() {
    // Class Overview button
    if (classOverviewBtn) {
        classOverviewBtn.addEventListener('click', showClassOverview);
    }

    // Header logo click - go to step 1 (audio)
    if (headerLogoLink) {
        headerLogoLink.addEventListener('click', (e) => {
            e.preventDefault();
            startNewAnalysis();
        });
    }

    // Back from class overview
    if (backFromClassBtn) {
        backFromClassBtn.addEventListener('click', () => {
            if (state.completedSteps.has('setup')) {
                goToStep('audio');
            } else {
                setupSection.classList.add('active');
                classOverviewSection.classList.remove('active');
                studentProfileSection.classList.remove('active');
            }
        });
    }

    // Add student button
    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', openAddStudentModal);
    }

    // Confirm add student
    if (confirmAddStudentBtn) {
        confirmAddStudentBtn.addEventListener('click', confirmAddStudent);
    }

    // Cancel add student
    if (cancelAddStudentBtn) {
        cancelAddStudentBtn.addEventListener('click', closeAddStudentModal);
    }

    // Student select change
    if (studentSelect) {
        studentSelect.addEventListener('change', () => {
            saveAssessmentBtn.disabled = !studentSelect.value;
        });
    }

    // Save assessment button
    if (saveAssessmentBtn) {
        saveAssessmentBtn.addEventListener('click', saveCurrentAssessmentToStudent);
    }

    // Back to class from profile
    if (backToClassBtn) {
        backToClassBtn.addEventListener('click', showClassOverview);
    }

    // Delete student button
    if (deleteStudentBtn) {
        deleteStudentBtn.addEventListener('click', deleteCurrentStudent);
    }

    // Assessment student selection
    if (assessmentStudentSelect) {
        assessmentStudentSelect.addEventListener('change', selectAssessmentStudent);
    }

    // Change student button
    if (changeStudentBtn) {
        changeStudentBtn.addEventListener('click', changeSelectedStudent);
    }

    // Quick add student button
    if (quickAddStudentBtn) {
        quickAddStudentBtn.addEventListener('click', openAddStudentModal);
    }

    // Update student dropdowns (await since these now call async Firebase functions)
    await updateStudentDropdown();
    await updateAssessmentStudentDropdown();
}

// Initialize after user authentication
async function initializeApp() {
    debugLog('Initializing Word Analyzer app...');

    try {
        // Update loading status
        updateLoadingStatus('Setting up your classroom...');

        // Initialize sample students if needed (for new users)
        await initializeSampleStudents();

        // Update loading status
        updateLoadingStatus('Loading API settings...');

        // Initialize app (loads API key)
        await init();

        // Update loading status
        updateLoadingStatus('Preparing interface...');

        // Initialize database features
        await initDatabaseFeaturesAsync();

        debugLog('App initialized successfully');

        // Small delay for smoother transition
        await new Promise(resolve => setTimeout(resolve, 300));

        // Show the app (hide loading screen)
        showAppReady();

    } catch (error) {
        debugError('Error initializing app:', error);
        updateLoadingStatus('Error loading app. Please refresh.');
    }
}

// Wait for user authentication before initializing app
window.addEventListener('userAuthenticated', async (event) => {
    debugLog('User authenticated, initializing app...');
    await initializeApp();
});

// Listen for API settings request from user menu
window.addEventListener('openApiSettings', () => {
    openApiSettingsFromMenu();
});

// Open API settings from the user menu dropdown
function openApiSettingsFromMenu() {
    // Navigate to setup section to show API key input
    // First hide all other sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => s.classList.remove('active'));

    // Hide class overview and student profile if visible
    if (classOverviewSection) classOverviewSection.classList.remove('active');
    if (studentProfileSection) studentProfileSection.classList.remove('active');

    // Show setup section
    setupSection.classList.add('active');

    // Update breadcrumb
    state.currentStep = 'setup';
    updateBreadcrumb();

    // Pre-fill with existing key (masked) if available
    if (state.apiKey && apiKeyInput) {
        apiKeyInput.value = '';
        apiKeyInput.placeholder = 'Enter new API key (current key is saved)';
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
