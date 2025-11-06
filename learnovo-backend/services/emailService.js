const nodemailer = require('nodemailer');
const { logger } = require('../middleware/errorHandler');

class EmailService {
  constructor() {
    this.transporter = null;
    this.emailQueue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds

    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Support both EMAIL_* and SMTP_* env variables for flexibility
      const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');
      const secure = (process.env.EMAIL_SECURE || process.env.SMTP_SECURE) === 'true';
      const user = process.env.EMAIL_USER || process.env.SMTP_USER;
      const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass
        }
      });

      logger.info('Email service initialized', {
        host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587')
      });
    } catch (error) {
      logger.error('Failed to initialize email service', error);
    }
  }

  // Add email to queue
  queueEmail(emailData) {
    const emailJob = {
      id: Date.now() + Math.random(),
      ...emailData,
      attempts: 0,
      createdAt: new Date(),
      status: 'pending'
    };

    this.emailQueue.push(emailJob);
    logger.info('Email queued', { emailId: emailJob.id, to: emailData.to });

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }

    return emailJob.id;
  }

  // Process email queue
  async processQueue() {
    if (this.isProcessing || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.emailQueue.length > 0) {
      const emailJob = this.emailQueue.shift();

      try {
        await this.sendEmail(emailJob);
        emailJob.status = 'sent';
        logger.info('Email sent successfully', { emailId: emailJob.id, to: emailJob.to });
      } catch (error) {
        emailJob.attempts++;
        emailJob.lastError = error.message;

        if (emailJob.attempts < this.maxRetries) {
          emailJob.status = 'retry';
          // Re-queue with delay
          setTimeout(() => {
            this.emailQueue.push(emailJob);
          }, this.retryDelay * emailJob.attempts);

          logger.warn('Email send failed, retrying', {
            emailId: emailJob.id,
            attempts: emailJob.attempts,
            error: error.message
          });
        } else {
          emailJob.status = 'failed';
          logger.error('Email send failed permanently', error, {
            emailId: emailJob.id,
            attempts: emailJob.attempts
          });
        }
      }
    }

    this.isProcessing = false;
  }

  // Send individual email
  async sendEmail(emailJob) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.EMAIL_USER || process.env.SMTP_USER,
      to: emailJob.to,
      subject: emailJob.subject,
      html: emailJob.html,
      text: emailJob.text
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Send onboarding email
  async sendOnboardingEmail(adminEmail, schoolName, adminName) {
    const emailData = {
      to: adminEmail,
      subject: `Welcome to Learnovo - ${schoolName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3B82F6;">Welcome to Learnovo!</h2>
          <p>Dear ${adminName},</p>
          <p>Congratulations! Your school <strong>${schoolName}</strong> has been successfully registered on Learnovo.</p>
          
          <h3>What's Next?</h3>
          <ul>
            <li>Complete your school profile setup</li>
            <li>Add your first classes and subjects</li>
            <li>Invite teachers to join your school</li>
            <li>Start managing student records</li>
          </ul>
          
          <h3>Getting Started</h3>
          <p>Visit your school dashboard to begin setting up your school management system.</p>
          
          <p>If you have any questions, feel free to contact our support team.</p>
          
          <p>Best regards,<br>The Learnovo Team</p>
        </div>
      `,
      text: `
        Welcome to Learnovo!
        
        Dear ${adminName},
        
        Congratulations! Your school ${schoolName} has been successfully registered on Learnovo.
        
        What's Next?
        - Complete your school profile setup
        - Add your first classes and subjects
        - Invite teachers to join your school
        - Start managing student records
        
        Getting Started
        Visit your school dashboard to begin setting up your school management system.
        
        If you have any questions, feel free to contact our support team.
        
        Best regards,
        The Learnovo Team
      `
    };

    return this.queueEmail(emailData);
  }

  // Send password reset email
  async sendPasswordResetEmail(userEmail, resetToken, userName) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const emailData = {
      to: userEmail,
      subject: 'Password Reset Request - Learnovo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3B82F6;">Password Reset Request</h2>
          <p>Dear ${userName},</p>
          <p>You have requested to reset your password for your Learnovo account.</p>
          
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
          
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p>${resetUrl}</p>
          
          <p>This link will expire in 1 hour for security reasons.</p>
          
          <p>If you didn't request this password reset, please ignore this email.</p>
          
          <p>Best regards,<br>The Learnovo Team</p>
        </div>
      `,
      text: `
        Password Reset Request
        
        Dear ${userName},
        
        You have requested to reset your password for your Learnovo account.
        
        Click the link below to reset your password:
        ${resetUrl}
        
        This link will expire in 1 hour for security reasons.
        
        If you didn't request this password reset, please ignore this email.
        
        Best regards,
        The Learnovo Team
      `
    };

    return this.queueEmail(emailData);
  }

  // Send user invitation email
  async sendUserInvitationEmail(userEmail, userName, schoolName, role, invitationToken) {
    const invitationUrl = `${process.env.FRONTEND_URL}/accept-invitation?token=${invitationToken}`;

    const emailData = {
      to: userEmail,
      subject: `You've been invited to join ${schoolName} on Learnovo`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3B82F6;">You've been invited!</h2>
          <p>Dear ${userName},</p>
          <p>You have been invited to join <strong>${schoolName}</strong> as a <strong>${role}</strong> on Learnovo.</p>
          
          <p>Click the button below to accept the invitation and set up your account:</p>
          <a href="${invitationUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Accept Invitation</a>
          
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p>${invitationUrl}</p>
          
          <p>This invitation will expire in 7 days.</p>
          
          <p>If you have any questions, feel free to contact the school administrator.</p>
          
          <p>Best regards,<br>The Learnovo Team</p>
        </div>
      `,
      text: `
        You've been invited!
        
        Dear ${userName},
        
        You have been invited to join ${schoolName} as a ${role} on Learnovo.
        
        Click the link below to accept the invitation and set up your account:
        ${invitationUrl}
        
        This invitation will expire in 7 days.
        
        If you have any questions, feel free to contact the school administrator.
        
        Best regards,
        The Learnovo Team
      `
    };

    return this.queueEmail(emailData);
  }

  // Get queue status
  getQueueStatus() {
    return {
      queueLength: this.emailQueue.length,
      isProcessing: this.isProcessing,
      pending: this.emailQueue.filter(job => job.status === 'pending').length,
      retrying: this.emailQueue.filter(job => job.status === 'retry').length,
      failed: this.emailQueue.filter(job => job.status === 'failed').length
    };
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
