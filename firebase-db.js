// Student Database — stored on this device (localStorage).
// (Historical name: data used to live in Firestore. The Firebase project was
// deleted in 2026; the filename and export names are kept so app.js and
// firebase-wrappers.js imports stay unchanged. The storage key matches the
// app's original pre-Firebase localStorage schema.)
import { debugLog, debugError } from './utils.js';

const STORAGE_KEY = 'wordAnalyzerStudents';

function readStore() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (error) {
        debugError('Error reading student store:', error);
        return {};
    }
}

function writeStore(students) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

// Get all students
export async function getAllStudents() {
    return readStore();
}

// Save all students (merge)
export async function saveAllStudents(students) {
    try {
        const store = readStore();
        Object.entries(students).forEach(([studentId, studentData]) => {
            store[studentId] = { ...(store[studentId] || {}), ...studentData };
        });
        writeStore(store);
        debugLog('All students saved successfully');
    } catch (error) {
        debugError('Error saving students:', error);
        throw error;
    }
}

// Add new student
export async function addStudent(name, grade = '') {
    try {
        const studentId = 'student-' + Date.now();
        const store = readStore();

        store[studentId] = {
            id: studentId,
            name: name,
            grade: grade,
            dateAdded: Date.now(),
            assessments: []
        };

        writeStore(store);
        debugLog('Student added:', name);
        return studentId;
    } catch (error) {
        debugError('Error adding student:', error);
        throw error;
    }
}

// Get student by ID
export async function getStudent(studentId) {
    return readStore()[studentId] || null;
}

// Update student
export async function updateStudent(studentId, updates) {
    try {
        const store = readStore();
        if (!store[studentId]) return false;
        store[studentId] = { ...store[studentId], ...updates };
        writeStore(store);
        debugLog('Student updated:', studentId);
        return true;
    } catch (error) {
        debugError('Error updating student:', error);
        return false;
    }
}

// Delete student
export async function deleteStudent(studentId) {
    try {
        const store = readStore();
        delete store[studentId];
        writeStore(store);
        debugLog('Student deleted:', studentId);
        return true;
    } catch (error) {
        debugError('Error deleting student:', error);
        return false;
    }
}

// Add assessment to student
export async function addAssessmentToStudent(studentId, assessmentData) {
    try {
        const store = readStore();
        const student = store[studentId];
        if (!student) {
            debugError('Student not found:', studentId);
            return false;
        }

        // Ensure assessments array exists (for older student records)
        if (!student.assessments) {
            student.assessments = [];
        }

        const assessment = {
            id: 'assessment-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            date: Date.now(),
            ...assessmentData
        };

        student.assessments.push(assessment);
        writeStore(store);

        debugLog('Assessment added to student:', studentId);
        return true;
    } catch (error) {
        debugError('Error adding assessment:', error);
        return false;
    }
}

// Delete assessment from student
export async function deleteAssessment(studentId, assessmentId) {
    try {
        const store = readStore();
        const student = store[studentId];
        if (!student) {
            return false;
        }

        student.assessments = (student.assessments || []).filter(a => a.id !== assessmentId);
        writeStore(store);

        debugLog('Assessment deleted:', assessmentId);
        return true;
    } catch (error) {
        debugError('Error deleting assessment:', error);
        return false;
    }
}

// Get student statistics
export function getStudentStats(student) {
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

// Sample students are no longer auto-created; kept as a no-op because
// app.js still calls it during initialization.
export async function initializeSampleStudents() {
    return;
}
