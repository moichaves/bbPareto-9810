import { useEffect, useState, useRef, useCallback } from "react";
import {
  Brain, Play, Trophy, BarChart2, RefreshCw, Clock,
  CheckCircle2, XCircle, ChevronRight, Loader2, AlertCircle,
  Target, TrendingDown, Calendar, BookOpen, Zap, RotateCcw
} from "lucide-react";
import QuizRevisao from "../components/quiz-revisao";

// ─── Types ────────────────────────────────────────────────────────────────────
type Aula = {
  id: number;
  assunto: string;
  disciplina: string | null;
  ordem: number;
  temQuestoes: boolean;
};
type Curso = {
  id: number;
  titulo: string;
  aulas: Aula[];
};
type Questao = {
  numero: number;
  aulaId: number;
  assunto: string;
  disciplina: string;
  enunciado: string;
  alternativas: { A: string; B: string; C: string; D: string; E: string };
  gabarito: string;
  explicacao: string;
};
type Resposta = {
  aulaId: number;
  resposta: string;
  gabarito: string;
  assunto: string;
};
type RankingItem = {
  aulaId: number;
  assunto: string;
  disciplina: string;
  taxaErro: number;
  acertos: number;
  erros: number;
  total: number;
};
type RevisaoPendente = {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTempo(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

const TIPO_CONFIG: Record<string, { label: string; cor: string; bg: string }> = {
  "24h": { label: "24h",  cor: "text-violet-400",  bg: "bg-violet-500/20 border-violet-700" },
  "7d":  { label: "7d",   cor: "text-blue-400",    bg: "bg-blue-500/20 border-blue-700" },
  "30d": { label: "30d",  cor: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-700" },
  "90d": { label: "90d",  cor: "text-amber-400",   bg: "bg-amber-500/20 border-amber-700" },
};

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = "simulado" | "ranking" | "revisao";

export default function SimuladoPage() {
  const [tab, setTab] = useState<Tab>("simulado");

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-[#7C3AED]/20 rounded-xl flex items-center justify-center">
            <Brain size={22} className="text-[#7C3AED]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Quiz & Simulados</h1>
            <p className="text-sm text-[#94A3B8]">Pratique, identifique pontos fracos e revise</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1E293B] rounded-xl p-1 mb-6 w-fit">
        {([
          { key: "simulado", label: "Simulado", icon: Play },
          { key: "ranking",  label: "Ranking de Erros", icon: TrendingDown },
          { key: "revisao",  label: "Revisão Inteligente", icon: Calendar },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-[#7C3AED] text-white shadow"
                : "text-[#94A3B8] hover:text-white hover:bg-[#334155]"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "simulado" && <AbaSimulado />}
      {tab === "ranking"  && <AbaRanking />}
      {tab === "revisao"  && <AbaRevisao />}
    </div>
  );
}

// ─── Aba Simulado ─────────────────────────────────────────────────────────────
type SimuladoFase = "config" | "rodando" | "resultado";

function AbaSimulado() {
  const [fase, setFase] = useState<SimuladoFase>("config");
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(true);
  const [cursoId, setCursoId] = useState<number | null>(null);
  const [aulasSelecionadas, setAulasSelecionadas] = useState<Set<number>>(new Set());
  const [numQuestoes, setNumQuestoes] = useState(20);
  const [tempoMin, setTempoMin] = useState(30);
  const [gerando, setGerando] = useState(false);
  const [erroGerar, setErroGerar] = useState("");

  // Rodando
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, Resposta>>({});
  const [respondeuAtual, setRespondeuAtual] = useState(false);
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resultado
  const [resultado, setResultado] = useState<{
    acertos: number; total: number; erros: number;
    revisoesAgendadas: number; tempoSegundos: number;
  } | null>(null);
  const [salvandoResultado, setSalvandoResultado] = useState(false);

  useEffect(() => {
    fetch("/api/simulado/cursos")
      .then(r => r.json())
      .then(d => { setCursos(d.cursos ?? []); setLoadingCursos(false); })
      .catch(() => setLoadingCursos(false));
  }, []);

  const cursoAtual = cursos.find(c => c.id === cursoId);

  function toggleAula(id: number) {
    setAulasSelecionadas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selecionarTodas() {
    if (!cursoAtual) return;
    const aulasValidas = cursoAtual.aulas.filter(a => a.temQuestoes || a.assunto).map(a => a.id);
    setAulasSelecionadas(new Set(aulasValidas));
  }

  async function iniciarSimulado() {
    if (!aulasSelecionadas.size) return;
    setGerando(true);
    setErroGerar("");
    try {
      const r = await fetch("/api/simulado/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aulaIds: [...aulasSelecionadas], numQuestoes }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setErroGerar(d.error ?? "Erro ao gerar questões"); return; }
      setQuestoes(d.questoes);
      setAtual(0);
      setRespostas({});
      setRespondeuAtual(false);
      setMostrarExplicacao(false);
      const total = tempoMin * 60;
      setTempoRestante(total);
      setTempoDecorrido(0);
      setFase("rodando");
      // Iniciar cronômetro
      timerRef.current = setInterval(() => {
        setTempoRestante(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
        setTempoDecorrido(prev => prev + 1);
      }, 1000);
    } finally {
      setGerando(false);
    }
  }

  function responder(alt: string) {
    if (respondeuAtual) return;
    const q = questoes[atual];
    setRespostas(prev => ({
      ...prev,
      [q.numero]: { aulaId: q.aulaId, resposta: alt, gabarito: q.gabarito, assunto: q.assunto },
    }));
    setRespondeuAtual(true);
    setMostrarExplicacao(false);
  }

  function proxima() {
    if (atual < questoes.length - 1) {
      setAtual(atual + 1);
      setRespondeuAtual(!!respostas[questoes[atual + 1]?.numero]);
      setMostrarExplicacao(false);
    } else {
      finalizarSimulado();
    }
  }

  async function finalizarSimulado() {
    clearInterval(timerRef.current!);
    setSalvandoResultado(true);
    try {
      const r = await fetch("/api/simulado/resultado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas, tempoSegundos: tempoDecorrido }),
      });
      const d = await r.json();
      setResultado(d);
    } finally {
      setSalvandoResultado(false);
      setFase("resultado");
    }
  }

  function reiniciar() {
    clearInterval(timerRef.current!);
    setFase("config");
    setQuestoes([]);
    setRespostas({});
    setResultado(null);
    setAulasSelecionadas(new Set());
  }

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Config ──
  if (fase === "config") {
    return (
      <div className="space-y-6">
        {loadingCursos ? (
          <div className="flex items-center gap-2 text-[#94A3B8]"><Loader2 className="animate-spin" size={18} />Carregando cursos...</div>
        ) : cursos.length === 0 ? (
          <div className="bg-[#1E293B] rounded-xl p-8 text-center border border-slate-700">
            <BookOpen size={40} className="text-[#94A3B8] mx-auto mb-3" />
            <p className="text-[#94A3B8]">Nenhum curso com aulas encontrado. Crie um curso primeiro.</p>
          </div>
        ) : (
          <>
            {/* Seleção de curso */}
            <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700">
              <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">1. Selecione o Curso</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cursos.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCursoId(c.id); setAulasSelecionadas(new Set()); }}
                    className={`text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      cursoId === c.id
                        ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white"
                        : "border-slate-600 text-[#94A3B8] hover:border-slate-500 hover:text-white"
                    }`}
                  >
                    <div className="font-medium truncate">{c.titulo}</div>
                    <div className="text-xs mt-0.5 opacity-70">{c.aulas.length} aulas</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção de aulas */}
            {cursoAtual && (
              <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">2. Selecione as Aulas</h2>
                  <button onClick={selecionarTodas} className="text-xs text-[#7C3AED] hover:text-violet-300">Selecionar todas</button>
                </div>
                {cursoAtual.aulas.length === 0 ? (
                  <p className="text-sm text-[#94A3B8]">Nenhuma aula neste curso.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {cursoAtual.aulas.map(a => (
                      <button
                        key={a.id}
                        onClick={() => toggleAula(a.id)}
                        className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all flex items-start gap-2 ${
                          aulasSelecionadas.has(a.id)
                            ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white"
                            : "border-slate-700 text-[#94A3B8] hover:border-slate-500 hover:text-white"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border mt-0.5 flex-shrink-0 flex items-center justify-center ${
                          aulasSelecionadas.has(a.id) ? "bg-[#7C3AED] border-[#7C3AED]" : "border-slate-500"
                        }`}>
                          {aulasSelecionadas.has(a.id) && <CheckCircle2 size={10} className="text-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-xs leading-tight truncate">{a.assunto}</div>
                          {a.disciplina && <div className="text-[10px] opacity-60 mt-0.5">{a.disciplina}</div>}
                          {!a.temQuestoes && <div className="text-[10px] text-amber-400 mt-0.5">⚡ gera na hora</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs text-[#94A3B8]">{aulasSelecionadas.size} aulas selecionadas</div>
              </div>
            )}

            {/* Config questões e tempo */}
            {aulasSelecionadas.size > 0 && (
              <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700">
                <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-4">3. Configure o Simulado</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">Nº de questões</label>
                    <div className="flex gap-2">
                      {[10, 20, 30, 40].map(n => (
                        <button
                          key={n}
                          onClick={() => setNumQuestoes(n)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                            numQuestoes === n
                              ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white"
                              : "border-slate-600 text-[#94A3B8] hover:border-slate-500"
                          }`}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1.5 block">Tempo (minutos)</label>
                    <div className="flex gap-2">
                      {[15, 30, 45, 60].map(n => (
                        <button
                          key={n}
                          onClick={() => setTempoMin(n)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                            tempoMin === n
                              ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white"
                              : "border-slate-600 text-[#94A3B8] hover:border-slate-500"
                          }`}
                        >{n}m</button>
                      ))}
                    </div>
                  </div>
                </div>
                {erroGerar && (
                  <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle size={15} /> {erroGerar}
                  </div>
                )}
                <button
                  onClick={iniciarSimulado}
                  disabled={gerando}
                  className="mt-5 w-full flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all"
                >
                  {gerando ? <><Loader2 className="animate-spin" size={18} />Gerando questões...</> : <><Play size={18} />Iniciar Simulado</>}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Rodando ──
  if (fase === "rodando") {
    const q = questoes[atual];
    const respostaAtual = respostas[q?.numero];
    const percentual = Math.round(((Object.keys(respostas).length) / questoes.length) * 100);
    const tempoPercent = tempoRestante > 0 ? Math.round((tempoRestante / (tempoMin * 60)) * 100) : 0;
    const acertouAtual = respostaAtual?.resposta === respostaAtual?.gabarito;

    return (
      <div className="max-w-2xl mx-auto">
        {/* Header cronômetro */}
        <div className="bg-[#1E293B] rounded-xl p-4 border border-slate-700 mb-4 flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Clock size={16} className={tempoRestante < 120 ? "text-red-400" : "text-[#94A3B8]"} />
            <span className={`font-mono font-bold text-lg ${tempoRestante < 120 ? "text-red-400" : "text-white"}`}>
              {formatTempo(tempoRestante)}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
              <span>Questão {atual + 1}/{questoes.length}</span>
              <span>{percentual}% respondido</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-[#7C3AED] rounded-full transition-all" style={{ width: `${percentual}%` }} />
            </div>
          </div>
          <button
            onClick={finalizarSimulado}
            disabled={salvandoResultado}
            className="text-xs text-[#94A3B8] hover:text-red-400 border border-slate-600 px-3 py-1.5 rounded-lg transition-all"
          >
            {salvandoResultado ? <Loader2 size={14} className="animate-spin" /> : "Finalizar"}
          </button>
        </div>

        {/* Questão */}
        {q && (
          <div className="bg-[#1E293B] rounded-xl border border-slate-700 overflow-hidden">
            {/* Meta */}
            <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2">
              <span className="text-xs bg-[#7C3AED]/20 text-violet-300 border border-violet-800 px-2 py-0.5 rounded-full">{q.disciplina || "Geral"}</span>
              <span className="text-xs text-[#94A3B8] truncate">{q.assunto}</span>
              <span className="ml-auto text-xs text-[#475569]">#{q.numero}</span>
            </div>

            {/* Enunciado */}
            <div className="p-5">
              <p className="text-[#E2E8F0] leading-relaxed text-sm mb-5">{q.enunciado}</p>

              {/* Alternativas */}
              <div className="space-y-2">
                {(Object.entries(q.alternativas) as [string, string][]).map(([letra, texto]) => {
                  let estilo = "border-slate-700 text-[#94A3B8] hover:border-slate-500 hover:text-white hover:bg-slate-700/30";
                  if (respondeuAtual) {
                    if (letra === q.gabarito) estilo = "border-emerald-500 bg-emerald-500/10 text-emerald-300";
                    else if (letra === respostaAtual?.resposta && letra !== q.gabarito) estilo = "border-red-500 bg-red-500/10 text-red-300";
                    else estilo = "border-slate-700 text-[#475569] opacity-50";
                  }
                  return (
                    <button
                      key={letra}
                      onClick={() => responder(letra)}
                      disabled={respondeuAtual}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border text-sm transition-all ${estilo}`}
                    >
                      <span className="font-bold font-mono mt-0.5 flex-shrink-0 w-5">{letra}</span>
                      <span className="leading-relaxed">{texto}</span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback */}
              {respondeuAtual && (
                <div className={`mt-4 p-3 rounded-xl flex items-center gap-2 ${acertouAtual ? "bg-emerald-500/10 border border-emerald-700" : "bg-red-500/10 border border-red-700"}`}>
                  {acertouAtual
                    ? <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                    : <XCircle size={16} className="text-red-400 flex-shrink-0" />}
                  <span className={`text-sm font-medium ${acertouAtual ? "text-emerald-300" : "text-red-300"}`}>
                    {acertouAtual ? "Correto!" : `Incorreto — gabarito: ${q.gabarito}`}
                  </span>
                  <button
                    onClick={() => setMostrarExplicacao(v => !v)}
                    className="ml-auto text-xs text-[#94A3B8] hover:text-white"
                  >{mostrarExplicacao ? "Ocultar" : "Ver explicação"}</button>
                </div>
              )}

              {mostrarExplicacao && (
                <div className="mt-2 p-3 bg-slate-800 rounded-xl text-sm text-[#CBD5E1] leading-relaxed">
                  {q.explicacao}
                </div>
              )}

              {/* Próxima */}
              {respondeuAtual && (
                <button
                  onClick={proxima}
                  disabled={salvandoResultado}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-[#1E40AF] hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-all text-sm"
                >
                  {salvandoResultado ? <Loader2 className="animate-spin" size={16} /> :
                    atual < questoes.length - 1 ? <><ChevronRight size={16} />Próxima questão</> : <><Trophy size={16} />Ver resultado</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Resultado ──
  if (fase === "resultado" && resultado) {
    const pct = Math.round((resultado.acertos / resultado.total) * 100);
    const cor = pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
    const msg = pct >= 70 ? "Ótimo desempenho!" : pct >= 50 ? "Pode melhorar!" : "Precisa revisar mais.";

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#1E293B] rounded-xl border border-slate-700 p-8 text-center">
          <Trophy size={48} className="mx-auto mb-4 text-[#F59E0B]" />
          <h2 className="text-2xl font-bold text-white mb-1">{msg}</h2>
          <div className={`text-6xl font-bold mt-4 mb-2 ${cor}`}>{pct}%</div>
          <p className="text-[#94A3B8] mb-6">{resultado.acertos} de {resultado.total} questões corretas</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-emerald-500/10 border border-emerald-700 rounded-xl p-3">
              <div className="text-2xl font-bold text-emerald-400">{resultado.acertos}</div>
              <div className="text-xs text-[#94A3B8] mt-0.5">Acertos</div>
            </div>
            <div className="bg-red-500/10 border border-red-700 rounded-xl p-3">
              <div className="text-2xl font-bold text-red-400">{resultado.erros}</div>
              <div className="text-xs text-[#94A3B8] mt-0.5">Erros</div>
            </div>
            <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-3">
              <div className="text-2xl font-bold text-white">{formatTempo(resultado.tempoSegundos)}</div>
              <div className="text-xs text-[#94A3B8] mt-0.5">Tempo</div>
            </div>
          </div>

          {resultado.revisoesAgendadas > 0 && (
            <div className="bg-violet-500/10 border border-violet-700 rounded-xl p-3 mb-6 flex items-center gap-2 justify-center">
              <Calendar size={16} className="text-violet-400" />
              <span className="text-sm text-violet-300">
                {resultado.revisoesAgendadas} revisão(ões) agendada(s) para os assuntos com erro
              </span>
            </div>
          )}

          <button
            onClick={reiniciar}
            className="flex items-center gap-2 mx-auto bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold px-6 py-3 rounded-xl transition-all"
          >
            <RotateCcw size={16} />
            Novo Simulado
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Aba Ranking de Erros ─────────────────────────────────────────────────────
function AbaRanking() {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/simulado/ranking-erros")
      .then(r => r.json())
      .then(d => { setRanking(d.ranking ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center gap-2 text-[#94A3B8]">
      <Loader2 className="animate-spin" size={18} />Carregando ranking...
    </div>
  );

  if (!ranking.length) return (
    <div className="bg-[#1E293B] rounded-xl p-8 text-center border border-slate-700">
      <BarChart2 size={40} className="text-[#94A3B8] mx-auto mb-3" />
      <p className="text-[#94A3B8]">Nenhum dado ainda. Faça um simulado primeiro!</p>
    </div>
  );

  const maxTaxa = Math.max(...ranking.map(r => r.taxaErro), 1);

  return (
    <div>
      <div className="bg-[#1E293B] rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
          <TrendingDown size={18} className="text-red-400" />
          <h2 className="font-semibold text-white">Assuntos com Maior Taxa de Erro</h2>
          <span className="ml-auto text-xs text-[#94A3B8]">{ranking.length} assunto(s)</span>
        </div>
        <div className="divide-y divide-slate-700/50">
          {ranking.map((item, idx) => (
            <div key={item.aulaId} className="px-5 py-4 hover:bg-slate-700/20 transition-colors">
              <div className="flex items-center gap-4">
                {/* Posição */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  idx === 0 ? "bg-red-500/20 text-red-400" :
                  idx === 1 ? "bg-orange-500/20 text-orange-400" :
                  idx === 2 ? "bg-amber-500/20 text-amber-400" :
                  "bg-slate-700 text-[#94A3B8]"
                }`}>{idx + 1}</div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white truncate">{item.assunto}</span>
                    {item.disciplina && item.disciplina !== "—" && (
                      <span className="text-[10px] text-[#94A3B8] bg-slate-700 px-1.5 py-0.5 rounded flex-shrink-0">{item.disciplina}</span>
                    )}
                  </div>
                  {/* Barra */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(item.taxaErro / maxTaxa) * 100}%`,
                          background: item.taxaErro >= 70 ? "#EF4444" : item.taxaErro >= 50 ? "#F97316" : item.taxaErro >= 30 ? "#F59E0B" : "#22C55E"
                        }}
                      />
                    </div>
                    <span className={`text-sm font-bold w-12 text-right flex-shrink-0 ${
                      item.taxaErro >= 70 ? "text-red-400" : item.taxaErro >= 50 ? "text-orange-400" : item.taxaErro >= 30 ? "text-amber-400" : "text-emerald-400"
                    }`}>{item.taxaErro}%</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right text-xs text-[#94A3B8] flex-shrink-0">
                  <div className="text-white font-medium">{item.total} questões</div>
                  <div>{item.acertos} ✓ · {item.erros} ✗</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[#475569] mt-3 text-center">
        Foque nos vermelhos — alta taxa de erro indica pontos fracos que precisam de revisão.
      </p>
    </div>
  );
}

// ─── Aba Revisão Inteligente ──────────────────────────────────────────────────
type RevisaoFase = "lista" | "quiz";

function AbaRevisao() {
  const [revisoes, setRevisoes] = useState<RevisaoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizAberto, setQuizAberto] = useState<RevisaoPendente | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [rHoje, rProx] = await Promise.all([
        fetch("/api/revisoes/hoje").then(r => r.json()),
        fetch("/api/revisoes/proximas").then(r => r.json()),
      ]);
      const todas = [...(rHoje.revisoes ?? []), ...(rProx.revisoes ?? [])];
      // deduplicar por id
      const mapa = new Map<number, RevisaoPendente>();
      todas.forEach(r => mapa.set(r.id, r));
      setRevisoes([...mapa.values()]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  if (quizAberto) {
    return (
      <div className="max-w-2xl mx-auto">
        <QuizRevisao
          revisaoId={quizAberto.id}
          assunto={quizAberto.assunto}
          tipo={quizAberto.tipo}
          onConcluir={async () => { setQuizAberto(null); await carregar(); }}
          onFechar={() => setQuizAberto(null)}
        />
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-[#94A3B8]">
      <Loader2 className="animate-spin" size={18} />Carregando revisões...
    </div>
  );

  if (!revisoes.length) return (
    <div className="bg-[#1E293B] rounded-xl p-8 text-center border border-slate-700">
      <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
      <p className="text-white font-medium mb-1">Nenhuma revisão pendente!</p>
      <p className="text-sm text-[#94A3B8]">Quando você errar questões no simulado, as revisões aparecerão aqui automaticamente.</p>
    </div>
  );

  function diasAte(data: string) {
    const diff = new Date(data).getTime() - Date.now();
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (dias <= 0) return "Hoje";
    if (dias === 1) return "Amanhã";
    return `Em ${dias} dias`;
  }

  const hoje = revisoes.filter(r => {
    const diff = new Date(r.agendadaPara).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) <= 0;
  });
  const proximas = revisoes.filter(r => {
    const diff = new Date(r.agendadaPara).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) > 0;
  });

  function RevisaoCard({ r }: { r: RevisaoPendente }) {
    const cfg = TIPO_CONFIG[r.tipo] ?? { label: r.tipo, cor: "text-slate-400", bg: "bg-slate-700 border-slate-600" };
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg}`}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{r.assunto}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${cfg.cor}`}>{cfg.label}</span>
            {r.disciplina && <span className="text-xs text-[#475569]">· {r.disciplina}</span>}
            <span className="text-xs text-[#475569]">· {r.cursoTitulo}</span>
          </div>
        </div>
        <button
          onClick={() => setQuizAberto(r)}
          className="flex items-center gap-1.5 bg-[#1E40AF] hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
        >
          <Zap size={12} />
          Revisar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hoje.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            <h3 className="text-sm font-semibold text-white">Pendentes — {hoje.length} revisão(ões)</h3>
          </div>
          <div className="space-y-2">
            {hoje.map(r => <RevisaoCard key={r.id} r={r} />)}
          </div>
        </div>
      )}

      {proximas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#94A3B8] mb-3">Próximas revisões — {proximas.length}</h3>
          <div className="space-y-2">
            {proximas.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/40">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#CBD5E1] truncate">{r.assunto}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs ${(TIPO_CONFIG[r.tipo] ?? {}).cor ?? "text-slate-400"}`}>
                      {(TIPO_CONFIG[r.tipo] ?? { label: r.tipo }).label}
                    </span>
                    <span className="text-xs text-[#475569]">· {r.cursoTitulo}</span>
                  </div>
                </div>
                <span className="text-xs text-[#475569] flex-shrink-0">{diasAte(r.agendadaPara)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={carregar} className="flex items-center gap-2 text-xs text-[#94A3B8] hover:text-white transition-colors mx-auto">
        <RefreshCw size={13} />Atualizar
      </button>
    </div>
  );
}
