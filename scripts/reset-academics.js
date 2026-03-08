/**
 * Utility script to reset all academic data:
 * - Deletes all Classes
 * - Deletes all Sections
 * - Deletes all Class Subjects
 * - Deletes all Teacher Subject Assignments
 * - Removes class/section enrollment from all Students
 * 
 * Run: node scripts/reset-academics.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

const User = require('../models/User');
const Class = require('../models/Class');
const Section = require('../models/Section');
// Optional models - might not exist if feature not fully implemented
let ClassSubject, TeacherSubjectAssignment;
try { ClassSubject = require('../models/ClassSubject'); } catch (e) { }
try { TeacherSubjectAssignment = require('../models/TeacherSubjectAssignment'); } catch (e) { }

async function resetAcademics() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not defined');
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('⚠️  STARTING ACADEMIC DATA RESET ⚠️');
        console.log('-----------------------------------');

        // 1. Delete all Classes
        const classResult = await Class.deleteMany({});
        console.log(`Deleted ${classResult.deletedCount} classes`);

        // 2. Delete all Sections
        const sectionResult = await Section.deleteMany({});
        console.log(`Deleted ${sectionResult.deletedCount} sections`);

        // 3. Delete Class Subjects (if model exists)
        if (ClassSubject) {
            const csResult = await ClassSubject.deleteMany({});
            console.log(`Deleted ${csResult.deletedCount} class subjects`);
        }

        // 4. Delete Teacher Subject Assignments (if model exists)
        if (TeacherSubjectAssignment) {
            const tsaResult = await TeacherSubjectAssignment.deleteMany({});
            console.log(`Deleted ${tsaResult.deletedCount} teacher subject assignments`);
        }

        // 5. Reset Student Enrollments
        const userUpdateResult = await User.updateMany(
            { role: 'student' },
            {
                $unset: {
                    classId: 1,
                    sectionId: 1,
                    class: 1,
                    section: 1,
                    rollNumber: 1 // Also reset roll number as it depends on class/section
                }
            }
        );
        console.log(`Reset enrollment for ${userUpdateResult.modifiedCount} students`);

        console.log('-----------------------------------');
        console.log('✅ ACADEMIC DATA RESET COMPLETE');

    } catch (error) {
        console.error('❌ Error resetting academic data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit();
    }
}

resetAcademics();
