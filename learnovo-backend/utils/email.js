const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send email
exports.sendEmail = async(to, subject, html, attachments = []) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Learnovo" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      attachments
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send fee reminder email
exports.sendFeeReminder = async(student, fee) => {
  try {
    const settings = await Settings.getSettings();
    const template = settings.notifications.email.templates.feeReminder;

    const subject = 'Fee Payment Reminder - Learnovo';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Fee Payment Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3EC4B1; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .fee-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #2355A6; }
          .footer { text-align: center; padding: 20px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background: #3EC4B1; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Learnovo Student Management</h1>
            <p>Fee Payment Reminder</p>
          </div>
          <div class="content">
            <h2>Dear ${student.name},</h2>
            <p>This is a friendly reminder that your fee payment is due.</p>
            
            <div class="fee-details">
              <h3>Fee Details:</h3>
              <p><strong>Description:</strong> ${fee.description}</p>
              <p><strong>Amount:</strong> <span class="amount">${fee.amount}</span></p>
              <p><strong>Due Date:</strong> ${new Date(fee.dueDate).toLocaleDateString()}</p>
              <p><strong>Student ID:</strong> ${student.studentId}</p>
              <p><strong>Class:</strong> ${student.class}</p>
            </div>
            
            <p>Please make the payment at your earliest convenience to avoid any late fees.</p>
            
            <p>If you have already made the payment, please ignore this reminder.</p>
            
            <p>Thank you for your attention.</p>
            
            <p>Best regards,<br>Learnovo Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await exports.sendEmail(student.email, subject, html);
  } catch (error) {
    console.error('Fee reminder email error:', error);
    return { success: false, error: error.message };
  }
};

// Send overdue fee email
exports.sendOverdueFeeReminder = async(student, fee) => {
  try {
    const settings = await Settings.getSettings();
    const template = settings.notifications.email.templates.feeOverdue;

    const subject = 'URGENT: Overdue Fee Payment - Learnovo';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Overdue Fee Payment</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .fee-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 5px solid #dc3545; }
          .amount { font-size: 24px; font-weight: bold; color: #dc3545; }
          .urgent { color: #dc3545; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Learnovo Student Management</h1>
            <p class="urgent">URGENT: Overdue Fee Payment</p>
          </div>
          <div class="content">
            <h2>Dear ${student.name},</h2>
            <p class="urgent">Your fee payment is now overdue. Please make the payment immediately to avoid further penalties.</p>
            
            <div class="fee-details">
              <h3>Overdue Fee Details:</h3>
              <p><strong>Description:</strong> ${fee.description}</p>
              <p><strong>Amount:</strong> <span class="amount">${fee.amount}</span></p>
              <p><strong>Due Date:</strong> ${new Date(fee.dueDate).toLocaleDateString()}</p>
              <p><strong>Days Overdue:</strong> ${Math.ceil((new Date() - new Date(fee.dueDate)) / (1000 * 60 * 60 * 24))} days</p>
              <p><strong>Student ID:</strong> ${student.studentId}</p>
              <p><strong>Class:</strong> ${student.class}</p>
            </div>
            
            <p class="urgent">Please contact the school office immediately to resolve this matter.</p>
            
            <p>Thank you for your immediate attention.</p>
            
            <p>Best regards,<br>Learnovo Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await exports.sendEmail(student.email, subject, html);
  } catch (error) {
    console.error('Overdue fee email error:', error);
    return { success: false, error: error.message };
  }
};

// Send admission approval email
exports.sendAdmissionApproval = async(student, admission) => {
  try {
    const settings = await Settings.getSettings();
    const template = settings.notifications.email.templates.admissionApproved;

    const subject = 'Congratulations! Admission Approved - Learnovo';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Admission Approved</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .admission-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .success { color: #28a745; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Learnovo Student Management</h1>
            <p class="success">Admission Approved!</p>
          </div>
          <div class="content">
            <h2>Dear ${student.name},</h2>
            <p class="success">Congratulations! Your admission to Learnovo has been approved.</p>
            
            <div class="admission-details">
              <h3>Admission Details:</h3>
              <p><strong>Application Number:</strong> ${admission.applicationNumber}</p>
              <p><strong>Student ID:</strong> ${admission.admissionInfo.studentId}</p>
              <p><strong>Class:</strong> ${admission.academicInfo.classApplied}</p>
              <p><strong>Admission Date:</strong> ${new Date(admission.admissionInfo.admissionDate).toLocaleDateString()}</p>
              <p><strong>Roll Number:</strong> ${admission.admissionInfo.rollNumber}</p>
            </div>
            
            <p>Please visit the school office to complete the admission formalities and pay the admission fee.</p>
            
            <p>Welcome to Learnovo family!</p>
            
            <p>Best regards,<br>Learnovo Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await exports.sendEmail(student.email, subject, html);
  } catch (error) {
    console.error('Admission approval email error:', error);
    return { success: false, error: error.message };
  }
};

// Send admission rejection email
exports.sendAdmissionRejection = async(student, admission) => {
  try {
    const settings = await Settings.getSettings();
    const template = settings.notifications.email.templates.admissionRejected;

    const subject = 'Admission Status Update - Learnovo';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Admission Status</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6c757d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .admission-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Learnovo Student Management</h1>
            <p>Admission Status Update</p>
          </div>
          <div class="content">
            <h2>Dear ${student.name},</h2>
            <p>Thank you for your interest in Learnovo. After careful consideration, we regret to inform you that your admission application has not been approved for the current academic year.</p>
            
            <div class="admission-details">
              <h3>Application Details:</h3>
              <p><strong>Application Number:</strong> ${admission.applicationNumber}</p>
              <p><strong>Class Applied:</strong> ${admission.academicInfo.classApplied}</p>
              <p><strong>Reason:</strong> ${admission.reviewInfo.rejectionReason}</p>
            </div>
            
            <p>We encourage you to apply again in the future. Thank you for considering Learnovo for your education.</p>
            
            <p>Best regards,<br>Learnovo Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await exports.sendEmail(student.email, subject, html);
  } catch (error) {
    console.error('Admission rejection email error:', error);
    return { success: false, error: error.message };
  }
};

// Send bulk email
exports.sendBulkEmail = async(recipients, subject, html) => {
  try {
    const results = [];

    for (const recipient of recipients) {
      const result = await exports.sendEmail(recipient.email, subject, html);
      results.push({
        email: recipient.email,
        success: result.success,
        error: result.error
      });
    }

    return {
      success: true,
      results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    };
  } catch (error) {
    console.error('Bulk email error:', error);
    return { success: false, error: error.message };
  }
};
