import { useState } from "react";
import {
  X, CheckCircle2, XCircle, ChevronRight, ChevronLeft,
  RotateCcw, Trophy, Loader2, BookOpen, AlertCircle
} from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────
interface Alternativas {
  A: string; B: string; C: string; D: string; E: string;
}

interface Questao {
  id: number;
  enunciado: string;
  alternativas: Alternativas;
  gabarito: string;
  explicacao: string;
}

interface Props {
  aulaId: number;
  cursoId: number;
  assunto: string;
  onFechar: () => void;
}

type Fase = "carregando" | "quiz" | "resultado";

const LETRA_COR = {
  correta: "bg-emerald-900/60 border-emerald-500 text-emerald-300",
  errada: "bg-red-900/40 border-red-500 text-red-300",
  selecionada: "bg-blue-900/60 border-blue-500 text-blue-300",
  neutra: "bg-[#1E293B] border-slate-600 text-slate-300 hover:border-blue-500 hover:text-white",
};

function notaEmoji(pct: number) {
  if (pct >= 90) return "🏆";
  if (pct >= 70) return "🎯";
  if (pct >= 50) return "📈";
  return "💪";
}

function notaMensagem(pct: number) {
  if (pct >= 90) return "Excelente! Domínio total do conteúdo.";
  if (pct >= 70) return "Muito bom! Está no caminho certo.";
  if (pct >= 50) return "Razoável. Revise os pontos que errou.";
  return "Precisa reforçar. Releia a aula antes de avançar.";
}

// ── Componente ───────────────────────────────────────────────────
export function QuizAula({ aulaId, cursoId, assunto, onFechar }: Props) {
  const [fase, setFase] = useState<Fase>("carregando");
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [cached, setCached] = useState(false);

  // Carregar questões ao montar
  useState(() => {
    carregarQuestoes();
  });

  async function carregarQuestoes() {
    setFase("carregando");
    setErro(null);
    try {
      const res = await fetch(`/api/aulas/cursos/${cursoId}/aulas/${aulaId}/questoes`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao gerar questões");
      }
      const data = await res.json();
      setQuestoes(data.questoes ?? []);
      setCached(data.cached ?? false);
      setFase("quiz");
    } catch (e: any) {
      setErro(e.message ?? "Erro desconhecido");
      setFase("quiz");
    }
  }

  function responder(letra: string) {
    if (respostas[indice] !== undefined) return; // já respondida
    setRespostas(prev => ({ ...prev, [indice]: letra }));
    setMostrarExplicacao(true);
  }

  function proxima() {
    setMostrarExplicacao(false);
    if (indice < questoes.length - 1) {
      setIndice(i => i + 1);
    } else {
      finalizarQuiz();
    }
  }

  function anterior() {
    setMostrarExplicacao(false);
    setIndice(i => Math.max(0, i - 1));
  }

  async function finalizarQuiz() {
    const acertos = questoes.filter((q, i) => respostas[i] === q.gabarito).length;
    setSalvando(true);
    try {
      await fetch(`/api/aulas/cursos/${cursoId}/aulas/${aulaId}/questoes/tentativa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acertos, total: questoes.length, respostas }),
      });
    } catch {}
    setSalvando(false);
    setFase("resultado");
  }

  function reiniciar() {
    setRespostas({});
    setIndice(0);
    setMostrarExplicacao(false);
    setFase("quiz");
  }

  // ── Render: carregando ───────────────────────────────────────
  if (fase === "carregando") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-[#1E293B] rounded-2xl border border-slate-700 p-10 flex flex-col items-center gap-4 max-w-sm w-full mx-4">
          <Loader2 size={40} className="text-blue-400 animate-spin" />
          <p className="text-white font-semibold">Gerando questões com IA...</p>
          <p className="text-slate-400 text-sm text-center">
            Criando 10 questões no estilo CESGRANRIO sobre<br />
            <span className="text-slate-300 font-medium">{assunto}</span>
          </p>
        </div>
      </div>
    );
  }

  // ── Render: erro ────────────────────────────────────────────
  if (erro) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-[#1E293B] rounded-2xl border border-red-800 p-8 flex flex-col items-center gap-4 max-w-sm w-full mx-4">
          <AlertCircle size={40} className="text-red-400" />
          <p className="text-white font-semibold">Erro ao gerar questões</p>
          <p className="text-slate-400 text-sm text-center">{erro}</p>
          <div className="flex gap-3">
            <button onClick={carregarQuestoes} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Tentar novamente
            </button>
            <button onClick={onFechar} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600">
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: resultado ────────────────────────────────────────
  if (fase === "resultado") {
    const acertos = questoes.filter((q, i) => respostas[i] === q.gabarito).length;
    const pct = Math.round((acertos / questoes.length) * 100);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-[#1E293B] rounded-2xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          {/* Header resultado */}
          <div className="p-8 text-center border-b border-slate-700">
            <div className="text-5xl mb-3">{notaEmoji(pct)}</div>
            <h2 className="text-2xl font-bold text-white mb-1">{acertos} / {questoes.length} acertos</h2>
            <div className="text-4xl font-black mb-3" style={{ color: pct >= 70 ? "#34D399" : pct >= 50 ? "#F59E0B" : "#F87171" }}>
              {pct}%
            </div>
            <p className="text-slate-400 text-sm">{notaMensagem(pct)}</p>

            {/* Barra de progresso */}
            <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct >= 70 ? "#34D399" : pct >= 50 ? "#F59E0B" : "#F87171"
                }}
              />
            </div>
          </div>

          {/* Gabarito rápido */}
          <div className="p-6">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-3 font-medium">Gabarito</p>
            <div className="grid grid-cols-5 gap-2">
              {questoes.map((q, i) => {
                const acertou = respostas[i] === q.gabarito;
                return (
                  <div
                    key={i}
                    className={`rounded-lg p-2 text-center border text-xs ${
                      acertou
                        ? "bg-emerald-900/40 border-emerald-700 text-emerald-300"
                        : "bg-red-900/30 border-red-800 text-red-300"
                    }`}
                  >
                    <div className="font-bold">{i + 1}</div>
                    <div>{acertou ? "✓" : `${respostas[i] ?? "—"}→${q.gabarito}`}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ações */}
          <div className="p-6 pt-0 flex gap-3">
            <button
              onClick={reiniciar}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#334155] text-white rounded-lg text-sm hover:bg-[#475569] transition-colors"
            >
              <RotateCcw size={15} /> Refazer
            </button>
            <button
              onClick={onFechar}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <BookOpen size={15} /> Voltar à aula
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: quiz ─────────────────────────────────────────────
  const questao = questoes[indice];
  if (!questao) return null;

  const respostaUsuario = respostas[indice];
  const respondida = respostaUsuario !== undefined;
  const acertou = respondida && respostaUsuario === questao.gabarito;
  const respondidas = Object.keys(respostas).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0F172A] rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Quiz</div>
            <div className="text-xs text-[#F59E0B] font-medium truncate max-w-[200px]">{assunto}</div>
            {cached && <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">cache</span>}
          </div>
          <button onClick={onFechar} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">{indice + 1} / {questoes.length}</span>
            <span className="text-xs text-slate-400">{respondidas} respondidas</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${((indice + 1) / questoes.length) * 100}%` }}
            />
          </div>
          {/* Bolinhas por questão */}
          <div className="flex gap-1.5 mt-2">
            {questoes.map((q, i) => {
              const r = respostas[i];
              return (
                <div
                  key={i}
                  onClick={() => { setIndice(i); setMostrarExplicacao(r !== undefined); }}
                  className={`h-2 flex-1 rounded-full cursor-pointer transition-all ${
                    i === indice ? "ring-1 ring-white/50" :
                    r === undefined ? "bg-slate-700" :
                    r === q.gabarito ? "bg-emerald-500" : "bg-red-500"
                  } ${i === indice ? (r === undefined ? "bg-blue-500" : r === q.gabarito ? "bg-emerald-500" : "bg-red-500") : ""}`}
                />
              );
            })}
          </div>
        </div>

        {/* Questão */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-white leading-relaxed mb-6 text-[15px]">
            <span className="text-slate-500 font-mono text-sm mr-2">{indice + 1}.</span>
            {questao.enunciado}
          </p>

          {/* Alternativas */}
          <div className="space-y-2.5">
            {(["A", "B", "C", "D", "E"] as const).map(letra => {
              let cor = LETRA_COR.neutra;
              if (respondida) {
                if (letra === questao.gabarito) cor = LETRA_COR.correta;
                else if (letra === respostaUsuario) cor = LETRA_COR.errada;
                else cor = "bg-[#1E293B] border-slate-700 text-slate-500 cursor-default";
              }

              return (
                <button
                  key={letra}
                  onClick={() => responder(letra)}
                  disabled={respondida}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-start gap-3 ${cor} ${!respondida ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span className="font-bold shrink-0 w-5">{letra}</span>
                  <span className="leading-relaxed">{questao.alternativas[letra]}</span>
                  {respondida && letra === questao.gabarito && (
                    <CheckCircle2 size={16} className="shrink-0 ml-auto mt-0.5 text-emerald-400" />
                  )}
                  {respondida && letra === respostaUsuario && letra !== questao.gabarito && (
                    <XCircle size={16} className="shrink-0 ml-auto mt-0.5 text-red-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explicação */}
          {respondida && mostrarExplicacao && (
            <div className={`mt-4 p-4 rounded-xl border text-sm leading-relaxed ${
              acertou
                ? "bg-emerald-900/20 border-emerald-800 text-emerald-200"
                : "bg-red-900/20 border-red-800 text-red-200"
            }`}>
              <p className={`font-semibold mb-1 ${acertou ? "text-emerald-400" : "text-red-400"}`}>
                {acertou ? "✓ Correto!" : `✗ Incorreto — gabarito: ${questao.gabarito}`}
              </p>
              <p className="text-slate-300">{questao.explicacao}</p>
            </div>
          )}
        </div>

        {/* Footer navegação */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={anterior}
            disabled={indice === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E293B] text-slate-400 text-sm hover:text-white hover:bg-[#334155] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          {respondida ? (
            <button
              onClick={proxima}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all"
            >
              {indice < questoes.length - 1 ? (
                <><ChevronRight size={16} /> Próxima</>
              ) : (
                <><Trophy size={16} /> Ver resultado</>
              )}
            </button>
          ) : (
            <span className="text-xs text-slate-500">Selecione uma alternativa</span>
          )}
        </div>
      </div>
    </div>
  );
}
