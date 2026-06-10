import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { db } from "./database";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = `Pareto Concursos <${process.env.SMTP_USER}>`;

async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({ from: FROM_EMAIL, to, subject, html });
}
const BASE_URL = (process.env.WEBSITE_URL ?? "http://localhost:4200").replace(/\/$/, "");

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin");
    return origin ? [origin] : ["*"];
  },
  plugins: [bearer()],

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // não bloqueia login, mas envia email de boas-vindas
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(user.email, "Redefinir senha — Pareto Concursos", `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0F172A;color:#F8FAFC;padding:32px;border-radius:16px">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
              <div style="background:#1E40AF;width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">📊</div>
              <span style="font-weight:700;font-size:18px">Pareto Concursos</span>
            </div>
            <h2 style="color:#F8FAFC;margin:0 0 12px">Redefinir sua senha</h2>
            <p style="color:#94A3B8;margin:0 0 24px;line-height:1.6">
              Recebemos uma solicitação para redefinir a senha da conta associada a <strong style="color:#F8FAFC">${user.email}</strong>.
            </p>
            <a href="${url}" style="display:inline-block;background:#1E40AF;color:#F8FAFC;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;margin-bottom:24px">
              Redefinir senha →
            </a>
            <p style="color:#475569;font-size:13px;margin:0">
              Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este email.
            </p>
          </div>
        `);
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(user.email, "Confirme seu email — Pareto Concursos", `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0F172A;color:#F8FAFC;padding:32px;border-radius:16px">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
              <div style="background:#1E40AF;width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">📊</div>
              <span style="font-weight:700;font-size:18px">Pareto Concursos</span>
            </div>
            <h2 style="color:#F8FAFC;margin:0 0 12px">Bem-vindo, ${user.name ?? user.email}!</h2>
            <p style="color:#94A3B8;margin:0 0 24px;line-height:1.6">
              Confirme seu email para ativar sua conta e começar a estudar com o método Pareto.
            </p>
            <a href="${url}" style="display:inline-block;background:#1E40AF;color:#F8FAFC;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;margin-bottom:24px">
              Confirmar email →
            </a>
            <p style="color:#475569;font-size:13px;margin:0">
              Se você não criou esta conta, ignore este email.
            </p>
          </div>
        `);
    },
  },
});
