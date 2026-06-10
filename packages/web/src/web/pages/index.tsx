import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Upload, FileText, X, Loader2, AlertCircle, ChevronRight, Calendar, SlidersHorizontal, Clock, Zap, BookOpen, Flame } from "lucide-react";
import { apiFetch } from "../lib/api";

export default function NovaAnalise() {
  const [, setLocation] = useLocation();
  const [titulo, setTitulo] = useState("Banco do Brasil - Agente Comercial");
  const [cargo, setCargo] = useState("Agente Comercial");
  const [banca, setBanca] = useState("CESGRANRIO");
  const [modoTempo, setModoTempo] = useState<"datas" | "manual">("manual");
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataProva, setDataProva] = useState("");
  const [diasEstudo, setDiasEstudo] = useState(60);
  const [horasDia, setHorasDia] = useState(3);
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  const toggleDiaSemana = (d: number) => {
    setDiasSemana(prev =>
      prev.includes(d) ? (prev.length > 1 ? prev.filter(x => x !== d) : prev) : [...prev, d].sort()
    );
  };

  const diasCalculados = useMemo(() => {
    if (modoTempo !== "datas" || !dataInicio || !dataProva || diasSemana.length === 0) return diasEstudo;
    let count = 0;
    const cur = new Date(dataInicio + "T00:00:00");
    const fim = new Date(dataProva + "T00:00:00");
    while (cur < fim) {
      if (diasSemana.includes(cur.getDay())) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count > 0 ? count : diasEstudo;
  }, [modoTempo, dataInicio, dataProva, diasEstudo, diasSemana]);

  const diasManualEfetivos = useMemo(() => {
    if (modoTempo !== "manual" || diasSemana.length === 0) return diasEstudo;
    const semanas = Math.ceil(diasEstudo / 7);
    return semanas * diasSemana.length;
  }, [modoTempo, diasEstudo, diasSemana]);

  const diasFinal = modoTempo === "datas" ? diasCalculados : diasManualEfetivos;
  const horasTotais = diasFinal * horasDia;
  const horasSemanais = diasSemana.length * horasDia;
  const sessoesPomodoro = Math.round(horasTotais * 60 / 25);

  // Alerta de prazo
  const alertaPrazo = useMemo(() => {
    if (modoTempo !== "datas" || !dataProva) return null;
    const diasCorridos = Math.floor((new Date(dataProva).getTime() - new Date().getTime()) / 86400000);
    if (diasCorridos < 15) return { tipo: "vermelho", msg: "Muito pouco tempo — o plano será extremamente intenso." };
    if (diasCorridos < 30) return { tipo: "amarelo", msg: "Prazo curto — prepare-se para um ritmo intenso." };
    if (diasCorridos > 365) return { tipo: "azul", msg: "Bastante tempo disponível — revise o ritmo periodicamente." };
    return null;
  }, [modoTempo, dataProva]);

  const [edital, setEdital] = useState<File | null>(null);
  const [provas, setProvas] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const editalRef = useRef<HTMLInputElement>(null);
  const provasRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !cargo) { setErro("Preencha o título e o cargo."); return; }
    if (!edital && provas.length === 0) { setErro("Envie pelo menos o edital ou uma prova anterior."); return; }
    setLoading(true); setErro("");
    const formData = new FormData();
    formData.append("titulo", titulo);
    formData.append("cargo", cargo);
    formData.append("banca", banca);
    formData.append("diasEstudo", String(diasFinal));
    formData.append("horasDia", String(horasDia));
    if (edital) formData.append("edital", edital);
    provas.forEach((p) => formData.append("provas", p));
    try {
      const res = await apiFetch("/api/analises/processar", {
        method: "POST",
        body: formData,

      });
      let data: any = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data.error || `Erro ${res.status} ao processar`);
      setLocation(`/analise/${data.analiseId}`);
    } catch (err: any) {
      setErro(err.message || "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#F8FAFC]">Nova Análise Pareto</h1>
        <p className="text-[#94A3B8] mt-1">
          Envie o edital e provas anteriores para identificar os 20% de conteúdo que caem em 80% da prova.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações */}
        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-[#F8FAFC] text-sm uppercase tracking-wide text-[#94A3B8]">
            Informações do Concurso
          </h2>
          <div>
            <label className="text-sm text-[#94A3B8] mb-1 block">Título da Análise</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Banco do Brasil 2025 - Agente Comercial"
              className="w-full bg-[#0F172A] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-[#F8FAFC] placeholder-slate-500 focus:outline-none focus:border-[#1E40AF]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[#94A3B8] mb-1 block">Cargo</label>
              <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)}
                placeholder="Ex: Agente Comercial"
                className="w-full bg-[#0F172A] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-[#F8FAFC] placeholder-slate-500 focus:outline-none focus:border-[#1E40AF]" />
            </div>
            <div>
              <label className="text-sm text-[#94A3B8] mb-1 block">Banca</label>
              <input type="text" value={banca} onChange={(e) => setBanca(e.target.value)}
                placeholder="Ex: CESGRANRIO, FGV..."
                className="w-full bg-[#0F172A] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-[#F8FAFC] placeholder-slate-500 focus:outline-none focus:border-[#1E40AF]" />
            </div>
          </div>

          {/* ── Plano de Estudos ── */}
          <div className="space-y-4 pt-1">
            <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide">Plano de Estudos</h3>

            {/* Toggle modo */}
            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button type="button" onClick={() => setModoTempo("datas")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-all ${modoTempo === "datas" ? "bg-[#1E40AF] text-white" : "bg-[#0F172A] text-slate-400 hover:text-slate-200"}`}>
                <Calendar size={13} /> Tenho uma data de prova
              </button>
              <button type="button" onClick={() => setModoTempo("manual")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-all ${modoTempo === "manual" ? "bg-[#1E40AF] text-white" : "bg-[#0F172A] text-slate-400 hover:text-slate-200"}`}>
                <SlidersHorizontal size={13} /> Definir manualmente
              </button>
            </div>

            {/* Campos por modo */}
            {modoTempo === "datas" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#94A3B8] mb-1 block">Início dos estudos</label>
                  <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-[#F8FAFC] focus:outline-none focus:border-[#1E40AF] [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-sm text-[#94A3B8] mb-1 block">Data prevista da prova</label>
                  <input type="date" value={dataProva} onChange={(e) => setDataProva(e.target.value)} min={dataInicio}
                    className="w-full bg-[#0F172A] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-[#F8FAFC] focus:outline-none focus:border-[#1E40AF] [color-scheme:dark]" />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm text-[#94A3B8] mb-1 block">Dias para estudar</label>
                <input type="number" value={diasEstudo} onChange={(e) => setDiasEstudo(parseInt(e.target.value))} min={7} max={365}
                  className="w-full bg-[#0F172A] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-[#F8FAFC] focus:outline-none focus:border-[#1E40AF]" />
              </div>
            )}

            {/* Dias da semana */}
            <div>
              <label className="text-sm text-[#94A3B8] mb-2 block">Dias de estudo na semana</label>
              <div className="flex gap-1.5">
                {[{ d: 1, label: "Seg" }, { d: 2, label: "Ter" }, { d: 3, label: "Qua" }, { d: 4, label: "Qui" }, { d: 5, label: "Sex" }, { d: 6, label: "Sáb" }, { d: 0, label: "Dom" }].map(({ d, label }) => {
                  const ativo = diasSemana.includes(d);
                  return (
                    <button key={d} type="button" onClick={() => toggleDiaSemana(d)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${ativo
                        ? d === 0 || d === 6 ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-blue-600/20 border-blue-500/50 text-blue-400"
                        : "bg-[#0F172A] border-slate-700 text-slate-500 hover:text-slate-300"}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horas por dia — slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-[#94A3B8]">Horas por dia</label>
                <span className="text-sm font-bold text-white bg-[#1E40AF] px-2.5 py-0.5 rounded-full">{horasDia}h</span>
              </div>
              <input type="range" min={0.5} max={8} step={0.5} value={horasDia} onChange={(e) => setHorasDia(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-500 bg-[#334155]" />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-0.5">
                <span>0.5h</span><span>2h</span><span>4h</span><span>6h</span><span>8h</span>
              </div>
              {/* Atalhos de ritmo */}
              <div className="flex gap-2 mt-3">
                {[
                  { label: "Leve", horas: 1, icon: BookOpen, cor: "text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10" },
                  { label: "Moderado", horas: 2.5, icon: Clock, cor: "text-blue-400 border-blue-500/40 hover:bg-blue-500/10" },
                  { label: "Intensivo", horas: 4, icon: Zap, cor: "text-amber-400 border-amber-500/40 hover:bg-amber-500/10" },
                  { label: "Maratona", horas: 6, icon: Flame, cor: "text-red-400 border-red-500/40 hover:bg-red-500/10" },
                ].map(({ label, horas, icon: Icon, cor }) => (
                  <button key={label} type="button" onClick={() => setHorasDia(horas)}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all ${cor} ${horasDia === horas ? "ring-1 ring-white/20 bg-white/5" : "border-slate-700"}`}>
                    <Icon size={11} />
                    {label}
                    <span className="text-[9px] opacity-60">{horas}h/dia</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Alerta de prazo */}
            {alertaPrazo && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
                alertaPrazo.tipo === "vermelho" ? "bg-red-500/10 border-red-500/30 text-red-400"
                : alertaPrazo.tipo === "amarelo" ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-blue-500/10 border-blue-500/30 text-blue-400"
              }`}>
                <AlertCircle size={13} className="shrink-0" />
                {alertaPrazo.msg}
              </div>
            )}

            {/* Card resumo do plano */}
            {(diasFinal > 0 && horasDia > 0) && (
              <div className="bg-gradient-to-br from-[#0f2040] to-[#0d1a30] border border-blue-500/25 rounded-xl p-4">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3 font-semibold">Resumo do plano</p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Dias de estudo", valor: diasFinal, unidade: "dias" },
                    { label: "Por semana", valor: `${diasSemana.length}d · ${horasSemanais}h`, unidade: "" },
                    { label: "Horas totais", valor: horasTotais.toFixed(0), unidade: "h" },
                    { label: "Sessões Pomodoro", valor: sessoesPomodoro, unidade: "sessões" },
                  ].map(({ label, valor, unidade }) => (
                    <div key={label} className="text-center">
                      <p className="text-base font-bold text-blue-400 leading-none">{valor}<span className="text-[10px] text-slate-400 ml-0.5">{unidade}</span></p>
                      <p className="text-[10px] text-slate-500 mt-1 leading-tight">{label}</p>
                    </div>
                  ))}
                </div>
                {modoTempo === "datas" && dataProva && (
                  <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-700/50">
                    📅 Prova em <span className="text-white font-semibold">{new Date(dataProva + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upload Edital */}
        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-[#94A3B8]">Edital (PDF)</h2>
          <input
            ref={editalRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => setEdital(e.target.files?.[0] ?? null)}
          />
          {edital ? (
            <div className="flex items-center gap-3 bg-[#0F172A] border border-slate-600 rounded-lg px-4 py-3">
              <FileText size={18} className="text-[#1E40AF]" />
              <span className="text-sm text-[#F8FAFC] flex-1 truncate">{edital.name}</span>
              <button type="button" onClick={() => setEdital(null)}>
                <X size={16} className="text-[#94A3B8] hover:text-red-400" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => editalRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-600 rounded-lg py-8 flex flex-col items-center gap-2 text-[#94A3B8] hover:border-[#1E40AF] hover:text-[#F8FAFC] transition-all"
            >
              <Upload size={24} />
              <span className="text-sm">Clique para selecionar o edital</span>
            </button>
          )}
        </div>

        {/* Upload Provas */}
        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-[#94A3B8]">
            Provas Anteriores (PDF) — opcional mas recomendado
          </h2>
          <input
            ref={provasRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => setProvas(Array.from(e.target.files ?? []))}
          />
          {provas.length > 0 ? (
            <div className="space-y-2">
              {provas.map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-[#0F172A] border border-slate-600 rounded-lg px-4 py-3">
                  <FileText size={18} className="text-[#F59E0B]" />
                  <span className="text-sm text-[#F8FAFC] flex-1 truncate">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => setProvas(provas.filter((_, j) => j !== i))}
                  >
                    <X size={16} className="text-[#94A3B8] hover:text-red-400" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => provasRef.current?.click()}
                className="text-sm text-[#94A3B8] hover:text-[#F8FAFC] flex items-center gap-1 mt-1"
              >
                + Adicionar mais provas
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => provasRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-600 rounded-lg py-8 flex flex-col items-center gap-2 text-[#94A3B8] hover:border-[#F59E0B] hover:text-[#F8FAFC] transition-all"
            >
              <Upload size={24} />
              <span className="text-sm">Clique para selecionar as provas anteriores</span>
              <span className="text-xs text-slate-600">Pode selecionar múltiplos arquivos</span>
            </button>
          )}
        </div>

        {erro && (
          <div className="flex items-center gap-2 bg-red-950 border border-red-700 rounded-lg px-4 py-3 text-red-400 text-sm">
            <AlertCircle size={16} />
            {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1E40AF] hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Analisando com IA... (pode levar ~1 min)
            </>
          ) : (
            <>
              Analisar e Gerar Plano
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
