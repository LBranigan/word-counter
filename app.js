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
    // Analysis results
    latestAnalysis: null,
    latestExpectedWords: null,
    latestSpokenWords: null,
    // Step management
    currentStep: 'setup',
    completedSteps: new Set(),
    stepsOrder: ['setup', 'audio', 'capture', 'highlight', 'results'],
    // Current student being assessed
    currentAssessmentStudentId: null,
    // Audio skip mode (word count only)
    audioSkipped: false
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
const exportBtn = document.getElementById('export-btn');
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

// Initialize
function init() {
    // Check if API key is already saved
    const savedKey = localStorage.getItem('googleCloudVisionApiKey');
    if (savedKey) {
        state.apiKey = savedKey;
        showCameraSection();
    }

    // Event listeners
    if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', saveApiKey);
    if (captureBtn) captureBtn.addEventListener('click', capturePhoto);
    if (retakeBtn) retakeBtn.addEventListener('click', retakePhoto);
    if (resetSelectionBtn) resetSelectionBtn.addEventListener('click', resetSelection);
    if (exportBtn) exportBtn.addEventListener('click', exportSelectedWords);
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
    if (goToAudioBtn) goToAudioBtn.addEventListener('click', () => goToStep('audio'));
    if (rerecordAudioBtn) rerecordAudioBtn.addEventListener('click', openAudioModal);
    if (downloadAudioBtnMain) downloadAudioBtnMain.addEventListener('click', downloadRecordedAudio);

    // Breadcrumb click handlers
    setupBreadcrumbClickHandlers();

    // Initialize breadcrumb update
    updateBreadcrumb();
}

// Save API Key
function saveApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) {
        alert('Please enter your API key');
        return;
    }

    state.apiKey = key;
    localStorage.setItem('googleCloudVisionApiKey', key);
    showCameraSection();
}

// Show Camera Section
function showCameraSection() {
    setupSection.classList.remove('active');
    audioSection.classList.add('active');
    state.completedSteps.add('setup');
    goToStep('audio');
}

// ============ STEP MANAGEMENT & NAVIGATION ============

// Navigate to a specific step
function goToStep(step) {
    // Update current step
    state.currentStep = step;

    // Hide all sections
    setupSection.classList.remove('active');
    cameraSection.classList.remove('active');
    audioSection.classList.remove('active');
    imageSection.classList.remove('active');
    resultsSection.classList.remove('active');

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

    // Update breadcrumb and button states
    updateBreadcrumb();
    updateButtonStates();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        latestAnalysis: null,
        latestExpectedWords: null,
        latestSpokenWords: null,
        currentStep: 'audio',
        completedSteps: new Set(['setup']),
        currentAssessmentStudentId: null,
        audioSkipped: false
    });

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
        state.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        camera.srcObject = state.stream;
    } catch (error) {
        alert('Camera access denied. Please allow camera permissions.');
        console.error('Camera error:', error);
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
    context.drawImage(camera, 0, 0);

    state.capturedImage = cameraCanvas.toDataURL('image/jpeg', 0.9);

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
                            console.log('Filtering out punctuation-only:', text);
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

        console.log('=== VISION API RESULTS ===');
        console.log('Total words found:', words.length);
        console.log('First 10 words:', words.slice(0, 10).map(w => w.text));

        state.ocrData = { words: words };

        if (words.length === 0) {
            showStatus('No text detected. Please try again.', 'error');
            return;
        }

        // Draw image and word boxes on canvas
        drawImageWithWords();

        // Update breadcrumb now that OCR is complete
        updateBreadcrumb();

    } catch (error) {
        console.error('Vision API error:', error);

        if (error.message.includes('API key')) {
            showStatus('Invalid API key. Please check your settings.', 'error');
            // Clear saved key
            localStorage.removeItem('googleCloudVisionApiKey');
            setTimeout(() => {
                imageSection.classList.remove('active');
                setupSection.classList.add('active');
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
            console.log('Deselected word at index:', clickedWordIndex);
        } else {
            // Word is not selected, so select it
            state.selectedWords.add(clickedWordIndex);
            console.log('Selected word at index:', clickedWordIndex);
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
        console.log('Started panning at:', state.panStartPoint);
        return;
    }

    e.preventDefault();
    state.isDrawing = true;
    state.wasDragged = false;
    state.startPoint = getCanvasPoint(e);
    state.endPoint = state.startPoint;

    console.log('Started drawing at:', state.startPoint);
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

    console.log('Ended at:', state.endPoint);

    // Only select words if it was a drag, not just a click
    if (state.wasDragged) {
        // Select words between start and end
        selectWordsBetweenPoints();

        // Redraw with highlighted words
        redrawCanvas();
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
        console.log('Missing data for selection');
        return;
    }

    console.log('Total words available:', state.ocrData.words.length);

    // Find closest word to start point
    let startWordIndex = findClosestWordIndex(state.startPoint);
    // Find closest word to end point
    let endWordIndex = findClosestWordIndex(state.endPoint);

    console.log('Start word index:', startWordIndex);
    console.log('End word index:', endWordIndex);

    if (startWordIndex === -1 || endWordIndex === -1) {
        console.log('Could not find start or end word');
        showStatus('Could not find words. Try clicking closer to text.', 'error');
        return;
    }

    // Swap if needed
    if (startWordIndex > endWordIndex) {
        [startWordIndex, endWordIndex] = [endWordIndex, startWordIndex];
    }

    console.log('Selecting words from', startWordIndex, 'to', endWordIndex);

    // Select all words in range
    for (let i = startWordIndex; i <= endWordIndex; i++) {
        state.selectedWords.add(i);
    }

    console.log('Total selected words:', state.selectedWords.size);
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
        console.log('Found word:', state.ocrData.words[closestIndex].text, 'at distance:', minDistance);
    }

    return closestIndex;
}

function redrawCanvas() {
    const img = new Image();
    img.onload = function() {
        const canvas = document.getElementById('selection-canvas');
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
                    ctx.lineWidth = 3 / state.zoom; // Adjust line width for zoom
                    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                } else {
                    // Subtle boundaries for unselected words
                    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
                    ctx.lineWidth = 1 / state.zoom; // Adjust line width for zoom
                    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                }
            });
        }
    };
    img.src = state.capturedImage;
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

function retakePhoto() {
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

    // Restart camera
    initCamera();
}

function showStatus(message, type = '') {
    statusDisplay.textContent = message;
    statusDisplay.className = 'status ' + type;
}

function exportSelectedWords() {
    if (!state.ocrData || !state.ocrData.words || state.selectedWords.size === 0) {
        exportOutput.innerHTML = `
            <h3>No Words Selected</h3>
            <p style="color: #666;">Please select words by dragging from the first word to the last word.</p>
        `;
        exportOutput.classList.add('active');
        return;
    }

    // Get selected words in order
    const selectedIndices = Array.from(state.selectedWords).sort((a, b) => a - b);
    const selectedWordTexts = selectedIndices.map(index => state.ocrData.words[index].text);

    // Create plain text output
    const plainText = selectedWordTexts.join(' ');

    // Create detailed output showing each word
    const wordListHtml = selectedWordTexts.map((word, index) => {
        return `${index + 1}. "${word}"`;
    }).join('\n');

    exportOutput.innerHTML = `
        <h3>Selected Words (${state.selectedWords.size} total)</h3>
        <div class="word-list">${wordListHtml}</div>
        <div class="export-info">
            <strong>How counting works:</strong><br>
            Each detected word is counted as 1, even if it contains punctuation or numbers.<br>
            Words are selected in order from index ${selectedIndices[0]} to ${selectedIndices[selectedIndices.length - 1]}.
        </div>
        <div class="export-info">
            <strong>Plain text:</strong><br>
            <div class="word-list">${plainText}</div>
        </div>
    `;
    exportOutput.classList.add('active');

    console.log('=== EXPORT DEBUG ===');
    console.log('Total selected indices:', state.selectedWords.size);
    console.log('Selected indices:', selectedIndices);
    console.log('Selected words:', selectedWordTexts);
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
        // Request microphone access with audio optimizations
        state.audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,    // Mono audio
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        // Initialize MediaRecorder with user-selected bitrate
        // Google Speech-to-Text inline audio has practical limits around 40-50 seconds
        // Lower bitrate = smaller files = more reliable processing
        const selectedBitrate = parseInt(audioBitrateInput.value);
        console.log('Recording with bitrate:', selectedBitrate, 'bps');

        const options = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: selectedBitrate
        };

        // Check if the browser supports the specified codec
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            // Fallback to default if opus not supported
            delete options.mimeType;
        }

        state.mediaRecorder = new MediaRecorder(state.audioStream, options);
        state.audioChunks = [];
        state.recordingDuration = duration * 60; // Convert to seconds

        // Collect audio data
        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        };

        // Handle recording stop
        state.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
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

        // Start recording
        state.mediaRecorder.start();
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
        console.error('Error accessing microphone:', error);
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

    // Update the main audio player in the audio section
    if (audioPlayerMain) {
        audioPlayerMain.src = url;
        if (audioPlayerSection) {
            audioPlayerSection.style.display = 'block';
        }
    }

    // Also update the old audio player for backward compatibility
    audioPlayer.src = url;
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

    showStatus('Converting audio to speech using Google Speech-to-Text...', 'processing');

    try {
        // Convert WebM to base64
        const reader = new FileReader();
        reader.readAsDataURL(state.recordedAudioBlob);

        reader.onerror = () => {
            console.error('File reader error:', reader.error);
            showStatus('Error reading audio file. Please try recording again.', 'error');
        };

        reader.onloadend = async () => {
            try {
                const base64Audio = reader.result.split(',')[1];

                // Detailed debugging information
                const fileSizeBytes = state.recordedAudioBlob.size;
                const fileSizeKB = fileSizeBytes / 1024;
                const fileSizeMB = fileSizeBytes / (1024 * 1024);

                console.log('=== AUDIO FILE DEBUG INFO ===');
                console.log('Audio blob size (bytes):', fileSizeBytes);
                console.log('Audio blob size (KB):', fileSizeKB.toFixed(2));
                console.log('Audio blob size (MB):', fileSizeMB.toFixed(2));
                console.log('Audio blob type:', state.recordedAudioBlob.type);
                console.log('Base64 audio length:', base64Audio.length);
                console.log('Recording duration (seconds):', state.recordingDuration);
                console.log('Recording duration (minutes):', (state.recordingDuration / 60).toFixed(2));

                // Check file size (Google has ~10MB limit for synchronous recognition)
                if (fileSizeMB > 9.5) {
                    throw new Error(`Audio file too large (${fileSizeMB.toFixed(1)}MB). Please record shorter audio or reduce quality.`);
                }

                // Prepare API request
                const requestBody = {
                    config: {
                        encoding: 'WEBM_OPUS',
                        // sampleRateHertz: 48000,  // Omit this to let API auto-detect
                        languageCode: 'en-US',
                        enableAutomaticPunctuation: true,
                        enableWordConfidence: true,
                        enableWordTimeOffsets: true,
                    },
                    audio: {
                        content: base64Audio
                    }
                };

                console.log('Sending request to Speech-to-Text API...');

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

                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);

                const data = await response.json();
                console.log('API Response:', data);

                if (data.error) {
                    console.error('API Error:', data.error);
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
                    console.warn('No speech detected in results');
                    showStatus('No speech detected in the audio. Please try recording again with clearer audio.', 'error');
                    return;
                }

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
                            console.warn('Skipping incomplete word data:', wordData);
                        }
                    });
                }
            });

            console.log('Word-level info with timing:', wordInfo);

            // Get expected text from highlighted words
            const selectedIndices = Array.from(state.selectedWords).sort((a, b) => a - b);
            const expectedWords = selectedIndices.map(index => state.ocrData.words[index].text);

            // Analyze pronunciation by comparing expected vs spoken words
            const analysis = analyzePronunciation(expectedWords, wordInfo);

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

            // Display results with pronunciation analysis
            displayPronunciationResults(expectedWords, wordInfo, analysis, prosodyMetrics);

            const totalErrors = analysis.errors.skippedWords.length +
                              analysis.errors.misreadWords.length +
                              analysis.errors.substitutedWords.length;
            showStatus(`Analysis complete! ${totalErrors} pronunciation error(s) detected.`, '');

                // Scroll to results
                exportOutput.scrollIntoView({ behavior: 'smooth', block: 'center' });

            } catch (innerError) {
                console.error('Inner error during audio analysis:', innerError);
                showStatus('Error analyzing audio: ' + innerError.message, 'error');
            }
        };

    } catch (error) {
        console.error('Outer Speech-to-Text error:', error);
        showStatus('Error analyzing audio: ' + error.message, 'error');
    }
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

// Analyze pronunciation by comparing expected vs spoken words
function analyzePronunciation(expectedWords, spokenWordInfo) {
    // Preprocess: Expand currency symbols
    expectedWords = expandCurrencySymbols(expectedWords);

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
            if (expNorm === spkNorm) {
                matchScore = 1; // Perfect match
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

            if (expNorm === spkNorm) {
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

    console.log('Detailed pronunciation analysis:', analysis);
    return analysis;
}

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

    console.log('Prosody Metrics:', metrics);
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
                    ${selectedWords.map((word, i) => `<span class="word-item">${i + 1}. ${word}</span>`).join(' ')}
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
        let className = 'word-correct';
        let errorLabel = '';
        let tooltip = 'Correct pronunciation';

        if (item.status === 'correct') {
            className = 'word-correct';
            tooltip = `Confidence: ${(item.confidence * 100).toFixed(0)}%`;
        } else if (item.status === 'skipped') {
            className = 'word-skipped';
            errorLabel = '<span class="error-badge">skipped</span>';
            tooltip = 'Word was not spoken';
        } else if (item.status === 'misread') {
            className = 'word-misread';
            errorLabel = '<span class="error-badge">misread</span>';
            tooltip = `Expected: "${word}", Heard: "${item.spoken}"`;
        } else if (item.status === 'substituted') {
            className = 'word-substituted';
            errorLabel = '<span class="error-badge">substituted</span>';
            tooltip = `Expected: "${word}", Said: "${item.spoken}" instead`;
        }

        wordsHtml += `<span class="${className}" title="${tooltip}">${word}${errorLabel}</span> `;
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
            `"${e.expected}" → "${e.spoken}"`
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
            `"${e.expected}" → "${e.spoken}"`
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
            h.type === 'filler' ? `"${h.word}"` : `pause before "${h.word}"`
        ).join(', ');
        errorBreakdownHtml += `
            <div class="error-category">
                <strong>⏸️ Hesitations (${analysis.errors.hesitations.length}):</strong>
                <div class="error-details">${hesitationList}</div>
            </div>
        `;
    }

    if (analysis.errors.repeatedWords.length > 0) {
        const repeatList = analysis.errors.repeatedWords.map(r => `"${r.word}"`).join(', ');
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
        const phraseList = analysis.errors.repeatedPhrases.map(p => `"${p.phrase}"`).join(', ');
        errorBreakdownHtml += `
            <div class="error-category">
                <strong>🔂 Repeated Phrases (${analysis.errors.repeatedPhrases.length}):</strong>
                <div class="error-details">${phraseList}</div>
            </div>
        `;
    }

    exportOutput.innerHTML = `
        <h3>🎯 Reading Comprehension Analysis</h3>
        <div class="audio-analysis-result">
            <div class="download-output-section">
                <button id="download-output-btn" class="btn btn-export">
                    <span class="icon">📄</span> Download Output (PDF)
                </button>
                <button id="generate-video-btn" class="btn btn-export">
                    <span class="icon">🎬</span> Generate Video
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
        const downloadOutputBtnResults = resultsContainer.querySelector('#download-output-btn');
        const generateVideoBtnResults = resultsContainer.querySelector('#generate-video-btn');
        const statusDivResults = resultsContainer.querySelector('#video-generation-status');

        if (downloadOutputBtnResults) {
            downloadOutputBtnResults.addEventListener('click', downloadAnalysisAsPDF);
        }
        if (generateVideoBtnResults) {
            generateVideoBtnResults.addEventListener('click', async function() {
                // Call generateTranscriptVideo with results container context
                await generateTranscriptVideoInContainer(resultsContainer);
            });
        }
    }

    // Add event listener for download button in export section
    const downloadOutputBtn = document.getElementById('download-output-btn');
    if (downloadOutputBtn) {
        downloadOutputBtn.addEventListener('click', downloadAnalysisAsPDF);
    }

    // Add event listener for video generation button in export section
    const generateVideoBtn = document.getElementById('generate-video-btn');
    if (generateVideoBtn) {
        generateVideoBtn.addEventListener('click', generateTranscriptVideo);
    }

    // Auto-save assessment if student was selected
    autoSaveAssessmentIfStudentSelected();

    // Mark highlight and results as complete and navigate to results section
    state.completedSteps.add('highlight');
    state.completedSteps.add('results');
    goToStep('results');
}

// Generate and download analysis as PDF
function downloadAnalysisAsPDF() {
    if (!state.latestAnalysis || !state.latestExpectedWords) {
        alert('No analysis data available');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const analysis = state.latestAnalysis;
    const expectedWords = state.latestExpectedWords;
    const totalWords = expectedWords.length;
    const correctCount = analysis.correctCount;
    const totalErrors = analysis.errors.skippedWords.length +
                        analysis.errors.misreadWords.length +
                        analysis.errors.substitutedWords.length;
    const accuracy = ((correctCount / totalWords) * 100).toFixed(1);

    let yPos = 20;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);

    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Reading Comprehension Analysis Report', margin, yPos);
    yPos += 10;

    // Date/Time
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    doc.setTextColor(0);
    yPos += 15;

    // Statistics Section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Summary Statistics', margin, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Total Words: ${totalWords}`, margin, yPos);
    yPos += 6;
    doc.text(`Correct: ${correctCount}`, margin, yPos);
    yPos += 6;
    doc.text(`Errors: ${totalErrors}`, margin, yPos);
    yPos += 6;
    doc.text(`Accuracy: ${accuracy}%`, margin, yPos);
    yPos += 6;

    // Add prosody metrics if available
    if (state.latestProsodyMetrics) {
        doc.text(`Reading Rate: ${state.latestProsodyMetrics.wpm} WPM`, margin, yPos);
        yPos += 6;
        doc.text(`Prosody Score: ${state.latestProsodyMetrics.prosodyScore}/4.0 (${state.latestProsodyMetrics.prosodyGrade})`, margin, yPos);
        yPos += 6;
    }
    yPos += 6;

    // Error Breakdown
    if (totalErrors > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Error Breakdown', margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        if (analysis.errors.skippedWords.length > 0) {
            doc.setFont(undefined, 'bold');
            doc.text(`Skipped Words: ${analysis.errors.skippedWords.length}`, margin, yPos);
            yPos += 5;
            doc.setFont(undefined, 'normal');
            const skippedText = 'Words not read aloud';
            doc.text(skippedText, margin + 5, yPos);
            yPos += 7;
        }

        if (analysis.errors.misreadWords.length > 0) {
            doc.setFont(undefined, 'bold');
            doc.text(`Misread Words: ${analysis.errors.misreadWords.length}`, margin, yPos);
            yPos += 5;
            doc.setFont(undefined, 'normal');
            analysis.errors.misreadWords.forEach(e => {
                const text = `"${e.expected}" -> "${e.spoken}"`;
                const lines = doc.splitTextToSize(text, maxWidth - 5);
                doc.text(lines, margin + 5, yPos);
                yPos += 5 * lines.length;
            });
            yPos += 2;
        }

        if (analysis.errors.substitutedWords.length > 0) {
            doc.setFont(undefined, 'bold');
            doc.text(`Substituted Words: ${analysis.errors.substitutedWords.length}`, margin, yPos);
            yPos += 5;
            doc.setFont(undefined, 'normal');
            analysis.errors.substitutedWords.forEach(e => {
                const text = `"${e.expected}" -> "${e.spoken}"`;
                const lines = doc.splitTextToSize(text, maxWidth - 5);
                doc.text(lines, margin + 5, yPos);
                yPos += 5 * lines.length;
            });
            yPos += 2;
        }

        if (analysis.errors.hesitations.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFont(undefined, 'bold');
            doc.text(`Hesitations: ${analysis.errors.hesitations.length}`, margin, yPos);
            yPos += 5;
            doc.setFont(undefined, 'normal');
            const hesitationText = analysis.errors.hesitations.map(h =>
                h.type === 'filler' ? `"${h.word}"` : `pause before "${h.word}"`
            ).join(', ');
            const hesLines = doc.splitTextToSize(hesitationText, maxWidth - 5);
            doc.text(hesLines, margin + 5, yPos);
            yPos += 5 * hesLines.length + 2;
        }

        if (analysis.errors.repeatedWords.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFont(undefined, 'bold');
            doc.text(`Repeated Words: ${analysis.errors.repeatedWords.length}`, margin, yPos);
            yPos += 5;
            doc.setFont(undefined, 'normal');
            const repeatText = analysis.errors.repeatedWords.map(r => `"${r.word}"`).join(', ');
            const repeatLines = doc.splitTextToSize(repeatText, maxWidth - 5);
            doc.text(repeatLines, margin + 5, yPos);
            yPos += 5 * repeatLines.length + 2;
        }

        if (analysis.errors.skippedLines.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFont(undefined, 'bold');
            doc.setTextColor(220, 53, 69);
            doc.text(`Skipped Lines: ${analysis.errors.skippedLines.length} (CRITICAL)`, margin, yPos);
            doc.setTextColor(0);
            yPos += 5;
            doc.setFont(undefined, 'normal');
            analysis.errors.skippedLines.forEach(l => {
                doc.text(`${l.count} consecutive words skipped`, margin + 5, yPos);
                yPos += 5;
            });
            yPos += 2;
        }

        if (analysis.errors.repeatedPhrases.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFont(undefined, 'bold');
            doc.text(`Repeated Phrases: ${analysis.errors.repeatedPhrases.length}`, margin, yPos);
            yPos += 5;
            doc.setFont(undefined, 'normal');
            const phraseText = analysis.errors.repeatedPhrases.map(p => `"${p.phrase}"`).join(', ');
            const phraseLines = doc.splitTextToSize(phraseText, maxWidth - 5);
            doc.text(phraseLines, margin + 5, yPos);
            yPos += 5 * phraseLines.length + 2;
        }
    }

    // Color-Coded Transcript (Visual like video)
    if (yPos > 200) {
        doc.addPage();
        yPos = 20;
    }

    yPos += 5;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Color-Coded Transcript', margin, yPos);
    yPos += 8;

    // Add legend
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');

    doc.setTextColor(34, 197, 94); // Green
    doc.text('■ Correct', margin, yPos);

    doc.setTextColor(249, 115, 22); // Orange
    doc.text('■ Misread', margin + 25, yPos);

    doc.setTextColor(239, 68, 68); // Red
    doc.text('■ Skipped/Substituted', margin + 50, yPos);

    doc.setTextColor(0);
    yPos += 8;

    // Build transcript as a flowing paragraph with color-coded words
    doc.setFontSize(10);
    let xPos = margin;
    const lineHeight = 6;
    const wordSpacing = 1.5;

    analysis.aligned.forEach((item, index) => {
        let color = [0, 0, 0];

        if (item.status === 'correct') {
            color = [34, 197, 94]; // Green
        } else if (item.status === 'skipped') {
            color = [239, 68, 68]; // Red
        } else if (item.status === 'misread') {
            color = [249, 115, 22]; // Orange
        } else if (item.status === 'substituted') {
            color = [220, 38, 38]; // Dark red
        }

        const word = item.expected + ' ';
        const wordWidth = doc.getTextWidth(word);

        // Check if word fits on current line
        if (xPos + wordWidth > pageWidth - margin) {
            xPos = margin;
            yPos += lineHeight;

            // Check if we need a new page
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
                xPos = margin;
            }
        }

        doc.setTextColor(...color);
        doc.text(word, xPos, yPos);
        xPos += wordWidth + wordSpacing;
    });

    doc.setTextColor(0);
    yPos += 10;

    // Word-by-Word Detailed Analysis
    if (yPos > 200) {
        doc.addPage();
        yPos = 20;
    }

    yPos += 5;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Detailed Word-by-Word Analysis', margin, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');

    analysis.aligned.forEach((item, index) => {
        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
        }

        let status = '';
        let color = [0, 0, 0];

        if (item.status === 'correct') {
            status = '✓';
            color = [21, 87, 36];
        } else if (item.status === 'skipped') {
            status = 'SKIPPED';
            color = [56, 61, 65];
        } else if (item.status === 'misread') {
            status = `MISREAD: "${item.spoken}"`;
            color = [133, 100, 4];
        } else if (item.status === 'substituted') {
            status = `SUBSTITUTED: "${item.spoken}"`;
            color = [114, 28, 36];
        }

        doc.setTextColor(...color);
        const text = `${index + 1}. ${item.expected} ${status}`;
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, margin, yPos);
        doc.setTextColor(0);
        yPos += 5 * lines.length;
    });

    // Save PDF
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    doc.save(`reading-comprehension-analysis-${timestamp}.pdf`);
}

// Generate transcript video with synchronized word highlighting
// Generate transcript video (with optional container for scoped element lookup)
async function generateTranscriptVideoInContainer(container) {
    if (!state.latestAnalysis || !state.latestSpokenWords || !state.recordedAudioBlob) {
        alert('No analysis data or audio available');
        return;
    }

    // Use container scope if provided, otherwise use document
    const scope = container || document;
    const statusDiv = scope.querySelector('#video-generation-status');
    const generateBtn = scope.querySelector('#generate-video-btn');

    if (!statusDiv || !generateBtn) {
        console.error('Video generation elements not found');
        return;
    }

    return await generateTranscriptVideoCore(statusDiv, generateBtn);
}

// Legacy wrapper for backward compatibility
async function generateTranscriptVideo() {
    return await generateTranscriptVideoInContainer(document);
}

// Core video generation logic
async function generateTranscriptVideoCore(statusDiv, generateBtn) {
    if (!state.latestAnalysis || !state.latestSpokenWords || !state.recordedAudioBlob) {
        alert('No analysis data or audio available');
        return;
    }

    try {
        generateBtn.disabled = true;
        statusDiv.innerHTML = '<div class="video-progress">🎬 Generating video... Please wait</div>';
        statusDiv.style.display = 'block';

        const analysis = state.latestAnalysis;
        const spokenWords = state.latestSpokenWords;
        const audioBlob = state.recordedAudioBlob;

        // Create canvas for video rendering
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        // Video rendering settings
        const padding = 60;
        const lineHeight = 50;
        const fontSize = 36;
        const maxWidth = canvas.width - (padding * 2);

        // Prepare word layout (wrap text)
        const wordLayouts = [];
        let xPos = padding;
        let yPos = padding + fontSize;

        analysis.aligned.forEach((item, index) => {
            const word = item.expected;
            ctx.font = `${fontSize}px Arial`;
            const wordWidth = ctx.measureText(word + ' ').width;

            // Wrap to next line if needed
            if (xPos + wordWidth > canvas.width - padding) {
                xPos = padding;
                yPos += lineHeight;
            }

            wordLayouts.push({
                word: word,
                x: xPos,
                y: yPos,
                width: wordWidth,
                status: item.status,
                spoken: item.spoken,
                startTime: item.startTime,
                endTime: item.endTime
            });

            xPos += wordWidth;
        });

        // Create audio context and decode audio (will be used for both duration and streaming)
        const audioContext = new AudioContext();
        const audioBuffer = await audioBlob.arrayBuffer();
        const decodedAudio = await audioContext.decodeAudioData(audioBuffer);
        const audioDuration = decodedAudio.duration;

        // Render function
        function renderFrame(currentTime) {
            // Clear canvas with white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw title
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 28px Arial';
            ctx.fillText('Reading Comprehension Analysis', padding, 35);

            // Draw each word with appropriate highlighting
            ctx.font = `${fontSize}px Arial`;

            wordLayouts.forEach(layout => {
                let color = '#cccccc'; // Default: not yet spoken
                let isCurrentWord = false;

                // Check if this word is being spoken right now
                if (layout.startTime && layout.endTime) {
                    const startTime = parseFloat(layout.startTime.replace('s', ''));
                    const endTime = parseFloat(layout.endTime.replace('s', ''));

                    if (currentTime >= startTime && currentTime <= endTime) {
                        isCurrentWord = true;
                        // Highlight current word based on status
                        if (layout.status === 'correct') {
                            color = '#22c55e'; // Bright green
                        } else if (layout.status === 'misread') {
                            color = '#f97316'; // Orange
                        } else if (layout.status === 'skipped') {
                            color = '#ef4444'; // Red
                        } else if (layout.status === 'substituted') {
                            color = '#dc2626'; // Dark red
                        }
                    } else if (currentTime > endTime) {
                        // Already spoken - use dimmer colors
                        if (layout.status === 'correct') {
                            color = '#86efac'; // Light green
                        } else if (layout.status === 'misread') {
                            color = '#fdba74'; // Light orange
                        } else if (layout.status === 'skipped') {
                            color = '#fca5a5'; // Light red
                        } else if (layout.status === 'substituted') {
                            color = '#fca5a5'; // Light red
                        }
                    }
                } else {
                    // No timing data - use status colors dimly
                    if (layout.status === 'correct') {
                        color = '#86efac';
                    } else if (layout.status === 'misread') {
                        color = '#fdba74';
                    } else if (layout.status === 'skipped') {
                        color = '#fca5a5';
                    }
                }

                // Draw word
                ctx.fillStyle = color;
                ctx.fillText(layout.word, layout.x, layout.y);

                // Draw underline for current word
                if (isCurrentWord) {
                    ctx.fillRect(layout.x, layout.y + 8, layout.width - 10, 3);
                }
            });

            // Draw legend at bottom
            const legendY = canvas.height - 40;
            ctx.font = '20px Arial';

            ctx.fillStyle = '#22c55e';
            ctx.fillText('■ Correct', padding, legendY);

            ctx.fillStyle = '#f97316';
            ctx.fillText('■ Misread', padding + 150, legendY);

            ctx.fillStyle = '#ef4444';
            ctx.fillText('■ Skipped', padding + 300, legendY);

            ctx.fillStyle = '#cccccc';
            ctx.fillText('■ Not Yet Spoken', padding + 450, legendY);
        }

        // Create canvas stream for video
        const canvasStream = canvas.captureStream(30); // 30 fps

        // Create media stream destination for audio
        const audioDestination = audioContext.createMediaStreamDestination();

        // Create buffer source from previously decoded audio
        const audioSource = audioContext.createBufferSource();
        audioSource.buffer = decodedAudio;
        audioSource.connect(audioDestination);

        // Combine video and audio streams
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioDestination.stream.getAudioTracks()
        ]);

        const mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp9,opus',
            videoBitsPerSecond: 2500000,
            audioBitsPerSecond: 128000
        });

        const chunks = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const videoBlob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(videoBlob);

            // Clean up audio context
            audioContext.close();

            // Create download link
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            a.download = `reading-comprehension-video-${timestamp}.webm`;

            statusDiv.innerHTML = `
                <div class="video-complete">
                    ✅ Video generated successfully!
                    <a href="${url}" download="${a.download}" class="btn btn-primary" style="margin-left: 10px;">
                        <span class="icon">💾</span> Download Video
                    </a>
                </div>
            `;

            generateBtn.disabled = false;
        };

        // Start recording and audio playback simultaneously
        mediaRecorder.start();
        audioSource.start(0);

        // Render frames
        const fps = 30;
        const frameInterval = 1000 / fps;
        let currentTime = 0;

        const renderInterval = setInterval(() => {
            currentTime += frameInterval / 1000;

            if (currentTime >= audioDuration) {
                clearInterval(renderInterval);
                mediaRecorder.stop();
                audioSource.stop();
            } else {
                renderFrame(currentTime);
            }
        }, frameInterval);

    } catch (error) {
        console.error('Error generating video:', error);
        statusDiv.innerHTML = `<div class="error">❌ Error generating video: ${error.message}</div>`;
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

// Get all students from localStorage
function getAllStudents() {
    const studentsData = localStorage.getItem('wordAnalyzerStudents');
    if (!studentsData) {
        // Initialize with sample students
        const sampleStudents = createSampleStudents();
        saveAllStudents(sampleStudents);
        return sampleStudents;
    }
    return JSON.parse(studentsData);
}

// Save all students to localStorage
function saveAllStudents(students) {
    localStorage.setItem('wordAnalyzerStudents', JSON.stringify(students));
}

// Create sample students (Susan, Jose, Timmy)
function createSampleStudents() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return {
        'student-001': {
            id: 'student-001',
            name: 'Susan',
            grade: '3rd Grade',
            dateAdded: now - (30 * dayMs),
            assessments: [
                createSampleAssessment(now - (7 * dayMs), 95, 100, 95, 120, 4.2),
                createSampleAssessment(now - (5 * dayMs), 92, 98, 93.9, 115, 4.0),
                createSampleAssessment(now - (2 * dayMs), 97, 100, 97, 125, 4.4)
            ]
        },
        'student-002': {
            id: 'student-002',
            name: 'Jose',
            grade: '3rd Grade',
            dateAdded: now - (30 * dayMs),
            assessments: [
                createSampleAssessment(now - (8 * dayMs), 78, 95, 82.1, 95, 3.2),
                createSampleAssessment(now - (6 * dayMs), 82, 95, 86.3, 100, 3.4),
                createSampleAssessment(now - (3 * dayMs), 85, 98, 86.7, 105, 3.6),
                createSampleAssessment(now - (1 * dayMs), 88, 100, 88, 108, 3.7)
            ]
        },
        'student-003': {
            id: 'student-003',
            name: 'Timmy',
            grade: '2nd Grade',
            dateAdded: now - (25 * dayMs),
            assessments: [
                createSampleAssessment(now - (4 * dayMs), 65, 85, 76.5, 80, 2.8),
                createSampleAssessment(now - (1 * dayMs), 70, 90, 77.8, 85, 3.0)
            ]
        }
    };
}

// Create a sample assessment
function createSampleAssessment(date, correct, total, accuracy, wpm, prosody) {
    const errors = total - correct;
    return {
        id: 'assessment-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        date: date,
        correctCount: correct,
        totalWords: total,
        accuracy: accuracy,
        wpm: wpm,
        prosodyScore: prosody,
        errors: {
            skippedWords: Array(Math.floor(errors * 0.4)).fill(0),
            misreadWords: Array(Math.floor(errors * 0.3)).fill({}),
            substitutedWords: Array(Math.floor(errors * 0.3)).fill({})
        },
        duration: 60
    };
}

// Add new student
function addStudent(name, grade = '') {
    const students = getAllStudents();
    const studentId = 'student-' + Date.now();

    students[studentId] = {
        id: studentId,
        name: name,
        grade: grade,
        dateAdded: Date.now(),
        assessments: []
    };

    saveAllStudents(students);
    return studentId;
}

// Get student by ID
function getStudent(studentId) {
    const students = getAllStudents();
    return students[studentId] || null;
}

// Update student
function updateStudent(studentId, updates) {
    const students = getAllStudents();
    if (students[studentId]) {
        students[studentId] = { ...students[studentId], ...updates };
        saveAllStudents(students);
        return true;
    }
    return false;
}

// Delete student
function deleteStudent(studentId) {
    const students = getAllStudents();
    if (students[studentId]) {
        delete students[studentId];
        saveAllStudents(students);
        return true;
    }
    return false;
}

// Add assessment to student
function addAssessmentToStudent(studentId, assessmentData) {
    const students = getAllStudents();
    const student = students[studentId];

    if (!student) {
        return false;
    }

    const assessment = {
        id: 'assessment-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        date: Date.now(),
        ...assessmentData
    };

    student.assessments.push(assessment);
    saveAllStudents(students);
    return true;
}

// Delete assessment from student
function deleteAssessment(studentId, assessmentId) {
    const students = getAllStudents();
    const student = students[studentId];

    if (!student) {
        return false;
    }

    student.assessments = student.assessments.filter(a => a.id !== assessmentId);
    saveAllStudents(students);
    return true;
}

// Get student statistics
function getStudentStats(student) {
    if (!student || !student.assessments || student.assessments.length === 0) {
        return {
            totalAssessments: 0,
            avgAccuracy: 0,
            avgWpm: 0,
            avgProsody: 0,
            latestAccuracy: 0,
            trend: 'neutral'
        };
    }

    const assessments = student.assessments;
    const total = assessments.length;

    const avgAccuracy = assessments.reduce((sum, a) => sum + (a.accuracy || 0), 0) / total;
    const avgWpm = assessments.reduce((sum, a) => sum + (a.wpm || 0), 0) / total;
    const avgProsody = assessments.reduce((sum, a) => sum + (a.prosodyScore || 0), 0) / total;

    // Calculate trend (comparing last assessment to average)
    const latestAccuracy = assessments[assessments.length - 1].accuracy;
    const trend = latestAccuracy > avgAccuracy + 2 ? 'improving' :
                  latestAccuracy < avgAccuracy - 2 ? 'declining' : 'stable';

    return {
        totalAssessments: total,
        avgAccuracy: avgAccuracy.toFixed(1),
        avgWpm: Math.round(avgWpm),
        avgProsody: avgProsody.toFixed(1),
        latestAccuracy: latestAccuracy.toFixed(1),
        trend: trend
    };
}

// ============ UI FUNCTIONS ============

// Get DOM elements for database features
const classOverviewSection = document.getElementById('class-overview-section');
const studentProfileSection = document.getElementById('student-profile-section');
const classOverviewBtn = document.getElementById('class-overview-btn');
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

// Show Class Overview
function showClassOverview() {
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
    renderStudentsGrid();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render students grid
function renderStudentsGrid() {
    const students = getAllStudents();
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
        const initial = student.name.charAt(0).toUpperCase();

        let accuracyClass = 'good';
        if (stats.latestAccuracy >= 95) accuracyClass = 'good';
        else if (stats.latestAccuracy >= 85) accuracyClass = 'warning';
        else accuracyClass = 'poor';

        return `
            <div class="student-card" data-student-id="${student.id}">
                <div class="student-card-header">
                    <div class="student-avatar">${initial}</div>
                    <div class="student-info">
                        <h3>${student.name}</h3>
                        <p class="student-grade">${student.grade || 'No grade set'}</p>
                    </div>
                </div>
                <div class="student-stats">
                    <div class="stat-item">
                        <div class="stat-item-label">Assessments</div>
                        <div class="stat-item-value">${stats.totalAssessments}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-item-label">Avg Accuracy</div>
                        <div class="stat-item-value ${accuracyClass}">${stats.avgAccuracy}%</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-item-label">Avg WPM</div>
                        <div class="stat-item-value">${stats.avgWpm}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-item-label">Prosody</div>
                        <div class="stat-item-value">${stats.avgProsody}</div>
                    </div>
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
function showStudentProfile(studentId) {
    const student = getStudent(studentId);
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

// Render student summary
function renderStudentSummary(student) {
    const stats = getStudentStats(student);
    const initial = student.name.charAt(0).toUpperCase();

    studentStatsSummary.innerHTML = `
        <div class="summary-header">
            <div class="summary-avatar">${initial}</div>
            <div class="summary-info">
                <h3>${student.name}</h3>
                <div class="summary-meta">
                    ${student.grade || 'Grade not set'} •
                    Added ${new Date(student.dateAdded).toLocaleDateString()}
                </div>
            </div>
        </div>
        <div class="summary-stats-grid">
            <div class="summary-stat-box">
                <div class="summary-stat-label">Total Assessments</div>
                <div class="summary-stat-value">${stats.totalAssessments}</div>
            </div>
            <div class="summary-stat-box">
                <div class="summary-stat-label">Avg Accuracy</div>
                <div class="summary-stat-value">${stats.avgAccuracy}%</div>
            </div>
            <div class="summary-stat-box">
                <div class="summary-stat-label">Avg WPM</div>
                <div class="summary-stat-value">${stats.avgWpm}</div>
            </div>
            <div class="summary-stat-box">
                <div class="summary-stat-label">Avg Prosody</div>
                <div class="summary-stat-value">${stats.avgProsody}</div>
            </div>
            <div class="summary-stat-box">
                <div class="summary-stat-label">Latest Accuracy</div>
                <div class="summary-stat-value">${stats.latestAccuracy}%</div>
            </div>
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

    assessmentHistory.innerHTML = '<h3>📈 Assessment History</h3>' + sortedAssessments.map(assessment => {
        const date = new Date(assessment.date);
        const dateStr = date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        const accuracy = assessment.accuracy || 0;
        let scoreClass = 'excellent';
        if (accuracy >= 95) scoreClass = 'excellent';
        else if (accuracy >= 85) scoreClass = 'good';
        else if (accuracy >= 75) scoreClass = 'fair';
        else scoreClass = 'poor';

        const totalErrors = (assessment.errors.skippedWords?.length || 0) +
                           (assessment.errors.misreadWords?.length || 0) +
                           (assessment.errors.substitutedWords?.length || 0);

        return `
            <div class="assessment-item">
                <div class="assessment-header">
                    <div class="assessment-date">📅 ${dateStr}</div>
                    <div class="assessment-score ${scoreClass}">${accuracy.toFixed(1)}%</div>
                </div>
                <div class="assessment-details">
                    <div class="assessment-detail">
                        <div class="assessment-detail-label">Correct</div>
                        <div class="assessment-detail-value">${assessment.correctCount}</div>
                    </div>
                    <div class="assessment-detail">
                        <div class="assessment-detail-label">Total Words</div>
                        <div class="assessment-detail-value">${assessment.totalWords}</div>
                    </div>
                    <div class="assessment-detail">
                        <div class="assessment-detail-label">Errors</div>
                        <div class="assessment-detail-value">${totalErrors}</div>
                    </div>
                    <div class="assessment-detail">
                        <div class="assessment-detail-label">WPM</div>
                        <div class="assessment-detail-value">${assessment.wpm || 'N/A'}</div>
                    </div>
                    <div class="assessment-detail">
                        <div class="assessment-detail-label">Prosody</div>
                        <div class="assessment-detail-value">${assessment.prosodyScore ? assessment.prosodyScore.toFixed(1) : 'N/A'}</div>
                    </div>
                </div>
                <div class="assessment-actions">
                    <button class="btn btn-danger btn-small delete-assessment-btn" data-assessment-id="${assessment.id}">
                        <span class="icon">🗑️</span> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');

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

// Update student dropdown in results section
function updateStudentDropdown() {
    if (!studentSelect) return;

    const students = getAllStudents();
    const studentArray = Object.values(students).sort((a, b) => a.name.localeCompare(b.name));

    studentSelect.innerHTML = '<option value="">-- Choose Student --</option>' +
        studentArray.map(s => `<option value="${s.id}">${s.name} (${s.grade || 'No grade'})</option>`).join('');
}

// Save current assessment to student
function saveCurrentAssessmentToStudent() {
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

    // Prepare assessment data
    const assessmentData = {
        correctCount: state.latestAnalysis.correctCount,
        totalWords: state.latestExpectedWords ? state.latestExpectedWords.length : 0,
        accuracy: state.latestAnalysis.correctCount / (state.latestExpectedWords?.length || 1) * 100,
        wpm: state.latestProsodyMetrics?.wpm || 0,
        prosodyScore: state.latestProsodyMetrics?.prosodyScore || 0,
        errors: state.latestAnalysis.errors,
        duration: state.recordingDuration || 60
    };

    const success = addAssessmentToStudent(selectedStudentId, assessmentData);

    if (success) {
        const student = getStudent(selectedStudentId);
        saveStatus.textContent = `✓ Assessment saved to ${student.name}'s profile!`;
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
function confirmAddStudent() {
    const name = studentNameInput.value.trim();
    const grade = studentGradeInput.value.trim();

    if (!name) {
        alert('Please enter a student name');
        return;
    }

    addStudent(name, grade);
    closeAddStudentModal();
    renderStudentsGrid();
    updateStudentDropdown();
    updateAssessmentStudentDropdown();
}

// Delete current student
function deleteCurrentStudent() {
    if (!currentViewingStudentId) return;

    const student = getStudent(currentViewingStudentId);
    if (!student) return;

    if (confirm(`Are you sure you want to delete ${student.name} and all their assessments? This cannot be undone.`)) {
        deleteStudent(currentViewingStudentId);
        showClassOverview();
    }
}

// ============ ASSESSMENT STUDENT SELECTION ============

// Update assessment student dropdown
function updateAssessmentStudentDropdown() {
    if (!assessmentStudentSelect) return;

    const students = getAllStudents();
    const studentArray = Object.values(students).sort((a, b) => a.name.localeCompare(b.name));

    assessmentStudentSelect.innerHTML = '<option value="">-- Choose Student --</option>' +
        studentArray.map(s => `<option value="${s.id}">${s.name} (${s.grade || 'No grade'})</option>`).join('');
}

// Handle assessment student selection
function selectAssessmentStudent() {
    const studentId = assessmentStudentSelect.value;

    if (!studentId) {
        state.currentAssessmentStudentId = null;
        hideSelectedStudentDisplay();
        hideCurrentStudentIndicator();
        return;
    }

    const student = getStudent(studentId);
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
function autoSaveAssessmentIfStudentSelected() {
    if (!state.currentAssessmentStudentId || !state.latestAnalysis) {
        return;
    }

    // Prepare assessment data
    const assessmentData = {
        correctCount: state.latestAnalysis.correctCount,
        totalWords: state.latestExpectedWords ? state.latestExpectedWords.length : 0,
        accuracy: state.latestAnalysis.correctCount / (state.latestExpectedWords?.length || 1) * 100,
        wpm: state.latestProsodyMetrics?.wpm || 0,
        prosodyScore: state.latestProsodyMetrics?.prosodyScore || 0,
        errors: state.latestAnalysis.errors,
        duration: state.recordingDuration || 60
    };

    const success = addAssessmentToStudent(state.currentAssessmentStudentId, assessmentData);

    if (success) {
        const student = getStudent(state.currentAssessmentStudentId);

        // Show success message in the save section
        if (saveStatus) {
            saveStatus.textContent = `✓ Automatically saved to ${student.name}'s profile!`;
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
function initDatabaseFeatures() {
    // Class Overview button
    if (classOverviewBtn) {
        classOverviewBtn.addEventListener('click', showClassOverview);
    }

    // Back from class overview
    if (backFromClassBtn) {
        backFromClassBtn.addEventListener('click', () => {
            if (state.completedSteps.has('setup')) {
                goToStep('audio');
            } else {
                setupSection.classList.add('active');
                classOverviewSection.classList.remove('active');
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

    // Update student dropdowns
    updateStudentDropdown();
    updateAssessmentStudentDropdown();
}

// ============ END DATABASE FUNCTIONS ============

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        initDatabaseFeatures();
    });
} else {
    init();
    initDatabaseFeatures();
}
