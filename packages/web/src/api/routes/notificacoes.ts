import { Hono } from "hono";
import { db } from "../database/index";
import * as schema from "../database/schema";
import { eq, and, lte, isNull } from "drizzle-orm";
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

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const DIAS_SEMANA = [
  "domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado",
];
const DIAS_SEMANA_PT = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado",
];
const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatarData(d: Date) {
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────
// Lógica principal: buscar dados de um usuário e enviar email
// ─────────────────────────────────────────────────────────────────

interface DadosNotificacao {
  userId: string;
  userName: string;
  userEmail: string;
  aulasHoje: {
    id: number;
    assunto: string;
    disciplina: string | null;
    prioridade: string | null;
    cursoTitulo: string;
    status: string;
  }[];
  revisoesHoje: {
    id: number;
    tipo: string;
    assunto: string;
    disciplina: string | null;
    cursoTitulo: string;
    agendadaPara: Date;
  }[];
}

async function buscarDadosUsuario(userId: string, hoje: Date): Promise<DadosNotificacao | null> {
  // Buscar info do usuário
  const usuarios = await db
    .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, userId));

  if (!usuarios.length) return null;
  const u = usuarios[0];

  // Dia da semana (ex: "segunda", "terca"...)
  const diaKey = DIAS_SEMANA[hoje.getDay()];

  // Aulas do dia (pendentes ou geradas, não concluídas)
  const aulasHoje = await db
    .select({
      id: schema.aulas.id,
      assunto: schema.aulas.assunto,
      disciplina: schema.aulas.disciplina,
      prioridade: schema.aulas.prioridade,
      cursoTitulo: schema.cursosAula.titulo,
      status: schema.aulas.status,
    })
    .from(schema.aulas)
    .innerJoin(schema.cursosAula, eq(schema.aulas.cursoId, schema.cursosAula.id))
    .where(
      and(
        eq(schema.cursosAula.userId, userId),
        eq(schema.aulas.diaSemana, diaKey),
        // não concluídas (status pendente ou gerada)
        isNull(schema.aulas.concluidaEm),
      )
    );

  // Revisões pendentes (agendadas até fim do dia, não concluídas)
  const fimDia = new Date(hoje);
  fimDia.setHours(23, 59, 59, 999);

  const revisoesHoje = await db
    .select({
      id: schema.revisoes.id,
      tipo: schema.revisoes.tipo,
      agendadaPara: schema.revisoes.agendadaPara,
      assunto: schema.aulas.assunto,
      disciplina: schema.aulas.disciplina,
      cursoTitulo: schema.cursosAula.titulo,
    })
    .from(schema.revisoes)
    .innerJoin(schema.aulas, eq(schema.revisoes.aulaId, schema.aulas.id))
    .innerJoin(schema.cursosAula, eq(schema.revisoes.cursoId, schema.cursosAula.id))
    .where(
      and(
        eq(schema.cursosAula.userId, userId),
        lte(schema.revisoes.agendadaPara, fimDia),
        isNull(schema.revisoes.concluidaEm),
      )
    );

  return {
    userId,
    userName: u.name,
    userEmail: u.email,
    aulasHoje,
    revisoesHoje,
  };
}

// ─────────────────────────────────────────────────────────────────
// Montar HTML do email
// ─────────────────────────────────────────────────────────────────

function gerarEmailHtml(dados: DadosNotificacao, hoje: Date): string {
  const diaSemanaStr = DIAS_SEMANA_PT[hoje.getDay()];
  const dataStr = formatarData(hoje);
  const nome = dados.userName?.split(" ")[0] ?? "Estudante";
  const temAulas = dados.aulasHoje.length > 0;
  const temRevisoes = dados.revisoesHoje.length > 0;

  const PRIORIDADE_BADGE: Record<string, string> = {
    alta: "background:#DC2626;color:#fff",
    media: "background:#D97706;color:#fff",
    baixa: "background:#16A34A;color:#fff",
  };

  const TIPO_REVISAO: Record<string, string> = {
    "24h": "24 horas",
    "7d": "7 dias",
    "30d": "30 dias",
    "90d": "90 dias",
  };

  const aulasHtml = temAulas
    ? dados.aulasHoje.map((a) => {
        const badge = PRIORIDADE_BADGE[a.prioridade ?? "media"] ?? PRIORIDADE_BADGE.media;
        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #1E293B">
              <div style="display:flex;align-items:flex-start;gap:10px">
                <div style="flex:1">
                  <div style="font-weight:600;color:#F8FAFC;font-size:14px">${a.assunto}</div>
                  <div style="color:#64748B;font-size:12px;margin-top:2px">${a.disciplina ?? ""} • ${a.cursoTitulo}</div>
                </div>
                <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;white-space:nowrap;${badge}">${(a.prioridade ?? "media").toUpperCase()}</span>
              </div>
            </td>
          </tr>`;
      }).join("")
    : `<tr><td style="padding:16px 0;color:#475569;text-align:center;font-size:14px">Nenhuma aula programada para hoje.</td></tr>`;

  const revisoesHtml = temRevisoes
    ? dados.revisoesHoje.map((r) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1E293B">
            <div style="flex:1">
              <div style="font-weight:600;color:#F8FAFC;font-size:14px">${r.assunto}</div>
              <div style="color:#64748B;font-size:12px;margin-top:2px">${r.disciplina ?? ""} • ${r.cursoTitulo}</div>
            </div>
            <span style="display:inline-block;background:#1E3A8A;color:#93C5FD;font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;margin-top:4px">Revisão ${TIPO_REVISAO[r.tipo] ?? r.tipo}</span>
          </td>
        </tr>`).join("")
    : `<tr><td style="padding:16px 0;color:#475569;text-align:center;font-size:14px">Nenhuma revisão pendente para hoje. 🎉</td></tr>`;

  const totalItens = dados.aulasHoje.length + dados.revisoesHoje.length;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#0F172A;border:1px solid #1E293B;border-radius:16px;overflow:hidden">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 100%);padding:28px 32px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="background:rgba(255,255,255,0.15);width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px">📊</div>
        <span style="font-weight:700;font-size:18px;color:#fff">Pareto Concursos</span>
      </div>
      <div style="color:#BFDBFE;font-size:13px;margin-bottom:4px">${diaSemanaStr}, ${dataStr}</div>
      <div style="color:#fff;font-size:22px;font-weight:700">Bom dia, ${nome}! ☀️</div>
      <div style="color:#BFDBFE;font-size:14px;margin-top:6px">
        ${totalItens > 0
          ? `Você tem <strong style="color:#fff">${totalItens} ${totalItens === 1 ? "item" : "itens"}</strong> para estudar hoje.`
          : "Tudo em dia por hoje! Continue assim."}
      </div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">

      <!-- Aulas do dia -->
      <div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
          <span style="font-size:18px">📚</span>
          <span style="font-weight:700;font-size:15px;color:#F8FAFC">Aulas de hoje</span>
          <span style="background:#1E293B;color:#64748B;font-size:12px;font-weight:600;padding:2px 8px;border-radius:9999px;margin-left:auto">${dados.aulasHoje.length}</span>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1E293B">
          ${aulasHtml}
        </table>
      </div>

      <!-- Revisões pendentes -->
      <div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
          <span style="font-size:18px">🔁</span>
          <span style="font-weight:700;font-size:15px;color:#F8FAFC">Revisões pendentes</span>
          <span style="background:#1E293B;color:#64748B;font-size:12px;font-weight:600;padding:2px 8px;border-radius:9999px;margin-left:auto">${dados.revisoesHoje.length}</span>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1E293B">
          ${revisoesHtml}
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-top:8px">
        <a href="${BASE_URL}" style="display:inline-block;background:#1E40AF;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none">
          Abrir Pareto Concursos →
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #1E293B;text-align:center">
      <p style="color:#334155;font-size:12px;margin:0">
        Você está recebendo este email porque tem uma conta no Pareto Concursos.<br>
        <a href="${BASE_URL}" style="color:#3B82F6;text-decoration:none">Acessar plataforma</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────
// Job: disparar notificações para todos os usuários com atividade
// ─────────────────────────────────────────────────────────────────

async function dispararNotificacoes(): Promise<{
  total: number;
  enviados: number;
  ignorados: number;
  erros: { email: string; erro: string }[];
}> {
  const hoje = new Date();

  // Buscar todos os userIds distintos que têm cursosAula
  const userIds = await db
    .selectDistinct({ userId: schema.cursosAula.userId })
    .from(schema.cursosAula)
    .where(isNull(schema.cursosAula.userId) === false as unknown as ReturnType<typeof isNull>);

  const ids = userIds
    .map((r) => r.userId)
    .filter((id): id is string => Boolean(id));

  let enviados = 0;
  let ignorados = 0;
  const erros: { email: string; erro: string }[] = [];

  for (const userId of ids) {
    try {
      const dados = await buscarDadosUsuario(userId, hoje);
      if (!dados) { ignorados++; continue; }

      // Só envia se tiver alguma coisa
      if (dados.aulasHoje.length === 0 && dados.revisoesHoje.length === 0) {
        ignorados++;
        continue;
      }

      const html = gerarEmailHtml(dados, hoje);
      await sendEmail(
        dados.userEmail,
        `📚 Seus estudos de hoje — ${dados.aulasHoje.length} aula(s) + ${dados.revisoesHoje.length} revisão(ões)`,
        html,
      );

      enviados++;
    } catch (err) {
      erros.push({ email: userId, erro: String(err) });
    }
  }

  return { total: ids.length, enviados, ignorados, erros };
}

// ─────────────────────────────────────────────────────────────────
// Rotas
// ─────────────────────────────────────────────────────────────────

// Chave secreta para proteger o endpoint de disparo
// Pode ser chamado por um cron externo (ex: cron-job.org, Upstash QStash)
const CRON_SECRET = process.env.CRON_SECRET ?? "pareto-cron-secret";

export const notificacoesRoutes = new Hono()

  // POST /api/notificacoes/disparar
  // Protegido por header X-Cron-Secret
  // Usar cron-job.org ou similar para chamar todo dia às 7h
  .post("/disparar", async (c) => {
    const secret = c.req.header("x-cron-secret");
    if (secret !== CRON_SECRET) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    try {
      const resultado = await dispararNotificacoes();
      return c.json({ ok: true, ...resultado });
    } catch (err) {
      return c.json({ ok: false, error: String(err) }, 500);
    }
  })

  // GET /api/notificacoes/preview/:userId
  // Preview do email que seria enviado (debug)
  // Protegido pela mesma chave
  .get("/preview/:userId", async (c) => {
    const secret = c.req.header("x-cron-secret");
    if (secret !== CRON_SECRET) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const userId = c.req.param("userId");
    const hoje = new Date();
    const dados = await buscarDadosUsuario(userId, hoje);

    if (!dados) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    const html = gerarEmailHtml(dados, hoje);
    return c.html(html);
  })

  // GET /api/notificacoes/preview-email/:userId
  // Envia o email de preview para o usuário (debug)
  .get("/preview-email/:userId", async (c) => {
    const secret = c.req.header("x-cron-secret");
    if (secret !== CRON_SECRET) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const userId = c.req.param("userId");
    const hoje = new Date();
    const dados = await buscarDadosUsuario(userId, hoje);

    if (!dados) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    const html = gerarEmailHtml(dados, hoje);
    await sendEmail(dados.userEmail, `[PREVIEW] 📚 Seus estudos de hoje`, html);

    return c.json({ ok: true, enviado_para: dados.userEmail });
  });
