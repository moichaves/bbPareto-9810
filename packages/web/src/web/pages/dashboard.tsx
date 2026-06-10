import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
import { apiFetch } from "../lib/api";
  BookOpen, Brain, CheckCircle2, Target, Zap, ChevronRight,
  LayoutDashboard, TrendingUp, BarChart2, Award, HelpCircle, Clock, Flame,
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Revisao = {
  id: number;
  tipo: string;
  agendadaPara: string;
  aulaId: number;
  cursoId: number;
  assunto: string;
  disciplina: string | null;
  prioridade: string | null;
  cursoTitulo: string;
};

type AulaHoje = {
  id: number;
  ordem: number;
  semana: number;
  diaSemana: string;
  assunto: string;
  disciplina: string;
  prioridade: string;
  status: string;
  cursoId: number;
  cursoTitulo: string;
};

type CursoStats = {
  totalAulas: number;
  aulasConcluidas: number;
  percentualGeral: number;
  semanas: Array<{ semana: number; total: number; concluidas: number; pct: number }>;
  disciplinas: Array<{ nome: string; total: number; concluidas: number; pct: number }>;
  quiz: {
    aulasComQuestoes: number;
    totalQuestoes: number;
    totalAcertos: number;
    totalRespostas: number;
    pctAcerto: number | null;
  };
};

const TIPO_REVISAO: Record<string, { label: string; cor: string; bg: string }> = {
  "24h": { label: "24h", cor: "text-violet-400", bg: "bg-violet-500/20 border-violet-700" },
  "7d": { label: "7d", cor: "text-blue-400", bg: "bg-blue-500/20 border-blue-700" },
  "30d": { label: "30d", cor: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-700" },
  "90d": { label: "90d", cor: "text-amber-400", bg: "bg-amber-500/20 border-amber-700" },
};

const PRIORIDADE_COR: Record<string, string> = {
  alta: "text-red-400 bg-red-500/10 border-red-700",
  media: "text-yellow-400 bg-yellow-500/10 border-yellow-700",
  baixa: "text-slate-400 bg-slate-500/10 border-slate-600",
};

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function diaSemanaHoje() {
  return DIAS_SEMANA[new Date().getDay()];
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Paleta de cores para disciplinas
const DISC_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#F97316", "#EC4899", "#84CC16", "#14B8A6",
  "#A78BFA", "#FB923C", "#34D399", "#60A5FA", "#FBBF24",
];

// ── Sub-componentes ──────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = "#3B82F6", height = 8 }: {
  value: number; max: number; color?: string; height?: number;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, backgroundColor: "rgba(255,255,255,0.07)" }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function SemanaChart({ semanas }: { semanas: CursoStats["semanas"] }) {
  const maxTotal = Math.max(...semanas.map(s => s.total), 1);
  return (
    <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <BarChart2 size={16} className="text-[#3B82F6]" />
        <span className="text-sm font-semibold text-[#F8FAFC]">Progresso por Semana</span>
      </div>
      <div className="flex items-end gap-1.5 h-28">
        {semanas.map((s) => {
          const alturaTotal = (s.total / maxTotal) * 100;
          const alturaConcluida = (s.concluidas / maxTotal) * 100;
          const isCurrent = s.semana === semanaCurrent(semanas);
          return (
            <div key={s.semana} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#0F172A] border border-slate-700 text-xs text-white px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                S{s.semana}: {s.concluidas}/{s.total} ({s.pct}%)
              </div>
              {/* Barra */}
              <div
                className="w-full rounded-t relative overflow-hidden"
                style={{ height: `${alturaTotal}%`, minHeight: 4, backgroundColor: "rgba(255,255,255,0.07)" }}
              >
                <div
                  className="absolute bottom-0 w-full rounded-t transition-all duration-700"
                  style={{
                    height: `${alturaConcluida > 0 ? (alturaConcluida / alturaTotal) * 100 : 0}%`,
                    backgroundColor: s.pct === 100 ? "#10B981" : isCurrent ? "#F59E0B" : "#3B82F6",
                  }}
                />
              </div>
              {/* Label */}
              <span className={`text-[9px] ${isCurrent ? "text-[#F59E0B] font-bold" : "text-[#475569]"}`}>
                S{s.semana}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#3B82F6]" />
          <span className="text-[10px] text-[#94A3B8]">Concluídas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
          <span className="text-[10px] text-[#94A3B8]">Pendentes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#F59E0B]" />
          <span className="text-[10px] text-[#94A3B8]">Semana atual</span>
        </div>
      </div>
    </div>
  );
}

function semanaCurrent(semanas: CursoStats["semanas"]): number {
  // semana mais próxima não 100% concluída
  const pendente = semanas.find(s => s.pct < 100);
  return pendente?.semana ?? semanas[semanas.length - 1]?.semana ?? 1;
}

function DisciplinasChart({ disciplinas }: { disciplinas: CursoStats["disciplinas"] }) {
  return (
    <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={16} className="text-[#10B981]" />
        <span className="text-sm font-semibold text-[#F8FAFC]">Progresso por Disciplina</span>
      </div>
      <div className="space-y-3">
        {disciplinas.slice(0, 12).map((d, i) => (
          <div key={d.nome}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: DISC_COLORS[i % DISC_COLORS.length] }}
                />
                <span className="text-xs text-[#CBD5E1] truncate max-w-[180px]">{d.nome}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-[10px] text-[#475569]">{d.concluidas}/{d.total}</span>
                <span
                  className="text-[10px] font-semibold w-8 text-right"
                  style={{ color: DISC_COLORS[i % DISC_COLORS.length] }}
                >
                  {d.pct}%
                </span>
              </div>
            </div>
            <ProgressBar
              value={d.concluidas}
              max={d.total}
              color={DISC_COLORS[i % DISC_COLORS.length]}
              height={6}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizCard({ quiz, totalAulas }: { quiz: CursoStats["quiz"]; totalAulas: number }) {
  const pctAulas = totalAulas > 0 ? Math.round((quiz.aulasComQuestoes / totalAulas) * 100) : 0;
  return (
    <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle size={16} className="text-[#F59E0B]" />
        <span className="text-sm font-semibold text-[#F8FAFC]">Questões</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-[#F8FAFC]">{quiz.aulasComQuestoes}</div>
          <div className="text-[10px] text-[#475569] mt-0.5">aulas c/ questões</div>
          <div className="mt-2">
            <ProgressBar value={quiz.aulasComQuestoes} max={totalAulas} color="#F59E0B" height={4} />
          </div>
          <div className="text-[10px] text-[#F59E0B] mt-0.5">{pctAulas}% do curso</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-[#F8FAFC]">{quiz.totalRespostas}</div>
          <div className="text-[10px] text-[#475569] mt-0.5">respondidas</div>
          {quiz.totalQuestoes > 0 && (
            <>
              <div className="mt-2">
                <ProgressBar value={quiz.totalRespostas} max={quiz.totalQuestoes} color="#8B5CF6" height={4} />
              </div>
              <div className="text-[10px] text-[#8B5CF6] mt-0.5">
                {Math.round((quiz.totalRespostas / quiz.totalQuestoes) * 100)}% do banco
              </div>
            </>
          )}
        </div>
        <div className="text-center">
          <div
            className="text-2xl font-bold"
            style={{
              color: quiz.pctAcerto === null ? "#475569"
                : quiz.pctAcerto >= 70 ? "#10B981"
                : quiz.pctAcerto >= 50 ? "#F59E0B"
                : "#EF4444",
            }}
          >
            {quiz.pctAcerto === null ? "—" : `${quiz.pctAcerto}%`}
          </div>
          <div className="text-[10px] text-[#475569] mt-0.5">aproveitamento</div>
          {quiz.pctAcerto !== null && (
            <>
              <div className="mt-2">
                <ProgressBar
                  value={quiz.pctAcerto}
                  max={100}
                  color={quiz.pctAcerto >= 70 ? "#10B981" : quiz.pctAcerto >= 50 ? "#F59E0B" : "#EF4444"}
                  height={4}
                />
              </div>
              <div className="text-[10px] text-[#475569] mt-0.5">
                {quiz.pctAcerto >= 70 ? "Ótimo!" : quiz.pctAcerto >= 50 ? "Melhorando" : "Precisa revisar"}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Heatmap de Calendário (estilo GitHub) ────────────────────────────────────

function HeatmapEstudo() {
  const [dados, setDados] = useState<Record<string, number>>({});

  useEffect(() => {
    const resultado: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i) ?? "";
      if (chave.startsWith("estudo_")) {
        const data = chave.replace("estudo_", "");
        resultado[data] = parseInt(localStorage.getItem(chave) ?? "0");
      }
    }
    setDados(resultado);
  }, []);

  // Gerar últimas 52 semanas (364 dias + hoje)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diasTotal = 364;
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - diasTotal);

  // Alinhar ao domingo
  const diaSemanaInicio = inicio.getDay();
  inicio.setDate(inicio.getDate() - diaSemanaInicio);

  const celulas: { data: string; min: number }[] = [];
  const cursor = new Date(inicio);
  while (cursor <= hoje) {
    const iso = cursor.toISOString().slice(0, 10);
    celulas.push({ data: iso, min: dados[iso] ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Agrupar por semana
  const semanas: { data: string; min: number }[][] = [];
  for (let i = 0; i < celulas.length; i += 7) {
    semanas.push(celulas.slice(i, i + 7));
  }

  const maxMin = Math.max(...celulas.map(c => c.min), 1);
  const totalMin = Object.values(dados).reduce((a, b) => a + b, 0);
  const diasAtivos = Object.values(dados).filter(v => v > 0).length;

  // Streak atual
  let streak = 0;
  const d = new Date(hoje);
  while (true) {
    const iso = d.toISOString().slice(0, 10);
    if ((dados[iso] ?? 0) > 0) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }

  function cor(min: number): string {
    if (min === 0) return "#1E293B";
    const pct = min / maxMin;
    if (pct < 0.25) return "#1e3a5f";
    if (pct < 0.5)  return "#1d4ed8";
    if (pct < 0.75) return "#2563eb";
    return "#3b82f6";
  }

  const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const DIAS_LABEL = ["D","S","T","Q","Q","S","S"];

  // Labels de mês — pegar semana onde muda o mês
  const labelMes: { semana: number; label: string }[] = [];
  semanas.forEach((sem, si) => {
    const primeiro = sem.find(c => c.data);
    if (!primeiro) return;
    const d = new Date(primeiro.data);
    const mes = d.getMonth();
    const isFirst = si === 0 || new Date(semanas[si - 1][0]?.data ?? "").getMonth() !== mes;
    if (isFirst) labelMes.push({ semana: si, label: MESES[mes] });
  });

  return (
    <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-orange-400" />
          <span className="text-sm font-semibold text-[#F8FAFC]">Atividade de Estudo</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
          {streak > 0 && (
            <span className="flex items-center gap-1 text-orange-400 font-semibold">
              <Flame size={11} /> {streak} dia{streak !== 1 ? "s" : ""} seguido{streak !== 1 ? "s" : ""}
            </span>
          )}
          <span>{diasAtivos} dias ativos</span>
          <span>{Math.floor(totalMin / 60)}h {totalMin % 60}min total</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Labels de mês */}
          <div className="flex mb-1 ml-6">
            {semanas.map((_, si) => {
              const lm = labelMes.find(l => l.semana === si);
              return (
                <div key={si} className="w-3 mr-0.5 text-[9px] text-[#475569] text-center">
                  {lm ? lm.label : ""}
                </div>
              );
            })}
          </div>

          <div className="flex gap-0.5">
            {/* Labels dia da semana */}
            <div className="flex flex-col gap-0.5 mr-1">
              {DIAS_LABEL.map((l, i) => (
                <div key={i} className="w-3 h-3 text-[8px] text-[#475569] flex items-center justify-center">
                  {i % 2 === 1 ? l : ""}
                </div>
              ))}
            </div>

            {/* Células */}
            {semanas.map((sem, si) => (
              <div key={si} className="flex flex-col gap-0.5">
                {sem.map((cel, di) => (
                  <div
                    key={di}
                    title={cel.min > 0 ? `${cel.data}: ${cel.min}min` : cel.data}
                    className="w-3 h-3 rounded-sm cursor-default transition-all hover:ring-1 hover:ring-white/30"
                    style={{ backgroundColor: cor(cel.min) }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-1 mt-2 ml-6 text-[9px] text-[#475569]">
            <span>Menos</span>
            {["#1E293B","#1e3a5f","#1d4ed8","#2563eb","#3b82f6"].map(c => (
              <div key={c} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
            ))}
            <span>Mais</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card de Tempo Total de Estudo ────────────────────────────────────────────

function TempoEstudo() {
  const [minutos, setMinutos] = useState(0);
  const [minHoje, setMinHoje] = useState(0);
  const [minSemana, setMinSemana] = useState(0);

  useEffect(() => {
    let total = 0;
    let hoje = 0;
    let semana = 0;
    const agoraIso = new Date().toISOString().slice(0, 10);
    const semanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i) ?? "";
      if (chave.startsWith("estudo_")) {
        const data = chave.replace("estudo_", "");
        const min = parseInt(localStorage.getItem(chave) ?? "0");
        total += min;
        if (data === agoraIso) hoje += min;
        if (data >= semanaAtras) semana += min;
      }
    }
    setMinutos(total);
    setMinHoje(hoje);
    setMinSemana(semana);
  }, []);

  const horas = Math.floor(minutos / 60);
  const min = minutos % 60;

  return (
    <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-[#3B82F6]" />
        <span className="text-sm font-semibold text-[#F8FAFC]">Tempo de Estudo</span>
        <span className="text-[10px] text-[#475569] ml-auto">via Pomodoro</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0F172A] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[#3B82F6]">{minHoje}</div>
          <div className="text-[10px] text-[#475569] mt-0.5">min hoje</div>
        </div>
        <div className="bg-[#0F172A] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[#10B981]">{Math.floor(minSemana / 60)}h{minSemana % 60 > 0 ? `${minSemana % 60}m` : ""}</div>
          <div className="text-[10px] text-[#475569] mt-0.5">essa semana</div>
        </div>
        <div className="bg-[#0F172A] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[#F59E0B]">{horas > 0 ? `${horas}h` : `${min}m`}</div>
          <div className="text-[10px] text-[#475569] mt-0.5">total</div>
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: revisoesHoje, isLoading: loadRev } = useQuery<{ revisoes: Revisao[] }>({
    queryKey: ["revisoes-hoje"],
    queryFn: () => apiFetch("/api/revisoes/hoje").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: aulasData, isLoading: loadAulas } = useQuery<{ cursos: any[] }>({
    queryKey: ["cursos-lista"],
    queryFn: () => apiFetch("/api/aulas/cursos").then(r => r.json()),
  });

  const { data: revisoesTotal } = useQuery<{ revisoes: Revisao[] }>({
    queryKey: ["revisoes-proximas"],
    queryFn: () => apiFetch("/api/revisoes/proximas").then(r => r.json()),
  });

  const concluirRevisao = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/revisoes/${id}/concluir`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revisoes-hoje"] });
      qc.invalidateQueries({ queryKey: ["revisoes-proximas"] });
    },
  });

  const concluirAula = useMutation({
    mutationFn: ({ cursoId, aulaId }: { cursoId: number; aulaId: number }) =>
      apiFetch(`/api/aulas/cursos/${cursoId}/aulas/${aulaId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "concluida" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cursos-lista"] });
      qc.invalidateQueries({ queryKey: ["aulas-hoje"] });
      qc.invalidateQueries({ queryKey: ["revisoes-hoje"] });
    },
  });

  // Aulas de hoje
  const { data: aulasHojeData } = useQuery<{ aulasHoje: AulaHoje[] }>({
    queryKey: ["aulas-hoje"],
    queryFn: async () => {
      const cursosRes = await apiFetch("/api/aulas/cursos").then(r => r.json());
      const cursos = cursosRes.cursos ?? [];
      const aulasHoje: AulaHoje[] = [];
      const diaHoje = diaSemanaHoje();

      await Promise.all(
        cursos.map(async (curso: any) => {
          try {
            const det = await apiFetch(`/api/aulas/cursos/${curso.id}`).then(r => r.json());
            const aulas = det.aulas ?? [];
            const inicioMs = det.curso?.createdAt
              ? new Date(det.curso.createdAt).getTime()
              : new Date(curso.createdAt ?? Date.now()).getTime();
            const diasDesdeInicio = Math.floor((Date.now() - inicioMs) / (1000 * 60 * 60 * 24));
            const semanaAtual = Math.min(Math.max(Math.ceil((diasDesdeInicio + 1) / 7), 1), 13);

            for (const aula of aulas) {
              if (
                aula.diaSemana === diaHoje &&
                aula.semana === semanaAtual &&
                aula.status !== "concluida"
              ) {
                aulasHoje.push({ ...aula, cursoId: curso.id, cursoTitulo: curso.titulo });
              }
            }
          } catch {}
        })
      );
      return { aulasHoje };
    },
    refetchInterval: 60_000,
  });

  // Stats do primeiro curso
  const cursos = aulasData?.cursos ?? [];
  const primeiroCursoId = cursos[0]?.id;

  const { data: statsData } = useQuery<CursoStats>({
    queryKey: ["curso-stats", primeiroCursoId],
    queryFn: () => apiFetch(`/api/aulas/cursos/${primeiroCursoId}/stats`).then(r => r.json()),
    enabled: !!primeiroCursoId,
    refetchInterval: 30_000,
  });

  const aulasHoje = aulasHojeData?.aulasHoje ?? [];
  const revHoje = revisoesHoje?.revisoes ?? [];
  const totalPendentes = (revisoesTotal?.revisoes ?? []).length;

  const hojeStr = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  const temNadaHoje = aulasHoje.length === 0 && revHoje.length === 0;
  const isLoading = loadRev || loadAulas;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-[#1E40AF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#94A3B8] text-sm mb-1">
            <LayoutDashboard size={14} />
            <span className="capitalize">{hojeStr}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#F8FAFC]">
            {saudacao()}, Moisés 👋
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1">
            {diaSemanaHoje() === "Domingo"
              ? "Domingo é dia de revisão — foco total no que já estudou."
              : "Veja o que está programado para hoje."}
          </p>
        </div>
        <button
          onClick={() => navigate("/nova-analise")}
          className="flex items-center gap-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <TrendingUp size={16} /> Nova Análise
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#94A3B8] text-xs mb-2">
            <BookOpen size={14} /> Aulas hoje
          </div>
          <div className="text-3xl font-bold text-[#F8FAFC]">{aulasHoje.length}</div>
          <div className="text-xs text-[#475569] mt-1">para {diaSemanaHoje()}</div>
        </div>

        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#94A3B8] text-xs mb-2">
            <Brain size={14} /> Revisões hoje
          </div>
          <div className={`text-3xl font-bold ${revHoje.length > 0 ? "text-[#F59E0B]" : "text-[#F8FAFC]"}`}>
            {revHoje.length}
          </div>
          <div className="text-xs text-[#475569] mt-1">{totalPendentes} no total</div>
        </div>

        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#94A3B8] text-xs mb-2">
            <CheckCircle2 size={14} /> Concluídas
          </div>
          <div className="text-3xl font-bold text-[#10B981]">
            {statsData?.aulasConcluidas ?? 0}
          </div>
          <div className="text-xs text-[#475569] mt-1">de {statsData?.totalAulas ?? 0} aulas</div>
        </div>

        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#94A3B8] text-xs mb-2">
            <Target size={14} /> Progresso
          </div>
          <div className="text-3xl font-bold" style={{
            color: (statsData?.percentualGeral ?? 0) >= 70 ? "#10B981"
              : (statsData?.percentualGeral ?? 0) >= 40 ? "#F59E0B"
              : "#3B82F6"
          }}>
            {statsData?.percentualGeral ?? 0}%
          </div>
          <div className="mt-2">
            <ProgressBar
              value={statsData?.aulasConcluidas ?? 0}
              max={statsData?.totalAulas ?? 1}
              color={(statsData?.percentualGeral ?? 0) >= 70 ? "#10B981"
                : (statsData?.percentualGeral ?? 0) >= 40 ? "#F59E0B" : "#3B82F6"}
              height={4}
            />
          </div>
        </div>
      </div>

      {/* Tempo de Estudo + Heatmap */}
      <TempoEstudo />
      <HeatmapEstudo />

      {/* Progresso Geral — barra grande */}
      {statsData && (
        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-[#F59E0B]" />
              <span className="text-sm font-semibold text-[#F8FAFC]">
                {cursos[0]?.titulo ?? "Progresso Geral"}
              </span>
            </div>
            <span className="text-sm font-bold text-[#F8FAFC]">
              {statsData.aulasConcluidas} / {statsData.totalAulas} aulas
            </span>
          </div>
          <ProgressBar
            value={statsData.aulasConcluidas}
            max={statsData.totalAulas}
            color={statsData.percentualGeral >= 70 ? "#10B981"
              : statsData.percentualGeral >= 40 ? "#F59E0B" : "#3B82F6"}
            height={14}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[#475569]">0%</span>
            <span
              className="text-xs font-bold"
              style={{
                color: statsData.percentualGeral >= 70 ? "#10B981"
                  : statsData.percentualGeral >= 40 ? "#F59E0B" : "#3B82F6",
              }}
            >
              {statsData.percentualGeral}% concluído
            </span>
            <span className="text-xs text-[#475569]">100%</span>
          </div>
        </div>
      )}

      {/* Gráficos */}
      {statsData && (
        <div className="grid grid-cols-2 gap-4">
          <SemanaChart semanas={statsData.semanas} />
          <DisciplinasChart disciplinas={statsData.disciplinas} />
        </div>
      )}

      {/* Questões */}
      {statsData && (
        <QuizCard quiz={statsData.quiz} totalAulas={statsData.totalAulas} />
      )}

      {/* Sem nada hoje */}
      {temNadaHoje && (
        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-8 text-center">
          <CheckCircle2 size={36} className="text-[#10B981] mx-auto mb-3" />
          <p className="text-[#F8FAFC] font-semibold">Tudo em dia!</p>
          <p className="text-[#94A3B8] text-sm mt-1">Nenhuma aula ou revisão pendente para hoje.</p>
          <button
            onClick={() => navigate("/aulas")}
            className="mt-4 inline-flex items-center gap-2 text-sm text-[#3B82F6] hover:text-blue-400 transition-colors"
          >
            Ver todos os cursos <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Aulas de hoje */}
      {aulasHoje.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={18} className="text-[#1E40AF]" />
            <h2 className="text-[#F8FAFC] font-semibold">Aulas de hoje</h2>
            <span className="text-xs text-[#94A3B8] bg-[#1E293B] border border-slate-700 px-2 py-0.5 rounded-full ml-1">
              {diaSemanaHoje()}
            </span>
          </div>
          <div className="space-y-2">
            {aulasHoje.map((aula) => (
              <div
                key={aula.id}
                className="bg-[#1E293B] border border-slate-700 rounded-xl p-4 flex items-center gap-4"
              >
                <div className={`w-1.5 h-12 rounded-full flex-shrink-0 ${
                  aula.prioridade === "alta" ? "bg-red-500"
                    : aula.prioridade === "media" ? "bg-yellow-500" : "bg-slate-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#F8FAFC] font-medium text-sm truncate">{aula.assunto}</span>
                    <span className={`text-[10px] border px-1.5 py-0.5 rounded-full flex-shrink-0 ${PRIORIDADE_COR[aula.prioridade] ?? PRIORIDADE_COR.baixa}`}>
                      {aula.prioridade}
                    </span>
                  </div>
                  <div className="text-[#94A3B8] text-xs mt-0.5 flex items-center gap-2">
                    <span>{aula.cursoTitulo}</span>
                    <span>·</span>
                    <span>Semana {aula.semana}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/aulas/${aula.cursoId}?aulaId=${aula.id}`)}
                    className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white border border-slate-600 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <BookOpen size={12} /> Estudar
                  </button>
                  <button
                    onClick={() => concluirAula.mutate({ cursoId: aula.cursoId, aulaId: aula.id })}
                    disabled={concluirAula.isPending}
                    className="flex items-center gap-1.5 text-xs text-[#10B981] hover:text-white hover:bg-[#10B981] border border-emerald-700 hover:border-emerald-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} /> Concluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Revisões de hoje */}
      {revHoje.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-[#F59E0B]" />
            <h2 className="text-[#F8FAFC] font-semibold">Revisões de hoje</h2>
            <span className="text-xs text-[#F59E0B] bg-[#F59E0B]/10 border border-yellow-700 px-2 py-0.5 rounded-full ml-1">
              {revHoje.length} pendente{revHoje.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {revHoje.map((rev) => {
              const cfg = TIPO_REVISAO[rev.tipo] ?? TIPO_REVISAO["24h"];
              return (
                <div
                  key={rev.id}
                  className="bg-[#1E293B] border border-slate-700 rounded-xl p-4 flex items-center gap-4"
                >
                  <div className={`flex-shrink-0 text-[10px] font-bold border px-2 py-1 rounded-lg ${cfg.bg} ${cfg.cor}`}>
                    {cfg.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#F8FAFC] font-medium text-sm truncate">{rev.assunto}</div>
                    <div className="text-[#94A3B8] text-xs mt-0.5">{rev.cursoTitulo}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/aulas/${rev.cursoId}?aulaId=${rev.aulaId}`)}
                      className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white border border-slate-600 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <BookOpen size={12} /> Ver aula
                    </button>
                    <button
                      onClick={() => concluirRevisao.mutate(rev.id)}
                      disabled={concluirRevisao.isPending}
                      className="flex items-center gap-1.5 text-xs text-[#F59E0B] hover:text-white hover:bg-[#F59E0B] border border-yellow-700 hover:border-yellow-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Zap size={12} /> Revisei
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
