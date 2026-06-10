import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Brain, CheckCircle2, Clock, CalendarDays, Loader2,
  BookOpen, ChevronRight, Zap, RefreshCw
} from "lucide-react";
import QuizRevisao from "../components/quiz-revisao";
import { apiFetch } from "../lib/api";

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

const TIPO_CONFIG: Record<string, { label: string; cor: string; bg: string }> = {
  "24h": { label: "24 horas",  cor: "text-violet-400",  bg: "bg-violet-500/20 border-violet-700" },
  "7d":  { label: "7 dias",    cor: "text-blue-400",    bg: "bg-blue-500/20 border-blue-700" },
  "30d": { label: "30 dias",   cor: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-700" },
  "90d": { label: "90 dias",   cor: "text-amber-400",   bg: "bg-amber-500/20 border-amber-700" },
};

function diasAte(data: string) {
  const diff = new Date(data).getTime() - Date.now();
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  return `Em ${dias} dias`;
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short"
  });
}

export default function RevisoesPage() {
  const [, navigate] = useLocation();
  const [hoje, setHoje] = useState<Revisao[]>([]);
  const [proximas, setProximas] = useState<Revisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [concluindo, setConcluindo] = useState<number | null>(null);
  const [quizAberto, setQuizAberto] = useState<Revisao | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [rHoje, rProx] = await Promise.all([
        apiFetch("/api/revisoes/hoje").then(r => r.json()),
        apiFetch("/api/revisoes/proximas").then(r => r.json()),
      ]);
      setHoje(rHoje.revisoes ?? []);
      // proximas = todas pendentes, excluir as que já estão em hoje
      const hojeIds = new Set((rHoje.revisoes ?? []).map((r: Revisao) => r.id));
      setProximas((rProx.revisoes ?? []).filter((r: Revisao) => !hojeIds.has(r.id)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function concluir(id: number) {
    setConcluindo(id);
    await apiFetch(`/api/revisoes/${id}/concluir`, { method: "PATCH" });
    setConcluindo(null);
    await carregar();
  }

  function abrirQuiz(r: Revisao) {
    setQuizAberto(r);
  }

  async function onQuizConcluido() {
    setQuizAberto(null);
    await carregar();
  }

  // Agrupar próximas por data
  const proximasPorData = proximas.reduce<Record<string, Revisao[]>>((acc, r) => {
    const key = new Date(r.agendadaPara).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-[#F59E0B]" size={36} />
      </div>
    );
  }

  const totalHoje = hoje.length;
  const totalProximas = proximas.length;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Modal quiz */}
      {quizAberto && (
        <QuizRevisao
          revisaoId={quizAberto.id}
          assunto={quizAberto.assunto}
          tipo={quizAberto.tipo}
          onConcluir={onQuizConcluido}
          onFechar={() => setQuizAberto(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Brain size={28} className="text-[#F59E0B]" />
            Revisão Espaçada
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1">
            Baseada na curva de Ebbinghaus: 24h · 7d · 30d · 90d
          </p>
        </div>
        <button
          onClick={carregar}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-[#F59E0B]" />
            <span className="text-xs text-[#94A3B8] uppercase tracking-wide font-medium">Para hoje</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalHoje}</p>
          <p className="text-xs text-[#475569] mt-1">
            {totalHoje === 0 ? "Nenhuma revisão pendente" : totalHoje === 1 ? "revisão pendente" : "revisões pendentes"}
          </p>
        </div>
        <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={16} className="text-[#94A3B8]" />
            <span className="text-xs text-[#94A3B8] uppercase tracking-wide font-medium">Agendadas</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalProximas}</p>
          <p className="text-xs text-[#475569] mt-1">nos próximos dias</p>
        </div>
      </div>

      {/* Revisões de hoje */}
      <section>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
          Para revisar hoje
        </h2>

        {hoje.length === 0 ? (
          <div className="bg-[#1E293B] rounded-xl border border-slate-700 p-8 text-center">
            <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-3" />
            <p className="text-white font-medium">Tudo em dia!</p>
            <p className="text-[#94A3B8] text-sm mt-1">Nenhuma revisão pendente para hoje.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hoje.map((r) => {
              const cfg = TIPO_CONFIG[r.tipo] ?? TIPO_CONFIG["24h"];
              return (
                <div
                  key={r.id}
                  className="bg-[#1E293B] rounded-xl border border-slate-700 p-4 flex items-center gap-4 hover:border-slate-600 transition-colors"
                >
                  {/* Tipo badge */}
                  <div className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.cor}`}>
                    {cfg.label}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{r.assunto}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#475569]">{r.disciplina ?? "—"}</span>
                      <span className="text-[#334155]">·</span>
                      <span className="text-xs text-[#475569]">{r.cursoTitulo}</span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/aulas/${r.cursoId}`)}
                      title="Ver aula"
                      className="p-2 rounded-lg text-[#475569] hover:text-[#94A3B8] hover:bg-[#334155] transition-colors"
                    >
                      <BookOpen size={15} />
                    </button>
                    <button
                      onClick={() => abrirQuiz(r)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-900/50 text-violet-400 border border-violet-700 text-xs font-medium hover:bg-violet-800/50 transition-colors"
                    >
                      <Brain size={12} />
                      Revisar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Próximas revisões */}
      {Object.keys(proximasPorData).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock size={14} className="text-[#94A3B8]" />
            Próximas revisões
          </h2>

          <div className="space-y-4">
            {Object.entries(proximasPorData).map(([dateKey, items]) => {
              const primeiraData = items[0].agendadaPara;
              return (
                <div key={dateKey}>
                  {/* Data header */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-semibold text-[#94A3B8]">
                      {diasAte(primeiraData)}
                    </span>
                    <span className="text-xs text-[#334155]">
                      {formatarData(primeiraData)}
                    </span>
                    <div className="flex-1 h-px bg-[#1E293B]" />
                  </div>

                  <div className="space-y-2">
                    {items.map((r) => {
                      const cfg = TIPO_CONFIG[r.tipo] ?? TIPO_CONFIG["24h"];
                      return (
                        <div
                          key={r.id}
                          className="bg-[#1E293B]/60 rounded-lg border border-slate-800 px-4 py-3 flex items-center gap-3 hover:border-slate-700 transition-colors cursor-pointer"
                          onClick={() => abrirQuiz(r)}
                        >
                          <div className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border ${cfg.bg} ${cfg.cor}`}>
                            {cfg.label}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[#CBD5E1] text-sm truncate">{r.assunto}</p>
                            <p className="text-xs text-[#475569] mt-0.5">{r.disciplina} · {r.cursoTitulo}</p>
                          </div>
                          <ChevronRight size={14} className="text-[#334155] shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state total */}
      {totalHoje === 0 && totalProximas === 0 && (
        <div className="text-center py-16">
          <Brain size={48} className="mx-auto text-[#1E293B] mb-4" />
          <p className="text-[#475569] text-sm">
            Conclua uma aula para começar a revisão espaçada.
          </p>
        </div>
      )}
    </div>
  );
}
