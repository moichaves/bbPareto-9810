import { Hono } from "hono";
import { db } from "../database/index";
import * as schema from "../database/schema";
import { eq, desc, asc, inArray, and, count, gte } from "drizzle-orm";
import { analisarComGemini } from "../lib/gemini";
import { agendarRevisoes } from "./revisoes";
import { authMiddleware, requireAuth } from "../middleware/auth";
import { isPro } from "./assinatura";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ── Perfis de bancas conhecidas ───────────────────────────────────────────────
const PERFIS_BANCA: Record<string, string> = {
  cesgranrio: `
PERFIL DA BANCA — CESGRANRIO:
• Questões com enunciados longos e contextualizados — cobra raciocínio e interpretação, não decoreba
• Matemática Financeira e Raciocínio Lógico têm peso alto; espere cálculos com juros compostos, amortização e análise de investimentos
• Língua Portuguesa foca em interpretação de textos formais e norma culta; raramente cobra gramática isolada
• Conhecimentos Bancários: produtos e serviços financeiros, mercado de capitais, regulamentação do SFN
• Atualidades do mercado financeiro: Banco Central, BACEN, taxa Selic, política monetária
• Raramente repete questões idênticas — adapta o contexto mas mantém o conceito cobrado
• Pegadinha clássica: alternativas muito próximas que diferem apenas em detalhe numérico ou termo técnico
• Valoriza candidatos que entendem o "porquê" da resposta, não apenas o "o quê"`,

  cespe: `
PERFIL DA BANCA — CESPE/CEBRASPE:
• Questões de certo/errado com afirmações que parecem corretas mas têm um detalhe errado
• Cobra legislação na literalidade — um advérbio trocado pode inverter o gabarito
• Jurisprudência recente do STF/STJ tem peso alto; informativos dos últimos 12 meses são alvo frequente
• Português: foca em coesão, coerência e análise sintática; cuidado com pronomes e concordância
• Pegadinha clássica: "sempre", "nunca", "somente" — generalizações absolutas quase sempre estão erradas`,

  fgv: `
PERFIL DA BANCA — FGV:
• Questões com casos concretos elaborados, exige aplicação do conhecimento em situação real
• Cobra divergências doutrinárias e jurisprudenciais — espera saber os dois lados
• Informativos STF/STJ dos últimos 24 meses são alvo prioritário
• Português: interpretação de textos longos, crase e regência são recorrentes
• Pegadinha clássica: mistura institutos vizinhos no mesmo enunciado`,

  fcc: `
PERFIL DA BANCA — FCC:
• Questões mais diretas e objetivas, cobra letra da lei com frequência
• Português tem peso alto; gramática normativa, análise morfossintática e interpretação
• Raciocínio Lógico: proposições, tabelas-verdade, diagramas de conjuntos
• Pegadinha clássica: troca de termos técnicos semelhantes (ex: "pode" vs "deve")`,

  vunesp: `
PERFIL DA BANCA — VUNESP:
• Equilibra teoria e prática; enunciados médios, nem muito longos nem muito curtos
• Português: interpretação e gramática com peso equivalente
• Raciocínio Lógico com foco em sequências e problemas aritméticos
• Cobra legislação vigente com atenção a alterações recentes`,
};

function getPerfilBanca(banca: string): string {
  if (!banca) return "";
  const key = banca.toLowerCase().replace(/[^a-z]/g, "");
  for (const [nome, perfil] of Object.entries(PERFIS_BANCA)) {
    if (key.includes(nome)) return perfil;
  }
  return "";
}

// ── PDF helper (mesmo padrão do analise.ts) ───────────────────────────────────
async function extractPdfText(buffer: Buffer): Promise<string> {
  const id = `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pdfPath = join(tmpdir(), `${id}.pdf`);
  const txtPath = join(tmpdir(), `${id}.txt`);
  try {
    writeFileSync(pdfPath, buffer);
    execSync(`pdftotext "${pdfPath}" "${txtPath}"`, { timeout: 60000 });
    return readFileSync(txtPath, "utf-8");
  } catch {
    return "";
  } finally {
    try { unlinkSync(pdfPath); } catch {}
    try { unlinkSync(txtPath); } catch {}
  }
}

// ── Wrapper com retry para rate limit do Gemini ───────────────────────────────
async function geminiComRetry(prompt: string, maxTentativas = 5): Promise<string> {
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      return await analisarComGemini(prompt);
    } catch (err: unknown) {
      const msg = String(err);
      const is429 = msg.includes("429") || msg.includes("quota") || msg.includes("rate") || msg.includes("RESOURCE_EXHAUSTED");
      if (is429 && tentativa < maxTentativas) {
        // Backoff exponencial: 60s, 90s, 120s, 150s
        const espera = 60000 + (tentativa - 1) * 30000;
        console.log(`[gemini rate limit] tentativa ${tentativa}/${maxTentativas}. Aguardando ${espera / 1000}s...`);
        await new Promise((r) => setTimeout(r, espera));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Máximo de tentativas excedido");
}

// ── Gerar conteúdo Markdown de uma aula via Gemini ────────────────────────────
async function gerarAula(params: {
  assunto: string;
  disciplina: string;
  cargo: string;
  banca: string;
  textoApostila: string;
  semana: number;
  diaSemana: string;
  prioridade: string;
}): Promise<string> {
  const { assunto, disciplina, cargo, banca, textoApostila, semana, diaSemana, prioridade } = params;

  const trechoApostila = textoApostila ? textoApostila.slice(0, 8000) : "";
  const perfilBanca = getPerfilBanca(banca);

  const prompt = `Você é um professor especialista em preparação para concursos públicos bancários, com foco em resultado: aprovação com a maior nota possível no menor tempo de estudo.

Crie uma aula DENSA e OBJETIVA exclusivamente sobre "${assunto}". NÃO inclua conteúdo de outros tópicos.

CARGO: ${cargo}
DISCIPLINA: ${disciplina}
ASSUNTO: ${assunto}
SEMANA: ${semana} | DIA: ${diaSemana} | PRIORIDADE: ${prioridade.toUpperCase()}
${perfilBanca ? `\n${perfilBanca}\n` : ""}${trechoApostila ? `\nAPOSTILA DE REFERÊNCIA (use apenas trechos relevantes para "${assunto}"):\n"""\n${trechoApostila}\n"""\n` : ""}
DIRETRIZES:
- Seja denso: prefira listas, tabelas e esquemas a parágrafos longos
- Priorize o que cai na prova, não o que é interessante
- Cada conceito deve ter conexão direta com questões de concurso
- Inclua termos técnicos que a banca usa no enunciado
- Nas questões de fixação, crie alternativas plausíveis (pegadinhas reais)

Responda em Markdown com EXATAMENTE estas seções, nesta ordem:

# ${assunto}

## 📚 Resumo Teórico
[Conceitos, definições, regras e fórmulas essenciais. Use tabelas comparativas sempre que houver mais de 2 itens para comparar. Seja denso — sem introduções ou transições desnecessárias.]

## 🔗 Correlações
[Como este assunto se conecta com outros tópicos da prova. O que costuma cair junto. Pontos de confusão com assuntos adjacentes.]

## 🎯 Pegadinhas da Banca
- [Pegadinhas reais e recorrentes especificamente para "${assunto}" no estilo da banca ${banca || "de concursos bancários"}]
- [Mínimo 3, máximo 6 pegadinhas. Cada uma com: situação + por que engana + resposta correta]

## 💡 Palavras-chave da Prova
[Lista das palavras e expressões que a banca usa nos enunciados sobre este assunto. Conhecê-las ajuda a identificar o tema rapidamente.]

## 📝 Exemplo Resolvido
**Questão:** [Enunciado completo no estilo ${cargo}, com contexto realista]
**Resolução passo a passo:**
[Resolução didática mostrando o raciocínio, não apenas o resultado]
**Resposta:** [letra e justificativa em 1 linha]

## ✅ Questões de Fixação

**Q1.** [Enunciado — nível fácil]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]
e) [alternativa]
<details><summary>Gabarito</summary>**[letra]** — [explicação curta destacando por que as outras estão erradas]</details>

**Q2.** [Enunciado — nível médio]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]
e) [alternativa]
<details><summary>Gabarito</summary>**[letra]** — [explicação curta destacando por que as outras estão erradas]</details>

**Q3.** [Enunciado — nível difícil, com pegadinha]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]
e) [alternativa]
<details><summary>Gabarito</summary>**[letra]** — [explicação curta destacando por que as outras estão erradas]</details>

---
*${cargo} | Semana ${semana} - ${diaSemana} | ${prioridade.toUpperCase()}*
`;

  return geminiComRetry(prompt);
}

// ── Extrair itens do plano de um curso ───────────────────────────────────────
async function extrairItensPlano(curso: typeof schema.cursosAula.$inferSelect): Promise<Array<{
  semana: number;
  diaSemana: string;
  assunto: string;
  disciplina: string;
  prioridade: string;
}>> {
  let itensPlano: Array<{ semana: number; diaSemana: string; assunto: string; disciplina: string; prioridade: string }> = [];

  if (curso.analiseId) {
    const [plano] = await db
      .select({ planoJson: schema.planosEstudo.planoJson })
      .from(schema.planosEstudo)
      .where(eq(schema.planosEstudo.analiseId, curso.analiseId))
      .orderBy(desc(schema.planosEstudo.createdAt))
      .limit(1);

    if (plano?.planoJson) {
      try {
        const planoData = JSON.parse(plano.planoJson);
        if (Array.isArray(planoData)) {
          itensPlano = planoData;
        } else if (planoData.semanas) {
          for (const semana of planoData.semanas) {
            for (const dia of semana.dias ?? []) {
              const diaSemanaItem = (dia.diaSemana ?? dia.dia ?? "") as string;
              if (diaSemanaItem.toLowerCase().includes("domingo")) continue;
              const assuntos = Array.isArray(dia.assuntos) ? dia.assuntos : [dia.assunto ?? ""];
              const disciplinas = Array.isArray(dia.disciplinas) ? dia.disciplinas : [dia.disciplina ?? ""];
              for (let i = 0; i < assuntos.length; i++) {
                itensPlano.push({
                  semana: semana.semana ?? semana.numero ?? 1,
                  diaSemana: diaSemanaItem,
                  assunto: assuntos[i] ?? "",
                  disciplina: disciplinas[i] ?? disciplinas[0] ?? "",
                  prioridade: dia.prioridade ?? "media",
                });
              }
            }
          }
        } else if (planoData.dias) {
          itensPlano = planoData.dias.map((d: Record<string, unknown>, i: number) => ({
            semana: (d.semana as number) ?? Math.floor(i / 6) + 1,
            diaSemana: (d.diaSemana ?? d.dia ?? "") as string,
            assunto: (d.assunto ?? "") as string,
            disciplina: (d.disciplina ?? "") as string,
            prioridade: (d.prioridade ?? "media") as string,
          }));
        }
      } catch {
        console.error("[aulas] Erro ao parsear plano JSON");
      }
    }

    if (itensPlano.length === 0) {
      const assuntosList = await db
        .select()
        .from(schema.assuntos)
        .where(eq(schema.assuntos.analiseId, curso.analiseId))
        .orderBy(desc(schema.assuntos.percentual));
      const diasSemana = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      assuntosList.forEach((a, i) => {
        itensPlano.push({
          semana: Math.floor(i / 6) + 1,
          diaSemana: diasSemana[i % 6],
          assunto: a.nome,
          disciplina: a.disciplina,
          prioridade: a.prioridade ?? "media",
        });
      });
    }
  }

  if (itensPlano.length === 0) {
    itensPlano = [
      { semana: 1, diaSemana: "Segunda", assunto: "Introdução ao Concurso", disciplina: "Geral", prioridade: "alta" },
    ];
  }

  return itensPlano;
}

// ── Rotas ─────────────────────────────────────────────────────────────────────
export const aulasRoutes = new Hono()
  .use(authMiddleware)
  .use(requireAuth)

  // GET /cursos — listar todos os cursos
  .get("/cursos", async (c) => {
    const userId = c.get("user").id;
    const cursos = await db
      .select()
      .from(schema.cursosAula)
      .where(eq(schema.cursosAula.userId, userId))
      .orderBy(desc(schema.cursosAula.createdAt));

    // Para cada curso, contar aulas
    const cursosComContagem = await Promise.all(
      cursos.map(async (curso) => {
        const todasAulas = await db
          .select({ id: schema.aulas.id })
          .from(schema.aulas)
          .where(eq(schema.aulas.cursoId, curso.id));
        return { ...curso, totalAulas: todasAulas.length };
      })
    );

    return c.json({ cursos: cursosComContagem }, 200);
  })

  // POST /cursos — criar curso + upload apostilas
  .post("/cursos", async (c) => {
    const userId = c.get("user").id;
    const formData = await c.req.formData();
    const titulo = formData.get("titulo") as string;
    const cargo = formData.get("cargo") as string;
    const banca = (formData.get("banca") as string | null) ?? "";
    const analiseIdRaw = formData.get("analiseId") as string | null;
    const apostilas = formData.getAll("apostilas") as File[];

    if (!titulo || !cargo) {
      return c.json({ error: "Título e cargo são obrigatórios" }, 400);
    }

    const analiseId = analiseIdRaw ? parseInt(analiseIdRaw) : null;

    // Salvar curso
    const [curso] = await db
      .insert(schema.cursosAula)
      .values({ titulo, cargo, banca, analiseId, userId })
      .returning();

    // Extrair texto das apostilas e salvar como metadata no curso
    let textoApostila = "";
    for (const apostila of apostilas) {
      const buffer = Buffer.from(await apostila.arrayBuffer());
      const texto = await extractPdfText(buffer);
      textoApostila += `\n\n=== ${apostila.name} ===\n${texto}`;
    }

    // Salvar texto completo no banco
    if (textoApostila) {
      await db.update(schema.cursosAula)
        .set({ textoApostila })
        .where(eq(schema.cursosAula.id, curso.id));
    }

    return c.json({ cursoId: curso.id, success: true }, 201);
  })

  // POST /cursos/:id/apostilas — upload de apostilas para curso existente
  .post("/cursos/:id/apostilas", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const userId = c.get("user").id;

    const [curso] = await db.select().from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    const formData = await c.req.formData();
    const apostilas = formData.getAll("apostilas") as File[];

    if (apostilas.length === 0) return c.json({ error: "Nenhum arquivo enviado" }, 400);

    let textoNovo = curso.textoApostila ?? "";
    for (const apostila of apostilas) {
      const buffer = Buffer.from(await apostila.arrayBuffer());
      const texto = await extractPdfText(buffer);
      textoNovo += `\n\n=== ${apostila.name} ===\n${texto}`;
    }

    await db.update(schema.cursosAula)
      .set({ textoApostila: textoNovo })
      .where(eq(schema.cursosAula.id, cursoId));

    return c.json({ success: true, chars: textoNovo.length }, 200);
  })

  // GET /cursos/:id/gerar/status — polling do progresso de geração
  .get("/cursos/:id/gerar/status", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const userId = c.get("user").id;
    const [curso] = await db
      .select({
        id: schema.cursosAula.id,
        gerandoStatus: schema.cursosAula.gerandoStatus,
        gerandoErro: schema.cursosAula.gerandoErro,
        totalAulasGeradas: schema.cursosAula.totalAulasGeradas,
      })
      .from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);
    return c.json(curso, 200);
  })

  // POST /cursos/:id/inicializar — popula lista de aulas (pendentes) a partir do plano, sem chamar Gemini
  .post("/cursos/:id/inicializar", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const userId = c.get("user").id;
    const [curso] = await db.select().from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    // Limpar aulas existentes
    await db.delete(schema.aulas).where(eq(schema.aulas.cursoId, cursoId));

    const itens = await extrairItensPlano(curso);

    // Inserir todas como pendentes (sem conteúdo — string vazia para evitar NOT NULL)
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      await db.insert(schema.aulas).values({
        cursoId,
        ordem: i,
        semana: item.semana,
        diaSemana: item.diaSemana,
        assunto: item.assunto,
        disciplina: item.disciplina,
        prioridade: item.prioridade,
        conteudoMd: "",
        status: "pendente",
      });
    }

    await db.update(schema.cursosAula)
      .set({ gerandoStatus: "concluido", totalAulasGeradas: 0 })
      .where(eq(schema.cursosAula.id, cursoId));

    return c.json({ success: true, total: itens.length }, 200);
  })

  // POST /cursos/:id/aulas/:aulaId/gerar — gera conteúdo de UMA aula sob demanda
  .post("/cursos/:id/aulas/:aulaId/gerar", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const aulaId = parseInt(c.req.param("aulaId"));
    const userId = c.get("user").id;

    // Ownership: curso deve pertencer ao usuário
    const [curso] = await db.select().from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    // Ownership: aula deve pertencer ao curso
    const [aula] = await db.select().from(schema.aulas)
      .where(and(eq(schema.aulas.id, aulaId), eq(schema.aulas.cursoId, cursoId)));
    if (!aula) return c.json({ error: "Aula não encontrada" }, 404);

    // Se já tem conteúdo, retorna direto
    if (aula.conteudoMd && aula.status !== "pendente") return c.json({ aula }, 200);

    // ── Limite do plano grátis: 10 aulas geradas por conta ───────────────────
    const LIMITE_GRATIS = 10;
    const [{ total }] = await db
      .select({ total: count() })
      .from(schema.aulas)
      .innerJoin(schema.cursosAula, eq(schema.aulas.cursoId, schema.cursosAula.id))
      .where(and(eq(schema.cursosAula.userId, userId), eq(schema.aulas.status, "gerada")));
    if (total >= LIMITE_GRATIS) {
      return c.json({ error: "limite_atingido", limite: LIMITE_GRATIS, total }, 402);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const conteudoMd = await gerarAula({
      assunto: aula.assunto,
      disciplina: aula.disciplina ?? "",
      cargo: curso.cargo ?? "",
      banca: curso.banca ?? "",
      textoApostila: curso.textoApostila ?? "",
      semana: aula.semana ?? 1,
      diaSemana: aula.diaSemana ?? "",
      prioridade: aula.prioridade ?? "media",
    });

    const [aulaAtualizada] = await db
      .update(schema.aulas)
      .set({ conteudoMd, status: "gerada" })
      .where(eq(schema.aulas.id, aulaId))
      .returning();

    return c.json({ aula: aulaAtualizada }, 200);
  })

  // POST /cursos/:id/gerar — mantido para compatibilidade (redireciona para inicializar)
  .post("/cursos/:id/gerar", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const userId = c.get("user").id;
    const [curso] = await db.select().from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    await db.delete(schema.aulas).where(eq(schema.aulas.cursoId, cursoId));
    const itens = await extrairItensPlano(curso);
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      await db.insert(schema.aulas).values({
        cursoId, ordem: i, semana: item.semana, diaSemana: item.diaSemana,
        assunto: item.assunto, disciplina: item.disciplina, prioridade: item.prioridade,
        conteudoMd: "", status: "pendente",
      });
    }
    await db.update(schema.cursosAula)
      .set({ gerandoStatus: "concluido", totalAulasGeradas: 0 })
      .where(eq(schema.cursosAula.id, cursoId));

    return c.json({ success: true, total: itens.length, message: "Aulas criadas como pendentes. Conteúdo gerado sob demanda ao abrir cada aula." }, 200);
  })

  // GET /cursos/:id — curso + todas as aulas (sem conteúdo completo)
  .get("/cursos/:id", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const userId = c.get("user").id;

    const [curso] = await db
      .select()
      .from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));

    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    const listaAulas = await db
      .select({
        id: schema.aulas.id,
        ordem: schema.aulas.ordem,
        semana: schema.aulas.semana,
        diaSemana: schema.aulas.diaSemana,
        assunto: schema.aulas.assunto,
        disciplina: schema.aulas.disciplina,
        prioridade: schema.aulas.prioridade,
        status: schema.aulas.status,
        createdAt: schema.aulas.createdAt,
      })
      .from(schema.aulas)
      .where(eq(schema.aulas.cursoId, cursoId))
      .orderBy(asc(schema.aulas.ordem));

    return c.json({ curso, aulas: listaAulas }, 200);
  })

  // GET /cursos/:id/aulas/:aulaId — conteúdo completo de uma aula
  .get("/cursos/:id/aulas/:aulaId", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const aulaId = parseInt(c.req.param("aulaId"));
    const userId = c.get("user").id;

    // Verificar ownership via curso
    const [curso] = await db.select({ id: schema.cursosAula.id }).from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    const [aula] = await db
      .select()
      .from(schema.aulas)
      .where(and(eq(schema.aulas.id, aulaId), eq(schema.aulas.cursoId, cursoId)));

    if (!aula) return c.json({ error: "Aula não encontrada" }, 404);

    return c.json({ aula }, 200);
  })

  // PATCH /cursos/:id/aulas/:aulaId/status — marcar concluída ou revisada
  .patch("/cursos/:id/aulas/:aulaId/status", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const aulaId = parseInt(c.req.param("aulaId"));
    const { status } = await c.req.json();
    const userId = c.get("user").id;

    // Ownership check
    const [curso] = await db.select({ id: schema.cursosAula.id }).from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    const [aula] = await db.select({ id: schema.aulas.id }).from(schema.aulas)
      .where(and(eq(schema.aulas.id, aulaId), eq(schema.aulas.cursoId, cursoId)));
    if (!aula) return c.json({ error: "Aula não encontrada" }, 404);

    // ── Limite free: 2 aulas concluídas por dia (filtrado por userId) ──
    if (status === "concluida") {
      const pro = await isPro(userId);
      if (!pro) {
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);
        const [{ total }] = await db
          .select({ total: count() })
          .from(schema.aulas)
          .innerJoin(schema.cursosAula, eq(schema.aulas.cursoId, schema.cursosAula.id))
          .where(
            and(
              eq(schema.cursosAula.userId, userId),
              gte(schema.aulas.concluidaEm, inicioDia),
              eq(schema.aulas.status, "concluida")
            )
          );
        if (total >= 2) {
          return c.json({
            error: "limite_free",
            mensagem: "O plano gratuito permite concluir apenas 2 aulas por dia. Faça upgrade para o Pareto Pro.",
          }, 403);
        }
      }
    }

    const agora = new Date();
    const updates: Partial<typeof schema.aulas.$inferInsert> = { status };
    if (status === "concluida") updates.concluidaEm = agora;

    await db
      .update(schema.aulas)
      .set(updates)
      .where(and(eq(schema.aulas.id, aulaId), eq(schema.aulas.cursoId, cursoId)));

    // Ao concluir, agendar as 4 revisões espaçadas
    if (status === "concluida") {
      await agendarRevisoes(aulaId, cursoId, agora);
    }

    return c.json({ success: true }, 200);
  })

  // DELETE /cursos/:id — deletar curso e aulas
  .delete("/cursos/:id", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const userId = c.get("user").id;

    // Ownership check
    const [curso] = await db.select({ id: schema.cursosAula.id }).from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    await db.delete(schema.cursosAula).where(eq(schema.cursosAula.id, cursoId));
    return c.json({ success: true }, 200);
  })

  // POST /cursos/:id/aulas/:aulaId/questoes — gera (ou retorna cached) 10 questões da aula
  .post("/cursos/:id/aulas/:aulaId/questoes", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const aulaId = parseInt(c.req.param("aulaId"));
    const userId = c.get("user").id;

    const [curso] = await db.select({ id: schema.cursosAula.id }).from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    const [aula] = await db.select().from(schema.aulas)
      .where(and(eq(schema.aulas.id, aulaId), eq(schema.aulas.cursoId, cursoId)));
    if (!aula) return c.json({ error: "Aula não encontrada" }, 404);
    if (!aula.conteudoMd) return c.json({ error: "Aula ainda não foi gerada" }, 400);

    // Verificar cache
    const [cached] = await db
      .select()
      .from(schema.questoesAula)
      .where(eq(schema.questoesAula.aulaId, aulaId))
      .orderBy(desc(schema.questoesAula.createdAt))
      .limit(1);

    if (cached) {
      return c.json({ questoes: JSON.parse(cached.questoesJson), cached: true }, 200);
    }

    // Gerar com Gemini
    const prompt = `Você é um professor preparatório para concursos públicos. Com base no conteúdo abaixo, crie EXATAMENTE 10 questões de múltipla escolha no estilo das bancas CESGRANRIO e CESPE.

CONTEÚDO DA AULA:
"""
${aula.conteudoMd.slice(0, 6000)}
"""

REGRAS:
- Cada questão deve ter enunciado claro e 5 alternativas (A, B, C, D, E)
- Apenas UMA alternativa correta por questão
- Alternativas incorretas devem ser plausíveis (não obviamente erradas)
- Varie o nível: 3 fáceis, 5 médias, 2 difíceis
- Base nas informações do conteúdo fornecido
- Assunto: ${aula.assunto}

RESPONDA APENAS com JSON válido neste formato (sem markdown, sem explicações):
{
  "questoes": [
    {
      "id": 1,
      "enunciado": "texto da questão",
      "alternativas": {
        "A": "texto",
        "B": "texto",
        "C": "texto",
        "D": "texto",
        "E": "texto"
      },
      "gabarito": "A",
      "explicacao": "por que a alternativa correta está certa"
    }
  ]
}`;

    let questoes: any[] = [];
    try {
      const raw = await analisarComGemini(prompt);
      // Limpar possível markdown wrapper
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      questoes = parsed.questoes ?? parsed;
    } catch (e) {
      return c.json({ error: "Falha ao gerar questões. Tente novamente." }, 500);
    }

    // Salvar no cache
    await db.insert(schema.questoesAula).values({
      aulaId,
      questoesJson: JSON.stringify(questoes),
    });

    return c.json({ questoes, cached: false }, 200);
  })

  // GET /cursos/:id/aulas/:aulaId/questoes — buscar questões cached
  .get("/cursos/:id/aulas/:aulaId/questoes", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const aulaId = parseInt(c.req.param("aulaId"));
    const userId = c.get("user").id;

    const [curso] = await db.select({ id: schema.cursosAula.id }).from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    // Confirmar que a aula pertence ao curso
    const [aulaCheck] = await db.select({ id: schema.aulas.id }).from(schema.aulas)
      .where(and(eq(schema.aulas.id, aulaId), eq(schema.aulas.cursoId, cursoId)));
    if (!aulaCheck) return c.json({ error: "Aula não encontrada" }, 404);

    const [cached] = await db
      .select()
      .from(schema.questoesAula)
      .where(eq(schema.questoesAula.aulaId, aulaId))
      .orderBy(desc(schema.questoesAula.createdAt))
      .limit(1);
    if (!cached) return c.json({ questoes: null }, 200);
    return c.json({ questoes: JSON.parse(cached.questoesJson), cached: true }, 200);
  })

  // POST /cursos/:id/aulas/:aulaId/questoes/tentativa — salvar resultado do quiz
  .post("/cursos/:id/aulas/:aulaId/questoes/tentativa", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const aulaId = parseInt(c.req.param("aulaId"));
    const userId = c.get("user").id;

    // Ownership
    const [curso] = await db.select({ id: schema.cursosAula.id }).from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    const [aulaCheck] = await db.select({ id: schema.aulas.id }).from(schema.aulas)
      .where(and(eq(schema.aulas.id, aulaId), eq(schema.aulas.cursoId, cursoId)));
    if (!aulaCheck) return c.json({ error: "Aula não encontrada" }, 404);

    const body = await c.req.json<{ acertos: number; total: number; respostas: Record<number, string> }>();
    await db.insert(schema.tentativasQuiz).values({
      aulaId,
      acertos: body.acertos,
      total: body.total,
      respostasJson: JSON.stringify(body.respostas),
    });
    return c.json({ success: true }, 200);
  })

  // GET /cursos/:id/aulas/:aulaId/questoes/tentativas — histórico de tentativas
  .get("/cursos/:id/aulas/:aulaId/questoes/tentativas", async (c) => {
    const cursoId = parseInt(c.req.param("id"));
    const aulaId = parseInt(c.req.param("aulaId"));
    const userId = c.get("user").id;

    const [curso] = await db.select({ id: schema.cursosAula.id }).from(schema.cursosAula)
      .where(and(eq(schema.cursosAula.id, cursoId), eq(schema.cursosAula.userId, userId)));
    if (!curso) return c.json({ error: "Curso não encontrado" }, 404);

    const [aulaCheck] = await db.select({ id: schema.aulas.id }).from(schema.aulas)
      .where(and(eq(schema.aulas.id, aulaId), eq(schema.aulas.cursoId, cursoId)));
    if (!aulaCheck) return c.json({ error: "Aula não encontrada" }, 404);

    const tentativas = await db
      .select()
      .from(schema.tentativasQuiz)
      .where(eq(schema.tentativasQuiz.aulaId, aulaId))
      .orderBy(desc(schema.tentativasQuiz.createdAt));
    return c.json({ tentativas }, 200);
  })

  // GET /cursos/:id/stats — dados agregados para dashboard
  .get("/cursos/:id/stats", async (c) => {
    const cursoId = parseInt(c.req.param("id"));

    const aulas = await db
      .select()
      .from(schema.aulas)
      .where(eq(schema.aulas.cursoId, cursoId))
      .orderBy(asc(schema.aulas.ordem));

    // Por semana
    const semanas: Record<number, { total: number; concluidas: number }> = {};
    for (const aula of aulas) {
      const s = aula.semana ?? 1;
      if (!semanas[s]) semanas[s] = { total: 0, concluidas: 0 };
      semanas[s].total++;
      if (aula.status === "concluida") semanas[s].concluidas++;
    }

    // Mapeamento de palavras-chave → disciplina canônica
    const DISC_KEYWORDS: Array<{ keywords: string[]; nome: string }> = [
      { keywords: ["informática", "informatica", "hardware", "software", "excel", "word", "windows", "internet", "redes"], nome: "Informática" },
      { keywords: ["vendas", "negociação", "negociacao", "atendimento", "cliente", "comercial"], nome: "Vendas e Negociação" },
      { keywords: ["conhecimentos bancários", "bancários", "bancario", "banco", "financeiro", "crédito", "credito", "sistema financeiro"], nome: "Conhecimentos Bancários" },
      { keywords: ["atualidades do mercado financeiro", "mercado financeiro", "atualidades"], nome: "Atualidades do Mercado Financeiro" },
      { keywords: ["matemática financeira", "matematica financeira", "juros", "amortização", "amortizacao"], nome: "Matemática Financeira" },
      { keywords: ["matemática", "matematica", "probabilidade", "estatística", "estatistica", "porcentagem"], nome: "Matemática" },
      { keywords: ["língua portuguesa", "lingua portuguesa", "português", "portugues", "redação", "redacao", "interpretação", "interpretacao", "gramática", "gramatica"], nome: "Língua Portuguesa" },
      { keywords: ["língua inglesa", "lingua inglesa", "inglês", "ingles", "english"], nome: "Língua Inglesa" },
    ];

    function inferirDisciplina(assunto: string): string {
      const lower = assunto.toLowerCase();
      // Sempre buscar por palavras-chave no texto completo (unifica variações)
      for (const { keywords, nome } of DISC_KEYWORDS) {
        if (keywords.some(k => lower.includes(k))) return nome;
      }
      // Categorias especiais
      if (/simulado|simulação|simulacao/.test(lower)) return "Simulados";
      if (/revisão|revisao/.test(lower)) return "Revisões Gerais";
      if (/descanso|descanç|relaxamento|lazer|refeição|refeicao|hidrat/.test(lower)) return "Descanso";
      if (/leitura|memoriz|organiz|planeja|prepara|análise|analise|análise|avalia|visualiz|flash|aprofund|foco em|identific|reflexão|reflexao|resolução de questões aleatórias|principais fórmulas|se houver|se convocado|dependendo/.test(lower)) return "Estratégia & Revisão Final";
      // Fallback: prefixo antes de ":"
      if (assunto.includes(":")) {
        const prefixo = assunto.split(":")[0].trim();
        if (prefixo.length <= 50) return prefixo;
      }
      return "Outros";
    }

    // Por disciplina
    const disciplinas: Record<string, { total: number; concluidas: number }> = {};
    for (const aula of aulas) {
      const disc = inferirDisciplina(aula.assunto ?? "");
      if (!disciplinas[disc]) disciplinas[disc] = { total: 0, concluidas: 0 };
      disciplinas[disc].total++;
      if (aula.status === "concluida") disciplinas[disc].concluidas++;
    }

    // Questões respondidas
    const aulaIds = aulas.map(a => a.id);
    let totalQuestoes = 0;
    let aulasComQuestoes = 0;
    let totalAcertos = 0;
    let totalRespostas = 0;

    if (aulaIds.length > 0) {
      const questoes = await db
        .select()
        .from(schema.questoesAula)
        .where(inArray(schema.questoesAula.aulaId, aulaIds));
      totalQuestoes = questoes.length;

      const aulasComQ = new Set(questoes.map(q => q.aulaId));
      aulasComQuestoes = aulasComQ.size;

      const tentativas = await db
        .select()
        .from(schema.tentativasQuiz)
        .where(inArray(schema.tentativasQuiz.aulaId, aulaIds));
      for (const t of tentativas) {
        totalAcertos += t.acertos ?? 0;
        totalRespostas += t.total ?? 0;
      }
    }

    const totalAulas = aulas.length;
    const aulasConcluidas = aulas.filter(a => a.status === "concluida").length;

    return c.json({
      totalAulas,
      aulasConcluidas,
      percentualGeral: totalAulas > 0 ? Math.round((aulasConcluidas / totalAulas) * 100) : 0,
      semanas: Object.entries(semanas).map(([s, v]) => ({
        semana: parseInt(s),
        ...v,
        pct: v.total > 0 ? Math.round((v.concluidas / v.total) * 100) : 0,
      })).sort((a, b) => a.semana - b.semana),
      disciplinas: Object.entries(disciplinas).map(([nome, v]) => ({
        nome,
        ...v,
        pct: v.total > 0 ? Math.round((v.concluidas / v.total) * 100) : 0,
      })).sort((a, b) => b.total - a.total),
      quiz: {
        aulasComQuestoes,
        totalQuestoes,
        totalAcertos,
        totalRespostas,
        pctAcerto: totalRespostas > 0 ? Math.round((totalAcertos / totalRespostas) * 100) : null,
      },
    }, 200);
  });
