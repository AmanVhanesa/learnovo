const Homework = require('../models/Homework');
const HomeworkSubmission = require('../models/HomeworkSubmission');
const User = require('../models/User');

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

            // Populate references before returning
            await homework.populate([
                { path: 'subject', select: 'name' },
                { path: 'class', select: 'name' },
                { path: 'section', select: 'name' },
                { path: 'assignedBy', select: 'name email' }
            ]);

            return homework;
        } catch (error) {
            throw new Error(`Failed to create homework: ${error.message}`);
        }
    }

    /**
     * Get homework list with filters
     */
    async getHomeworkList(filters, userRole, userId, tenantId) {
        try {
            const query = { tenantId, isActive: true };

            // Role-based filtering
            if (userRole === 'teacher') {
                query.assignedBy = userId;
            } else if (userRole === 'student') {
                // Get student's class and section
                const student = await User.findById(userId).select('currentClass currentSection');
                if (student) {
                    query.class = student.currentClass;
                    if (student.currentSection) {
                        query.$or = [
                            { section: student.currentSection },
                            { section: null }
                        ];
                    }
                }
            }

            // Additional filters
            if (filters.subject) query.subject = filters.subject;
            if (filters.class) query.class = filters.class;
            if (filters.section) query.section = filters.section;
            if (filters.startDate || filters.endDate) {
                query.assignedDate = {};
                if (filters.startDate) query.assignedDate.$gte = new Date(filters.startDate);
                if (filters.endDate) query.assignedDate.$lte = new Date(filters.endDate);
            }

            const homework = await Homework.find(query)
                .populate('subject', 'name')
                .populate('class', 'name')
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

                    // Get total students in class
                    const totalStudents = await User.countDocuments({
                        tenantId,
                        role: 'student',
                        currentClass: hw.class._id,
                        ...(hw.section ? { currentSection: hw.section._id } : {}),
                        isActive: true
                    });

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
                .populate('class', 'name')
                .populate('section', 'name')
                .populate('assignedBy', 'name email')
                .lean();

            if (!homework) {
                throw new Error('Homework not found');
            }

            // For students, add their submission
            if (userRole === 'student') {
                const submission = await HomeworkSubmission.findOne({
                    homeworkId: id,
                    studentId: userId
                });
                homework.mySubmission = submission;
            }

            // For teachers, add submission list
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
                { path: 'class', select: 'name' },
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

            // Hard delete: Remove all submissions first to free up space
            await HomeworkSubmission.deleteMany({
                homeworkId: id,
                tenantId
            });

            // Then remove the homework itself
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
            // Check if homework exists
            const homework = await Homework.findOne({ _id: homeworkId, tenantId, isActive: true });
            if (!homework) {
                throw new Error('Homework not found');
            }

            // Check if submission already exists
            let submission = await HomeworkSubmission.findOne({
                homeworkId,
                studentId,
                tenantId
            });

            if (submission) {
                // Update existing submission
                submission.submissionText = data.submissionText;
                submission.attachments = data.attachments || [];
                submission.status = 'submitted';
                submission.submittedAt = new Date();
            } else {
                // Create new submission
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
            // Verify teacher owns this homework
            const homework = await Homework.findOne({
                _id: homeworkId,
                tenantId,
                assignedBy: teacherId
            });

            if (!homework) {
                throw new Error('Homework not found or unauthorized');
            }

            const submissions = await HomeworkSubmission.find({
                homeworkId,
                tenantId
            })
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

            // Verify teacher owns the homework
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
                        { path: 'class', select: 'name' }
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
                // Count homework created by teacher
                stats.totalHomework = await Homework.countDocuments({
                    assignedBy: userId,
                    tenantId,
                    isActive: true
                });

                // Count pending reviews
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
                // Get student's class
                const student = await User.findById(userId).select('currentClass currentSection');

                if (student) {
                    // Count total homework for student's class
                    const query = {
                        tenantId,
                        class: student.currentClass,
                        isActive: true
                    };

                    if (student.currentSection) {
                        query.$or = [
                            { section: student.currentSection },
                            { section: null }
                        ];
                    }

                    const allHomework = await Homework.find(query).distinct('_id');
                    stats.totalHomework = allHomework.length;

                    // Count pending homework
                    const submittedIds = await HomeworkSubmission.find({
                        studentId: userId,
                        status: { $in: ['submitted', 'reviewed'] }
                    }).distinct('homeworkId');

                    stats.pendingHomework = allHomework.filter(
                        id => !submittedIds.some(subId => subId.toString() === id.toString())
                    ).length;

                    // Count submitted
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
