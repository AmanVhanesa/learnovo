const csv = require('csv-parser');
const fs = require('fs');
const { logger } = require('../middleware/errorHandler');
const User = require('../models/User');
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

  // Validate CSV headers — only reject if required headers are missing; extra columns are allowed
  validateHeaders(headers, role) {
    const required = this.requiredHeaders[role];
    const missing = required.filter(header => !headers.includes(header));

    if (missing.length > 0) {
      throw new Error(`Missing required headers: ${missing.join(', ')}`);
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

  // Import teachers — batched insertMany instead of per-row User.create()
  async importTeachers(tenantId, csvData, adminEmail) {
    const results = { created: 0, skipped: 0, errors: [] };

    logger.info('Starting teacher import', { tenantId, adminEmail, recordCount: csvData.length });

    // Collect emails of all valid rows for duplicate check in one query
    const emailsInFile = csvData
      .filter(row => row.name && row.email)
      .map(row => row.email.toLowerCase().trim());

    const existingEmails = new Set();
    if (emailsInFile.length > 0) {
      const existing = await User.find({ tenantId, role: 'teacher', email: { $in: emailsInFile } })
        .select('email').lean();
      existing.forEach(u => existingEmails.add(u.email));
    }

    const docsToInsert = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNumber = i + 2;

      if (!row.name || !row.email) {
        results.errors.push({ row: rowNumber, error: 'Missing required fields: name and email are required' });
        results.skipped++;
        continue;
      }

      const email = row.email.toLowerCase().trim();

      if (existingEmails.has(email)) {
        results.errors.push({ row: rowNumber, error: `Teacher with email ${email} already exists` });
        results.skipped++;
        continue;
      }

      docsToInsert.push({
        tenantId,
        name: row.name.trim(),
        email,
        password: this.generateTemporaryPassword(),
        role: 'teacher',
        phone: row.phone?.trim(),
        qualifications: row.qualifications?.trim(),
        subjects: row.subjects ? row.subjects.split(',').map(s => s.trim()) : []
      });
    }

    if (docsToInsert.length === 0) {
      logger.info('Teacher import completed (nothing to insert)', { tenantId, adminEmail, results });
      return results;
    }

    // Batch insert in chunks of 100
    const CHUNK_SIZE = 100;
    const insertedDocs = [];
    for (let i = 0; i < docsToInsert.length; i += CHUNK_SIZE) {
      const chunk = docsToInsert.slice(i, i + CHUNK_SIZE);
      try {
        const inserted = await User.insertMany(chunk, { ordered: false });
        insertedDocs.push(...inserted);
        results.created += inserted.length;
      } catch (bulkErr) {
        // ordered:false — some docs may have been inserted despite the error
        const inserted = bulkErr.insertedDocs || [];
        insertedDocs.push(...inserted);
        results.created += inserted.length;
        if (bulkErr.writeErrors) {
          bulkErr.writeErrors.forEach(we => {
            results.errors.push({ row: '?', error: we.errmsg || we.message });
            results.skipped++;
          });
        }
      }
    }

    // Fire invitation emails asynchronously after the batch completes
    Promise.all(
      insertedDocs.map(teacher =>
        emailService.sendUserInvitationEmail(
          teacher.email,
          teacher.name,
          'Your School',
          'teacher',
          this.generateInvitationToken(teacher._id)
        ).catch(error => {
          logger.error('Failed to send teacher invitation email', error, {
            tenantId, teacherId: teacher._id, email: teacher.email
          });
        })
      )
    ).catch(() => {});

    logger.info('Teacher import completed', { tenantId, adminEmail, results });
    return results;
  }

  // Import students — batched insertMany instead of per-row User.create()
  async importStudents(tenantId, csvData, adminEmail) {
    const results = { created: 0, skipped: 0, errors: [] };

    logger.info('Starting student import', { tenantId, adminEmail, recordCount: csvData.length });

    // Collect all emails + rollNumbers for bulk duplicate check
    const emailsInFile = [];
    const rollNosInFile = [];
    csvData.forEach(row => {
      if (row.email) emailsInFile.push(row.email.toLowerCase().trim());
      if (row.rollno) rollNosInFile.push(row.rollno.trim());
    });

    const existingEmails = new Set();
    const existingRollNos = new Set();
    if (emailsInFile.length > 0 || rollNosInFile.length > 0) {
      const existing = await User.find({
        tenantId,
        role: 'student',
        $or: [
          ...(emailsInFile.length > 0 ? [{ email: { $in: emailsInFile } }] : []),
          ...(rollNosInFile.length > 0 ? [{ rollNumber: { $in: rollNosInFile } }] : [])
        ]
      }).select('email rollNumber').lean();
      existing.forEach(u => {
        if (u.email) existingEmails.add(u.email);
        if (u.rollNumber) existingRollNos.add(u.rollNumber);
      });
    }

    const docsToInsert = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNumber = i + 2;

      if (!row.name || !row.email || !row.class || !row.rollno) {
        results.errors.push({ row: rowNumber, error: 'Missing required fields: name, email, class, and rollno are required' });
        results.skipped++;
        continue;
      }

      const email = row.email.toLowerCase().trim();
      const rollNumber = row.rollno.trim();

      if (existingEmails.has(email) || existingRollNos.has(rollNumber)) {
        results.errors.push({ row: rowNumber, error: `Student with email ${email} or roll number ${rollNumber} already exists` });
        results.skipped++;
        continue;
      }

      docsToInsert.push({
        tenantId,
        name: row.name.trim(),
        email,
        password: this.generateTemporaryPassword(),
        role: 'student',
        phone: row.phone?.trim(),
        class: row.class?.trim(),
        rollNumber,
        guardianName: row.guardianName?.trim(),
        guardianPhone: row.guardianPhone?.trim(),
        address: row.address?.trim(),
        admissionDate: new Date(),
        isImported: true
      });
    }

    if (docsToInsert.length === 0) {
      logger.info('Student import completed (nothing to insert)', { tenantId, adminEmail, results });
      return results;
    }

    // Batch insert in chunks of 100
    const CHUNK_SIZE = 100;
    const insertedDocs = [];
    for (let i = 0; i < docsToInsert.length; i += CHUNK_SIZE) {
      const chunk = docsToInsert.slice(i, i + CHUNK_SIZE);
      try {
        const inserted = await User.insertMany(chunk, { ordered: false });
        insertedDocs.push(...inserted);
        results.created += inserted.length;
      } catch (bulkErr) {
        const inserted = bulkErr.insertedDocs || [];
        insertedDocs.push(...inserted);
        results.created += inserted.length;
        if (bulkErr.writeErrors) {
          bulkErr.writeErrors.forEach(we => {
            results.errors.push({ row: '?', error: we.errmsg || we.message });
            results.skipped++;
          });
        }
      }
    }

    // Fire invitation emails asynchronously after the batch completes
    Promise.all(
      insertedDocs.map(student =>
        emailService.sendUserInvitationEmail(
          student.email,
          student.name,
          'Your School',
          'student',
          this.generateInvitationToken(student._id)
        ).catch(error => {
          logger.error('Failed to send student invitation email', error, {
            tenantId, studentId: student._id, email: student.email
          });
        })
      )
    ).catch(() => {});

    logger.info('Student import completed', { tenantId, adminEmail, results });
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
  generateInvitationToken(_userId) {
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
