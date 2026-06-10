import { useEffect, useState } from "react";
import {
  X, Loader2, CheckCircle2, XCircle, ChevronRight,
  Trophy, RotateCcw, AlertCircle
} from "lucide-react";

type Alternativas = { A: string; B: string; C: string; D: string; E: string };
type Questao = {
  numero: number;
  enunciado: string;
  alternativas: Alternativas;
  gabarito: string;
  explicacao: string;
};

type Props = {
  revisaoId: number;
  assunto: string;
  tipo: string;
  onConcluir: () => void;
  onFechar: () => void;
};

const TIPO_COR: Record<string, string> = {
  "24h": "text-violet-400",
  "7d": "text-blue-400",
  "30d": "text-emerald-400",
  "90d": "text-amber-400",
};

const TIPO_LABEL: Record<string, string> = {
  "24h": "Revisão 24h",
  "7d": "Revisão 7 dias",
  "30d": "Revisão 30 dias",
  "90d": "Revisão 90 dias",
};

export default function QuizRevisao({ revisaoId, assunto, tipo, onConcluir, onFechar }: Props) {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [mostrarGabarito, setMostrarGabarito] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [concluindo, setConcluindo] = useState(false);

  useEffect(() => {
    carregarQuestoes();
  }, [revisaoId]);

  async function carregarQuestoes() {
    setLoading(true);
    setErro("");
    try {
      const r = await fetch(`/api/revisoes/${revisaoId}/questoes`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro ao carregar");
      setQuestoes(data.questoes ?? []);
    } catch (e: unknown) {
      setErro(String(e));
    } finally {
      setLoading(false);
    }
  }

  function responder(letra: string) {
    if (mostrarGabarito) return;
    setRespostas(prev => ({ ...prev, [atual]: letra }));
    setMostrarGabarito(true);
  }

  function proxima() {
    setMostrarGabarito(false);
    if (atual + 1 >= questoes.length) {
      setFinalizado(true);
    } else {
      setAtual(prev => prev + 1);
    }
  }

  async function concluirRevisao() {
    setConcluindo(true);
    await fetch(`/api/revisoes/${revisaoId}/concluir`, { method: "PATCH" });
    setConcluindo(false);
    onConcluir();
  }

  const questao = questoes[atual];
  const acertos = questoes.filter((q, i) => respostas[i] === q.gabarito).length;
  const percentual = questoes.length > 0 ? Math.round((acertos / questoes.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0F172A] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TIPO_COR[tipo] ?? "text-slate-400"}`}>
              {TIPO_LABEL[tipo] ?? tipo}
            </p>
            <h2 className="text-white font-semibold text-sm mt-0.5 truncate max-w-md">{assunto}</h2>
          </div>
          <button
            onClick={onFechar}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={36} className="animate-spin text-[#F59E0B]" />
              <p className="text-slate-400 text-sm">Gerando questões estilo Cesgranrio...</p>
            </div>
          )}

          {/* Erro */}
          {!loading && erro && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <AlertCircle size={36} className="text-red-400" />
              <p className="text-slate-300 text-sm">{erro}</p>
              <button
                onClick={carregarQuestoes}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700 transition-colors"
              >
                <RotateCcw size={14} /> Tentar novamente
              </button>
            </div>
          )}

          {/* Resultado final */}
          {!loading && !erro && finalizado && (
            <div className="flex flex-col items-center justify-center gap-6 py-8">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${
                percentual >= 70 ? "border-emerald-500 bg-emerald-900/30" : "border-amber-500 bg-amber-900/30"
              }`}>
                <span className={`text-3xl font-bold ${percentual >= 70 ? "text-emerald-400" : "text-amber-400"}`}>
                  {percentual}%
                </span>
              </div>

              <div className="text-center">
                <p className="text-white text-xl font-bold mb-1">
                  {acertos} de {questoes.length} corretas
                </p>
                <p className="text-slate-400 text-sm">
                  {percentual >= 80
                    ? "Ótimo! Você domina esse assunto."
                    : percentual >= 60
                    ? "Bom progresso! Revise os pontos errados."
                    : "Atenção: releia a teoria antes da próxima revisão."}
                </p>
              </div>

              {/* Resumo por questão */}
              <div className="w-full space-y-2">
                {questoes.map((q, i) => {
                  const certo = respostas[i] === q.gabarito;
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                      certo ? "bg-emerald-900/20 border-emerald-800" : "bg-red-900/20 border-red-800"
                    }`}>
                      {certo
                        ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                        : <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-xs line-clamp-2">{q.enunciado}</p>
                        {!certo && (
                          <p className="text-xs text-slate-400 mt-1">
                            Sua resposta: <span className="text-red-400 font-bold">{respostas[i] ?? "—"}</span>
                            {" · "}Correta: <span className="text-emerald-400 font-bold">{q.gabarito}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={concluirRevisao}
                disabled={concluindo}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#F59E0B] text-black font-bold hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                {concluindo ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                Concluir revisão
              </button>
            </div>
          )}

          {/* Questão */}
          {!loading && !erro && !finalizado && questao && (
            <div className="space-y-5">
              {/* Progress */}
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                  <div
                    className="bg-[#F59E0B] h-1.5 rounded-full transition-all"
                    style={{ width: `${((atual) / questoes.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {atual + 1}/{questoes.length}
                </span>
              </div>

              {/* Enunciado */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-2">
                  Questão {questao.numero} · Cesgranrio
                </p>
                <p className="text-slate-200 text-sm leading-relaxed">{questao.enunciado}</p>
              </div>

              {/* Alternativas */}
              <div className="space-y-2">
                {(["A", "B", "C", "D", "E"] as const).map((letra) => {
                  const respondida = respostas[atual];
                  const estaCorreta = letra === questao.gabarito;
                  const foiEscolhida = letra === respondida;

                  let estilo = "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-500 hover:bg-slate-800";
                  if (mostrarGabarito) {
                    if (estaCorreta) estilo = "border-emerald-600 bg-emerald-900/30 text-emerald-300";
                    else if (foiEscolhida) estilo = "border-red-600 bg-red-900/30 text-red-300";
                    else estilo = "border-slate-800 bg-slate-800/20 text-slate-500";
                  }

                  return (
                    <button
                      key={letra}
                      onClick={() => responder(letra)}
                      disabled={mostrarGabarito}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${estilo}`}
                    >
                      <span className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold transition-colors ${
                        mostrarGabarito && estaCorreta
                          ? "border-emerald-500 bg-emerald-600 text-white"
                          : mostrarGabarito && foiEscolhida
                          ? "border-red-500 bg-red-600 text-white"
                          : "border-current"
                      }`}>
                        {letra}
                      </span>
                      <span className="text-sm leading-relaxed">{questao.alternativas[letra]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Gabarito/Explicação */}
              {mostrarGabarito && (
                <div className={`rounded-xl border p-4 ${
                  respostas[atual] === questao.gabarito
                    ? "border-emerald-700 bg-emerald-900/20"
                    : "border-amber-700 bg-amber-900/20"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {respostas[atual] === questao.gabarito
                      ? <CheckCircle2 size={16} className="text-emerald-400" />
                      : <XCircle size={16} className="text-amber-400" />}
                    <span className={`text-sm font-semibold ${
                      respostas[atual] === questao.gabarito ? "text-emerald-400" : "text-amber-400"
                    }`}>
                      {respostas[atual] === questao.gabarito ? "Correto!" : `Incorreto — Gabarito: ${questao.gabarito}`}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{questao.explicacao}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — botão próxima */}
        {!loading && !erro && !finalizado && mostrarGabarito && (
          <div className="px-5 py-4 border-t border-slate-800">
            <button
              onClick={proxima}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#F59E0B] text-black font-bold hover:bg-amber-400 transition-colors"
            >
              {atual + 1 >= questoes.length ? "Ver resultado" : "Próxima questão"}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
