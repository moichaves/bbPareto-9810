import { Hono } from "hono";
import { db } from "../database/index";
import * as schema from "../database/schema";
import { eq, desc, inArray, and, isNull } from "drizzle-orm";
import { analisarComGemini } from "../lib/gemini";
import { agendarRevisoes } from "./revisoes";
import { authMiddleware, requireAuth } from "../middleware/auth";

export const simuladoRoutes = new Hono()
  .use(authMiddleware)
  .use(requireAuth)

  // GET /simulado/cursos — lista cursos do usuário com suas aulas (para montar simulado)
  .get("/cursos", async (c) => {
    const userId = c.get("user").id;
    const cursos = await db
      .select()
      .from(schema.cursosAula)
      .where(eq(schema.cursosAula.userId, userId))
      .orderBy(desc(schema.cursosAula.createdAt));

    const result = await Promise.all(
      cursos.map(async (curso) => {
        const aulasLista = await db
          .select()
          .from(schema.aulas)
          .where(eq(schema.aulas.cursoId, curso.id))
          .orderBy(schema.aulas.ordem);
        // Só aulas com conteúdo gerado e com questões cached
        const aulasComQuestoes = await Promise.all(
          aulasLista.filter(a => a.conteudoMd).map(async (aula) => {
            const [cached] = await db
              .select()
              .from(schema.questoesAula)
              .where(eq(schema.questoesAula.aulaId, aula.id))
              .limit(1);
            return { ...aula, temQuestoes: !!cached };
          })
        );
        return { ...curso, aulas: aulasComQuestoes };
      })
    );

    return c.json({ cursos: result }, 200);
  })

  // POST /simulado/gerar — gera (ou retorna cache) questões para uma lista de aulaIds
  .post("/gerar", async (c) => {
    const userId = c.get("user").id;
    const body = await c.req.json<{ aulaIds: number[]; numQuestoes?: number }>();
    const { aulaIds, numQuestoes = 20 } = body;

    if (!aulaIds?.length) return c.json({ error: "Informe ao menos uma aula" }, 400);

    // Verificar ownership: só aulas que pertencem a cursos do userId
    const cursosDoUsuario = await db
      .select({ id: schema.cursosAula.id })
      .from(schema.cursosAula)
      .where(eq(schema.cursosAula.userId, userId));
    const cursoIds = cursosDoUsuario.map(c => c.id);

    const aulasAutorizadas = await db
      .select({ id: schema.aulas.id })
      .from(schema.aulas)
      .where(and(inArray(schema.aulas.id, aulaIds), inArray(schema.aulas.cursoId, cursoIds)));
    const aulaIdsAutorizados = aulasAutorizadas.map(a => a.id);

    if (!aulaIdsAutorizados.length) return c.json({ error: "Nenhuma aula autorizada" }, 403);

    // Pegar questões cached de cada aula autorizada
    const todasQuestoes: any[] = [];
    for (const aulaId of aulaIdsAutorizados) {
      const [cached] = await db
        .select()
        .from(schema.questoesAula)
        .where(eq(schema.questoesAula.aulaId, aulaId))
        .orderBy(desc(schema.questoesAula.createdAt))
        .limit(1);

      if (cached) {
        const qs = JSON.parse(cached.questoesJson) as any[];
        const [aula] = await db.select().from(schema.aulas).where(eq(schema.aulas.id, aulaId));
        qs.forEach(q => todasQuestoes.push({ ...q, aulaId, assunto: aula?.assunto ?? "", disciplina: aula?.disciplina ?? "" }));
      } else {
        // Sem cache: gerar na hora se a aula tiver conteúdo
        const [aula] = await db.select().from(schema.aulas).where(eq(schema.aulas.id, aulaId));
        if (!aula?.conteudoMd) continue;

        const prompt = `Você é professor preparatório para concursos. Com base no conteúdo abaixo, crie EXATAMENTE 10 questões de múltipla escolha no estilo CESGRANRIO/CESPE.

CONTEÚDO:
"""
${aula.conteudoMd.slice(0, 5000)}
"""

REGRAS: 5 alternativas (A-E), uma correta, alternativas plausíveis, varie dificuldade.
ASSUNTO: ${aula.assunto}

RESPONDA APENAS JSON válido:
{"questoes":[{"id":1,"enunciado":"...","alternativas":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"gabarito":"A","explicacao":"..."}]}`;

        try {
          const raw = await analisarComGemini(prompt);
          const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
          const parsed = JSON.parse(cleaned);
          const qs = parsed.questoes ?? parsed;
          await db.insert(schema.questoesAula).values({ aulaId, questoesJson: JSON.stringify(qs) });
          qs.forEach((q: any) => todasQuestoes.push({ ...q, aulaId, assunto: aula.assunto ?? "", disciplina: aula.disciplina ?? "" }));
        } catch {}
      }
    }

    if (!todasQuestoes.length) return c.json({ error: "Nenhuma questão disponível para as aulas selecionadas" }, 400);

    // Embaralhar e recortar para numQuestoes
    const embaralhadas = todasQuestoes.sort(() => Math.random() - 0.5).slice(0, numQuestoes);
    // Renumerar ids sequencialmente
    embaralhadas.forEach((q, i) => { q.numero = i + 1; });

    return c.json({ questoes: embaralhadas }, 200);
  })

  // POST /simulado/resultado — salva resultado + agenda revisões inteligentes dos erros
  .post("/resultado", async (c) => {
    const userId = c.get("user").id;
    const body = await c.req.json<{
      respostas: Record<number, { aulaId: number; resposta: string; gabarito: string; assunto: string }>;
      tempoSegundos: number;
    }>();

    const { respostas, tempoSegundos } = body;

    // Verificar ownership das aulas
    const cursosDoUsuario = await db
      .select({ id: schema.cursosAula.id })
      .from(schema.cursosAula)
      .where(eq(schema.cursosAula.userId, userId));
    const cursoIds = cursosDoUsuario.map(c => c.id);

    const aulaIdsAll = [...new Set(Object.values(respostas).map(r => r.aulaId))];
    const aulasAutorizadas = await db
      .select({ id: schema.aulas.id })
      .from(schema.aulas)
      .where(and(inArray(schema.aulas.id, aulaIdsAll), inArray(schema.aulas.cursoId, cursoIds)));
    const aulaIdsAutorizados = new Set(aulasAutorizadas.map(a => a.id));

    const erros = Object.values(respostas).filter(r => aulaIdsAutorizados.has(r.aulaId) && r.resposta !== r.gabarito);
    const acertos = Object.values(respostas).filter(r => aulaIdsAutorizados.has(r.aulaId) && r.resposta === r.gabarito).length;

    // Agendar revisões apenas para aulas onde errou
    const aulaIdsErro = [...new Set(erros.map(r => r.aulaId))];
    for (const aulaId of aulaIdsErro) {
      const [aula] = await db.select().from(schema.aulas).where(eq(schema.aulas.id, aulaId));
      if (aula && aulaIdsAutorizados.has(aulaId)) {
        await agendarRevisoes(aulaId, aula.cursoId, new Date());
      }
    }

    // Salvar tentativa para cada aula participante (só autorizadas)
    for (const aulaId of aulaIdsAutorizados) {
      const respostasAula = Object.entries(respostas)
        .filter(([, v]) => v.aulaId === aulaId)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v.resposta }), {});
      const acertosAula = Object.values(respostas).filter(r => r.aulaId === aulaId && r.resposta === r.gabarito).length;
      const totalAula = Object.values(respostas).filter(r => r.aulaId === aulaId).length;
      await db.insert(schema.tentativasQuiz).values({
        aulaId,
        acertos: acertosAula,
        total: totalAula,
        respostasJson: JSON.stringify(respostasAula),
      });
    }

    return c.json({
      acertos,
      total: Object.values(respostas).filter(r => aulaIdsAutorizados.has(r.aulaId)).length,
      erros: erros.length,
      revisoesAgendadas: aulaIdsErro.length,
      tempoSegundos,
    }, 200);
  })

  // GET /simulado/ranking-erros — ranking de assuntos por taxa de erro
  .get("/ranking-erros", async (c) => {
    const userId = c.get("user").id;

    // Busca todos os cursos do usuário
    const cursos = await db
      .select()
      .from(schema.cursosAula)
      .where(eq(schema.cursosAula.userId, userId));

    if (!cursos.length) return c.json({ ranking: [] }, 200);

    const cursoIds = cursos.map(c => c.id);
    const aulasAll = await db
      .select()
      .from(schema.aulas)
      .where(inArray(schema.aulas.cursoId, cursoIds));

    const aulaIds = aulasAll.map(a => a.id);
    if (!aulaIds.length) return c.json({ ranking: [] }, 200);

    const tentativas = await db
      .select()
      .from(schema.tentativasQuiz)
      .where(inArray(schema.tentativasQuiz.aulaId, aulaIds))
      .orderBy(desc(schema.tentativasQuiz.createdAt));

    // Agrupa por aulaId
    const porAula: Record<number, { acertos: number; total: number }> = {};
    for (const t of tentativas) {
      if (!porAula[t.aulaId]) porAula[t.aulaId] = { acertos: 0, total: 0 };
      porAula[t.aulaId].acertos += t.acertos;
      porAula[t.aulaId].total += t.total;
    }

    const ranking = Object.entries(porAula)
      .map(([aulaIdStr, stats]) => {
        const aulaId = parseInt(aulaIdStr);
        const aula = aulasAll.find(a => a.id === aulaId);
        const taxaErro = stats.total > 0 ? Math.round(((stats.total - stats.acertos) / stats.total) * 100) : 0;
        return {
          aulaId,
          assunto: aula?.assunto ?? "—",
          disciplina: aula?.disciplina ?? "—",
          taxaErro,
          acertos: stats.acertos,
          total: stats.total,
          erros: stats.total - stats.acertos,
        };
      })
      .filter(r => r.total > 0)
      .sort((a, b) => b.taxaErro - a.taxaErro);

    return c.json({ ranking }, 200);
  });
