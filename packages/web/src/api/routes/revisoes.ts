import { Hono } from "hono";
import { db } from "../database/index";
import * as schema from "../database/schema";
import { eq, and, lte, isNull, asc } from "drizzle-orm";
import { analisarComGemini } from "../lib/gemini";
import { authMiddleware, requireAuth } from "../middleware/auth";

// ── Perfis de bancas (espelhado de aulas.ts) ──────────────────────────────────
const PERFIS_BANCA: Record<string, string> = {
  cesgranrio: `
PERFIL DA BANCA — CESGRANRIO (Banco do Brasil / Agente Comercial):

ESTILO DE QUESTÃO:
• Enunciados longos com contexto bancário real (cliente, produto, situação de atendimento)
• Cobra raciocínio e interpretação — não decoreba nem letra da lei isolada
• Alternativas muito próximas, diferindo em detalhe numérico, termo técnico ou condição específica
• Nunca repete questão idêntica — adapta contexto mas mantém o conceito central

HIERARQUIA DE COBRABILIDADE POR DISCIPLINA:

[CRÍTICO — cai em toda prova]
• Matemática Financeira: juros compostos, VP/VF, taxa equivalente, sistemas de amortização (SAC/PRICE), desconto simples e composto
• Conhecimentos Bancários: produtos e serviços do BB, SFN (estrutura, CMN, BACEN, CVM), crédito, garantias, câmbio, seguros, previdência
• Informática: Internet/segurança (phishing, ransomware, HTTPS), pacote Office (fórmulas Excel), Windows, redes básicas
• Vendas e Negociação: técnicas de abordagem, perfil do cliente, pós-venda, CRM, gestão de carteira

[IMPORTANTE — alta frequência]
• Língua Portuguesa: interpretação de textos formais longos, concordância verbal/nominal, regência, pronomes
• Raciocínio Lógico / Matemática: sequências, proporcionalidade, porcentagem, razão, PA/PG
• Atualidades Mercado Financeiro: taxa Selic, câmbio, política monetária, inflação, Open Finance, PIX, crédito

[NOVIDADE — alteração recente, alta chance de cair]
• Open Finance e Open Banking: compartilhamento de dados, consentimento, regulação BACEN
• PIX: funcionamento, chaves, limites, fraudes, DICT
• ESG no setor bancário: conceitos, critérios, financiamentos verdes

[ACESSÓRIO — estudar por último, menor frequência]
• Inglês: vocabulário técnico bancário/financeiro, leitura de textos, falsos cognatos
• Gramática normativa isolada (fora de contexto de texto)

PEGADINHAS CLÁSSICAS CESGRANRIO:
• Matemática Financeira: confundir taxa nominal com efetiva, mês com ano, juros simples com compostos
• Conhecimentos Bancários: trocar atribuições de CMN × BACEN × CVM
• Informática: confundir atalhos de teclado (Ctrl+C vs Ctrl+X), extensões de arquivo, protocolos (HTTP vs HTTPS vs FTP)
• Vendas: "abordagem" vs "sondagem" vs "fechamento" — banca troca a etapa do processo
• Português: sujeito oculto em período longo fazendo concordância "errar"

ESTRATÉGIA DE ELABORAÇÃO:
• Use caso concreto bancário no enunciado (cliente pedindo produto, gerente orientando, situação de venda)
• Alternativas incorretas devem ser plausíveis — erro sutil de valor, prazo ou nome de órgão
• Distribua dificuldade: fácil = conceito direto, médio = aplicação em contexto, difícil = exceção ou comparação entre produtos similares`,

  cespe: `
PERFIL DA BANCA — CESPE/CEBRASPE:
• Questões de certo/errado com afirmações que parecem corretas mas têm detalhe errado escondido
• Cobra legislação na literalidade — um advérbio trocado pode inverter o gabarito
• Jurisprudência recente do STF/STJ tem peso alto; informativos dos últimos 12 meses são alvo frequente
• Pegadinha clássica: "sempre", "nunca", "somente" — generalizações absolutas quase sempre erradas

[CRÍTICO] Legislação específica, jurisprudência, raciocínio lógico
[IMPORTANTE] Português (coesão, pronomes, concordância), atualidades
[NOVIDADE] Alterações legislativas recentes, informativos STF/STJ
[ACESSÓRIO] Teoria pura sem aplicação recente em prova`,

  fgv: `
PERFIL DA BANCA — FGV:
• Casos concretos elaborados, exige aplicação do conhecimento em situação real
• Cobra divergências doutrinárias e jurisprudenciais — espera saber os dois lados
• Informativos STF/STJ dos últimos 24 meses são alvo prioritário
• Pegadinha clássica: mistura institutos vizinhos no mesmo enunciado

[CRÍTICO] Casos práticos, jurisprudência datada, correlações entre temas
[IMPORTANTE] Doutrina majoritária vs minoritária, legislação atualizada
[NOVIDADE] Alterações legislativas dos últimos 24 meses
[ACESSÓRIO] Teoria pura sem aplicação em prova recente`,

  fcc: `
PERFIL DA BANCA — FCC:
• Questões mais diretas e objetivas, cobra letra da lei com frequência
• Português tem peso alto: gramática normativa, análise morfossintática, interpretação
• Raciocínio Lógico: proposições, tabelas-verdade, diagramas de conjuntos
• Pegadinha clássica: troca de termos técnicos semelhantes ("pode" vs "deve", "será" vs "poderá")

[CRÍTICO] Letra da lei, gramática normativa, raciocínio lógico formal
[IMPORTANTE] Interpretação de texto, legislação específica do cargo
[NOVIDADE] Alterações legislativas recentes
[ACESSÓRIO] Teoria doutrinária, divergências`,

  vunesp: `
PERFIL DA BANCA — VUNESP:
• Equilibra teoria e prática; enunciados médios, nem muito longos nem muito curtos
• Português: interpretação e gramática com peso equivalente
• Raciocínio Lógico com foco em sequências e problemas aritméticos
• Cobra legislação vigente com atenção a alterações recentes

[CRÍTICO] Legislação do cargo, raciocínio lógico, português
[IMPORTANTE] Conhecimentos específicos, informática básica
[NOVIDADE] Legislação alterada nos últimos 12 meses
[ACESSÓRIO] Teoria pura, doutrina isolada`,
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
    const trechoAula = revisao.conteudoMd ? revisao.conteudoMd.slice(0, 7000) : "";

    // Dificuldade e foco crescente por tipo de revisão
    const configPorTipo: Record<string, { dificuldade: string; foco: string; instrucao: string }> = {
      "24h": {
        dificuldade: "Q1-Q5 fáceis (reforço imediato do conceito central), Q6-Q8 médias, Q9-Q10 difíceis",
        foco: "conceito direto e definição — o candidato acabou de estudar, reforce o essencial",
        instrucao: "Enunciados curtos e diretos. Alternativas incorretas com erros claros mas plausíveis.",
      },
      "7d": {
        dificuldade: "Q1-Q3 fáceis, Q4-Q7 médias com caso concreto bancário, Q8-Q10 difíceis",
        foco: "aplicação prática em situação real de banco — cliente, produto, atendimento",
        instrucao: "Enunciados médios com contexto bancário (gerente, cliente, operação). Alternativas com erros sutis de prazo, taxa ou órgão regulador.",
      },
      "30d": {
        dificuldade: "Q1-Q2 fáceis, Q3-Q6 médias, Q7-Q10 difíceis com alternativas muito próximas",
        foco: "pegadinhas clássicas CESGRANRIO — alternativas que diferem em detalhe numérico ou termo técnico",
        instrucao: "Enunciados longos e contextualizados. Pelo menos 3 questões devem ter duas alternativas extremamente próximas (ex: taxa nominal vs efetiva, CMN vs BACEN). Exija raciocínio, não decoreba.",
      },
      "90d": {
        dificuldade: "Q1-Q2 fáceis, Q3-Q5 médias, Q6-Q10 difíceis com correlação entre assuntos",
        foco: "correlação com outros assuntos da disciplina — banca mistura conceitos no mesmo enunciado",
        instrucao: "Enunciados complexos que cruzam este assunto com temas vizinhos. Questões de análise comparativa, exceções à regra e casos-limite. Exija domínio profundo.",
      },
    };

    const config = configPorTipo[revisao.tipo ?? "7d"] ?? configPorTipo["7d"];

    const prompt = `Você é elaborador sênior de questões para o concurso Banco do Brasil, cargo "${revisao.cargo ?? "Agente Comercial"}", banca CESGRANRIO.

${perfilBanca}

ASSUNTO DA REVISÃO: "${revisao.assunto}"
DISCIPLINA: ${revisao.disciplina ?? ""}
TIPO DE REVISÃO: ${revisao.tipo ?? "7d"} — foco em ${config.foco}
${trechoAula ? `\nCONTEÚDO DA AULA (base para as questões):\n"""\n${trechoAula}\n"""` : ""}

INSTRUÇÕES DE ELABORAÇÃO:
${config.instrucao}

DISTRIBUIÇÃO DE DIFICULDADE OBRIGATÓRIA:
${config.dificuldade}

REGRAS CESGRANRIO:
- 5 alternativas (A a E), exatamente 1 correta
- Enunciados contextualizados com situação bancária real (não abstratos)
- Alternativas incorretas plausíveis — nunca obviamente erradas
- Nunca repita conceito entre questões — cada questão deve testar ângulo diferente
- Terminologia e estilo CESGRANRIO: enunciados longos, raciocínio exigido, detalhes técnicos

GABARITO COMENTADO — OBRIGATÓRIO POR QUESTÃO:
Para cada questão, o campo "gabarito_comentado" deve conter:
- Por que a alternativa correta está certa (fundamentação técnica)
- Por que cada alternativa incorreta está errada (erro específico de cada uma)
- "isca_da_banca": o detalhe sutil que confunde o candidato desatento (se houver)

Retorne APENAS JSON válido, sem markdown:
[
  {
    "numero": 1,
    "enunciado": "texto completo da questão",
    "alternativas": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
    "gabarito": "A",
    "explicacao": "resumo geral da resposta correta (1-2 frases)",
    "gabarito_comentado": {
      "A": { "status": "CORRETA", "justificativa": "..." },
      "B": { "status": "INCORRETA", "justificativa": "..." },
      "C": { "status": "INCORRETA", "justificativa": "..." },
      "D": { "status": "INCORRETA", "justificativa": "..." },
      "E": { "status": "INCORRETA", "justificativa": "..." },
      "isca_da_banca": "..."
    }
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
