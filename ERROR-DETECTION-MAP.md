# Error Detection Mechanism - Detailed Technical Map

## Overview
The Word Analyzer uses a **multi-pass analysis algorithm** with **Dynamic Programming (DP) sequence alignment** to detect reading errors. The algorithm compares expected text (from the image) with spoken words (from audio transcription).

---

## 📊 Error Categories

### 1. **Skipped Words** ⏭️
**What it is:** Words in the text that were NOT read aloud

**How detected:**
- DP alignment identifies expected words with no matching spoken word
- Added when alignment path chooses "skip" action

**Example:**
- Text: "The quick brown fox"
- Spoken: "The brown fox"
- Error: "quick" was skipped

---

### 2. **Misread Words** 📖
**What it is:** Words that were read but pronounced incorrectly (similar enough to recognize the attempt)

**How detected:**
- Uses **Levenshtein Distance** (edit distance) algorithm
- Checks if words are similar enough despite differences
- Similarity threshold: **≥ 60%** (allows up to 40% character differences)

**Similarity Calculation:**
```
similarity = 1 - (levenshtein_distance / max_word_length)
```

**Examples:**
- "intelligent" → "intelloogin" (60%+ similar = misread)
- "cat" → "dog" (0% similar = substitution, not misread)
- "running" → "runing" (misread due to missing 'n')

**Match Score in DP:**
- Perfect match: **+1.0**
- Similar (misread): **+0.3**
- Not similar: **-1.0**

---

### 3. **Substituted Words** 🔄
**What it is:** Words that were replaced with completely different words (no similarity)

**How detected:**
- DP alignment matches positions but words are NOT similar
- Similarity < 60% threshold

**Examples:**
- "cat" → "dog"
- "house" → "building"
- "run" → "walk"

**Note:** The current implementation classifies these as "misread" if matched by DP. Consider reviewing alignment logic in app.js:1860-1873

---

### 4. **Hesitations** ⏸️
**What it is:** Pauses or filler words during reading

**Two types detected:**

#### A. Filler Words
**List of detected fillers:**
- "um", "uh", "er", "ah", "hmm", "like", "you know"

**How detected:** Direct string matching after normalization

#### B. Long Pauses
**Threshold:** > 1.0 second between words

**How detected:**
- Uses timing data from Google Speech-to-Text API
- Calculates pause: `currentWord.startTime - previousWord.endTime`
- If > 1 second, marks as hesitation

---

### 5. **Repeated Words** 🔁
**What it is:** Same word said twice or more consecutively

**How detected:**
- Compares each spoken word with previous word
- After normalization, if identical = repeated

**Example:**
- Spoken: "the the cat"
- Error: "the" repeated

**Processing:** Repeated words are removed during cleaning (Pass 2) and flagged as errors

---

### 6. **Skipped Lines** 📄 (CRITICAL)
**What it is:** Multiple consecutive words skipped (indicates line/sentence skipped)

**Threshold:** **≥ 3 consecutive skipped words**

**How detected:**
- Counts consecutive words with status = 'skipped' in alignment
- If count ≥ 3, flags as skipped line

**Example:**
- Text: "The quick brown fox jumps over the lazy dog"
- Spoken: "The quick over the lazy dog"
- Error: Skipped line detected ("brown fox jumps" = 3 words)

---

### 7. **Repeated Phrases** 🔂
**What it is:** Multi-word phrases repeated more than expected

**Detection method:**
- Builds map of 2-word phrases and occurrence counts
- Compares spoken phrase counts vs expected phrase counts
- Only flags if spoken has MORE repetitions than expected

**Example:**
- Text: "the cat sat"
- Spoken: "the cat the cat sat"
- Error: "the cat" repeated

---

## 🔄 Processing Pipeline (5 Passes)

### **Pass 1: Pre-Processing & Detection**
**What happens:**
1. Scan all spoken words
2. Detect hesitations (filler words & long pauses)
3. Detect repeated words

**Functions used:**
- `isFillerWord()`: Checks against filler list
- `detectHesitation()`: Checks pause duration
- Compares consecutive words for repetition

---

### **Pass 2: Cleaning Spoken Words**
**What happens:**
1. Create `cleanSpoken` array
2. Remove filler words (already flagged as errors)
3. Remove repeated words (already flagged as errors)

**Purpose:** Prepare clean data for alignment

**Code location:** app.js:1759-1773

---

### **Pass 3: Dynamic Programming Alignment** ⚡
**What happens:** Find optimal word-by-word alignment between expected and spoken text

**Algorithm:** Sequence alignment using DP table

**DP Table Structure:**
```
dp[i][j] = best alignment score for:
  - expected words [0...i-1]
  - spoken words [0...j-1]
```

**Penalties/Scores:**
- Skip expected word: **-1.0** (major penalty)
- Insert extra spoken word: **-0.5** (minor penalty)
- Perfect match: **+1.0**
- Similar match (misread): **+0.3**
- Mismatch: **-1.0**

**Three alignment options at each step:**

1. **Match/Mismatch** (align expected[i-1] with spoken[j-1])
   - Score: `dp[i-1][j-1] + matchScore`

2. **Skip** (expected word not said)
   - Score: `dp[i-1][j] - 1.0`

3. **Insert** (extra spoken word)
   - Score: `dp[i][j-1] - 0.5`

**Backtracking:** After DP table is filled, backtrack from `dp[m][n]` to `dp[0][0]` following path to reconstruct optimal alignment

**Code location:** app.js:1775-1895

---

### **Pass 4: Skipped Line Detection**
**What happens:**
1. Scan through alignment results
2. Count consecutive skipped words
3. If ≥ 3 consecutive, flag as skipped line

**Code location:** app.js:1898-1925

---

### **Pass 5: Repeated Phrase Detection**
**What happens:**
1. Build phrase count maps for both expected and spoken text
2. Compare counts
3. Flag phrases with extra repetitions in spoken text

**Code location:** app.js:1927-2000+

---

## 🔍 Helper Functions

### `normalizeWord(word)`
**Purpose:** Standardize words for comparison

**Process:**
1. Convert to lowercase
2. Remove punctuation
3. Handle number ↔ word conversion
   - "10" → "ten"
   - "ten" → "ten"

**Code location:** app.js:1604-1624

---

### `wordsAreSimilar(expected, spoken)`
**Purpose:** Determine if a misread word is "close enough"

**Algorithm:**
1. Normalize both words
2. Calculate Levenshtein distance
3. Calculate similarity: `1 - (distance / maxLength)`
4. Return true if similarity ≥ 60%

**Code location:** app.js:1627-1644

---

### `levenshteinDistance(str1, str2)`
**Purpose:** Calculate minimum edit operations needed to transform str1 → str2

**Operations counted:**
- Insertion
- Deletion
- Substitution

**Example:**
- "cat" → "bat" = 1 (substitute c→b)
- "running" → "runing" = 1 (delete one 'n')

**Code location:** app.js:1545-1573

---

## 📈 Accuracy Calculation

```javascript
correctCount = number of perfect matches
totalWords = number of expected words
majorErrors = skippedWords + misreadWords + substitutedWords

accuracy = (correctCount / totalWords) × 100%
```

**Important:** Hesitations, repetitions, and repeated phrases do NOT count toward major errors in accuracy calculation

---

## 🎯 Current Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Similarity threshold | 60% | app.js:1643 |
| Misread match score | +0.3 | app.js:1808 |
| Perfect match score | +1.0 | app.js:1806 |
| Mismatch score | -1.0 | app.js:1810 |
| Skip penalty | -1.0 | app.js:1818 |
| Insert penalty | -0.5 | app.js:1821 |
| Pause threshold (hesitation) | 1.0 second | app.js:1667 |
| Skipped line threshold | 3 words | app.js:1907 |
| Low confidence threshold | 0.85 | app.js:1725 |

---

## 🔧 Potential Improvements

### 1. **Distinguish Misread vs Substitution**
**Current issue:** Both are handled similarly in DP matching

**Suggestion:** Add explicit substitution detection:
- If DP matches but similarity < 60%, classify as substitution
- If DP matches and 60% ≤ similarity < 100%, classify as misread

### 2. **Confidence-Based Error Weighting**
**Current:** Low confidence threshold (0.85) is defined but not actively used

**Suggestion:**
- Weight errors by Google's confidence score
- Lower confidence = more likely to be recognition error vs actual reading error

### 3. **Context-Aware Similarity**
**Current:** Each word compared independently

**Suggestion:**
- Consider surrounding words for context
- "read" (reed) vs "read" (red) depending on context

### 4. **Adjustable Thresholds**
**Suggestion:** Allow users/educators to adjust:
- Similarity threshold (currently 60%)
- Pause threshold (currently 1.0s)
- Skipped line threshold (currently 3 words)

---

## 📝 Data Flow Summary

```
1. User captures image
   ↓
2. Google Vision API extracts text → expectedWords[]
   ↓
3. User records audio
   ↓
4. Google Speech-to-Text transcribes → spokenWordInfo[]
   ↓
5. analyzePronunciation(expectedWords, spokenWordInfo)
   ↓
   Pass 1: Detect hesitations & repetitions
   Pass 2: Clean spoken words (remove fillers & repeats)
   Pass 3: DP alignment (match expected ↔ spoken)
   Pass 4: Detect skipped lines
   Pass 5: Detect repeated phrases
   ↓
6. Generate analysis object with error counts
   ↓
7. Display results to user
```

---

## 🎓 For Educators

**Key Error Types to Focus On:**

1. **Skipped Words/Lines** - May indicate:
   - Difficulty with specific words
   - Lost place in text
   - Intentional skipping of challenging content

2. **Misread Words** - May indicate:
   - Phonics/decoding difficulties
   - Unfamiliar vocabulary
   - Vision issues

3. **Hesitations** - May indicate:
   - Processing time needed
   - Uncertainty
   - Word recognition challenges

4. **Substitutions** - May indicate:
   - Guessing based on context
   - Sight word confusion
   - Comprehension over accuracy

---

**Generated:** 2025-01-22
**Version:** 2.0
