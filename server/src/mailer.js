import nodemailer from "nodemailer";

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    });
  }

  // Fallback Ethereal / Development logger transporter
  return {
    sendMail: async (options) => {
      console.log("\n==================================================");
      console.log(" 📧 [DEV MAIL TRANSPORTER] Password Reset Email");
      console.log(` To: ${options.to}`);
      console.log(` Subject: ${options.subject}`);
      console.log(` Reset Link: ${options.text.match(/https?:\/\/[^\s]+/)?.[0] || "N/A"}`);
      console.log("==================================================\n");
      return { messageId: `dev-${Date.now()}` };
    },
  };
}

export async function sendPasswordResetEmail({ to, name, resetLink }) {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || '"BharatBridge Security" <noreply@bharatbridge.app>';

  const subject = "🔒 Reset Your BharatBridge Password";
  const text = `Hello ${name || "User"},\n\nYou recently requested to reset your password for your BharatBridge account.\n\nPlease click the link below to reset your password:\n${resetLink}\n\nThis link will expire in 30 minutes.\n\nIf you did not request a password reset, please ignore this email.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #334155;">
      <h2 style="color: #f59e0b; margin-top: 0;">🔒 BharatBridge Password Reset</h2>
      <p style="font-size: 15px; color: #cbd5e1;">Hello <strong>${name || "User"}</strong>,</p>
      <p style="font-size: 15px; color: #cbd5e1;">We received a request to reset the password for your BharatBridge account.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #f59e0b; color: #0f172a; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
          Reset Your Password
        </a>
      </div>
      <p style="font-size: 13px; color: #94a3b8;">Or copy and paste this link into your browser:</p>
      <p style="font-size: 13px; word-break: break-all; color: #38bdf8;">${resetLink}</p>
      <hr style="border: 0; border-top: 1px solid #334155; margin: 25px 0;" />
      <p style="font-size: 12px; color: #64748b; margin: 0;">This link is valid for 30 minutes. If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  return transporter.sendMail({ from, to, subject, text, html });
}
