import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string;
  };
  from: string; // Default from address
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;

  /**
   * Initialize email service with SMTP configuration
   */
  initialize(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return this.transporter !== null && this.config !== null;
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (!this.isConfigured()) {
      console.warn('[Email] Email service not configured, skipping email send');
      return;
    }

    try {
      await this.transporter!.sendMail({
        from: this.config!.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
      });

      console.log(`[Email] Sent email to ${options.to}: ${options.subject}`);
    } catch (error) {
      console.error('[Email] Failed to send email:', error);
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send backup failure notification
   */
  async sendBackupFailureNotification(
    userEmail: string,
    configName: string,
    error: string
  ): Promise<void> {
    const subject = `Backup Failed: ${configName}`;
    const text = `
Your backup "${configName}" has failed.

Error: ${error}

Time: ${new Date().toLocaleString()}

Please check the BackApp dashboard for more details and take appropriate action.

---
This is an automated message from BackApp.
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #fee; border-left: 4px solid #f44; padding: 20px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 10px 0; color: #c00;">❌ Backup Failed</h2>
          <p style="margin: 0; font-size: 16px;"><strong>${configName}</strong></p>
        </div>

        <div style="padding: 20px; background-color: #f9f9f9; border-radius: 4px;">
          <p><strong>Error:</strong></p>
          <pre style="background-color: #fff; padding: 10px; border-radius: 4px; overflow-x: auto;">${error}</pre>

          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div style="margin-top: 20px; padding: 20px; background-color: #f0f0f0; border-radius: 4px;">
          <p style="margin: 0 0 10px 0;">Please check the BackApp dashboard for more details and take appropriate action.</p>
          <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/backups" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Dashboard</a>
        </div>

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
          <p>This is an automated message from BackApp.</p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: userEmail,
      subject,
      text,
      html,
    });
  }

  /**
   * Send backup timeout notification
   */
  async sendBackupTimeoutNotification(
    userEmail: string,
    configName: string
  ): Promise<void> {
    const subject = `Backup Timeout Warning: ${configName}`;
    const text = `
Your backup "${configName}" has timed out and may not have completed.

This usually means the backup agent is not running or is experiencing issues.

Time: ${new Date().toLocaleString()}

Please check:
1. The backup agent is running on your machine
2. The agent has proper network connectivity
3. The BackApp dashboard for more details

---
This is an automated message from BackApp.
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #fff3cd; border-left: 4px solid #f90; padding: 20px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 10px 0; color: #856404;">⚠️ Backup Timeout Warning</h2>
          <p style="margin: 0; font-size: 16px;"><strong>${configName}</strong></p>
        </div>

        <div style="padding: 20px; background-color: #f9f9f9; border-radius: 4px;">
          <p>Your backup has timed out and may not have completed successfully.</p>
          <p>This usually means the backup agent is not running or is experiencing issues.</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div style="margin-top: 20px; padding: 20px; background-color: #f0f0f0; border-radius: 4px;">
          <p style="margin: 0 0 10px 0;"><strong>Please check:</strong></p>
          <ol style="margin: 0; padding-left: 20px;">
            <li>The backup agent is running on your machine</li>
            <li>The agent has proper network connectivity</li>
            <li>The BackApp dashboard for more details</li>
          </ol>
        </div>

        <div style="margin-top: 20px; padding: 20px; background-color: #f0f0f0; border-radius: 4px; text-align: center;">
          <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/backups" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Dashboard</a>
        </div>

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
          <p>This is an automated message from BackApp.</p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: userEmail,
      subject,
      text,
      html,
    });
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Email service not configured');
    }

    try {
      await this.transporter!.verify();
      return true;
    } catch (error) {
      console.error('[Email] Connection test failed:', error);
      return false;
    }
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();

    // Auto-configure from environment variables if available
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
    ) {
      emailServiceInstance.initialize({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        from: process.env.SMTP_FROM,
      });

      console.log('[Email] Email service auto-configured from environment variables');
    }
  }

  return emailServiceInstance;
}
