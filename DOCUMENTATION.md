# Word Analyzer - Technical Documentation

**Version**: 3.2.11
**Last Updated**: November 25, 2025

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [State Management](#state-management)
4. [Step Navigation System](#step-navigation-system)
5. [API Integration](#api-integration)
6. [Event Handling](#event-handling)
7. [Canvas Operations](#canvas-operations)
8. [Audio Processing](#audio-processing)
9. [Analysis Algorithm](#analysis-algorithm)
10. [Export Functions](#export-functions)
11. [Styling System](#styling-system)
12. [Security Considerations](#security-considerations)

---

## Architecture Overview

### Design Pattern
- **Pattern**: Single Page Application (SPA)
- **Framework**: Vanilla JavaScript (no dependencies)
- **State**: Centralized state object
- **UI**: Event-driven with DOM manipulation
- **Navigation**: Breadcrumb-based step system

### Key Principles
1. **Progressive Enhancement**: Core features work without advanced APIs
2. **Mobile First**: Touch events prioritized over mouse
3. **Defensive Programming**: Null checks on all DOM operations
4. **User Guidance**: Visual feedback at every step
5. **Error Recovery**: Graceful degradation on failures

---

## File Structure

### HTML (`index.html`)
```
<!DOCTYPE html>
├── <head>
│   ├── Meta tags (viewport, mobile-web-app)
│   ├── styles.css link
│   └── Title & theme color
├── <body>
│   ├── Container
│   │   ├── Header (Title + Word Count)
│   │   ├── Breadcrumb Navigation (5 steps)
│   │   ├── Main Content
│   │   │   ├── Audio Playback Section (legacy)
│   │   │   ├── Setup Section (API Key)
│   │   │   ├── Camera Section (Step 1)
│   │   │   ├── Audio Section (Step 2)
│   │   │   ├── Image Section (Step 3)
│   │   │   └── Results Section (Step 4)
│   │   └── Footer (Hints + Version)
│   ├── Modals
│   │   ├── Audio Recording Modal
│   │   ├── Recording Status Indicator
│   │   └── Image Preview Modal
│   ├── External Scripts (jsPDF)
│   └── app.js
```

### JavaScript (`app.js` - 2,600+ lines)

**Structure**:
```javascript
// 1. State Definition (lines 1-35)
const state = { ... }

// 2. DOM Element References (lines 36-92)
const elements = { ... }

// 3. Initialization (lines 93-150)
function init() { ... }

// 4. Step Management (lines 170-450)
- goToStep()
- updateBreadcrumb()
- canAccessStep()
- updateButtonStates()

// 5. Camera & Image Processing (lines 451-650)
- initCamera()
- capturePhoto()
- handleFileUpload()
- processOCR()

// 6. Canvas Drawing (lines 651-1000)
- drawImageWithWords()
- handleStart(), handleMove(), handleEnd()
- selectWordsBetweenPoints()
- redrawCanvas()

// 7. Audio Recording (lines 1001-1250)
- openAudioModal()
- startRecording()
- stopRecording()
- displayRecordedAudio()

// 8. Audio Analysis (lines 1251-1850)
- analyzeRecordedAudio()
- analyzePronunciation()
- alignWords()

// 9. Results Display (lines 1851-2075)
- displayPronunciationResults()
- downloadAnalysisAsPDF()

// 10. Video Generation (lines 2076-2603)
- generateTranscriptVideo()
- generateTranscriptVideoCore()
```

### CSS (`styles.css` - 900+ lines)

**Organization**:
```css
/* 1. Reset & Base Styles */
/* 2. Breadcrumb Navigation */
/* 3. Step Headers & Badges */
/* 4. Requirements Checklist */
/* 5. Audio Recording Container */
/* 6. Step Navigation Buttons */
/* 7. Button States & Tooltips */
/* 8. Image Preview & Canvas */
/* 9. Results Display */
/* 10. Modals & Overlays */
/* 11. Mobile Responsive */
```

---

## State Management

### State Object
```javascript
const state = {
    // API Configuration
    apiKey: null,

    // Image Capture
    stream: null,
    capturedImage: null,
    ocrData: null,

    // Word Selection
    selectedWords: new Set(),
    isDrawing: false,
    wasDragged: false,
    startPoint: null,
    endPoint: null,

    // Zoom & Pan
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartPoint: null,

    // Audio Recording
    audioStream: null,
    mediaRecorder: null,
    audioChunks: [],
    recordingTimer: null,
    recordingStartTime: null,
    recordingDuration: 0,
    recordedAudioBlob: null,

    // Analysis Results
    latestAnalysis: null,
    latestExpectedWords: null,
    latestSpokenWords: null,

    // Step Management
    currentStep: 'setup',
    completedSteps: new Set(),
    stepsOrder: ['setup', 'capture', 'audio', 'highlight', 'results']
};
```

### State Flow
```
1. Setup → apiKey stored in localStorage
2. Capture → capturedImage, stream closed
3. OCR → ocrData populated
4. Audio → recordedAudioBlob, audioChunks
5. Highlight → selectedWords Set
6. Analyze → latestAnalysis, latestExpectedWords, latestSpokenWords
7. Results → Display from latestAnalysis
```

---

## Step Navigation System

### Breadcrumb States
```javascript
// State Classes
.breadcrumb-step.completed   // Green, clickable
.breadcrumb-step.current      // Blue, highlighted
.breadcrumb-step.available    // Light blue, clickable
.breadcrumb-step.locked       // Grey, disabled
```

### Navigation Logic
```javascript
function goToStep(step) {
    // 1. Update state.currentStep
    // 2. Hide all sections
    // 3. Show target section
    // 4. Run step-specific setup
    // 5. Update breadcrumb
    // 6. Update button states
    // 7. Scroll to top
}

function canAccessStep(step) {
    // Validation rules:
    // - capture: requires setup complete
    // - audio: requires capturedImage
    // - highlight: requires ocrData
    // - results: requires latestAnalysis
}
```

### Step Completion Tracking
```javascript
// Completed steps stored in Set
state.completedSteps.add('setup');
state.completedSteps.add('capture');
state.completedSteps.add('audio');
state.completedSteps.add('highlight');

// Check completion
if (state.completedSteps.has('audio')) { ... }
```

---

## API Integration

### Google Cloud Vision API

**Endpoint**: `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`

**Request**:
```javascript
{
    requests: [{
        image: {
            content: base64Image  // Base64 encoded image
        },
        features: [{
            type: 'DOCUMENT_TEXT_DETECTION'
        }]
    }]
}
```

**Response Processing**:
```javascript
// Extract words with bounding boxes
pages.forEach(page => {
    page.blocks.forEach(block => {
        block.paragraphs.forEach(paragraph => {
            paragraph.words.forEach(word => {
                const text = word.symbols.map(s => s.text).join('');
                const vertices = word.boundingBox.vertices;

                // Store word data
                words.push({
                    text: text,
                    bbox: {
                        x0: Math.min(...xs),
                        y0: Math.min(...ys),
                        x1: Math.max(...xs),
                        y1: Math.max(...ys)
                    },
                    confidence: word.confidence
                });
            });
        });
    });
});
```

### Google Cloud Speech-to-Text API

**Endpoint**: `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`

**Request**:
```javascript
{
    config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableWordTimeOffsets: true,
        model: 'latest_long'
    },
    audio: {
        content: base64Audio  // Base64 encoded audio
    }
}
```

**Response Processing**:
```javascript
// Extract words with timing
const transcript = data.results
    .map(result => result.alternatives[0].transcript)
    .join(' ');

const wordInfo = data.results
    .flatMap(result => result.alternatives[0].words || [])
    .map(word => ({
        word: word.word,
        startTime: parseFloat(word.startTime.replace('s', '')),
        endTime: parseFloat(word.endTime.replace('s', ''))
    }));
```

---

## Event Handling

### Canvas Interaction

**Mouse Events**:
```javascript
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);
canvas.addEventListener('click', handleWordClick);
canvas.addEventListener('contextmenu', preventContextMenu);
```

**Touch Events**:
```javascript
canvas.addEventListener('touchstart', handleStart);
canvas.addEventListener('touchmove', handleMove);
canvas.addEventListener('touchend', handleEnd);
```

**Coordinate Transformation**:
```javascript
function getCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Get client coordinates
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    // Convert to canvas coordinates
    const screenX = (clientX - rect.left) * scaleX;
    const screenY = (clientY - rect.top) * scaleY;

    // Account for zoom and pan
    return {
        x: (screenX - state.panX) / state.zoom,
        y: (screenY - state.panY) / state.zoom
    };
}
```

---

## Canvas Operations

### Drawing Workflow
```javascript
1. Load image
2. Draw image to canvas (with zoom/pan transform)
3. Draw word boundaries (green rectangles)
4. Draw selected words (yellow fill)
5. Draw selection line (if active)
```

### Zoom & Pan Implementation
```javascript
// Apply transformations
ctx.save();
ctx.translate(state.panX, state.panY);
ctx.scale(state.zoom, state.zoom);

// Draw content
ctx.drawImage(img, 0, 0);

// Restore context
ctx.restore();
```

### Word Selection Algorithm
```javascript
function selectWordsBetweenPoints() {
    const words = state.ocrData.words;

    // Find words at start and end points
    const startWordIndex = findWordAtPoint(state.startPoint);
    const endWordIndex = findWordAtPoint(state.endPoint);

    // Select all words in range
    for (let i = startWordIndex; i <= endWordIndex; i++) {
        state.selectedWords.add(i);
    }
}

function findWordAtPoint(point) {
    return state.ocrData.words.findIndex(word => {
        const center = {
            x: (word.bbox.x0 + word.bbox.x1) / 2,
            y: (word.bbox.y0 + word.bbox.y1) / 2
        };
        const distance = Math.sqrt(
            Math.pow(point.x - center.x, 2) +
            Math.pow(point.y - center.y, 2)
        );
        return distance < 50; // Tolerance
    });
}
```

---

## Audio Processing

### Recording Flow
```javascript
1. Request microphone access
   → navigator.mediaDevices.getUserMedia()

2. Create MediaRecorder
   → new MediaRecorder(stream, { mimeType: 'audio/webm' })

3. Collect chunks
   → mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data)

4. Stop recording
   → mediaRecorder.stop()

5. Create Blob
   → new Blob(audioChunks, { type: 'audio/webm' })

6. Convert to Base64
   → FileReader.readAsDataURL(blob)
```

### Audio Constraints
```javascript
{
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
        channelCount: 1
    }
}

// Bitrate: 32000 bps (reduced to avoid file size errors)
```

---

## Analysis Algorithm

### Word Alignment (Dynamic Programming)
```javascript
function alignWords(expectedWords, spokenWords) {
    // 1. Normalize words (lowercase, remove punctuation)
    // 2. Build DP matrix for edit distance
    // 3. Traceback to find alignment path
    // 4. Classify each word as: correct, skipped, misread, substituted

    const dp = Array(expected.length + 1)
        .fill(null)
        .map(() => Array(spoken.length + 1).fill(0));

    // Fill DP matrix
    for (let i = 0; i <= expected.length; i++) {
        for (let j = 0; j <= spoken.length; j++) {
            if (i === 0) dp[i][j] = j;
            else if (j === 0) dp[i][j] = i;
            else {
                const match = wordsMatch(expected[i-1], spoken[j-1]) ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i-1][j] + 1,      // Deletion (skip)
                    dp[i][j-1] + 1,      // Insertion
                    dp[i-1][j-1] + match // Match/Substitution
                );
            }
        }
    }

    // Traceback to get alignment
    return traceback(dp, expected, spoken);
}
```

### Error Detection
```javascript
// Skipped Words: Expected but not spoken
// Misread Words: Spoken incorrectly
// Substituted Words: Different word spoken
// Repeated Phrases: Same phrase spoken multiple times
// Skipped Lines: 3+ consecutive skipped words
```

---

## Export Functions

### PDF Generation (html2pdf)
```javascript
function downloadAnalysisAsHtml2Pdf() {
    // 1. Disable button, show "⏳ Generating..." state
    // 2. Create themed purple loading overlay (prevents visual glitches)
    // 3. Create hidden print container with report HTML
    // 4. Use html2canvas to capture content
    // 5. Generate PDF blob
    // 6. Open PDF in new browser tab
    // 7. Trigger automatic download
    // 8. Clean up overlay and restore button state

    // Button states during generation:
    pdfBtn.disabled = true;
    pdfBtn.innerHTML = '<span class="icon">⏳</span> Generating...';
    pdfBtn.style.background = '#6c757d'; // Grey

    // Loading overlay (app-themed purple gradient)
    overlay.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

    // Output: Opens in new tab AND downloads
    window.open(pdfUrl, '_blank');
    downloadLink.click();
}
```

### Video Generation (Canvas + MediaRecorder)
```javascript
async function generateTranscriptVideoCore() {
    // 1. Create off-screen canvas
    // 2. Setup audio context
    // 3. Create MediaRecorder for canvas stream
    // 4. Render frames (30 fps)
    // 5. Highlight current word based on time
    // 6. Stop when audio ends
    // 7. Create Blob and download link

    const stream = canvas.captureStream(30);
    const audioTrack = audioContext.createMediaStreamSource();
    stream.addTrack(audioTrack);

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();

    // Render loop
    setInterval(() => {
        renderFrame(currentTime);
    }, frameInterval);
}
```

---

## Styling System

### CSS Custom Properties
```css
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --success-color: #28a745;
    --error-color: #dc3545;
    --warning-color: #ffc107;
}
```

### Responsive Breakpoints
```css
/* Mobile First */
@media (max-width: 768px) {
    /* Tablet and below */
}

@media (max-width: 480px) {
    /* Phone */
}
```

### Animation System
```css
/* Smooth transitions */
transition: all 0.3s ease;

/* Breadcrumb hover */
transform: translateY(-2px);
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

/* Canvas expand */
transition: max-height 0.3s ease;
```

---

## Security Considerations

### Input Validation
```javascript
// API Key
- Stored in localStorage only
- Never sent to non-Google servers
- Validated before API calls

// File Upload
- Accept only image/* types
- Validate file type before processing
- No server-side upload (client-only)

// Audio Recording
- User permission required
- Data sent only to Google Cloud
- Not stored permanently
```

### XSS Prevention
```javascript
// Use textContent instead of innerHTML when possible
element.textContent = userInput;

// Sanitize when HTML needed
const sanitized = text.replace(/[<>]/g, '');
```

### CORS & HTTPS
- App must run on HTTPS for camera/microphone
- Google APIs require valid CORS headers
- GitHub Pages provides HTTPS automatically

### Audio Data Privacy (COPPA/FERPA Compliance)

**Design Principle**: Audio recordings are processed transiently and NEVER persisted to any database.

**Data Flow**:
```
1. Student speaks → Audio captured in browser memory (MediaRecorder)
2. Recording stops → Audio Blob created in browser memory
3. Analysis requested → Audio converted to Base64, sent to Google Speech-to-Text API
4. Google processes → Returns transcript + word timing data
5. Analysis complete → Audio Blob is discarded from memory
6. Only text results → Transcript and analysis metrics saved to Firestore
```

**What IS Stored in Database**:
- Text transcripts (words recognized)
- Analysis metrics (accuracy %, WPM, prosody score)
- Error details (skipped words, misread words as text)
- Assessment timestamps

**What is NOT Stored**:
- Audio recordings (never saved to Firestore or Firebase Storage)
- Voice data in any form
- Audio file references or URLs

**Compliance Benefits**:
- **COPPA**: Voice recordings are "personal information" requiring parental consent. No storage = no consent complexity.
- **FERPA**: Student voice recordings are "education records" requiring protection. No storage = no breach liability.
- **Data Minimization**: Only essential analysis results are retained.
- **No Retention Limits**: Without audio storage, no need for retention/deletion policies for recordings.

**Implementation Notes**:
```javascript
// In saveCurrentAssessmentToStudent():
// Audio is explicitly excluded from saved assessment data
const assessmentData = {
    correctCount: analysis.correctCount,
    totalWords: analysis.totalWords,
    accuracy: analysis.accuracy,
    wpm: analysis.wpm,
    // Note: No audio/audioBlob field - audio is NOT stored
};
```

---

## Performance Optimization

### Lazy Loading
- Canvas only drawn when visible
- OCR triggered after capture
- Audio processing on-demand

### Debouncing
- Window resize events debounced
- Canvas redraw throttled during pan

### Memory Management
```javascript
// Clean up media streams
if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
}

// Revoke object URLs
URL.revokeObjectURL(audioUrl);

// Clear large data on reset
state.audioChunks = [];
state.recordedAudioBlob = null;
```

---

## Deployment

### GitHub Pages Setup
```bash
# 1. Push to main branch
git push origin main

# 2. Enable GitHub Pages
Settings → Pages → Source: main branch

# 3. Access at:
https://lbranigan.github.io/word-counter/
```

### Local Development
```bash
# HTTP Server (Python)
python -m http.server 8000

# HTTP Server (Node)
npx http-server

# HTTPS Tunnel (for camera testing)
npx localtunnel --port 8000
```

---

## Testing Checklist

See `QA-CHECKLIST.md` for comprehensive testing procedures.

---

## Changelog

See commit history for detailed changes:
https://github.com/LBranigan/word-counter/commits/main

---

**Documentation maintained by**: Claude Code (Anthropic)
**Last review**: November 25, 2025
