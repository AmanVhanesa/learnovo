const Homework = require('../models/Homework');
const HomeworkSubmission = require('../models/HomeworkSubmission');
const User = require('../models/User');
const Class = require('../models/Class');
const mongoose = require('mongoose');

/**
 * Resolve ObjectId(s) for a student's class.
 * Homework.class is an ObjectId ref — we must NEVER pass plain strings into it.
 */
async function resolveStudentClassIds(student, tenantId) {
    const ids = [];

    // Best case: student already has classId (ObjectId)
    if (student.classId) {
        ids.push(student.classId);
    }

    // Fallback: student has a class string — look up matching Class docs
    if (student.class && ids.length === 0) {
        try {
            const classDocs = await Class.find({
                tenantId,
                $or: [
                    { grade: student.class },
                    { name: student.class }
                ]
            }).select('_id').lean();
            classDocs.forEach(c => ids.push(c._id));
        } catch (e) {
            console.warn('Class lookup fallback failed:', e.message);
        }
    }

    return ids;
}

/**
 * Resolve ObjectId(s) for a teacher's assigned classes.
 * A teacher may have classTeacher (string) and/or assignedClasses (string[]).
 * We look up matching Class documents by name or grade.
 */
async function resolveTeacherClassIds(teacher, tenantId) {
    const classNames = new Set();

    if (teacher.classTeacher) classNames.add(teacher.classTeacher);
    if (Array.isArray(teacher.assignedClasses)) {
        teacher.assignedClasses.forEach(c => c && classNames.add(c));
    }

    if (classNames.size === 0) return [];

    try {
        const classDocs = await Class.find({
            tenantId,
            $or: [
                { name: { $in: [...classNames] } },
                { grade: { $in: [...classNames] } }
            ]
        }).select('_id').lean();
        return classDocs.map(c => c._id);
    } catch (e) {
        console.warn('Teacher class lookup failed:', e.message);
        return [];
    }
}

class HomeworkService {
    /**
     * Create new homework
     */
    async createHomework(data, teacherId, tenantId) {
        try {
            const homework = new Homework({
                ...data,
                assignedBy: teacherId,
                tenantId
            });

            await homework.save();

            await homework.populate([
                { path: 'subject', select: 'name' },
                { path: 'class', select: 'name grade' },
                { path: 'section', select: 'name' },
                { path: 'assignedBy', select: 'name email' }
            ]);

            return homework;
        } catch (error) {
            throw new Error(`Failed to create homework: ${error.message}`);
        }
    }

    /**
     * Build the student homework query robustly.
     * Students can be linked to a class via classId (ObjectId) or via the legacy `class` string field.
     * Similarly sections via sectionId or the `section` string field.
     */
    async _buildStudentQuery(userId, tenantId) {
        const student = await User.findById(userId)
            .select('classId sectionId class section')
            .lean();

        if (!student) return null;

        const query = { tenantId, isActive: true };

        // Build class matching: prefer classId (ObjectId), fall back to class name string
        const classConditions = [];
        if (student.classId) {
            classConditions.push({ class: student.classId });
        }
        if (student.class) {
            // Also try matching by grade string in case homework.class is stored differently
            classConditions.push({ class: student.class });
        }

        if (classConditions.length === 0) return null; // Student has no class assigned

        if (classConditions.length === 1) {
            Object.assign(query, classConditions[0]);
        } else {
            query.$or = classConditions;
        }

        // Build section matching: homework is shown if:
        //   (a) section matches student's sectionId or section name, OR
        //   (b) no section specified on the homework (the $or trick with null / missing)
        const sectionConditions = [];
        if (student.sectionId) {
            sectionConditions.push(student.sectionId);
        }
        if (student.section) {
            sectionConditions.push(student.section);
        }

        if (sectionConditions.length > 0) {
            // Show homework assigned to student's section OR to the whole class (no section)
            query.sectionFilter = { sectionId: student.sectionId, sectionName: student.section };
        }

        return { query, student };
    }

    /**
     * Get homework list with filters
     */
    async getHomeworkList(filters, userRole, userId, tenantId) {
        try {
            const baseQuery = { tenantId, isActive: true };

            // Role-based filtering
            if (userRole === 'teacher') {
                // Teachers see ALL homework assigned to their classes (including admin-created).
                // We match by class ObjectId resolved from the teacher's assignedClasses / classTeacher.
                const teacher = await User.findById(userId)
                    .select('assignedClasses classTeacher')
                    .lean();

                if (teacher) {
                    const classIds = await resolveTeacherClassIds(teacher, tenantId);
                    if (classIds.length > 0) {
                        // Show homework for teacher's class(es) OR homework they personally created
                        baseQuery.$or = [
                            { class: { $in: classIds } },
                            { assignedBy: userId }
                        ];
                    } else {
                        // Fallback: nothing resolved — show only their own homework
                        baseQuery.assignedBy = userId;
                    }
                } else {
                    baseQuery.assignedBy = userId;
                }
            } else if (userRole === 'student') {
                const student = await User.findById(userId)
                    .select('classId sectionId class section')
                    .lean();

                if (!student) return [];

                // Resolve to ObjectId(s) only — Homework.class is an ObjectId ref
                const classIds = await resolveStudentClassIds(student, tenantId);
                if (classIds.length === 0) return [];

                baseQuery.class = { $in: classIds };

                // Section: only use ObjectId (sectionId). String fallback not safe here.
                const sectionMatch = [];
                if (student.sectionId) sectionMatch.push(student.sectionId);

                if (sectionMatch.length > 0) {
                    baseQuery.$or = [
                        { section: { $in: sectionMatch } },
                        { section: null },
                        { section: { $exists: false } }
                    ];
                }
            }

            // Additional teacher/admin filters
            if (filters.subject) baseQuery.subject = filters.subject;
            if (filters.class) baseQuery.class = filters.class;
            if (filters.section) baseQuery.section = filters.section;
            if (filters.startDate || filters.endDate) {
                baseQuery.assignedDate = {};
                if (filters.startDate) baseQuery.assignedDate.$gte = new Date(filters.startDate);
                if (filters.endDate) baseQuery.assignedDate.$lte = new Date(filters.endDate);
            }

            const homework = await Homework.find(baseQuery)
                .populate('subject', 'name')
                .populate('class', 'name grade')
                .populate('section', 'name')
                .populate('assignedBy', 'name email')
                .sort({ assignedDate: -1 })
                .lean();

            // For teachers, add submission statistics
            if (userRole === 'teacher') {
                for (let hw of homework) {
                    const submissions = await HomeworkSubmission.countDocuments({
                        homeworkId: hw._id,
                        status: { $in: ['submitted', 'reviewed'] }
                    });

                    // Count students in the class/section using flexible matching
                    const classId = hw.class?._id || hw.class;
                    const sectionId = hw.section?._id || hw.section;

                    const studentQuery = {
                        tenantId,
                        role: 'student',
                        isActive: true
                    };

                    if (classId) {
                        studentQuery.$or = [
                            { classId: classId },
                            { class: hw.class?.grade || hw.class?.name }
                        ];
                    }

                    if (sectionId) {
                        studentQuery.sectionId = sectionId;
                    }

                    const totalStudents = await User.countDocuments(studentQuery);

                    hw.submissionStats = {
                        submitted: submissions,
                        total: totalStudents
                    };
                }
            }

            // For students, add submission status
            if (userRole === 'student') {
                for (let hw of homework) {
                    const submission = await HomeworkSubmission.findOne({
                        homeworkId: hw._id,
                        studentId: userId
                    }).select('status submittedAt teacherFeedback grade');

                    hw.mySubmission = submission;
                }
            }

            return homework;
        } catch (error) {
            throw new Error(`Failed to fetch homework: ${error.message}`);
        }
    }

    /**
     * Get homework by ID
     */
    async getHomeworkById(id, userId, userRole, tenantId) {
        try {
            const homework = await Homework.findOne({ _id: id, tenantId })
                .populate('subject', 'name')
                .populate('class', 'name grade')
                .populate('section', 'name')
                .populate('assignedBy', 'name email')
                .lean();

            if (!homework) {
                throw new Error('Homework not found');
            }

            if (userRole === 'student') {
                const submission = await HomeworkSubmission.findOne({
                    homeworkId: id,
                    studentId: userId
                });
                homework.mySubmission = submission;
            }

            if (userRole === 'teacher') {
                const submissions = await HomeworkSubmission.find({
                    homeworkId: id
                })
                    .populate('studentId', 'name admissionNumber')
                    .sort({ submittedAt: -1 })
                    .lean();

                homework.submissions = submissions;
            }

            return homework;
        } catch (error) {
            throw new Error(`Failed to fetch homework: ${error.message}`);
        }
    }

    /**
     * Update homework
     */
    async updateHomework(id, data, teacherId, tenantId) {
        try {
            const homework = await Homework.findOne({
                _id: id,
                tenantId,
                assignedBy: teacherId
            });

            if (!homework) {
                throw new Error('Homework not found or unauthorized');
            }

            Object.assign(homework, data);
            await homework.save();

            await homework.populate([
                { path: 'subject', select: 'name' },
                { path: 'class', select: 'name grade' },
                { path: 'section', select: 'name' },
                { path: 'assignedBy', select: 'name email' }
            ]);

            return homework;
        } catch (error) {
            throw new Error(`Failed to update homework: ${error.message}`);
        }
    }

    /**
     * Delete homework (hard delete)
     */
    async deleteHomework(id, teacherId, tenantId) {
        try {
            const homework = await Homework.findOne({
                _id: id,
                tenantId,
                assignedBy: teacherId
            });

            if (!homework) {
                throw new Error('Homework not found or unauthorized');
            }

            await HomeworkSubmission.deleteMany({ homeworkId: id, tenantId });
            await Homework.deleteOne({ _id: id });

            return { message: 'Homework and all submissions deleted permanently' };
        } catch (error) {
            throw new Error(`Failed to delete homework: ${error.message}`);
        }
    }

    /**
     * Submit homework (student)
     */
    async submitHomework(homeworkId, studentId, data, tenantId) {
        try {
            const homework = await Homework.findOne({ _id: homeworkId, tenantId, isActive: true });
            if (!homework) {
                throw new Error('Homework not found');
            }

            let submission = await HomeworkSubmission.findOne({ homeworkId, studentId, tenantId });

            if (submission) {
                submission.submissionText = data.submissionText;
                submission.attachments = data.attachments || [];
                submission.status = 'submitted';
                submission.submittedAt = new Date();
            } else {
                submission = new HomeworkSubmission({
                    homeworkId,
                    studentId,
                    tenantId,
                    submissionText: data.submissionText,
                    attachments: data.attachments || [],
                    status: 'submitted',
                    submittedAt: new Date()
                });
            }

            await submission.save();
            await submission.populate('studentId', 'name admissionNumber');

            return submission;
        } catch (error) {
            throw new Error(`Failed to submit homework: ${error.message}`);
        }
    }

    /**
     * Get submissions for a homework (teacher)
     * Teachers can view submissions for any homework assigned to their class,
     * including homework created by the admin.
     */
    async getSubmissions(homeworkId, teacherId, tenantId) {
        try {
            // First try to find homework directly
            const homework = await Homework.findOne({ _id: homeworkId, tenantId });

            if (!homework) {
                throw new Error('Homework not found');
            }

            // Authorization: teacher must have created it OR it must be for their class
            const isCreator = homework.assignedBy.toString() === teacherId.toString();
            if (!isCreator) {
                const teacher = await User.findById(teacherId)
                    .select('assignedClasses classTeacher')
                    .lean();
                const classIds = await resolveTeacherClassIds(teacher || {}, tenantId);
                const isForTeacherClass = classIds.some(
                    id => id.toString() === (homework.class?.toString() || '')
                );
                if (!isForTeacherClass) {
                    throw new Error('Homework not found or unauthorized');
                }
            }

            const submissions = await HomeworkSubmission.find({ homeworkId, tenantId })
                .populate('studentId', 'name admissionNumber email')
                .sort({ submittedAt: -1 })
                .lean();

            return submissions;
        } catch (error) {
            throw new Error(`Failed to fetch submissions: ${error.message}`);
        }
    }

    /**
     * Update submission feedback (teacher)
     */
    async updateSubmissionFeedback(submissionId, feedbackData, teacherId, tenantId) {
        try {
            const submission = await HomeworkSubmission.findOne({
                _id: submissionId,
                tenantId
            }).populate('homeworkId');

            if (!submission) {
                throw new Error('Submission not found');
            }

            if (submission.homeworkId.assignedBy.toString() !== teacherId.toString()) {
                throw new Error('Unauthorized');
            }

            submission.teacherFeedback = feedbackData.feedback;
            submission.grade = feedbackData.grade;
            submission.reviewedBy = teacherId;
            submission.reviewedAt = new Date();
            submission.status = 'reviewed';

            await submission.save();
            await submission.populate('studentId', 'name admissionNumber');

            return submission;
        } catch (error) {
            throw new Error(`Failed to update feedback: ${error.message}`);
        }
    }

    /**
     * Get student's submissions
     */
    async getStudentSubmissions(studentId, tenantId, filters = {}) {
        try {
            const query = { studentId, tenantId };

            if (filters.status) {
                query.status = filters.status;
            }

            const submissions = await HomeworkSubmission.find(query)
                .populate({
                    path: 'homeworkId',
                    populate: [
                        { path: 'subject', select: 'name' },
                        { path: 'class', select: 'name grade' }
                    ]
                })
                .sort({ submittedAt: -1 })
                .lean();

            return submissions;
        } catch (error) {
            throw new Error(`Failed to fetch student submissions: ${error.message}`);
        }
    }

    /**
     * Get homework statistics for dashboard
     */
    async getHomeworkStats(userId, userRole, tenantId) {
        try {
            const stats = {};

            if (userRole === 'teacher') {
                const teacher = await User.findById(userId)
                    .select('assignedClasses classTeacher')
                    .lean();

                const classIds = teacher
                    ? await resolveTeacherClassIds(teacher, tenantId)
                    : [];

                const hwFilterQuery = { tenantId, isActive: true };
                if (classIds.length > 0) {
                    hwFilterQuery.$or = [
                        { class: { $in: classIds } },
                        { assignedBy: userId }
                    ];
                } else {
                    hwFilterQuery.assignedBy = userId;
                }

                stats.totalHomework = await Homework.countDocuments(hwFilterQuery);

                const homeworkIds = await Homework.find(hwFilterQuery).distinct('_id');

                stats.pendingReviews = await HomeworkSubmission.countDocuments({
                    homeworkId: { $in: homeworkIds },
                    status: 'submitted'
                });
            } else if (userRole === 'student') {
                const student = await User.findById(userId)
                    .select('classId sectionId class section')
                    .lean();

                if (student) {
                    const classIds = await resolveStudentClassIds(student, tenantId);

                    const hwQuery = {
                        tenantId,
                        isActive: true
                    };

                    if (classIds.length > 0) {
                        hwQuery.class = { $in: classIds };
                    }

                    const sectionMatch = [];
                    if (student.sectionId) sectionMatch.push(student.sectionId);

                    if (sectionMatch.length > 0) {
                        hwQuery.$or = [
                            { section: { $in: sectionMatch } },
                            { section: null },
                            { section: { $exists: false } }
                        ];
                    }

                    const allHomework = await Homework.find(hwQuery).distinct('_id');
                    stats.totalHomework = allHomework.length;

                    const submittedIds = await HomeworkSubmission.find({
                        studentId: userId,
                        status: { $in: ['submitted', 'reviewed'] }
                    }).distinct('homeworkId');

                    stats.pendingHomework = allHomework.filter(
                        id => !submittedIds.some(subId => subId.toString() === id.toString())
                    ).length;

                    stats.submittedHomework = submittedIds.length;
                }
            }

            return stats;
        } catch (error) {
            throw new Error(`Failed to fetch homework stats: ${error.message}`);
        }
    }
}

module.exports = new HomeworkService();
