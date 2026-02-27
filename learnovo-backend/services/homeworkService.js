const Homework = require('../models/Homework');
const HomeworkSubmission = require('../models/HomeworkSubmission');
const User = require('../models/User');
const mongoose = require('mongoose');

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
                baseQuery.assignedBy = userId;
            } else if (userRole === 'student') {
                const student = await User.findById(userId)
                    .select('classId sectionId class section')
                    .lean();

                if (!student) return [];

                // Match class: by classId ObjectId OR by class name/grade string
                const classMatch = [];
                if (student.classId) classMatch.push(student.classId);
                if (student.class) classMatch.push(student.class);

                if (classMatch.length === 0) return [];

                baseQuery.class = { $in: classMatch };

                // Match section: show homework for this section OR homework with no section (whole class)
                const sectionMatch = [];
                if (student.sectionId) sectionMatch.push(student.sectionId);
                if (student.section) sectionMatch.push(student.section);

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
     */
    async getSubmissions(homeworkId, teacherId, tenantId) {
        try {
            const homework = await Homework.findOne({
                _id: homeworkId,
                tenantId,
                assignedBy: teacherId
            });

            if (!homework) {
                throw new Error('Homework not found or unauthorized');
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
                stats.totalHomework = await Homework.countDocuments({
                    assignedBy: userId,
                    tenantId,
                    isActive: true
                });

                const homeworkIds = await Homework.find({
                    assignedBy: userId,
                    tenantId,
                    isActive: true
                }).distinct('_id');

                stats.pendingReviews = await HomeworkSubmission.countDocuments({
                    homeworkId: { $in: homeworkIds },
                    status: 'submitted'
                });
            } else if (userRole === 'student') {
                const student = await User.findById(userId)
                    .select('classId sectionId class section')
                    .lean();

                if (student) {
                    const classMatch = [];
                    if (student.classId) classMatch.push(student.classId);
                    if (student.class) classMatch.push(student.class);

                    const hwQuery = {
                        tenantId,
                        isActive: true
                    };

                    if (classMatch.length > 0) {
                        hwQuery.class = { $in: classMatch };
                    }

                    const sectionMatch = [];
                    if (student.sectionId) sectionMatch.push(student.sectionId);
                    if (student.section) sectionMatch.push(student.section);

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
