import { Hono } from "hono";
import { db } from "../database/index";
import * as schema from "../database/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../middleware/auth";

const PAGBANK_BASE = "https://api.pagseguro.com";
const PAGBANK_TOKEN = process.env.PAGBANK_TOKEN ?? "";

// Preços em centavos
const PLANOS = {
  pro_mensal: { valor: 2700, nome: "Pareto Pro — Mensal", intervalo: "MONTHLY" },
  pro_anual:  { valor: 19700, nome: "Pareto Pro — Anual",  intervalo: "YEARLY"  },
} as const;

// ── Helpers PagBank ───────────────────────────────────────────────────────────

async function pagbankPost(path: string, body: unknown) {
  const r = await fetch(`${PAGBANK_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PAGBANK_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, data: await r.json() };
}

async function pagbankGet(path: string) {
  const r = await fetch(`${PAGBANK_BASE}${path}`, {
    headers: { Authorization: `Bearer ${PAGBANK_TOKEN}` },
  });
  return { ok: r.ok, status: r.status, data: await r.json() };
}

// ── Utilitário: buscar ou criar plan_id no PagBank ────────────────────────────
// Mapeamento fixo — em produção você cria os planos 1x e salva os IDs no .env
async function obterPlanId(tipo: "pro_mensal" | "pro_anual"): Promise<string> {
  const envKey = tipo === "pro_mensal" ? process.env.PAGBANK_PLAN_ID_MENSAL : process.env.PAGBANK_PLAN_ID_ANUAL;
  if (envKey) return envKey;

  // Criar plano dinamicamente se não existir no .env
  const plano = PLANOS[tipo];
  const { ok, data } = await pagbankPost("/recurring-payments/plans", {
    reference_id: `pareto-${tipo}`,
    name: plano.nome,
    description: "Acesso completo ao Pareto Concursos",
    amount: { value: plano.valor, currency: "BRL" },
    interval: { unit: plano.intervalo, length: 1 },
    payment_method: ["CREDIT_CARD"],
    trial: { days: 7, enabled: true, hold_setup_fee: false },
  });

  if (!ok) throw new Error(`Erro ao criar plano PagBank: ${JSON.stringify(data)}`);
  return data.id as string;
}

// ── Rotas ─────────────────────────────────────────────────────────────────────
export const assinaturaRoutes = new Hono()
  .use("/*", authMiddleware)

  // GET /assinatura/status — retorna plano atual do usuário
  .get("/status", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ plano: "free", status: "ativa" });

    const [assinatura] = await db
      .select()
      .from(schema.assinaturas)
      .where(eq(schema.assinaturas.userId, user.id))
      .orderBy(desc(schema.assinaturas.createdAt))
      .limit(1);

    if (!assinatura || assinatura.plano === "free") {
      return c.json({ plano: "free", status: "ativa", renovaEm: null });
    }

    return c.json({
      plano: assinatura.plano,
      status: assinatura.status,
      renovaEm: assinatura.renovaEm?.toISOString() ?? null,
      pagbankSubscriptionId: assinatura.pagbankSubscriptionId,
    });
  })

  // POST /assinatura/checkout — inicia assinatura com cartão
  // Body: { tipo: "pro_mensal" | "pro_anual", cartao: { numero, cvv, mes, ano, titular, cpf }, email, nome, cpf, telefone }
  .post("/checkout", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Não autenticado" }, 401);

    const body = await c.req.json();
    const { tipo, cartao, email, nome, cpf, telefone } = body as {
      tipo: "pro_mensal" | "pro_anual";
      cartao: { numero: string; cvv: string; mes: string; ano: string; titular: string; token: string };
      email: string;
      nome: string;
      cpf: string;
      telefone: string;
    };

    if (!PLANOS[tipo]) return c.json({ error: "Plano inválido" }, 400);

    // 1. Obter plan_id
    let planId: string;
    try {
      planId = await obterPlanId(tipo);
    } catch (e: unknown) {
      return c.json({ error: String(e) }, 500);
    }

    // 2. Criar subscriber
    const subRes = await pagbankPost("/recurring-payments/subscribers", {
      reference_id: `pareto-user-${user.id}`,
      name: nome,
      email: email,
      tax_id: cpf.replace(/\D/g, ""),
      phones: [{ country: "55", area: telefone.slice(0, 2), number: telefone.slice(2), type: "MOBILE" }],
      payment_method: {
        type: "CREDIT_CARD",
        card: { encrypted: cartao.token }, // token encriptado via SDK PagBank JS
      },
    });

    if (!subRes.ok) {
      console.error("Erro subscriber:", subRes.data);
      return c.json({ error: "Erro ao cadastrar pagador no PagBank", detail: subRes.data }, 400);
    }

    const subscriberId = subRes.data.id as string;

    // 3. Criar subscription
    const subsRes = await pagbankPost("/recurring-payments/subscriptions", {
      reference_id: `pareto-sub-${user.id}-${Date.now()}`,
      plan: { id: planId },
      subscriber: { id: subscriberId },
    });

    if (!subsRes.ok) {
      console.error("Erro subscription:", subsRes.data);
      return c.json({ error: "Erro ao criar assinatura no PagBank", detail: subsRes.data }, 400);
    }

    const sub = subsRes.data;

    // 4. Salvar no banco
    await db.insert(schema.assinaturas).values({
      userId: user.id,
      plano: tipo,
      status: sub.status === "ACTIVE" ? "ativa" : "pendente",
      pagbankPlanId: planId,
      pagbankSubscriptionId: sub.id,
      pagbankSubscriberId: subscriberId,
      renovaEm: sub.next_invoice_at ? new Date(sub.next_invoice_at) : null,
    });

    return c.json({ ok: true, status: sub.status, subscriptionId: sub.id });
  })

  // POST /assinatura/cancelar
  .post("/cancelar", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Não autenticado" }, 401);

    const [assinatura] = await db
      .select()
      .from(schema.assinaturas)
      .where(eq(schema.assinaturas.userId, user.id))
      .orderBy(desc(schema.assinaturas.createdAt))
      .limit(1);

    if (!assinatura?.pagbankSubscriptionId) {
      return c.json({ error: "Nenhuma assinatura ativa" }, 400);
    }

    const { ok, data } = await pagbankPost(
      `/recurring-payments/subscriptions/${assinatura.pagbankSubscriptionId}/cancel`,
      {}
    );

    if (!ok) return c.json({ error: "Erro ao cancelar no PagBank", detail: data }, 400);

    await db
      .update(schema.assinaturas)
      .set({ status: "cancelada", canceladaEm: new Date() })
      .where(eq(schema.assinaturas.id, assinatura.id));

    return c.json({ ok: true });
  })

  // POST /assinatura/webhook — PagBank notifica mudanças de status
  .post("/webhook", async (c) => {
    const body = await c.req.json();
    // Tipos de evento relevantes
    if (body.type === "subscription.updated" || body.type === "subscription.charged") {
      const sub = body.data;
      const novoStatus =
        sub.status === "ACTIVE" ? "ativa" :
        sub.status === "SUSPENDED" ? "suspensa" :
        sub.status === "CANCELED" ? "cancelada" : "pendente";

      await db
        .update(schema.assinaturas)
        .set({
          status: novoStatus,
          renovaEm: sub.next_invoice_at ? new Date(sub.next_invoice_at) : undefined,
        })
        .where(eq(schema.assinaturas.pagbankSubscriptionId, sub.id));
    }
    return c.json({ ok: true });
  });

// ── Helper exportado para checar plano em outras rotas ────────────────────────
export async function isPro(userId: string): Promise<boolean> {
  const [assinatura] = await db
    .select({ plano: schema.assinaturas.plano, status: schema.assinaturas.status })
    .from(schema.assinaturas)
    .where(eq(schema.assinaturas.userId, userId))
    .orderBy(desc(schema.assinaturas.createdAt))
    .limit(1);

  if (!assinatura) return false;
  return (assinatura.plano === "pro_mensal" || assinatura.plano === "pro_anual")
    && assinatura.status === "ativa";
}
