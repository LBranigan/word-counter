// App State
const state = {
    apiKey: null,
    stream: null,
    capturedImage: null,
    ocrData: null,
    selectedWords: new Set(),
    isDrawing: false,
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
    }

    // Touch events
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd, { passive: false });

    // Mouse events
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);

    listenersAttached = true;
}

function handleStart(e) {
    e.preventDefault();
    state.isDrawing = true;
    state.startPoint = getCanvasPoint(e);
    state.endPoint = state.startPoint;

    console.log('Started at:', state.startPoint);
}

function handleMove(e) {
    if (!state.isDrawing) return;
    e.preventDefault();

    state.endPoint = getCanvasPoint(e);
    drawSelectionLine();
}

function handleEnd(e) {
    if (!state.isDrawing) return;
    e.preventDefault();

    state.isDrawing = false;
    state.endPoint = getCanvasPoint(e);

    console.log('Ended at:', state.endPoint);

    // Select words between start and end
    selectWordsBetweenPoints();

    // Redraw with highlighted words
    redrawCanvas();
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

    if (!state.apiKey) {
        alert('API key is required for audio analysis');
        return;
    }

    showStatus('Converting audio to speech using Google Speech-to-Text...', 'processing');

    try {
        // Convert WebM to base64
        const reader = new FileReader();
        reader.readAsDataURL(state.recordedAudioBlob);

        reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];

            // Call Google Cloud Speech-to-Text API
            const response = await fetch(
                `https://speech.googleapis.com/v1/speech:recognize?key=${state.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        config: {
                            encoding: 'WEBM_OPUS',
                            sampleRateHertz: 48000,
                            languageCode: 'en-US',
                            enableAutomaticPunctuation: true,
                        },
                        audio: {
                            content: base64Audio
                        }
                    })
                }
            );

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message);
            }

            if (!data.results || data.results.length === 0) {
                showStatus('No speech detected in the audio. Please try recording again with clearer audio.', 'error');
                return;
            }

            // Extract transcript
            const transcript = data.results
                .map(result => result.alternatives[0].transcript)
                .join(' ');

            // Count words
            const words = transcript.trim().split(/\s+/);
            const wordCount = words.length;

            // Display results
            exportOutput.innerHTML = `
                <h3>Audio Analysis Results</h3>
                <div class="audio-analysis-result">
                    <div class="stat">
                        <span class="stat-label">Words Detected:</span>
                        <span class="stat-value">${wordCount}</span>
                    </div>
                    <div class="transcript-section">
                        <strong>Transcript:</strong>
                        <div class="word-list">${transcript}</div>
                    </div>
                </div>
            `;
            exportOutput.classList.add('active');

            // Update word count display
            wordCountDisplay.textContent = wordCount;

            showStatus(`Analysis complete! Found ${wordCount} words in your recording.`, '');

            // Scroll to results
            exportOutput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

    } catch (error) {
        console.error('Speech-to-Text error:', error);
        showStatus('Error analyzing audio: ' + error.message, 'error');
    }
}

// Initialize on load
init();
