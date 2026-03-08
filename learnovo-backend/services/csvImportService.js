const csv = require('csv-parser');
const fs = require('fs');
const { logger } = require('../middleware/errorHandler');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const emailService = require('./emailService');

class CSVImportService {
  constructor() {
    this.supportedRoles = ['teacher', 'student'];
    this.requiredHeaders = {
      teacher: ['name', 'email', 'phone'],
      student: ['name', 'email', 'class', 'rollno', 'phone']
    };
    this.optionalHeaders = {
      teacher: ['qualifications', 'subjects'],
      student: ['guardianName', 'guardianPhone', 'address']
    };
  }

  // Validate CSV headers
  validateHeaders(headers, role) {
    const required = this.requiredHeaders[role];
    const missing = required.filter(header => !headers.includes(header));

    if (missing.length > 0) {
      throw new Error(`Missing required headers: ${missing.join(', ')}`);
    }

    const allValidHeaders = [...required, ...this.optionalHeaders[role]];
    const invalid = headers.filter(header => !allValidHeaders.includes(header));

    if (invalid.length > 0) {
      throw new Error(`Invalid headers: ${invalid.join(', ')}`);
    }

    return true;
  }

  // Parse CSV file
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  // Import teachers
  async importTeachers(tenantId, csvData, adminEmail) {
    const results = {
      created: 0,
      skipped: 0,
      errors: []
    };

    logger.info('Starting teacher import', {
      tenantId,
      adminEmail,
      recordCount: csvData.length
    });

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNumber = i + 2; // +2 because CSV is 1-indexed and we skip header

      try {
        // Validate required fields
        if (!row.name || !row.email) {
          results.errors.push({
            row: rowNumber,
            error: 'Missing required fields: name and email are required'
          });
          results.skipped++;
          continue;
        }

        // Check if teacher already exists
        const existingTeacher = await User.findOne({
          tenantId,
          email: row.email.toLowerCase(),
          role: 'teacher'
        });

        if (existingTeacher) {
          results.errors.push({
            row: rowNumber,
            error: `Teacher with email ${row.email} already exists`
          });
          results.skipped++;
          continue;
        }

        // Create teacher
        const teacherData = {
          tenantId,
          name: row.name.trim(),
          email: row.email.toLowerCase().trim(),
          password: this.generateTemporaryPassword(),
          role: 'teacher',
          phone: row.phone?.trim(),
          qualifications: row.qualifications?.trim(),
          subjects: row.subjects ? row.subjects.split(',').map(s => s.trim()) : []
        };

        const teacher = await User.create(teacherData);
        results.created++;

        // Send invitation email
        emailService.sendUserInvitationEmail(
          teacher.email,
          teacher.name,
          'Your School', // This should be fetched from tenant
          'teacher',
          this.generateInvitationToken(teacher._id)
        ).catch(error => {
          logger.error('Failed to send teacher invitation email', error, {
            tenantId,
            teacherId: teacher._id,
            email: teacher.email
          });
        });

        logger.info('Teacher created successfully', {
          tenantId,
          teacherId: teacher._id,
          email: teacher.email,
          row: rowNumber
        });

      } catch (error) {
        results.errors.push({
          row: rowNumber,
          error: error.message
        });
        results.skipped++;

        logger.error('Failed to create teacher', error, {
          tenantId,
          row: rowNumber,
          email: row.email
        });
      }
    }

    logger.info('Teacher import completed', {
      tenantId,
      adminEmail,
      results
    });

    return results;
  }

  // Import students
  async importStudents(tenantId, csvData, adminEmail) {
    const results = {
      created: 0,
      skipped: 0,
      errors: []
    };

    logger.info('Starting student import', {
      tenantId,
      adminEmail,
      recordCount: csvData.length
    });

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNumber = i + 2; // +2 because CSV is 1-indexed and we skip header

      try {
        // Validate required fields
        if (!row.name || !row.email || !row.class || !row.rollno) {
          results.errors.push({
            row: rowNumber,
            error: 'Missing required fields: name, email, class, and rollno are required'
          });
          results.skipped++;
          continue;
        }

        // Check if student already exists
        const existingStudent = await User.findOne({
          tenantId,
          $or: [
            { email: row.email.toLowerCase() },
            { rollNumber: row.rollno.trim() }
          ],
          role: 'student'
        });

        if (existingStudent) {
          results.errors.push({
            row: rowNumber,
            error: `Student with email ${row.email} or roll number ${row.rollno} already exists`
          });
          results.skipped++;
          continue;
        }

        // Create student
        const studentData = {
          tenantId,
          name: row.name.trim(),
          email: row.email.toLowerCase().trim(),
          password: this.generateTemporaryPassword(),
          role: 'student',
          phone: row.phone?.trim(),
          rollNumber: row.rollno.trim(),
          guardianName: row.guardianName?.trim(),
          guardianPhone: row.guardianPhone?.trim(),
          address: row.address?.trim(),
          admissionDate: new Date()
        };

        const student = await User.create(studentData);
        results.created++;

        // Send invitation email
        emailService.sendUserInvitationEmail(
          student.email,
          student.name,
          'Your School', // This should be fetched from tenant
          'student',
          this.generateInvitationToken(student._id)
        ).catch(error => {
          logger.error('Failed to send student invitation email', error, {
            tenantId,
            studentId: student._id,
            email: student.email
          });
        });

        logger.info('Student created successfully', {
          tenantId,
          studentId: student._id,
          email: student.email,
          row: rowNumber
        });

      } catch (error) {
        results.errors.push({
          row: rowNumber,
          error: error.message
        });
        results.skipped++;

        logger.error('Failed to create student', error, {
          tenantId,
          row: rowNumber,
          email: row.email
        });
      }
    }

    logger.info('Student import completed', {
      tenantId,
      adminEmail,
      results
    });

    return results;
  }

  // Generate temporary password
  generateTemporaryPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Generate invitation token
  generateInvitationToken(userId) {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  // Get import template
  getTemplate(role) {
    const required = this.requiredHeaders[role];
    const optional = this.optionalHeaders[role];

    return {
      role,
      headers: [...required, ...optional],
      required,
      optional,
      sample: this.getSampleData(role)
    };
  }

  // Get sample data for template
  getSampleData(role) {
    if (role === 'teacher') {
      return {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        qualifications: 'M.Ed Mathematics',
        subjects: 'Mathematics, Physics'
      };
    } else if (role === 'student') {
      return {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        class: 'Grade 10A',
        rollno: 'STU001',
        phone: '+1234567890',
        guardianName: 'Robert Smith',
        guardianPhone: '+1234567891',
        address: '123 Main St, City, State'
      };
    }
    return {};
  }
}

module.exports = new CSVImportService();
