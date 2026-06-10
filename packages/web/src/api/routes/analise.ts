import { Hono } from "hono";
import { db } from "../database/index";
import * as schema from "../database/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { analisarComGemini } from "../lib/gemini";
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

async function extractPdfText(buffer: Buffer): Promise<string> {
  const id = `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pdfPath = join(tmpdir(), `${id}.pdf`);
  const txtPath = join(tmpdir(), `${id}.txt`);
  try {
    writeFileSync(pdfPath, buffer);
    execSync(`pdftotext "${pdfPath}" "${txtPath}"`, { timeout: 30000 });
    const text = readFileSync(txtPath, "utf-8");
    return text;
  } catch {
    return "";
  } finally {
    try { unlinkSync(pdfPath); } catch {}
    try { unlinkSync(txtPath); } catch {}
  }
}

export const analiseRoutes = new Hono()
  .use(authMiddleware)
  .use(requireAuth)

  // Listar análises do usuário
  .get("/", async (c) => {
    const userId = c.get("user")!.id;
    const lista = await db
      .select()
      .from(schema.analises)
      .where(eq(schema.analises.userId, userId))
      .orderBy(desc(schema.analises.createdAt));
    return c.json({ analises: lista }, 200);
  })

  // Buscar análise por ID
  .get("/:id", async (c) => {
    const userId = c.get("user")!.id;
    const id = parseInt(c.req.param("id"));
    const [analise] = await db
      .select()
      .from(schema.analises)
      .where(and(eq(schema.analises.id, id), eq(schema.analises.userId, userId)));

    if (!analise) return c.json({ error: "Análise não encontrada" }, 404);

    const itens = await db
      .select()
      .from(schema.assuntos)
      .where(eq(schema.assuntos.analiseId, id))
      .orderBy(desc(schema.assuntos.totalQuestoes));

    const [plano] = await db
      .select()
      .from(schema.planosEstudo)
      .where(eq(schema.planosEstudo.analiseId, id))
      .orderBy(desc(schema.planosEstudo.createdAt));

    return c.json({ analise, assuntos: itens, plano: plano ?? null }, 200);
  })

  // Regenerar plano
  .post("/:id/gerar-plano", async (c) => {
    const userId = c.get("user")!.id;
    const id = parseInt(c.req.param("id"));

    const [analise] = await db.select().from(schema.analises)
      .where(and(eq(schema.analises.id, id), eq(schema.analises.userId, userId)));
    if (!analise) return c.json({ error: "Análise não encontrada" }, 404);

    const assuntosLista = await db
      .select()
      .from(schema.assuntos)
      .where(eq(schema.assuntos.analiseId, id))
      .orderBy(desc(schema.assuntos.percentual));

    if (assuntosLista.length === 0) return c.json({ error: "Sem assuntos para gerar plano" }, 400);

    const body = await c.req.json().catch(() => ({}));
    const diasEstudo = (body as any).diasEstudo ?? 90;
    const horasDia = (body as any).horasDia ?? 3;

    const alta = assuntosLista.filter((a) => a.prioridade === "alta");
    const media = assuntosLista.filter((a) => a.prioridade === "media");
    const baixa = assuntosLista.filter((a) => a.prioridade === "baixa");

    const perfilBancaRegen = getPerfilBanca(analise.banca ?? "");
    const promptPlano = `
Você é um especialista em planejamento estratégico de estudos para concursos públicos brasileiros.

MISSÃO: Criar um plano de estudos cirúrgico baseado no Princípio de Pareto (80/20), priorizando os assuntos de maior retorno para a prova.

CONCURSO: ${analise.cargo}
BANCA: ${analise.banca || "não informada"}
${perfilBancaRegen}
TEMPO DISPONÍVEL: ${diasEstudo} dias | ${horasDia}h/dia | Total: ${diasEstudo * horasDia}h

━━━ ASSUNTOS POR PRIORIDADE PARETO ━━━

🔴 ALTA PRIORIDADE — cobrem ~50% da prova (estudar PRIMEIRO e com mais profundidade):
${alta.map((a) => `• ${a.nome} (${a.disciplina})`).join("\n")}

🟡 MÉDIA PRIORIDADE — cobrem até 80% da prova (estudar após dominar os de alta):
${media.map((a) => `• ${a.nome} (${a.disciplina})`).join("\n")}

⚪ BAIXA PRIORIDADE — completam os 20% restantes (estudar só se sobrar tempo):
${baixa.map((a) => `• ${a.nome} (${a.disciplina})`).join("\n")}

━━━ REGRAS DO PLANO ━━━
1. Segunda a Sábado = estudo. Domingo = EXCLUSIVAMENTE revisão semanal do que foi estudado na semana
2. Distribua os assuntos de ALTA prioridade nas primeiras semanas (base sólida primeiro)
3. Alterne disciplinas diferentes no mesmo dia para evitar fadiga cognitiva
4. Reserve sempre os últimos 10% dos dias para revisão geral e simulados
5. Agrupe assuntos correlatos na mesma semana
6. Seja realista com as horas — ${horasDia}h/dia incluem pausas e revisão do dia

Retorne APENAS JSON válido (sem markdown, sem texto fora do JSON):
{"semanas":[{"semana":1,"foco":"string descrevendo o tema central da semana","dias":[{"dia":1,"diaSemana":"Segunda","assuntos":["Assunto específico"],"horas":${horasDia},"tipo":"estudo"}]}],"resumo":{"totalHoras":${diasEstudo * horasDia},"assuntosAlta":${alta.length},"assuntosMedia":${media.length},"assuntosBaixa":${baixa.length},"metaAcerto":"80%","estrategia":"resumo da estratégia em 1 frase"}}

IMPORTANTE: Domingo deve ter tipo "revisao" e assuntos listando o que foi visto na semana.
`;

    function extrairJsonLocal(texto: string): string {
      let limpo = texto.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      const inicio = limpo.indexOf("{");
      const fim = limpo.lastIndexOf("}");
      if (inicio !== -1 && fim !== -1 && fim > inicio) limpo = limpo.slice(inicio, fim + 1);
      JSON.parse(limpo);
      return limpo;
    }

    let planoJson = "";
    for (let t = 1; t <= 3; t++) {
      try {
        const resp = await analisarComGemini(promptPlano);
        planoJson = extrairJsonLocal(resp);
        break;
      } catch (err) {
        if (t < 3) await new Promise((r) => setTimeout(r, 5000));
        else return c.json({ error: "Não foi possível gerar o plano após 3 tentativas" }, 500);
      }
    }

    await db.delete(schema.planosEstudo).where(eq(schema.planosEstudo.analiseId, id));
    await db.insert(schema.planosEstudo).values({ analiseId: id, diasEstudo, horasDia, planoJson });

    return c.json({ success: true, planoJson }, 200);
  })

  // Status de processamento
  .get("/:id/status", async (c) => {
    const userId = c.get("user")!.id;
    const id = parseInt(c.req.param("id"));
    const [analise] = await db
      .select({ id: schema.analises.id, status: schema.analises.status, erroMsg: schema.analises.erroMsg })
      .from(schema.analises)
      .where(and(eq(schema.analises.id, id), eq(schema.analises.userId, userId)));
    if (!analise) return c.json({ error: "Não encontrada" }, 404);
    return c.json(analise, 200);
  })

  // Upload e análise dos PDFs
  .post("/processar", async (c) => {
    const userId = c.get("user")!.id;
    const formData = await c.req.formData();
    const editalFile = formData.get("edital") as File | null;
    const provasFiles = formData.getAll("provas") as File[];
    const titulo = formData.get("titulo") as string;
    const cargo = formData.get("cargo") as string;
    const banca = formData.get("banca") as string;
    const diasEstudo = parseInt(formData.get("diasEstudo") as string) || 30;
    const horasDia = parseFloat(formData.get("horasDia") as string) || 3;

    if (!titulo || !cargo) {
      return c.json({ error: "Título e cargo são obrigatórios" }, 400);
    }

    // ── Limite free tier: 1 análise ──
    const pro = await isPro(userId);
    if (!pro) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(schema.analises)
        .where(eq(schema.analises.userId, userId));
      if (total >= 1) {
        return c.json({
          error: "limite_free",
          mensagem: "O plano gratuito permite apenas 1 análise. Faça upgrade para o Pareto Pro.",
        }, 403);
      }
    }

    let bufferEdital: Buffer | null = null;
    let buffersProvas: Buffer[] = [];

    if (editalFile) bufferEdital = Buffer.from(await editalFile.arrayBuffer());
    for (const prova of provasFiles) buffersProvas.push(Buffer.from(await prova.arrayBuffer()));

    if (!bufferEdital && buffersProvas.length === 0) {
      return c.json({ error: "Envie pelo menos um edital ou prova anterior" }, 400);
    }

    const [novaAnalise] = await db
      .insert(schema.analises)
      .values({ userId, titulo, cargo, banca: banca || null, status: "processando" })
      .returning();

    const analiseId = novaAnalise.id;

    processarAnalise({ analiseId, bufferEdital, buffersProvas, cargo, banca, diasEstudo, horasDia }).catch(
      async (err) => {
        console.error("[analise background]", err);
        await db.update(schema.analises)
          .set({ status: "erro", erroMsg: String(err).slice(0, 500) })
          .where(eq(schema.analises.id, analiseId));
      }
    );

    return c.json({ analiseId, success: true }, 201);
  })

  // Deletar análise
  .delete("/:id", async (c) => {
    const userId = c.get("user")!.id;
    const id = parseInt(c.req.param("id"));
    await db.delete(schema.analises)
      .where(and(eq(schema.analises.id, id), eq(schema.analises.userId, userId)));
    return c.json({ success: true }, 200);
  });

// ── Processamento assíncrono ──────────────────────────────────────────────────
async function processarAnalise(params: {
  analiseId: number;
  bufferEdital: Buffer | null;
  buffersProvas: Buffer[];
  cargo: string;
  banca: string;
  diasEstudo: number;
  horasDia: number;
}) {
  const { analiseId, bufferEdital, buffersProvas, cargo, banca, diasEstudo, horasDia } = params;

  let textoEdital = "";
  let textoProvas = "";

  // Limites ampliados: editais grandes precisam de mais contexto
  if (bufferEdital) textoEdital = (await extractPdfText(bufferEdital)).slice(0, 40000);
  for (const buf of buffersProvas) textoProvas += "\n\n--- PROVA ---\n" + (await extractPdfText(buf)).slice(0, 20000);

  const bancaCtx = banca ? `Banca: ${banca}` : "Banca: não informada";
  const perfilBanca = getPerfilBanca(banca);

  // ── ETAPA 1: Extrair conteúdo programático do edital ──────────────────────
  // Separamos a leitura do edital da contagem de questões para maior precisão
  const promptEdital = textoEdital ? `
Você é um especialista em concursos públicos brasileiros com foco em análise estratégica de editais.

MISSÃO: Extrair TODOS os tópicos do conteúdo programático deste edital e atribuir pesos estratégicos.

CARGO: ${cargo}
${bancaCtx}
${perfilBanca}

=== EDITAL ===
${textoEdital}

INSTRUÇÕES DE ANÁLISE:
1. Varra TODO o conteúdo programático do edital — não pule disciplinas
2. Para cada tópico, estime quantas questões provavelmente caem com base em:
   - Número de subtópicos listados no edital para aquele item
   - Peso/importância da disciplina na grade (ex: se Língua Portuguesa tem 15 questões previstas, distribua entre os tópicos)
   - Padrão histórico da banca ${banca || "para concursos similares"}
3. Seja ESPECÍFICO: prefira "Juros Compostos — capitalização e equivalência" a apenas "Matemática Financeira"
4. Não agrupe tópicos distintos em um só item

Retorne APENAS JSON válido (sem markdown):
{
  "totalQuestoesProva": 0,
  "assuntos": [
    {
      "nome": "Tópico específico do edital",
      "disciplina": "Disciplina pai",
      "pesoEdital": 3
    }
  ]
}

- "pesoEdital": estimativa de questões que esse tópico representa na prova
- Liste no mínimo todos os tópicos do edital, sem limite máximo
- Ordene do maior pesoEdital para o menor
` : null;

  // ── ETAPA 2: Contar questões nas provas anteriores ─────────────────────────
  const promptProvas = textoProvas ? `
Você é um especialista em análise de provas de concursos públicos brasileiros.

MISSÃO: Contar com precisão cirúrgica quantas questões caíram de cada assunto nas provas anteriores.

CARGO: ${cargo}
${bancaCtx}
${perfilBanca}

=== PROVAS ANTERIORES ===
${textoProvas}

INSTRUÇÕES:
1. Leia cada questão e identifique o tópico exato que ela cobra
2. Agrupe por assunto específico — não por disciplina genérica
3. Conte o total de questões por assunto em TODAS as provas fornecidas
4. Identifique padrões: assuntos que aparecem em múltiplas provas têm peso maior
5. Anote pegadinhas recorrentes da banca quando identificar

Retorne APENAS JSON válido (sem markdown):
{
  "totalQuestoesAnalisadas": 0,
  "assuntos": [
    {
      "nome": "Tópico específico",
      "disciplina": "Disciplina pai",
      "totalQuestoes": 5,
      "recorrencia": "alta",
      "observacao": "Cai em todas as provas, foco em cálculo de prestações"
    }
  ]
}

- "recorrencia": "alta" (≥3 provas), "media" (2 provas), "baixa" (1 prova)
- "observacao": padrão de cobrança detectado (opcional, só quando relevante)
- Ordene do maior totalQuestoes para o menor
` : null;

  // ── Executar as etapas em paralelo quando possível ────────────────────────
  function extrairJson(texto: string): any {
    let limpo = texto.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    if (inicio !== -1 && fim !== -1 && fim > inicio) limpo = limpo.slice(inicio, fim + 1);
    return JSON.parse(limpo);
  }

  const [resEdital, resProvas] = await Promise.all([
    promptEdital ? analisarComGemini(promptEdital).then(extrairJson).catch(() => null) : Promise.resolve(null),
    promptProvas ? analisarComGemini(promptProvas).then(extrairJson).catch(() => null) : Promise.resolve(null),
  ]);

  // ── ETAPA 3: Consolidar e aplicar Pareto ──────────────────────────────────
  // Merge: combina dados do edital com contagem real das provas
  const mapaConsolidado = new Map<string, {
    nome: string;
    disciplina: string;
    totalQuestoes: number;
    pesoEdital: number;
    recorrencia?: string;
    observacao?: string;
  }>();

  // Primeiro popula com dados do edital
  const assuntosEdital: any[] = resEdital?.assuntos ?? [];
  for (const a of assuntosEdital) {
    const chave = `${a.disciplina}::${a.nome}`.toLowerCase();
    mapaConsolidado.set(chave, {
      nome: a.nome,
      disciplina: a.disciplina,
      totalQuestoes: 0,
      pesoEdital: a.pesoEdital ?? 1,
    });
  }

  // Sobrescreve/enriquece com dados reais das provas (mais confiáveis)
  const assuntosProvas: any[] = resProvas?.assuntos ?? [];
  for (const a of assuntosProvas) {
    const chave = `${a.disciplina}::${a.nome}`.toLowerCase();
    const existente = mapaConsolidado.get(chave);
    if (existente) {
      existente.totalQuestoes = a.totalQuestoes ?? 0;
      existente.recorrencia = a.recorrencia;
      existente.observacao = a.observacao;
    } else {
      mapaConsolidado.set(chave, {
        nome: a.nome,
        disciplina: a.disciplina,
        totalQuestoes: a.totalQuestoes ?? 0,
        pesoEdital: 0,
        recorrencia: a.recorrencia,
        observacao: a.observacao,
      });
    }
  }

  // Se não tiver provas, usa pesoEdital como proxy de frequência
  // Se tiver provas, usa totalQuestoes como base principal (mais fidedigno)
  const temProvas = assuntosProvas.length > 0;
  const assuntosRaw = Array.from(mapaConsolidado.values()).sort((a, b) => {
    const scoreA = temProvas ? (a.totalQuestoes * 2 + a.pesoEdital) : a.pesoEdital;
    const scoreB = temProvas ? (b.totalQuestoes * 2 + b.pesoEdital) : b.pesoEdital;
    return scoreB - scoreA;
  });

  const promptAnalise = `PLACEHOLDER`; // mantido para compatibilidade — lógica migrada acima

  // ── Calcular Pareto ───────────────────────────────────────────────────────
  const total = assuntosRaw.reduce((sum, a) => {
    const score = temProvas ? (a.totalQuestoes * 2 + a.pesoEdital) : a.pesoEdital;
    return sum + (score || 1);
  }, 0);

  let acumulado = 0;
  const assuntosComPareto = assuntosRaw.map((a) => {
    const score = temProvas ? (a.totalQuestoes * 2 + a.pesoEdital) : (a.pesoEdital || 1);
    const percentual = total > 0 ? (score / total) * 100 : 0;
    acumulado += percentual;
    return {
      ...a,
      percentual: Math.round(percentual * 10) / 10,
      percentualAcumulado: Math.round(acumulado * 10) / 10,
      // Pareto estratégico: alta = top 50%, media = 50-80%, baixa = acima de 80%
      prioridade: acumulado <= 50 ? "alta" : acumulado <= 80 ? "media" : "baixa",
    };
  });

  if (assuntosComPareto.length > 0) {
    await db.insert(schema.assuntos).values(
      assuntosComPareto.map((a) => ({
        analiseId,
        nome: a.nome,
        disciplina: a.disciplina,
        totalQuestoes: a.totalQuestoes,
        percentual: a.percentual,
        percentualAcumulado: a.percentualAcumulado,
        prioridade: a.prioridade,
        pesoEdital: a.pesoEdital,
      }))
    );
  }

  const assuntosAlta = assuntosComPareto.filter((a) => a.prioridade === "alta");
  const assuntosMedia = assuntosComPareto.filter((a) => a.prioridade === "media");
  const assuntosBaixa = assuntosComPareto.filter((a) => a.prioridade === "baixa");

  const promptPlano = `
Você é um especialista em planejamento estratégico de estudos para concursos públicos brasileiros.

MISSÃO: Criar um plano de estudos cirúrgico baseado no Princípio de Pareto (80/20), priorizando os assuntos de maior retorno para a prova.

CONCURSO: ${cargo}
${bancaCtx}
${perfilBanca}
TEMPO DISPONÍVEL: ${diasEstudo} dias | ${horasDia}h/dia | Total: ${diasEstudo * horasDia}h

━━━ ASSUNTOS POR PRIORIDADE PARETO ━━━

🔴 ALTA PRIORIDADE — cobrem ~50% da prova (estudar PRIMEIRO e com mais profundidade):
${assuntosAlta.map((a) => `• ${a.nome} (${a.disciplina})${(a as any).observacao ? ` — ${(a as any).observacao}` : ""}`).join("\n")}

🟡 MÉDIA PRIORIDADE — cobrem até 80% da prova (estudar após dominar os de alta):
${assuntosMedia.map((a) => `• ${a.nome} (${a.disciplina})`).join("\n")}

⚪ BAIXA PRIORIDADE — completam os 20% restantes (estudar só se sobrar tempo):
${assuntosBaixa.map((a) => `• ${a.nome} (${a.disciplina})`).join("\n")}

━━━ REGRAS DO PLANO ━━━
1. Segunda a Sábado = estudo. Domingo = EXCLUSIVAMENTE revisão semanal do que foi estudado na semana
2. Distribua os assuntos de ALTA prioridade nas primeiras semanas (base sólida primeiro)
3. Alterne disciplinas diferentes no mesmo dia para evitar fadiga cognitiva
4. Reserve sempre os últimos 10% dos dias para revisão geral e simulados
5. Agrupe assuntos correlatos (ex: na semana de Matemática Financeira, coloque Juros Simples e Compostos juntos)
6. Seja realista com as horas — ${horasDia}h/dia incluem pausas e revisão do dia

Retorne APENAS JSON válido (sem markdown, sem texto fora do JSON):
{"semanas":[{"semana":1,"foco":"string descrevendo o tema central da semana","dias":[{"dia":1,"diaSemana":"Segunda","assuntos":["Assunto específico"],"horas":${horasDia},"tipo":"estudo"}]}],"resumo":{"totalHoras":${diasEstudo * horasDia},"assuntosAlta":${assuntosAlta.length},"assuntosMedia":${assuntosMedia.length},"assuntosBaixa":${assuntosBaixa.length},"metaAcerto":"80%","estrategia":"resumo da estratégia em 1 frase"}}

IMPORTANTE: Domingo deve ter tipo "revisao" e assuntos listando o que foi visto na semana.
`;

  function extrairJson(texto: string): string {
    let limpo = texto.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    if (inicio !== -1 && fim !== -1 && fim > inicio) limpo = limpo.slice(inicio, fim + 1);
    JSON.parse(limpo);
    return limpo;
  }

  let planoJson = "{}";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const respostaPlano = await analisarComGemini(promptPlano);
      planoJson = extrairJson(respostaPlano);
      break;
    } catch (err) {
      if (tentativa < 3) await new Promise((r) => setTimeout(r, 5000));
      else planoJson = JSON.stringify({ erro: "Não foi possível gerar o plano" });
    }
  }

  await db.insert(schema.planosEstudo).values({ analiseId, diasEstudo, horasDia, planoJson });

  await db.update(schema.analises)
    .set({ status: "concluido" })
    .where(eq(schema.analises.id, analiseId));
}
