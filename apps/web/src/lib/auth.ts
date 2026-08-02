import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './prisma';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || smtpUser || 'no-reply@standlens.com';

      console.log('--- PASSWORD RESET REQUEST ---');
      console.log(`User: ${user.email} (${user.name})`);
      console.log(`Reset URL: ${url}`);
      console.log('------------------------------');

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort || '465', 10),
            secure: smtpPort === '465', // true for 465, false for 587 or other ports
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });

          await transporter.sendMail({
            from: `"StandLens" <${smtpFrom}>`,
            to: user.email,
            subject: 'Reset your StandLens password',
            text: `Hello ${user.name || 'User'},\n\nYou requested a password reset for your StandLens account. Please use the following link to reset your password:\n\n${url}\n\nIf you did not request this, you can safely ignore this email.\n\nBest regards,\nThe StandLens Team`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0b0b0f; color: #f0ece5; border-radius: 12px; border: 1px solid #2a2a32;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #e5a320; margin: 0; font-size: 24px;">StandLens</h1>
                  <p style="color: #9b9ba3; font-size: 14px; margin: 4px 0 0 0;">AI Team Standups & Tasks</p>
                </div>
                <div style="background-color: #141418; padding: 24px; border-radius: 8px; border: 1px solid #2a2a32; margin-bottom: 20px;">
                  <p style="margin-top: 0;">Hello ${user.name || 'there'},</p>
                  <p>You requested to reset your password for your StandLens account. Click the button below to set a new password:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${url}" style="background-color: #e5a320; color: #0b0b0f; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
                  </div>
                  <p style="font-size: 13px; color: #9b9ba3;">If the button above doesn't work, copy and paste the following URL into your browser:</p>
                  <p style="font-size: 12px; word-break: break-all; color: #e5a320;">${url}</p>
                </div>
                <p style="font-size: 12px; color: #71717a; text-align: center; margin-bottom: 0;">
                  If you did not request this email, you can safely ignore it.
                </p>
              </div>
            `,
          });
          console.log(`Password reset email successfully sent to ${user.email}`);
        } catch (error) {
          console.error('Failed to send password reset email via SMTP:', error);
        }
      } else {
        console.log('SMTP credentials not configured. Reset email logged to console only.');
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  secret: process.env.BETTER_AUTH_SECRET || 'fallback-secret-for-development-mode-only-32chars',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
});
