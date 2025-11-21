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
    // Audio recording state
    audioStream: null,
    mediaRecorder: null,
    audioChunks: [],
    recordingTimer: null,
    recordingStartTime: null,
    recordingDuration: 0,
    recordedAudioBlob: null
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
const audioModal = document.getElementById('audio-modal');
const recordingModal = document.getElementById('recording-modal');
const audioDurationInput = document.getElementById('audio-duration');
const startRecordingBtn = document.getElementById('start-recording-btn');
const cancelRecordingBtn = document.getElementById('cancel-recording-btn');
const stopRecordingBtn = document.getElementById('stop-recording-btn');
const recordingTimer = document.getElementById('recording-timer');
const progressBar = document.getElementById('progress-bar');
const audioPlaybackSection = document.getElementById('audio-playback-section');
const audioPlayer = document.getElementById('audio-player');
const downloadAudioBtn = document.getElementById('download-audio-btn');
const analyzeAudioBtn = document.getElementById('analyze-audio-btn');

// Initialize
function init() {
    // Check if API key is already saved
    const savedKey = localStorage.getItem('googleCloudVisionApiKey');
    if (savedKey) {
        state.apiKey = savedKey;
        showCameraSection();
    }

    // Event listeners
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    captureBtn.addEventListener('click', capturePhoto);
    retakeBtn.addEventListener('click', retakePhoto);
    resetSelectionBtn.addEventListener('click', resetSelection);
    exportBtn.addEventListener('click', exportSelectedWords);
    uploadBtnCamera.addEventListener('click', () => fileInputCamera.click());
    uploadBtnImage.addEventListener('click', () => fileInputImage.click());
    fileInputCamera.addEventListener('change', handleFileUpload);
    fileInputImage.addEventListener('change', handleFileUpload);

    // Audio recording event listeners
    recordAudioBtn.addEventListener('click', openAudioModal);
    startRecordingBtn.addEventListener('click', startRecording);
    cancelRecordingBtn.addEventListener('click', closeAudioModal);
    stopRecordingBtn.addEventListener('click', stopRecording);
    downloadAudioBtn.addEventListener('click', downloadRecordedAudio);
    analyzeAudioBtn.addEventListener('click', analyzeRecordedAudio);
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
    cameraSection.classList.add('active');
    initCamera();
}

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

        // Switch to image section
        cameraSection.classList.remove('active');
        imageSection.classList.add('active');

        // Process OCR
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

    // Switch to image section
    cameraSection.classList.remove('active');
    imageSection.classList.add('active');

    // Process OCR
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
        showStatus(`Found ${words.length} words in this image`, '');

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
        ctx.drawImage(img, 0, 0);

        // Draw word boundaries (green boxes for all detected words)
        if (state.ocrData && state.ocrData.words) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
            ctx.lineWidth = 1;

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

    // Click event for deselecting words
    canvas.addEventListener('click', handleWordClick);

    listenersAttached = true;
}

function handleWordClick(e) {
    const clickPoint = getCanvasPoint(e);
    const clickedWordIndex = findWordAtPoint(clickPoint);

    if (clickedWordIndex !== -1 && state.selectedWords.has(clickedWordIndex)) {
        // Word is selected, so deselect it
        state.selectedWords.delete(clickedWordIndex);
        updateWordCount();
        redrawCanvas();
        console.log('Deselected word at index:', clickedWordIndex);
    }
}

function handleStart(e) {
    e.preventDefault();
    state.isDrawing = true;
    state.wasDragged = false;
    state.startPoint = getCanvasPoint(e);
    state.endPoint = state.startPoint;

    console.log('Started at:', state.startPoint);
}

function handleMove(e) {
    if (!state.isDrawing) return;
    e.preventDefault();

    state.wasDragged = true;
    state.endPoint = getCanvasPoint(e);
    drawSelectionLine();
}

function handleEnd(e) {
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

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function drawSelectionLine() {
    redrawCanvas();

    const canvas = document.getElementById('selection-canvas');
    const ctx = canvas.getContext('2d');

    // Draw thick line from start to end
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(state.startPoint.x, state.startPoint.y);
    ctx.lineTo(state.endPoint.x, state.endPoint.y);
    ctx.stroke();

    // Draw larger circles at start and end for better visibility
    ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;

    // Start circle
    ctx.beginPath();
    ctx.arc(state.startPoint.x, state.startPoint.y, 15, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // End circle
    ctx.beginPath();
    ctx.arc(state.endPoint.x, state.endPoint.y, 15, 0, 2 * Math.PI);
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
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                } else {
                    // Subtle boundaries for unselected words
                    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                }
            });
        }
    };
    img.src = state.capturedImage;
}

function updateWordCount() {
    wordCountDisplay.textContent = state.selectedWords.size;
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
    const duration = parseInt(audioDurationInput.value);

    if (duration < 1 || duration > 5) {
        alert('Please enter a duration between 1 and 5 minutes');
        return;
    }

    try {
        // Request microphone access
        state.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Initialize MediaRecorder
        state.mediaRecorder = new MediaRecorder(state.audioStream);
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
    audioPlayer.src = url;
    audioPlaybackSection.classList.add('active');

    // Scroll to audio section
    audioPlaybackSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

                console.log('Audio blob size:', state.recordedAudioBlob.size);
                console.log('Audio blob type:', state.recordedAudioBlob.type);
                console.log('Base64 audio length:', base64Audio.length);

                // Prepare API request
                const requestBody = {
                    config: {
                        encoding: 'WEBM_OPUS',
                        sampleRateHertz: 48000,
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

                // Call Google Cloud Speech-to-Text API with word-level details
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
                        wordInfo.push({
                            word: wordData.word,
                            confidence: wordData.confidence || 1.0,
                            startTime: wordData.startTime,
                            endTime: wordData.endTime
                        });
                    });
                }
            });

            console.log('Word-level info with timing:', wordInfo);

            // Get expected text from highlighted words
            const selectedIndices = Array.from(state.selectedWords).sort((a, b) => a - b);
            const expectedWords = selectedIndices.map(index => state.ocrData.words[index].text);

            // Analyze pronunciation by comparing expected vs spoken words
            const analysis = analyzePronunciation(expectedWords, wordInfo);

            // Display results with pronunciation analysis
            displayPronunciationResults(expectedWords, wordInfo, analysis);

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

// Normalize word for comparison (remove punctuation, lowercase)
function normalizeWord(word) {
    return word.toLowerCase().replace(/[^\w]/g, '');
}

// Check if two words are similar enough (allowing for minor pronunciation differences)
function wordsAreSimilar(expected, spoken) {
    const exp = normalizeWord(expected);
    const spk = normalizeWord(spoken);

    if (exp === spk) return true;

    const maxLen = Math.max(exp.length, spk.length);
    const distance = levenshteinDistance(exp, spk);
    const similarity = 1 - (distance / maxLen);

    // Allow up to 25% difference for minor mispronunciations
    return similarity >= 0.75;
}

// Detect if word is a filler word indicating hesitation
function isFillerWord(word) {
    const fillers = ['um', 'uh', 'er', 'ah', 'hmm', 'like', 'you know'];
    return fillers.includes(normalizeWord(word));
}

// Detect if there's a long pause (hesitation)
function detectHesitation(wordInfo, index) {
    if (index === 0) return false;

    const currentWord = wordInfo[index];
    const previousWord = wordInfo[index - 1];

    // Check if there's timing info and calculate pause
    if (currentWord.startTime && previousWord.endTime) {
        const pauseDuration = parseFloat(currentWord.startTime) - parseFloat(previousWord.endTime);
        // Pause longer than 1 second indicates hesitation
        return pauseDuration > 1.0;
    }

    return false;
}

// Analyze pronunciation by comparing expected vs spoken words
function analyzePronunciation(expectedWords, spokenWordInfo) {
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
        if (i > 0 && normalizeWord(spokenWordInfo[i].word) === normalizeWord(spokenWordInfo[i - 1].word)) {
            analysis.errors.repeatedWords.push({
                spokenIndex: i,
                word: word.word
            });
        }
    }

    // Second pass: Align expected with spoken, detecting specific errors
    for (let i = 0; i < expectedWords.length; i++) {
        const expected = expectedWords[i];

        // Check if we've run out of spoken words
        if (spokenIndex >= spokenWordInfo.length) {
            analysis.aligned.push({
                expected: expected,
                spoken: null,
                status: 'skipped',
                errorType: 'skipped_word',
                index: i
            });
            analysis.errors.skippedWords.push(i);
            continue;
        }

        // Skip over filler words and repeated words in spoken
        while (spokenIndex < spokenWordInfo.length &&
               (isFillerWord(spokenWordInfo[spokenIndex].word) ||
                (spokenIndex > 0 && normalizeWord(spokenWordInfo[spokenIndex].word) ===
                 normalizeWord(spokenWordInfo[spokenIndex - 1].word)))) {
            spokenIndex++;
        }

        if (spokenIndex >= spokenWordInfo.length) {
            analysis.aligned.push({
                expected: expected,
                spoken: null,
                status: 'skipped',
                errorType: 'skipped_word',
                index: i
            });
            analysis.errors.skippedWords.push(i);
            continue;
        }

        const spoken = spokenWordInfo[spokenIndex];
        const expNorm = normalizeWord(expected);
        const spkNorm = normalizeWord(spoken.word);

        // Exact match
        if (expNorm === spkNorm) {
            analysis.aligned.push({
                expected: expected,
                spoken: spoken.word,
                status: 'correct',
                confidence: spoken.confidence,
                index: i
            });
            analysis.correctCount++;
            spokenIndex++;
        }
        // Similar but not exact - misread
        else if (wordsAreSimilar(expected, spoken.word)) {
            analysis.aligned.push({
                expected: expected,
                spoken: spoken.word,
                status: 'misread',
                errorType: 'misread_word',
                confidence: spoken.confidence,
                index: i
            });
            analysis.errors.misreadWords.push({
                index: i,
                expected: expected,
                spoken: spoken.word
            });
            spokenIndex++;
        }
        // Look ahead to see if word was skipped
        else {
            let foundLater = false;

            // Look ahead up to 5 words in spoken
            for (let j = 1; j <= Math.min(5, spokenWordInfo.length - spokenIndex); j++) {
                if (normalizeWord(spokenWordInfo[spokenIndex + j].word) === expNorm) {
                    // Expected word found later - current spoken word is substituted
                    analysis.aligned.push({
                        expected: expected,
                        spoken: spoken.word,
                        status: 'substituted',
                        errorType: 'substituted_word',
                        confidence: spoken.confidence,
                        index: i
                    });
                    analysis.errors.substitutedWords.push({
                        index: i,
                        expected: expected,
                        spoken: spoken.word
                    });
                    spokenIndex++;
                    foundLater = true;
                    break;
                }
            }

            if (!foundLater) {
                // Expected word not found - it was skipped
                analysis.aligned.push({
                    expected: expected,
                    spoken: null,
                    status: 'skipped',
                    errorType: 'skipped_word',
                    index: i
                });
                analysis.errors.skippedWords.push(i);
                // Don't increment spokenIndex - reuse this spoken word for next expected
            }
        }
    }

    // Third pass: Detect skipped lines (3+ consecutive skipped words)
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

    // Fourth pass: Detect repeated phrases (2+ consecutive words repeated)
    for (let i = 0; i < spokenWordInfo.length - 2; i++) {
        const word1 = normalizeWord(spokenWordInfo[i].word);
        const word2 = normalizeWord(spokenWordInfo[i + 1].word);

        // Look for same 2-word phrase later
        for (let j = i + 2; j < spokenWordInfo.length - 1; j++) {
            const laterWord1 = normalizeWord(spokenWordInfo[j].word);
            const laterWord2 = normalizeWord(spokenWordInfo[j + 1].word);

            if (word1 === laterWord1 && word2 === laterWord2) {
                analysis.errors.repeatedPhrases.push({
                    phrase: `${spokenWordInfo[i].word} ${spokenWordInfo[i + 1].word}`,
                    firstIndex: i,
                    secondIndex: j
                });
                break;
            }
        }
    }

    console.log('Detailed pronunciation analysis:', analysis);
    return analysis;
}

// Display pronunciation analysis results
function displayPronunciationResults(expectedWords, spokenWordInfo, analysis) {
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
        <h3>🎯 Pronunciation Analysis</h3>
        <div class="audio-analysis-result">
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
}

// Initialize on load
init();
