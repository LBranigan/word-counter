# Word Analyzer - Reading Fluency Assessment Tool

A comprehensive web application for Morningside Academy that combines audio recording, OCR text detection, and speech analysis to evaluate student reading performance and track progress longitudinally.

## Live Demo

🌐 **https://lbranigan.github.io/word-counter/**

## Purpose

A complete reading fluency assessment platform for teachers to:
- Record students reading aloud
- Compare spoken words to written text
- Calculate accuracy, WPM, and prosody scores
- Track individual student progress over time
- Identify specific pronunciation errors
- Generate detailed reports

**Typical Workflow:**
1. Teacher selects student (e.g., "Jose")
2. Student reads aloud from physical text (30s/1min/2min)
3. Teacher captures photo of the text
4. Teacher highlights what was read
5. App analyzes audio vs. text
6. Results automatically save to Jose's profile
7. Teacher views Jose's progress over time

## Key Features

### 🎤 Audio Recording & Analysis
- Record students reading aloud
- Configurable duration (30 seconds, 1 minute, 2 minutes)
- Speech-to-Text transcription
- Word-by-word comparison
- Download audio files

### 📸 Image Capture & OCR
- Camera capture or file upload
- Google Cloud Vision API (99%+ accuracy)
- Automatic word detection with bounding boxes
- Zoom and pan controls
- Touch and mouse selection

### 📊 Comprehensive Analysis
- **Accuracy**: Percentage of words read correctly
- **WPM**: Words per minute calculation
- **Prosody Score**: Reading fluency rating (1-5 scale)
- **Error Detection**:
  - Skipped words
  - Misread words
  - Substituted words
  - Hesitations
  - Repeated words/phrases
  - Skipped lines (critical errors)

### 👥 Student Database & Tracking
- Create student profiles
- Track assessments longitudinally
- View individual student progress
- Class Overview with all students
- Color-coded performance indicators
- Sample students pre-loaded (Susan, Jose, Timmy)

### 🎯 Teacher-Friendly Workflow
- Student-first: Select student before assessment
- Auto-save: Assessments save automatically
- Step-by-step guided process
- Breadcrumb navigation
- Clear instructions at each step

### 📤 Export & Reporting
- Download assessment as PDF
- Download audio recordings
- Generate transcript video
- Export word lists
- View detailed error breakdowns

## Quick Start

### 1. Get Google Cloud API Keys

You need TWO API keys from Google Cloud:

#### A. Cloud Vision API (for text detection)
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Create an API key
4. Enable "Cloud Vision API"
5. **Cost**: 1,000 requests/month FREE

#### B. Cloud Speech-to-Text API (for audio analysis)
1. Same Google Cloud project
2. Use the same API key
3. Enable "Cloud Speech-to-Text API"
4. **Cost**: 60 minutes/month FREE, then $0.006 per 15 seconds

**Estimated Monthly Cost** (100 students, 4 assessments each):
- Vision API: FREE (400 < 1,000)
- Speech-to-Text: ~$144 (~400 minutes)
- **Total**: ~$144/month

### 2. Use the App

1. **Open App**: https://lbranigan.github.io/word-counter/
2. **Enter API Key**: One-time setup (stored locally)
3. **Select Student**: Choose from dropdown or add new
4. **Record Audio**: Student reads aloud (pick duration)
5. **Capture Image**: Photo of the text
6. **Highlight Text**: Select what was read
7. **View Results**: Automatic analysis with all metrics
8. **Auto-Saved**: Assessment saves to student profile

## How It Works

### Step 1: Record Audio
- Student reads from physical text
- Teacher records using microphone
- Choose duration: 30s, 1min, or 2min
- Audio quality: 32 kbps (optimized for speech)
- Can download recording for records
- Collapsible "Need help?" instructions (click to expand)

### Step 2: Capture Image
- Take photo of the physical text
- Or upload existing image
- Google Vision API detects all words
- Green boxes show detected words
- Typically processes in 1-3 seconds

### Step 3: Highlight Text
- Select the exact portion that was read
- Drag gesture: Swipe from first to last word
- Click gesture: Click individual words
- Zoom controls for accuracy
- Pan with right-click or shift+drag
- Real-time word count in header

### Step 4: Analysis & Results
- Audio transcribed with Speech-to-Text API
- Compares spoken words to highlighted text
- Identifies all error types
- Calculates accuracy percentage
- Computes words per minute (WPM)
- Rates prosody (reading fluency)
- Color-codes results (green/yellow/red)

### Step 5: Auto-Save
- If student was selected, assessment auto-saves
- Manual save option if no student selected
- All data stored locally in browser
- No cloud storage or server required

## Student Database

### Class Overview
- Grid of all students with avatar initials
- Summary stats for each student:
  - Total assessments
  - Average accuracy
  - Average WPM
  - Average prosody
- Click any student to view full profile
- Add new students anytime

### Student Profiles
- Individual page for each student
- Complete assessment history
- Longitudinal progress tracking
- Each assessment shows:
  - Date and time
  - Accuracy percentage (color-coded)
  - Correct words / Total words
  - Error count breakdown
  - WPM and Prosody scores
- Delete assessments or entire profile
- Navigate back to Class Overview

### Sample Students
Three sample students are pre-loaded to demonstrate features:
- **Susan** (3rd Grade): High performer, 3 assessments, 95-97% accuracy
- **Jose** (3rd Grade): Improving, 4 assessments, 78% → 88% accuracy
- **Timmy** (2nd Grade): Needs support, 2 assessments, 76-77% accuracy

## User Interface

### Header
- App title and school name
- Current student indicator (when selected)
- Class Overview button
- Real-time word count

### Breadcrumb Navigation
Shows progress through workflow:
- Setup ✓ → Audio → Capture → Highlight → Results
- Click completed steps to navigate
- Current step highlighted
- Locked steps show requirements

### Responsive Design
- Mobile-first approach
- Works on phones, tablets, desktops
- Touch and mouse input
- Optimized for classroom iPads/Chromebooks

## Privacy & Security

- **Client-Side Only**: No backend server
- **Local Storage**: All student data stays on your device
- **No Cloud Database**: Data never uploaded to cloud
- **No User Accounts**: No login or authentication
- **Device-Local**: Data only on the device using the app
- **Teacher Control**: Delete any data anytime
- **HTTPS**: Secure connection (required for camera/mic)
- **Google APIs**: Images and audio sent to Google for processing only

**Important**: Data does NOT sync across devices. Each device has its own local database.

## Browser Compatibility

**Recommended:**
- Chrome (Desktop & Mobile)
- Safari (iOS & macOS)
- Edge (Desktop)

**Requirements:**
- Modern browser with ES6 support
- HTTPS (provided by GitHub Pages)
- Camera and microphone permissions
- localStorage support

**Not Tested:**
- Internet Explorer (not supported)
- Older browsers (may not work)

## Technical Details

### Architecture
- **Type**: Progressive Web App (PWA-ready)
- **Stack**: Vanilla JavaScript, HTML5, CSS3 (no frameworks)
- **APIs**: Google Cloud Vision + Speech-to-Text
- **Storage**: localStorage (IndexedDB could be added)
- **Hosting**: GitHub Pages (free, automatic HTTPS)

### Code Stats
- **Lines of Code**: ~6,000 total
  - app.js: ~3,600 lines
  - styles.css: ~2,000 lines
  - index.html: ~400 lines
- **Dependencies**: html2pdf.js (PDF generation only)
- **Bundle Size**: Minimal (no webpack/build process)

### Data Structure
```javascript
// localStorage: wordAnalyzerStudents
{
  "student-001": {
    id: "student-001",
    name: "Jose",
    grade: "3rd Grade",
    dateAdded: 1737849600000,
    assessments: [
      {
        id: "assessment-123",
        date: 1737849600000,
        correctCount: 88,
        totalWords: 100,
        accuracy: 88.0,
        wpm: 108,
        prosodyScore: 3.7,
        errors: { ... },
        duration: 60
      }
    ]
  }
}
```

## Troubleshooting

### Camera Not Working
- Ensure HTTPS (http:// won't work)
- Check browser camera permissions
- Try different browser (Chrome recommended)
- Use upload option as fallback

### Microphone Not Working
- Grant microphone permission in browser
- Check system sound settings
- Ensure not muted
- Try different browser

### OCR Not Detecting Words
- Ensure good lighting
- Hold camera steady
- Use high-contrast text (black on white)
- Avoid glare/reflections
- Try uploading clearer image

### Audio Analysis Errors
- Record in quiet environment
- Speak clearly at moderate pace
- Check microphone quality
- Ensure audio is audible on playback
- Try shorter duration first

### API Key Errors
- Verify key is correct (no extra spaces)
- Enable both APIs in Google Cloud Console
- Check API quotas not exceeded
- Ensure billing enabled (for Speech-to-Text)

### Student Data Not Saving
- Check localStorage not disabled
- Clear browser cache and retry
- Ensure not in private/incognito mode
- Check browser storage not full

### Performance Issues
- Close other browser tabs
- Clear browser cache
- Use modern device (2018+)
- Check internet connection speed

## For Developers

### Local Development
```bash
# Clone repository
git clone https://github.com/LBranigan/word-counter.git
cd word-counter

# Start local server
python -m http.server 8000
# or
npx http-server -p 8000

# Open browser
open http://localhost:8000
```

### Testing on Mobile (HTTPS required)
```bash
# Create HTTPS tunnel
npx localtunnel --port 8000

# Use provided HTTPS URL on phone
# Example: https://smooth-sheep-42.loca.lt
```

### Project Structure
```
word-analyzer/
├── index.html          # Main HTML
├── styles.css          # All styling
├── app.js             # All JavaScript logic
├── README.md          # This file
├── MANIFEST.md        # Project manifest
├── QA_CHECKLIST.md    # Testing checklist
└── .gitignore         # Git ignore rules
```

### Contributing
1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly (see QA_CHECKLIST.md)
5. Submit pull request

### Code Style
- Vanilla JavaScript (ES6+)
- 4-space indentation
- Semicolons required
- Clear function names
- Comments on complex logic
- Modular functions

## Support & Feedback

- **Issues**: [GitHub Issues](https://github.com/LBranigan/word-counter/issues)
- **Repository**: [github.com/LBranigan/word-counter](https://github.com/LBranigan/word-counter)
- **Documentation**: See MANIFEST.md for detailed project info
- **Testing**: See QA_CHECKLIST.md for comprehensive test scenarios

## Version History

### v3.2.12 (Current) - November 25, 2025
- ✅ Collapsible instructions on Step 1 (Record Audio) - cleaner UI
- ✅ "Need help?" toggle button with smooth expand/collapse animation
- ✅ Accessibility improvements (aria-expanded, focus styles, touch targets)
- ✅ Reduced motion support for users with motion sensitivity

### v3.2.11 - November 25, 2025
- ✅ PDF opens in new browser tab AND downloads automatically
- ✅ PDF generation shows themed purple loading screen (no visual glitches)
- ✅ PDF button shows "⏳ Generating..." state while loading
- ✅ Export Words now works for historical assessments
- ✅ Removed "Oral Fluency Analysis" header from results page
- ✅ XSS sanitization for user-provided data
- ✅ Debug logging with toggleable flag
- ✅ Lazy-loaded video generator module for better performance

### v2.2 - November 24, 2025
- ✅ Fixed PDF generation on mobile devices
- ✅ Fixed tap-to-deselect on touch devices after auto-detect
- ✅ Tooltip displays for 4 seconds on mobile

### v2.1 - January 24, 2025
- ✅ Interactive word tooltips (hover/touch to see error details)
- ✅ Phonetic matching for proper names (e.g., Graham/gram)
- ✅ Improved auto-detect first word detection
- ✅ Fixed audio player timeline display
- ✅ Export Words downloads .txt file
- ✅ Streamlined PDF generation (html2pdf only)
- ✅ UI improvements to results page action bar

### v2.0 - January 2025
- ✅ Audio recording and playback
- ✅ Speech-to-Text analysis
- ✅ Pronunciation error detection
- ✅ WPM and prosody calculation
- ✅ Student database with localStorage
- ✅ Class Overview and student profiles
- ✅ Student-first assessment workflow
- ✅ Auto-save functionality
- ✅ Longitudinal progress tracking
- ✅ PDF export with complete analysis
- ✅ Transcript video generation
- ✅ Breadcrumb navigation
- ✅ Sample students pre-loaded

### v1.0 - January 2025
- ✅ Basic word counting
- ✅ Camera capture
- ✅ OCR with Google Vision API
- ✅ Touch-based word selection
- ✅ Export word lists

## License

This project was created for Morningside Academy.

Co-developed with Claude Code (AI pair programming).

## Credits

- **Google Cloud Vision API**: Text detection
- **Google Cloud Speech-to-Text API**: Audio transcription
- **html2pdf.js**: PDF generation
- **GitHub Pages**: Hosting
- **Claude Code**: AI pair programming assistant

---

## FAQ

**Q: Does this work offline?**
A: No, it requires internet for Google APIs (OCR and Speech-to-Text).

**Q: Is student data secure?**
A: Yes, all data stored locally on your device. Nothing uploaded to cloud.

**Q: Can I use this on multiple devices?**
A: Yes, but data doesn't sync. Each device has separate database.

**Q: How much does it cost?**
A: Free for low usage. ~$144/month for 100 students x 4 assessments.

**Q: Can I delete student data?**
A: Yes, delete individual assessments or entire student profiles anytime.

**Q: What if I lose my device?**
A: Data is device-local, so it would be lost. Export PDFs for records.

**Q: Can students use this themselves?**
A: Designed for teachers. Students need supervision for recording.

**Q: Does it support other languages?**
A: Currently English only. Speech-to-Text API supports others.

**Q: Can I export all student data?**
A: Currently no bulk export. Feature could be added.

**Q: Is there a mobile app?**
A: No, but web app works great on mobile browsers.

---

**Ready to transform reading assessment at your school?**
Start here: https://lbranigan.github.io/word-counter/
