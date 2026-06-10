import { useEffect, useRef, useState } from "react";
import { useParams, useSearch } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  BookOpen, Loader2, ChevronRight, ChevronLeft, CheckCircle2, Clock,
  AlertCircle, ChevronDown, ChevronUp, BookMarked, Upload, FileText, X, FolderOpen, Sparkles, Timer, Youtube, Maximize2, Minimize2, Lock, Zap
} from "lucide-react";

import { QuizAula } from "../components/quiz-aula";

type AulaItem = {
  id: number;
  ordem: number;
  semana: number;
  diaSemana: string | null;
  assunto: string;
  disciplina: string | null;
  prioridade: string | null;
  status: string;
};

type AulaCompleta = AulaItem & { conteudoMd: string };

type Curso = {
  id: number;
  titulo: string;
  cargo: string | null;
  analiseId: number | null;
  gerandoStatus: string | null;
  gerandoErro: string | null;
  totalAulasGeradas: number;
  textoApostila: string | null;
};

const PRIORIDADE_COLOR: Record<string, string> = {
  alta: "bg-red-500/20 text-red-400 border border-red-800",
  media: "bg-yellow-500/20 text-yellow-400 border border-yellow-800",
  baixa: "bg-slate-600/40 text-slate-400 border border-slate-600",
};

export default function AulasCursoPage() {
  const params = useParams<{ id: string }>();
  const cursoId = parseInt(params.id ?? "0");
  const search = useSearch();
  const aulaIdInicial = new URLSearchParams(search).get("aulaId");

  const [curso, setCurso] = useState<Curso | null>(null);
  const [aulas, setAulas] = useState<AulaItem[]>([]);
  function iniciarParaAula(nomeAula: string) {
    localStorage.setItem("pomodoro_aula", nomeAula);
    window.dispatchEvent(new CustomEvent("pomodoro:iniciar", { detail: { aula: nomeAula } }));
  }
  const [quizAberto, setQuizAberto] = useState(false);
  const [aulaAtiva, setAulaAtiva] = useState<AulaCompleta | null>(null);
  const [modoFoco, setModoFoco] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAula, setLoadingAula] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [semanaAberta, setSemanaAberta] = useState<number | null>(null);
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<"aulas" | "apostilas">("aulas");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "enviando" | "ok" | "erro">("idle");
  const [uploadMsg, setUploadMsg] = useState("");
  const [modalLimite, setModalLimite] = useState(false);
  const [temApostila, setTemApostila] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Fechar modo foco com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModoFoco(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Carregar curso + lista de aulas
  useEffect(() => {
    fetch(`/api/aulas/cursos/${cursoId}`)
      .then((r) => r.json())
      .then(async (d) => {
        setCurso(d.curso ?? null);
        const aulasCarregadas: AulaItem[] = d.aulas ?? [];
        setAulas(aulasCarregadas);
        setTemApostila(!!(d.curso?.textoApostila));

        // Se veio ?aulaId=X, abrir essa aula diretamente
        if (aulaIdInicial) {
          const alvo = aulasCarregadas.find((a) => a.id === parseInt(aulaIdInicial));
          if (alvo) {
            setSemanaAberta(alvo.semana);
            // Carregar conteúdo
            try {
              const res = await fetch(`/api/aulas/cursos/${cursoId}/aulas/${alvo.id}`);
              const data = await res.json();
              setAulaAtiva(data.aula ?? null);
            } catch {}
          } else {
            const primeiroSemana = aulasCarregadas[0]?.semana ?? null;
            setSemanaAberta(primeiroSemana);
          }
        } else {
          const primeiroSemana = aulasCarregadas[0]?.semana ?? null;
          setSemanaAberta(primeiroSemana);
        }

        // Se está gerando, iniciar polling
        if (d.curso?.gerandoStatus === "gerando") {
          startPolling();
        }
      })
      .finally(() => setLoading(false));

    return () => stopPolling();
  }, [cursoId]);

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const [statusRes, aulasRes] = await Promise.all([
          fetch(`/api/aulas/cursos/${cursoId}/gerar/status`).then((r) => r.json()),
          fetch(`/api/aulas/cursos/${cursoId}`).then((r) => r.json()),
        ]);

        setCurso((prev) => prev ? {
          ...prev,
          gerandoStatus: statusRes.gerandoStatus,
          gerandoErro: statusRes.gerandoErro,
          totalAulasGeradas: statusRes.totalAulasGeradas,
        } : prev);

        setAulas(aulasRes.aulas ?? []);

        // Abrir semana das novas aulas automaticamente
        if (aulasRes.aulas?.length > 0 && !semanaAberta) {
          setSemanaAberta(aulasRes.aulas[0].semana);
        }

        if (statusRes.gerandoStatus !== "gerando") {
          stopPolling();
        }
      } catch {
        // silencia erros de rede durante polling
      }
    }, 4000);
  }

  // Carregar conteúdo de uma aula — gera sob demanda se ainda for pendente
  async function abrirAula(aula: AulaItem) {
    if (aulaAtiva?.id === aula.id) return;
    setLoadingAula(true);
    setAulaAtiva(null);
    try {
      let res: Response;
      if (aula.status === "pendente") {
        // Gera conteúdo agora (pode demorar alguns segundos)
        setGerando(true);
        res = await fetch(`/api/aulas/cursos/${cursoId}/aulas/${aula.id}/gerar`, { method: "POST" });
        setGerando(false);
        if (res.status === 402) {
          setModalLimite(true);
          setLoadingAula(false);
          return;
        }
      } else {
        res = await fetch(`/api/aulas/cursos/${cursoId}/aulas/${aula.id}`);
      }
      const data = await res.json();
      const aulaRetornada = data.aula ?? null;
      setAulaAtiva(aulaRetornada);
      // Atualiza status na lista (pendente → gerada)
      if (aulaRetornada) {
        setAulas((prev) => prev.map((a) => a.id === aulaRetornada.id ? { ...a, status: aulaRetornada.status } : a));
      }
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoadingAula(false);
    }
  }

  // Marcar como concluída (agenda revisão espaçada) ou desfazer
  async function toggleStatus(aulaId: number, statusAtual: string) {
    const novoStatus = statusAtual === "concluida" ? "gerada" : "concluida";
    await fetch(`/api/aulas/cursos/${cursoId}/aulas/${aulaId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    setAulas((prev) =>
      prev.map((a) => (a.id === aulaId ? { ...a, status: novoStatus } : a))
    );
    if (aulaAtiva?.id === aulaId) {
      setAulaAtiva((prev) => (prev ? { ...prev, status: novoStatus } : prev));
    }
  }

  // Upload de apostilas
  function addUploadFiles(files: FileList | null) {
    if (!files) return;
    const pdfs = Array.from(files).filter(f => f.type === "application/pdf");
    setUploadFiles(prev => [...prev, ...pdfs]);
  }

  async function enviarApostilas() {
    if (uploadFiles.length === 0) return;
    setUploadStatus("enviando");
    setUploadMsg("");
    const fd = new FormData();
    for (const f of uploadFiles) fd.append("apostilas", f);
    try {
      const res = await fetch(`/api/aulas/cursos/${cursoId}/apostilas`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no upload");
      setUploadStatus("ok");
      setUploadMsg(`✅ ${uploadFiles.length} arquivo(s) enviados com sucesso! (${Math.round(data.chars / 1000)}k caracteres extraídos)`);
      setUploadFiles([]);
      setTemApostila(true);
    } catch (e: unknown) {
      setUploadStatus("erro");
      setUploadMsg(e instanceof Error ? e.message : "Erro desconhecido");
    }
  }

  // Agrupar por semana
  const semanas = [...new Set(aulas.map((a) => a.semana))].sort((a, b) => a - b);
  const aulasPorSemana = (sem: number) => aulas.filter((a) => a.semana === sem);
  const revisadas = aulas.filter((a) => a.status === "concluida").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-[#F59E0B]" size={36} />
      </div>
    );
  }

  if (!curso) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="mx-auto text-[#475569] mb-3" size={40} />
        <p className="text-[#94A3B8]">Curso não encontrado.</p>
      </div>
    );
  }

  const isGerando = curso.gerandoStatus === "gerando";
  const totalGeradas = curso.totalAulasGeradas ?? 0;

  return (
    <>
    {/* ── Modal Limite Plano Grátis ─────────────────────────────────────── */}
    {modalLimite && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-[#0F1C3F] border border-[#1E3A8A] rounded-2xl max-w-md w-full p-8 shadow-2xl text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/30 mx-auto mb-5">
            <Lock size={28} className="text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Limite do plano grátis</h2>
          <p className="text-[#94A3B8] text-sm mb-1">
            Você atingiu o limite de <span className="text-white font-semibold">10 aulas geradas</span> no plano gratuito.
          </p>
          <p className="text-[#94A3B8] text-sm mb-6">
            Faça upgrade para continuar gerando aulas ilimitadas com IA.
          </p>
          <div className="bg-[#1E3A8A]/30 border border-[#1E3A8A] rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-3">Plano Premium inclui:</p>
            {["Aulas ilimitadas com IA", "Revisões espaçadas ilimitadas", "Questões estilo Cesgranrio", "Suporte prioritário"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-[#CBD5E1]">
                <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <button
            onClick={() => { setModalLimite(false); window.location.href = "/planos"; }}
            className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors mb-3"
          >
            <Zap size={16} /> Ver planos
          </button>
          <button
            onClick={() => setModalLimite(false)}
            className="w-full text-sm text-[#64748B] hover:text-white transition-colors py-2"
          >
            Fechar
          </button>
        </div>
      </div>
    )}
    <div className="flex flex-col h-[calc(100vh-64px)] -m-8">
      {/* ── Banner de progresso (aparece enquanto gera) ──────────────────── */}
      {isGerando && (
        <div className="bg-[#1E3A8A]/80 border-b border-blue-700 px-6 py-3 flex items-center gap-3 shrink-0">
          <Loader2 size={16} className="animate-spin text-[#F59E0B] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium">
              Gerando aulas com IA...{" "}
              {totalGeradas > 0 && (
                <span className="text-[#F59E0B]">{totalGeradas} aulas prontas</span>
              )}
            </p>
            <p className="text-xs text-blue-300">As aulas aparecem no menu conforme são geradas. Pode levar alguns minutos.</p>
          </div>
          {/* Mini progress bar */}
          {aulas.length > 0 && (
            <div className="w-32 shrink-0">
              <div className="h-1.5 bg-blue-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F59E0B] rounded-full transition-all duration-700"
                  style={{ width: `${Math.min((totalGeradas / Math.max(totalGeradas, aulas.length)) * 100, 95)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {curso.gerandoStatus === "erro" && (
        <div className="bg-red-950/60 border-b border-red-800 px-6 py-3 flex items-center gap-3 shrink-0">
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            Erro ao gerar aulas: {curso.gerandoErro ?? "Erro desconhecido"}
          </p>
        </div>
      )}

      <div className="flex flex-1 gap-0 overflow-hidden">
      {/* ── Sidebar de aulas ─────────────────────────────────────────────── */}
      <aside className={`${sidebarAberta ? "w-80" : "w-12"} bg-[#1E293B] border-r border-slate-700 flex flex-col overflow-hidden shrink-0 transition-all duration-300`}>

        {/* Botão toggle — sempre visível */}
        <div className={`flex ${sidebarAberta ? "justify-end px-3 pt-3" : "justify-center pt-3"} shrink-0`}>
          <button
            onClick={() => setSidebarAberta(!sidebarAberta)}
            title={sidebarAberta ? "Recolher menu" : "Expandir menu"}
            className="p-1.5 rounded-md text-[#475569] hover:text-[#F59E0B] hover:bg-[#334155] transition-colors"
          >
            {sidebarAberta ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Conteúdo da sidebar — oculto quando recolhida */}
        {sidebarAberta ? (
          <>
            {/* Header do curso */}
            <div className="px-5 pb-4 pt-2 border-b border-slate-700">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={16} className="text-[#F59E0B]" />
                <span className="text-xs text-[#94A3B8] font-medium uppercase tracking-wide">Curso</span>
              </div>
              <h2 className="font-bold text-white text-sm leading-snug">{curso.titulo}</h2>
              <p className="text-xs text-[#475569] mt-1">{curso.cargo}</p>

              {/* Progresso */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
                  <span>{revisadas}/{aulas.length} concluídas</span>
                  <span>{aulas.length > 0 ? Math.round((revisadas / aulas.length) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${aulas.length > 0 ? (revisadas / aulas.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Abas */}
              <div className="flex gap-1 mt-4">
                <button
                  onClick={() => setAbaAtiva("aulas")}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    abaAtiva === "aulas"
                      ? "bg-[#1E40AF] text-white"
                      : "text-[#94A3B8] hover:bg-[#334155]"
                  }`}
                >
                  Aulas
                </button>
                <button
                  onClick={() => setAbaAtiva("apostilas")}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    abaAtiva === "apostilas"
                      ? "bg-[#1E40AF] text-white"
                      : "text-[#94A3B8] hover:bg-[#334155]"
                  }`}
                >
                  <FolderOpen size={11} />
                  Apostilas
                  {temApostila && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </button>
              </div>
            </div>

            {/* Aba Apostilas */}
            {abaAtiva === "apostilas" ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Indicador de apostila atual */}
                {temApostila && (
                  <div className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-800 rounded-lg px-3 py-2">
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                    <p className="text-xs text-emerald-300">Apostila carregada — IA usará nas aulas.</p>
                  </div>
                )}

                {/* Drop zone */}
                <div
                  className="border-2 border-dashed border-slate-600 rounded-xl p-5 text-center cursor-pointer hover:border-[#1E40AF] transition-colors"
                  onClick={() => uploadRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); addUploadFiles(e.dataTransfer.files); }}
                >
                  <Upload size={22} className="mx-auto text-[#475569] mb-2" />
                  <p className="text-[#94A3B8] text-xs">Arraste PDFs ou clique</p>
                  <p className="text-[10px] text-[#475569] mt-1">A IA extrai o conteúdo e usa nas próximas aulas geradas</p>
                </div>
                <input ref={uploadRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => addUploadFiles(e.target.files)} />

                {/* Fila de arquivos */}
                {uploadFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[#0F172A] rounded-lg px-3 py-2">
                        <FileText size={12} className="text-[#F59E0B] shrink-0" />
                        <span className="text-xs text-[#CBD5E1] flex-1 truncate">{f.name}</span>
                        <span className="text-[10px] text-[#475569]">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                        <button onClick={() => setUploadFiles(prev => prev.filter((_, idx) => idx !== i))}>
                          <X size={12} className="text-[#475569] hover:text-red-400" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={enviarApostilas}
                      disabled={uploadStatus === "enviando"}
                      className="w-full py-2 bg-[#1E40AF] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      {uploadStatus === "enviando"
                        ? <><Loader2 size={12} className="animate-spin" /> Enviando...</>
                        : <><Upload size={12} /> Enviar {uploadFiles.length} arquivo(s)</>}
                    </button>
                  </div>
                )}

                {/* Feedback */}
                {uploadMsg && (
                  <p className={`text-xs rounded-lg px-3 py-2 ${
                    uploadStatus === "ok"
                      ? "bg-emerald-900/30 border border-emerald-800 text-emerald-300"
                      : "bg-red-950/30 border border-red-800 text-red-300"
                  }`}>
                    {uploadMsg}
                  </p>
                )}

                <p className="text-[10px] text-[#334155] text-center pt-2">
                  Após o upload, regere as aulas para usar o novo conteúdo.
                </p>
              </div>
            ) : (

            /* Lista de aulas por semana */
            <div className="flex-1 overflow-y-auto py-2">
              {aulas.length === 0 ? (
                <div className="text-center py-10 px-4">
                  {isGerando ? (
                    <>
                      <Loader2 size={24} className="mx-auto text-[#F59E0B] animate-spin mb-2" />
                      <p className="text-sm text-[#94A3B8]">Gerando primeira aula...</p>
                    </>
                  ) : (
                    <p className="text-sm text-[#475569]">Nenhuma aula gerada ainda.</p>
                  )}
                </div>
              ) : (
                semanas.map((sem) => {
                  const aulasSemanais = aulasPorSemana(sem);
                  const revisadasSemana = aulasSemanais.filter((a) => a.status === "concluida").length;
                  const aberta = semanaAberta === sem;

                  return (
                    <div key={sem}>
                      <button
                        onClick={() => setSemanaAberta(aberta ? null : sem)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#334155] transition-colors text-left"
                      >
                        <div>
                          <span className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wide">
                            Semana {sem}
                          </span>
                          <span className="text-xs text-[#475569] ml-2">
                            {revisadasSemana}/{aulasSemanais.length}
                          </span>
                        </div>
                        {aberta ? (
                          <ChevronUp size={14} className="text-[#475569]" />
                        ) : (
                          <ChevronDown size={14} className="text-[#475569]" />
                        )}
                      </button>

                      {aberta && (
                        <div>
                          {aulasSemanais.map((aula) => {
                            const isAtiva = aulaAtiva?.id === aula.id;
                            const isConcluida = aula.status === "concluida";
                            const isPendente = aula.status === "pendente";

                            return (
                              <button
                                key={aula.id}
                                onClick={() => abrirAula(aula)}
                                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-l-2 ${
                                  isAtiva
                                    ? "bg-[#1E3A8A]/40 border-[#F59E0B]"
                                    : "border-transparent hover:bg-[#334155]/50"
                                }`}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {isConcluida ? (
                                    <CheckCircle2 size={14} className="text-emerald-400" />
                                  ) : isPendente ? (
                                    <Sparkles size={14} className="text-violet-400" />
                                  ) : (
                                    <Clock size={14} className="text-[#475569]" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-xs leading-snug ${isAtiva ? "text-white font-medium" : isConcluida ? "text-[#94A3B8]" : "text-[#CBD5E1]"}`}>
                                    {aula.assunto}
                                  </p>
                                  {aula.diaSemana && (
                                    <p className={`text-[10px] mt-0.5 ${isPendente ? "text-violet-500" : "text-[#475569]"}`}>
                                      {aula.diaSemana}{isPendente ? " · gerar ao abrir" : ""}
                                    </p>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            )}
          </>
        ) : (
          /* Sidebar recolhida: ícones verticais das aulas ativas */
          <div className="flex-1 overflow-y-auto flex flex-col items-center py-2 gap-1">
            {aulas.map((aula) => {
              const isAtiva = aulaAtiva?.id === aula.id;
              const isConcluida = aula.status === "concluida";
              const isPendente = aula.status === "pendente";
              return (
                <button
                  key={aula.id}
                  onClick={() => { setSidebarAberta(true); abrirAula(aula); }}
                  title={aula.assunto}
                  className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                    isAtiva ? "bg-[#1E3A8A]/60 text-[#F59E0B]" : "text-[#475569] hover:bg-[#334155] hover:text-[#94A3B8]"
                  }`}
                >
                  {isConcluida ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  ) : isPendente ? (
                    <Sparkles size={13} className="text-violet-400" />
                  ) : (
                    <Clock size={13} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* ── Conteúdo da aula ──────────────────────────────────────────────── */}
      <div ref={contentRef} className="flex-1 overflow-y-auto bg-[#0F172A]">
        {loadingAula ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="animate-spin text-[#F59E0B] mx-auto mb-3" size={36} />
              {gerando ? (
                <>
                  <p className="text-[#94A3B8] text-sm font-medium">Gerando aula com IA...</p>
                  <p className="text-[#475569] text-xs mt-1">Pode levar alguns segundos</p>
                </>
              ) : (
                <p className="text-[#94A3B8] text-sm">Carregando aula...</p>
              )}
            </div>
          </div>
        ) : !aulaAtiva ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm px-6">
              <BookMarked size={56} className="mx-auto text-[#1E3A8A] mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Selecione uma aula</h3>
              <p className="text-[#94A3B8] text-sm">
                Escolha uma aula no menu lateral para ver o conteúdo completo gerado pela IA.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Header da aula */}
            <div className="mb-8 pb-6 border-b border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {aulaAtiva.disciplina && (
                    <p className="text-xs text-[#F59E0B] font-medium uppercase tracking-wide mb-2">
                      {aulaAtiva.disciplina}
                    </p>
                  )}
                  <h1 className="text-2xl font-bold text-white">{aulaAtiva.assunto}</h1>
                  <div className="flex items-center gap-3 mt-3">
                    {aulaAtiva.semana > 0 && (
                      <span className="text-xs text-[#94A3B8]">
                        Semana {aulaAtiva.semana} · {aulaAtiva.diaSemana ?? "—"}
                      </span>
                    )}
                    {aulaAtiva.prioridade && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORIDADE_COLOR[aulaAtiva.prioridade] ?? ""}`}>
                        {aulaAtiva.prioridade}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botões ação */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Modo Foco */}
                  <button
                    onClick={() => setModoFoco(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#1E293B] text-[#94A3B8] border border-slate-600 hover:border-violet-500 hover:text-violet-400 transition-colors"
                    title="Modo Foco — tela cheia sem distrações"
                  >
                    <Maximize2 size={15} />
                    Foco
                  </button>
                  {/* YouTube */}
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(aulaAtiva.assunto + " concurso Banco do Brasil")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#1E293B] text-[#94A3B8] border border-slate-600 hover:border-red-500 hover:text-red-400 transition-colors"
                    title="Buscar aula no YouTube"
                  >
                    <Youtube size={15} />
                    YouTube
                  </a>
                  {/* Pomodoro */}
                  <button
                    onClick={() => iniciarParaAula(aulaAtiva.assunto)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#1E293B] text-[#94A3B8] border border-slate-600 hover:border-blue-500 hover:text-blue-400 transition-colors"
                    title="Iniciar Pomodoro para esta aula"
                  >
                    <Timer size={15} />
                    Pomodoro
                  </button>
                  {/* Marcar concluída */}
                  <button
                    onClick={() => toggleStatus(aulaAtiva.id, aulaAtiva.status)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      aulaAtiva.status === "concluida"
                        ? "bg-emerald-900/50 text-emerald-400 border border-emerald-700"
                        : "bg-[#1E293B] text-[#94A3B8] border border-slate-600 hover:border-emerald-600 hover:text-emerald-400"
                    }`}
                  >
                    <CheckCircle2 size={15} />
                    {aulaAtiva.status === "concluida" ? "Concluída ✓" : "Marcar concluída"}
                  </button>
                </div>
              </div>
            </div>

            {/* Conteúdo markdown */}
            <div className="aula-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-white mt-8 mb-4 pb-3 border-b border-slate-700 first:mt-0">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-bold text-[#F59E0B] mt-8 mb-3 flex items-center gap-2">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold text-[#93C5FD] mt-5 mb-2">
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="text-sm font-semibold text-[#CBD5E1] uppercase tracking-wide mt-4 mb-2">
                      {children}
                    </h4>
                  ),
                  p: ({ children }) => (
                    <p className="text-[#CBD5E1] leading-7 mb-4 text-[15px]">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-4 space-y-1.5 pl-2">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-4 space-y-1.5 pl-2 list-decimal list-inside">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-[#CBD5E1] text-[15px] leading-relaxed flex gap-2 items-start">
                      <span className="text-[#F59E0B] mt-1.5 shrink-0">▸</span>
                      <span>{children}</span>
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-white font-semibold">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="text-[#94A3B8] italic">{children}</em>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-[#F59E0B] bg-[#1E293B] rounded-r-lg px-4 py-3 my-4 text-[#94A3B8] italic text-sm">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.includes("language-");
                    if (isBlock) {
                      return (
                        <code className="block bg-[#0F172A] border border-slate-700 rounded-lg p-4 text-[#86EFAC] text-sm font-mono whitespace-pre-wrap leading-relaxed my-4">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className="bg-[#1E293B] text-[#F59E0B] px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-700">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="bg-[#0F172A] border border-slate-700 rounded-lg p-4 overflow-x-auto my-4 text-sm font-mono">
                      {children}
                    </pre>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4 rounded-lg border border-slate-700">
                      <table className="w-full text-sm">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-[#1E293B]">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="text-[#F59E0B] font-semibold px-4 py-2.5 text-left border-b border-slate-700">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="text-[#CBD5E1] px-4 py-2.5 border-b border-slate-800">
                      {children}
                    </td>
                  ),
                  hr: () => (
                    <hr className="border-slate-700 my-6" />
                  ),
                  a: ({ children, href }) => (
                    <a href={href} className="text-[#60A5FA] hover:underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  details: ({ children, ...props }) => (
                    <details className="bg-[#1E293B] border border-slate-700 rounded-lg p-4 my-3 cursor-pointer" {...props}>
                      {children}
                    </details>
                  ),
                  summary: ({ children, ...props }) => (
                    <summary className="text-[#F59E0B] font-medium text-sm select-none" {...props}>
                      {children}
                    </summary>
                  ),
                }}
              >
                {aulaAtiva.conteudoMd}
              </ReactMarkdown>
            </div>

            {/* Botão Praticar Questões */}
            <div className="mt-10 p-6 rounded-2xl border border-dashed border-slate-700 bg-[#1E293B]/50 flex items-center justify-between gap-4">
              <div>
                <p className="text-white font-semibold text-sm">Hora de praticar!</p>
                <p className="text-slate-400 text-xs mt-0.5">10 questões de múltipla escolha geradas pela IA com base nesta aula.</p>
              </div>
              <button
                onClick={() => setQuizAberto(true)}
                className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F59E0B] text-[#0F172A] font-semibold text-sm hover:bg-yellow-400 transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                🎯 Fazer questões
              </button>
            </div>

            {/* Navegação entre aulas */}
            <div className="mt-12 pt-6 border-t border-slate-800 flex items-center justify-between">
              {(() => {
                const idx = aulas.findIndex((a) => a.id === aulaAtiva.id);
                const prev = idx > 0 ? aulas[idx - 1] : null;
                const next = idx < aulas.length - 1 ? aulas[idx + 1] : null;
                return (
                  <>
                    <div>
                      {prev && (
                        <button
                          onClick={() => abrirAula(prev)}
                          className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-white transition-colors"
                        >
                          ← {prev.assunto}
                        </button>
                      )}
                    </div>
                    <div>
                      {next && (
                        <button
                          onClick={() => abrirAula(next)}
                          className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-white transition-colors"
                        >
                          {next.assunto} →
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>

    {/* Modo Foco — overlay fullscreen */}
    {modoFoco && aulaAtiva && (
      <div className="fixed inset-0 z-50 bg-[#0F172A] overflow-y-auto">
        {/* Barra topo minimalista */}
        <div className="sticky top-0 z-10 bg-[#0F172A]/95 backdrop-blur border-b border-slate-800 px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-violet-400 font-medium uppercase tracking-widest">Modo Foco</span>
            <span className="text-[#475569] text-xs">·</span>
            <span className="text-sm text-[#94A3B8] truncate max-w-lg">{aulaAtiva.assunto}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                toggleStatus(aulaAtiva.id, aulaAtiva.status);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                aulaAtiva.status === "concluida"
                  ? "bg-emerald-900/50 text-emerald-400 border border-emerald-700"
                  : "text-[#94A3B8] border border-slate-700 hover:border-emerald-600 hover:text-emerald-400"
              }`}
            >
              <CheckCircle2 size={13} />
              {aulaAtiva.status === "concluida" ? "Concluída ✓" : "Concluir"}
            </button>
            <button
              onClick={() => setModoFoco(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#94A3B8] border border-slate-700 hover:border-violet-500 hover:text-violet-400 transition-colors"
              title="Sair do Modo Foco"
            >
              <Minimize2 size={13} />
              Sair
            </button>
          </div>
        </div>

        {/* Conteúdo centralizado */}
        <div className="max-w-2xl mx-auto px-8 py-12">
          <h1 className="text-2xl font-bold text-white mb-10">{aulaAtiva.assunto}</h1>
          <div className="aula-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold text-white mt-8 mb-4 pb-3 border-b border-slate-700 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold text-[#F59E0B] mt-8 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold text-[#93C5FD] mt-5 mb-2">{children}</h3>,
                h4: ({ children }) => <h4 className="text-sm font-semibold text-[#CBD5E1] uppercase tracking-wide mt-4 mb-2">{children}</h4>,
                p: ({ children }) => <p className="text-[#CBD5E1] leading-8 mb-5 text-[16px]">{children}</p>,
                ul: ({ children }) => <ul className="mb-4 space-y-2 pl-2">{children}</ul>,
                ol: ({ children }) => <ol className="mb-4 space-y-2 pl-2 list-decimal list-inside">{children}</ol>,
                li: ({ children }) => (
                  <li className="text-[#CBD5E1] text-[16px] leading-relaxed flex gap-2 items-start">
                    <span className="text-[#F59E0B] mt-1.5 shrink-0">▸</span>
                    <span>{children}</span>
                  </li>
                ),
                strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                em: ({ children }) => <em className="text-[#94A3B8] italic">{children}</em>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-[#F59E0B] bg-[#1E293B] rounded-r-lg px-4 py-3 my-4 text-[#94A3B8] italic text-sm">{children}</blockquote>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock) return <code className="block bg-[#0F172A] border border-slate-700 rounded-lg p-4 text-[#86EFAC] text-sm font-mono whitespace-pre-wrap leading-relaxed my-4">{children}</code>;
                  return <code className="bg-[#1E293B] text-[#F59E0B] px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-700">{children}</code>;
                },
                pre: ({ children }) => <pre className="bg-[#0F172A] border border-slate-700 rounded-lg p-4 overflow-x-auto my-4 text-sm font-mono">{children}</pre>,
                table: ({ children }) => <div className="overflow-x-auto my-4 rounded-lg border border-slate-700"><table className="w-full text-sm">{children}</table></div>,
                thead: ({ children }) => <thead className="bg-[#1E293B]">{children}</thead>,
                th: ({ children }) => <th className="text-[#F59E0B] font-semibold px-4 py-2.5 text-left border-b border-slate-700">{children}</th>,
                td: ({ children }) => <td className="text-[#CBD5E1] px-4 py-2.5 border-b border-slate-800">{children}</td>,
                hr: () => <hr className="border-slate-700 my-6" />,
                a: ({ children, href }) => <a href={href} className="text-[#60A5FA] hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                details: ({ children, ...props }) => <details className="bg-[#1E293B] border border-slate-700 rounded-lg p-4 my-3 cursor-pointer" {...props}>{children}</details>,
                summary: ({ children, ...props }) => <summary className="text-[#F59E0B] font-medium text-sm select-none" {...props}>{children}</summary>,
              }}
            >
              {aulaAtiva.conteudoMd}
            </ReactMarkdown>
          </div>

          {/* Navegação no modo foco */}
          <div className="mt-12 pt-6 border-t border-slate-800 flex items-center justify-between">
            {(() => {
              const idx = aulas.findIndex((a) => a.id === aulaAtiva.id);
              const prev = idx > 0 ? aulas[idx - 1] : null;
              const next = idx < aulas.length - 1 ? aulas[idx + 1] : null;
              return (
                <>
                  <div>
                    {prev && (
                      <button onClick={() => abrirAula(prev)} className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-white transition-colors">
                        ← {prev.assunto}
                      </button>
                    )}
                  </div>
                  <div>
                    {next && (
                      <button onClick={() => abrirAula(next)} className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-white transition-colors">
                        {next.assunto} →
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    )}

    {/* Modal Quiz */}
    {quizAberto && aulaAtiva && (
      <QuizAula
        aulaId={aulaAtiva.id}
        cursoId={parseInt(cursoId!)}
        assunto={aulaAtiva.assunto}
        onFechar={() => setQuizAberto(false)}
      />
    )}
    </>
  );
}
