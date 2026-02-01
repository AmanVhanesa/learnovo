const mongoose = require('mongoose');
const User = require('../models/User');
const TeacherSubjectAssignment = require('../models/TeacherSubjectAssignment');
const Class = require('../models/Class');
const Section = require('../models/Section');
const dotenv = require('dotenv');

dotenv.config({ path: './config.env' });

const debug = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Find the teacher "Tania Mittal" from the screenshot
        const teacher = await User.findOne({
            $or: [
                { fullName: /Tania/i },
                { name: /Tania/i },
                { email: /tania/i } // Assuming email might match
            ],
            role: 'teacher'
        });

        if (!teacher) {
            console.log('Teacher Tania not found!');
            return;
        }
        console.log('Teacher Found:', teacher.name || teacher.fullName, teacher._id);
        console.log('Teacher Tenant:', teacher.tenantId);

        // 2b. Check Class Teacher field
        console.log('Class Teacher Field:', teacher.classTeacher);

        // 3. Find new assignments
        const assignments = await TeacherSubjectAssignment.find({
            teacherId: teacher._id
        });
        console.log(`Found ${assignments.length} assignments for this teacher.`);

        const allAssignments = await TeacherSubjectAssignment.countDocuments({});
        console.log(`Total TeacherSubjectAssignment docs in DB: ${allAssignments}`);

        const teachersWithAssignedClasses = await User.countDocuments({ role: 'teacher', assignedClasses: { $not: { $size: 0 } } });
        console.log(`Teachers with legacy assignedClasses: ${teachersWithAssignedClasses}`);

        // 4. Check Class collection for classTeacher or embedded subjects
        console.log('Checking Class collection for embedded assignments...');
        const classesByteacher = await Class.find({
            tenantId: teacher.tenantId,
            $or: [
                { classTeacher: teacher._id },
                { 'subjects.teacher': teacher._id }
            ]
        });

        console.log(`Found ${classesByteacher.length} classes where teacher is assigned in Class model.`);
        classesByteacher.forEach(c => {
            console.log(`- Class: ${c.name} (Grade: ${c.grade})`);
            if (c.classTeacher && c.classTeacher.toString() === teacher._id.toString()) {
                console.log('  -> Is Class Teacher');
            }
            if (c.subjects && Array.isArray(c.subjects)) {
                c.subjects.forEach(s => {
                    if (s.teacher && s.teacher.toString() === teacher._id.toString()) {
                        console.log(`  -> Subject Teacher for: ${s.name} (${s.subject ? s.subject : 'No Ref'})`);
                    }
                });
            }
        });

        if (assignments.length > 0) {
            for (const assign of assignments) {
                console.log('--- Assignment ---');
                console.log('ClassId:', assign.classId);
                console.log('SectionId:', assign.sectionId);

                // Get Class details
                const cls = await Class.findById(assign.classId);
                console.log('Resolved Class Name:', cls ? cls.name : 'NOT FOUND');

                // Get Section details
                if (assign.sectionId) {
                    const sec = await Section.findById(assign.sectionId);
                    console.log('Resolved Section Name:', sec ? sec.name : 'NOT FOUND');
                }

                // 4. Try to find students matching this assignment via ObjectId
                const countById = await User.countDocuments({
                    role: 'student',
                    classId: assign.classId,
                    tenantId: teacher.tenantId
                });
                console.log(`Students matching classId=${assign.classId}: ${countById}`);

                // 5. Try to find students matching this assignment via String Name
                if (cls) {
                    const countByName = await User.countDocuments({
                        role: 'student',
                        class: cls.name, // CAREFUL: Case sensitivity or format?
                        tenantId: teacher.tenantId
                    });
                    console.log(`Students matching class="${cls.name}": ${countByName}`);

                    // Check strict match vs variations
                    const sampleStudent = await User.findOne({ role: 'student', tenantId: teacher.tenantId });
                    if (sampleStudent) {
                        console.log('Sample Student Class Value:', sampleStudent.class);
                        console.log('Sample Student ClassId Value:', sampleStudent.classId);
                    }
                }
            }
        } else {
            console.log('No TeacherSubjectAssignments found for this teacher.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
};

debug();
