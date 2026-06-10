import { Hono } from "hono";
import { db } from "../database/index";
import * as schema from "../database/schema";
import { eq, and, lte, isNull, asc } from "drizzle-orm";
import { analisarComGemini } from "../lib/gemini";
import { authMiddleware, requireAuth } from "../middleware/auth";

// ── Perfis de bancas (espelhado de aulas.ts) ──────────────────────────────────
const PERFIS_BANCA: Record<string, string> = {
  cesgranrio: `PERFIL CESGRANRIO: enunciados longos e contextualizados, cobra raciocínio (não decoreba), alternativas muito próximas diferindo em detalhe numérico ou termo técnico, peso alto em Matemática Financeira e Conhecimentos Bancários.`,
  cespe: `PERFIL CESPE/CEBRASPE: afirmações certo/errado com detalhe errado escondido, cobra legislação na literalidade, cuidado com "sempre"/"nunca"/"somente" (generalizações quase sempre erradas).`,
  fgv: `PERFIL FGV: casos concretos elaborados, cobra divergências doutrinárias, informativos STF/STJ dos últimos 24 meses, mistura institutos vizinhos no mesmo enunciado.`,
  fcc: `PERFIL FCC: questões diretas, letra da lei, troca de termos técnicos semelhantes ("pode" vs "deve"), gramática normativa com peso alto.`,
  vunesp: `PERFIL VUNESP: enunciados médios, equilibra teoria e prática, legislação vigente com alterações recentes.`,
};

function getPerfilBanca(banca: string): string {
  if (!banca) return "";
  const key = banca.toLowerCase().replace(/[^a-z]/g, "");
  for (const [nome, perfil] of Object.entries(PERFIS_BANCA)) {
    if (key.includes(nome)) return perfil;
  }
  return "";
}

// Intervalos em ms
const INTERVALOS: Record<string, number> = {
  "24h":  1  * 24 * 60 * 60 * 1000,
  "7d":   7  * 24 * 60 * 60 * 1000,
  "30d":  30 * 24 * 60 * 60 * 1000,
  "90d":  90 * 24 * 60 * 60 * 1000,
};

// Criar as 4 revisões ao concluir uma aula
export async function agendarRevisoes(aulaId: number, cursoId: number, baseDate: Date) {
  // Apagar revisões pendentes anteriores (re-agendar se relido)
  await db
    .delete(schema.revisoes)
    .where(and(eq(schema.revisoes.aulaId, aulaId), isNull(schema.revisoes.concluidaEm)));

  const agora = baseDate.getTime();
  const values = Object.entries(INTERVALOS).map(([tipo, ms]) => ({
    aulaId,
    cursoId,
    tipo,
    agendadaPara: new Date(agora + ms),
    createdAt: baseDate,
  }));

  await db.insert(schema.revisoes).values(values);
}

export const revisoesRoutes = new Hono()
  .use(authMiddleware)
  .use(requireAuth)

  // GET /revisoes/hoje — revisões pendentes para hoje
  .get("/hoje", async (c) => {
    const userId = c.get("user").id;
    const agora = new Date();
    const fimDia = new Date(agora);
    fimDia.setHours(23, 59, 59, 999);

    const pendentes = await db
      .select({
        id: schema.revisoes.id,
        tipo: schema.revisoes.tipo,
        agendadaPara: schema.revisoes.agendadaPara,
        aulaId: schema.revisoes.aulaId,
        cursoId: schema.revisoes.cursoId,
        assunto: schema.aulas.assunto,
        disciplina: schema.aulas.disciplina,
        prioridade: schema.aulas.prioridade,
        cursoTitulo: schema.cursosAula.titulo,
      })
      .from(schema.revisoes)
      .innerJoin(schema.aulas, eq(schema.revisoes.aulaId, schema.aulas.id))
      .innerJoin(schema.cursosAula, eq(schema.revisoes.cursoId, schema.cursosAula.id))
      .where(
        and(
          eq(schema.cursosAula.userId, userId),
          lte(schema.revisoes.agendadaPara, fimDia),
          isNull(schema.revisoes.concluidaEm)
        )
      )
      .orderBy(asc(schema.revisoes.agendadaPara));

    return c.json({ revisoes: pendentes }, 200);
  })

  // GET /revisoes/proximas — todas as pendentes agrupadas
  .get("/proximas", async (c) => {
    const userId = c.get("user").id;

    const pendentes = await db
      .select({
        id: schema.revisoes.id,
        tipo: schema.revisoes.tipo,
        agendadaPara: schema.revisoes.agendadaPara,
        aulaId: schema.revisoes.aulaId,
        cursoId: schema.revisoes.cursoId,
        assunto: schema.aulas.assunto,
        disciplina: schema.aulas.disciplina,
        prioridade: schema.aulas.prioridade,
        cursoTitulo: schema.cursosAula.titulo,
      })
      .from(schema.revisoes)
      .innerJoin(schema.aulas, eq(schema.revisoes.aulaId, schema.aulas.id))
      .innerJoin(schema.cursosAula, eq(schema.revisoes.cursoId, schema.cursosAula.id))
      .where(
        and(
          eq(schema.cursosAula.userId, userId),
          isNull(schema.revisoes.concluidaEm)
        )
      )
      .orderBy(asc(schema.revisoes.agendadaPara));

    return c.json({ revisoes: pendentes }, 200);
  })

  // GET /revisoes/contagem — quantas pendentes hoje (para badge)
  .get("/contagem", async (c) => {
    const userId = c.get("user").id;
    const fimDia = new Date();
    fimDia.setHours(23, 59, 59, 999);

    const pendentes = await db
      .select({ id: schema.revisoes.id })
      .from(schema.revisoes)
      .innerJoin(schema.cursosAula, eq(schema.revisoes.cursoId, schema.cursosAula.id))
      .where(
        and(
          eq(schema.cursosAula.userId, userId),
          lte(schema.revisoes.agendadaPara, fimDia),
          isNull(schema.revisoes.concluidaEm)
        )
      );

    return c.json({ total: pendentes.length }, 200);
  })

  // GET /revisoes/aula/:aulaId — status das revisões de uma aula específica
  .get("/aula/:aulaId", async (c) => {
    const aulaId = parseInt(c.req.param("aulaId"));
    const userId = c.get("user").id;

    // Verificar ownership via JOIN
    const revisoes = await db
      .select({
        id: schema.revisoes.id,
        tipo: schema.revisoes.tipo,
        agendadaPara: schema.revisoes.agendadaPara,
        concluidaEm: schema.revisoes.concluidaEm,
        aulaId: schema.revisoes.aulaId,
        cursoId: schema.revisoes.cursoId,
      })
      .from(schema.revisoes)
      .innerJoin(schema.cursosAula, eq(schema.revisoes.cursoId, schema.cursosAula.id))
      .where(and(eq(schema.revisoes.aulaId, aulaId), eq(schema.cursosAula.userId, userId)))
      .orderBy(asc(schema.revisoes.agendadaPara));

    return c.json({ revisoes }, 200);
  })

  // GET /revisoes/:id/questoes — gera (ou retorna do cache) 10 questões calibradas para a banca
  .get("/:id/questoes", async (c) => {
    const id = parseInt(c.req.param("id"));
    const userId = c.get("user").id;

    const [revisao] = await db
      .select({
        id: schema.revisoes.id,
        tipo: schema.revisoes.tipo,
        questoesJson: schema.revisoes.questoesJson,
        assunto: schema.aulas.assunto,
        disciplina: schema.aulas.disciplina,
        conteudoMd: schema.aulas.conteudoMd,
        cargo: schema.cursosAula.cargo,
        banca: schema.cursosAula.banca,
      })
      .from(schema.revisoes)
      .innerJoin(schema.aulas, eq(schema.revisoes.aulaId, schema.aulas.id))
      .innerJoin(schema.cursosAula, eq(schema.revisoes.cursoId, schema.cursosAula.id))
      .where(and(eq(schema.revisoes.id, id), eq(schema.cursosAula.userId, userId)));

    if (!revisao) return c.json({ error: "Revisão não encontrada" }, 404);

    // Cache: retornar se já gerou
    if (revisao.questoesJson) {
      return c.json({ questoes: JSON.parse(revisao.questoesJson) }, 200);
    }

    // Montar contexto
    const banca = revisao.banca ?? "CESGRANRIO";
    const perfilBanca = getPerfilBanca(banca) || `Banca: ${banca}`;
    const trechoAula = revisao.conteudoMd ? revisao.conteudoMd.slice(0, 6000) : "";

    // Dificuldade progressiva conforme o tipo de revisão (quanto mais tarde, mais difícil)
    const nivelPorTipo: Record<string, string> = {
      "24h": "Q1-Q4 fáceis (reforço imediato), Q5-Q8 médias, Q9-Q10 difíceis",
      "7d":  "Q1-Q3 fáceis, Q4-Q7 médias, Q8-Q10 difíceis",
      "30d": "Q1-Q2 fáceis, Q3-Q6 médias, Q7-Q10 difíceis",
      "90d": "Q1-Q2 fáceis, Q3-Q5 médias, Q6-Q10 difíceis com pegadinhas de banca",
    };
    const nivelDificuldade = nivelPorTipo[revisao.tipo ?? "7d"] ?? nivelPorTipo["7d"];

    const prompt = `Você é elaborador sênior de questões de concurso para o cargo "${revisao.cargo ?? "Agente Comercial"}" (banca: ${banca}).

${perfilBanca}

Gere EXATAMENTE 10 questões de múltipla escolha sobre: "${revisao.assunto}" — ${revisao.disciplina ?? ""}
${trechoAula ? `\nBASEIE-SE no conteúdo da aula abaixo (use os conceitos, exemplos e terminologia presentes nele):\n"""\n${trechoAula}\n"""` : ""}

REGRAS OBRIGATÓRIAS:
- 5 alternativas (A a E), apenas 1 correta
- Alternativas incorretas plausíveis — sem opções obviamente erradas
- Varie o formato: definição, situação-problema, aplicação prática, interpretação de texto
- Dificuldade progressiva: ${nivelDificuldade}
- Use terminologia e estilo de enunciado da banca ${banca}
- Este é uma revisão "${revisao.tipo ?? ""}" — foque em consolidar retenção e aplicação, não apenas reconhecimento

Retorne APENAS JSON válido, sem markdown, neste formato:
[
  {
    "numero": 1,
    "enunciado": "texto da questão",
    "alternativas": {
      "A": "texto",
      "B": "texto",
      "C": "texto",
      "D": "texto",
      "E": "texto"
    },
    "gabarito": "A",
    "explicacao": "Por que a alternativa correta está certa e por que as principais erradas estão erradas"
  }
]`;

    let questoes: unknown[] = [];
    try {
      const resp = await analisarComGemini(prompt);
      let limpo = resp.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      const ini = limpo.indexOf("[");
      const fim = limpo.lastIndexOf("]");
      if (ini !== -1 && fim !== -1) limpo = limpo.slice(ini, fim + 1);
      questoes = JSON.parse(limpo);
    } catch (err) {
      console.error("[revisoes/questoes] erro ao gerar:", err);
      return c.json({ error: "Erro ao gerar questões. Tente novamente." }, 500);
    }

    // Salvar no cache
    await db
      .update(schema.revisoes)
      .set({ questoesJson: JSON.stringify(questoes) })
      .where(eq(schema.revisoes.id, id));

    return c.json({ questoes }, 200);
  })


  // PATCH /revisoes/:id/concluir — marcar revisão como feita
  .patch("/:id/concluir", async (c) => {
    const id = parseInt(c.req.param("id"));
    const userId = c.get("user").id;

    // Ownership check via JOIN
    const [revisao] = await db
      .select({ id: schema.revisoes.id })
      .from(schema.revisoes)
      .innerJoin(schema.cursosAula, eq(schema.revisoes.cursoId, schema.cursosAula.id))
      .where(and(eq(schema.revisoes.id, id), eq(schema.cursosAula.userId, userId)));

    if (!revisao) return c.json({ error: "Revisão não encontrada" }, 404);

    await db
      .update(schema.revisoes)
      .set({ concluidaEm: new Date() })
      .where(eq(schema.revisoes.id, id));

    return c.json({ success: true }, 200);
  });
