// App State
const state = {
    apiKey: null,
    stream: null,
    capturedImage: null,
    ocrData: null,
    selectedWords: new Set(),
    isDrawing: false,
    startPoint: null,
    endPoint: null
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
const wordCountHeaderDisplay = document.getElementById('word-count-header');
const statusDisplay = document.getElementById('status');

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
        selectionCanvas.width = img.width;
        selectionCanvas.height = img.height;

        const ctx = selectionCanvas.getContext('2d');
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

// Setup Canvas Touch/Mouse Interaction
function setupCanvasInteraction() {
    const canvas = document.getElementById('selection-canvas');

    // Remove old listeners by cloning, but preserve the canvas content
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    // Replace canvas with clone
    canvas.replaceWith(canvas.cloneNode(true));
    const newCanvas = document.getElementById('selection-canvas');

    // Restore the content
    newCanvas.width = tempCanvas.width;
    newCanvas.height = tempCanvas.height;
    const ctx = newCanvas.getContext('2d');
    ctx.drawImage(tempCanvas, 0, 0);

    // Touch events
    newCanvas.addEventListener('touchstart', handleStart, { passive: false });
    newCanvas.addEventListener('touchmove', handleMove, { passive: false });
    newCanvas.addEventListener('touchend', handleEnd, { passive: false });

    // Mouse events
    newCanvas.addEventListener('mousedown', handleStart);
    newCanvas.addEventListener('mousemove', handleMove);
    newCanvas.addEventListener('mouseup', handleEnd);
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
    wordCountHeaderDisplay.textContent = state.selectedWords.size;
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

// Initialize on load
init();
