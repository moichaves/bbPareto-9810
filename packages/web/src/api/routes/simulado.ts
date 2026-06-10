import { Hono } from "hono";
import { db } from "../database/index";
import * as schema from "../database/schema";
import { eq, desc, inArray, and, isNull } from "drizzle-orm";
import { analisarComGemini } from "../lib/gemini";
import { agendarRevisoes } from "./revisoes";
import { authMiddleware, requireAuth } from "../middleware/auth";

// ── Perfis de bancas ──────────────────────────────────────────────────────────
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

        // Buscar banca do curso desta aula
        const [cursoAula] = await db
          .select({ banca: schema.cursosAula.banca })
          .from(schema.cursosAula)
          .where(eq(schema.cursosAula.id, aula.cursoId));
        const perfilBanca = getPerfilBanca(cursoAula?.banca ?? "");

        const prompt = `Você é professor preparatório para concursos públicos.
${perfilBanca ? `\n${perfilBanca}\n` : ""}
Com base no conteúdo abaixo, crie EXATAMENTE 10 questões de múltipla escolha.

CONTEÚDO:
"""
${aula.conteudoMd.slice(0, 8000)}
"""

ASSUNTO: ${aula.assunto}
DISCIPLINA: ${aula.disciplina ?? ""}

DISTRIBUIÇÃO DE DIFICULDADE OBRIGATÓRIA:
- Q1, Q2, Q3 → FÁCIL: conceito direto, definição clara, nomenclatura básica
- Q4, Q5, Q6, Q7 → MÉDIO: aplicação prática, cálculo simples, interpretação de regra
- Q8, Q9, Q10 → DIFÍCIL: análise comparativa, exceções, pegadinha técnica, caso concreto complexo

REGRAS:
- 5 alternativas (A-E), exatamente uma correta
- Alternativas plausíveis e tecnicamente similares (não trivialmente erradas)
- Enunciados completos e contextualizados
- Explicação objetiva da resposta correta + por que as demais estão erradas

RESPONDA APENAS JSON válido, sem markdown, sem texto fora do JSON:
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
  })

  // POST /simulado/corrigir-questao — análise detalhada alternativa por alternativa
  .post("/corrigir-questao", async (c) => {
    const body = await c.req.json<{
      enunciado: string;
      alternativas: Record<string, string>;
      gabarito: string;
      respostaUsuario: string;
      assunto: string;
      disciplina?: string;
    }>();

    const { enunciado, alternativas, gabarito, respostaUsuario, assunto, disciplina } = body;

    const alternativasTexto = Object.entries(alternativas)
      .map(([letra, texto]) => `${letra}) ${texto}`)
      .join("\n");

    const acertou = respostaUsuario === gabarito;

    const prompt = `Você é professor preparatório para concursos públicos. Analise esta questão de forma cirúrgica.

QUESTÃO:
${enunciado}

ALTERNATIVAS:
${alternativasTexto}

GABARITO: ${gabarito}
RESPOSTA DO CANDIDATO: ${respostaUsuario} (${acertou ? "CORRETO" : "ERRADO"})
ASSUNTO: ${assunto}${disciplina ? `\nDISCIPLINA: ${disciplina}` : ""}

Produza uma análise DENSA e DIDÁTICA no seguinte formato JSON:

{
  "resultado": "${acertou ? "CORRETO" : "ERRADO"}",
  "tese_central": "O que esta questão realmente testa (1 frase)",
  "analise_alternativas": {
    "A": { "status": "CORRETA|INCORRETA", "justificativa": "Explicação técnica do porquê" },
    "B": { "status": "CORRETA|INCORRETA", "justificativa": "..." },
    "C": { "status": "CORRETA|INCORRETA", "justificativa": "..." },
    "D": { "status": "CORRETA|INCORRETA", "justificativa": "..." },
    "E": { "status": "CORRETA|INCORRETA", "justificativa": "..." }
  },
  "isca_da_banca": "Qual armadilha a banca plantou? O que derruba o candidato desatento?",
  "licao_pareto": "Em 1-2 linhas: o que fixar para nunca mais errar questões deste tipo"
}

REGRAS:
- Cada justificativa deve explicar tecnicamente o erro ou acerto — não apenas dizer "está correto"
- "isca_da_banca" deve identificar o detalhe sutil que confunde (número, termo, condição)
- "licao_pareto" deve ser memorável e prática
- RESPONDA APENAS JSON válido, sem markdown`;

    try {
      const raw = await analisarComGemini(prompt);
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      return c.json({ ok: true, analise: parsed }, 200);
    } catch (err) {
      return c.json({ ok: false, error: String(err) }, 500);
    }
  });
