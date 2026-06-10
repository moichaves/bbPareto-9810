import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const analises = sqliteTable("analises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  titulo: text("titulo").notNull(),
  cargo: text("cargo").notNull(),
  banca: text("banca"),
  status: text("status").notNull().default("processando"), // processando | concluido | erro
  erroMsg: text("erro_msg"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const assuntos = sqliteTable("assuntos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  analiseId: integer("analise_id").notNull().references(() => analises.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  disciplina: text("disciplina").notNull(),
  totalQuestoes: integer("total_questoes").notNull().default(0),
  percentual: real("percentual").notNull().default(0),
  percentualAcumulado: real("percentual_acumulado").notNull().default(0),
  prioridade: text("prioridade").notNull().default("media"),
  pesoEdital: integer("peso_edital").default(0),
});

export const planosEstudo = sqliteTable("planos_estudo", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  analiseId: integer("analise_id").notNull().references(() => analises.id, { onDelete: "cascade" }),
  diasEstudo: integer("dias_estudo").notNull().default(30),
  horasDia: real("horas_dia").notNull().default(3),
  planoJson: text("plano_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Aulas ────────────────────────────────────────────────────────
export const cursosAula = sqliteTable("cursos_aula", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  titulo: text("titulo").notNull(),
  analiseId: integer("analise_id"),
  cargo: text("cargo"),
  banca: text("banca"),
  textoApostila: text("texto_apostila"),
  gerandoStatus: text("gerando_status").notNull().default("idle"), // idle | gerando | concluido | erro
  gerandoErro: text("gerando_erro"),
  totalAulasGeradas: integer("total_aulas_geradas").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const aulas = sqliteTable("aulas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cursoId: integer("curso_id").notNull().references(() => cursosAula.id, { onDelete: "cascade" }),
  ordem: integer("ordem").notNull().default(0),
  semana: integer("semana").default(0),
  diaSemana: text("dia_semana"),
  assunto: text("assunto").notNull(),
  disciplina: text("disciplina"),
  prioridade: text("prioridade").default("media"),
  conteudoMd: text("conteudo_md"),
  status: text("status").notNull().default("pendente"), // pendente | gerada | concluida | revisada
  concluidaEm: integer("concluida_em", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Questões por Aula ────────────────────────────────────────────
export const questoesAula = sqliteTable("questoes_aula", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  aulaId: integer("aula_id").notNull().references(() => aulas.id, { onDelete: "cascade" }),
  questoesJson: text("questoes_json").notNull(), // JSON array de questões geradas
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Tentativas de quiz por aula
export const tentativasQuiz = sqliteTable("tentativas_quiz", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  aulaId: integer("aula_id").notNull().references(() => aulas.id, { onDelete: "cascade" }),
  acertos: integer("acertos").notNull().default(0),
  total: integer("total").notNull().default(10),
  respostasJson: text("respostas_json"), // respostas do usuário
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Revisão Espaçada ─────────────────────────────────────────────
export const revisoes = sqliteTable("revisoes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  aulaId: integer("aula_id").notNull().references(() => aulas.id, { onDelete: "cascade" }),
  cursoId: integer("curso_id").notNull(),
  tipo: text("tipo").notNull(), // "24h" | "7d" | "30d" | "90d"
  agendadaPara: integer("agendada_para", { mode: "timestamp" }).notNull(),
  concluidaEm: integer("concluida_em", { mode: "timestamp" }),
  questoesJson: text("questoes_json"), // cache das 10 questões geradas
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Assinaturas / Planos ─────────────────────────────────────────
export const assinaturas = sqliteTable("assinaturas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  plano: text("plano").notNull().default("free"), // "free" | "pro_mensal" | "pro_anual"
  status: text("status").notNull().default("ativa"), // "ativa" | "cancelada" | "suspensa" | "pendente"
  // IDs do PagBank
  pagbankPlanId: text("pagbank_plan_id"),
  pagbankSubscriptionId: text("pagbank_subscription_id"),
  pagbankSubscriberId: text("pagbank_subscriber_id"),
  // Datas
  iniciadaEm: integer("iniciada_em", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  renovaEm: integer("renova_em", { mode: "timestamp" }),
  canceladaEm: integer("cancelada_em", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export * from "./auth-schema";
