import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
import { apiFetch } from "../lib/api";
  BarChart3,
  Calendar,
  ChevronLeft,
  TrendingUp,
  Clock,
  Target,
  AlertTriangle,
  Download,
  Loader2,
} from "lucide-react";

type Assunto = {
  id: number;
  nome: string;
  disciplina: string;
  totalQuestoes: number;
  percentual: number;
  percentualAcumulado: number;
  prioridade: string;
  pesoEdital: number;
};

type Plano = {
  diasEstudo: number;
  horasDia: number;
  planoJson: string;
};

type AnaliseData = {
  analise: { id: number; titulo: string; cargo: string; banca: string | null; createdAt: number };
  assuntos: Assunto[];
  plano: Plano | null;
};

const prioridadeConfig = {
  alta: { label: "Alta", bg: "bg-red-950", text: "text-red-400", border: "border-red-800", bar: "#EF4444" },
  media: { label: "Média", bg: "bg-amber-950", text: "text-amber-400", border: "border-amber-800", bar: "#F59E0B" },
  baixa: { label: "Baixa", bg: "bg-slate-800", text: "text-slate-400", border: "border-slate-700", bar: "#475569" },
};

async function exportarPDF(titulo: string, assuntos: Assunto[], planoData: any) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 14;
  const contentW = W - margin * 2;
  let y = 0;

  const corPrimaria: [number, number, number] = [30, 64, 175];
  const corAmbar: [number, number, number] = [245, 158, 11];
  const corTexto: [number, number, number] = [15, 23, 42];
  const corCinza: [number, number, number] = [100, 116, 139];
  const corBg: [number, number, number] = [248, 250, 252];
  const corAlta: [number, number, number] = [239, 68, 68];
  const corMedia: [number, number, number] = [245, 158, 11];
  const corBaixa: [number, number, number] = [71, 85, 105];

  // ── Página 1: Capa ──────────────────────────────────────────────
  doc.setFillColor(...corPrimaria);
  doc.rect(0, 0, W, 60, "F");

  doc.setFillColor(...corAmbar);
  doc.rect(0, 58, W, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Análise Pareto", margin, 22);

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  const linhasTitulo = doc.splitTextToSize(titulo, contentW);
  doc.text(linhasTitulo, margin, 33);

  doc.setFontSize(9);
  doc.setTextColor(180, 200, 240);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, margin, 52);

  y = 75;

  // ── Resumo stats ─────────────────────────────────────────────────
  const totalQuestoes = assuntos.reduce((s, a) => s + a.totalQuestoes, 0);
  const assuntosAlta = assuntos.filter((a) => a.prioridade === "alta");
  const stats = [
    { label: "Assuntos mapeados", valor: String(assuntos.length) },
    { label: "Questões analisadas", valor: totalQuestoes > 0 ? String(totalQuestoes) : "—" },
    { label: "Alta prioridade", valor: `${assuntosAlta.length} assuntos` },
  ];
  const boxW = contentW / 3 - 2;
  stats.forEach((s, i) => {
    const x = margin + i * (boxW + 3);
    doc.setFillColor(...corBg);
    doc.roundedRect(x, y, boxW, 18, 2, 2, "F");
    doc.setTextColor(...corCinza);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(s.label, x + 3, y + 6);
    doc.setTextColor(...corTexto);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(s.valor, x + 3, y + 14);
  });

  y += 26;

  // ── Seção: Ranking Pareto ────────────────────────────────────────
  doc.setFillColor(...corAmbar);
  doc.rect(margin, y, 3, 7, "F");
  doc.setTextColor(...corTexto);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Ranking Pareto — Prioridade de Estudos", margin + 6, y + 5.5);
  y += 12;

  // Banner explicativo
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
  doc.setTextColor(146, 64, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Os ${assuntosAlta.length} assuntos de ALTA prioridade representam ~80% das questões. Foque neles primeiro.`,
    margin + 3,
    y + 6.5
  );
  y += 14;

  // Cabeçalho tabela
  doc.setFillColor(...corPrimaria);
  doc.rect(margin, y, contentW, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("#", margin + 2, y + 5);
  doc.text("Assunto", margin + 8, y + 5);
  doc.text("Disciplina", margin + 95, y + 5);
  doc.text("%", margin + 140, y + 5);
  doc.text("Acum.", margin + 152, y + 5);
  doc.text("Prioridade", margin + 168, y + 5);
  y += 7;

  assuntos.forEach((a, i) => {
    if (y > 270) {
      doc.addPage();
      y = 14;
    }

    const rowH = 8;
    const cor: [number, number, number] = i % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
    doc.setFillColor(...cor);
    doc.rect(margin, y, contentW, rowH, "F");

    // Barra lateral colorida por prioridade
    const barCor: [number, number, number] =
      a.prioridade === "alta" ? corAlta : a.prioridade === "media" ? corMedia : corBaixa;
    doc.setFillColor(...barCor);
    doc.rect(margin, y, 2, rowH, "F");

    doc.setTextColor(...corTexto);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(String(i + 1), margin + 3, y + 5.5);
    const nomeLinhas = doc.splitTextToSize(a.nome, 80);
    doc.text(nomeLinhas[0], margin + 9, y + 5.5);
    const discLinhas = doc.splitTextToSize(a.disciplina, 40);
    doc.text(discLinhas[0], margin + 96, y + 5.5);
    doc.text(`${a.percentual}%`, margin + 141, y + 5.5);
    doc.text(`${a.percentualAcumulado}%`, margin + 153, y + 5.5);

    // Badge prioridade
    const badgeCor: [number, number, number] =
      a.prioridade === "alta" ? [254, 226, 226] : a.prioridade === "media" ? [254, 243, 199] : [241, 245, 249];
    const badgeTexCor: [number, number, number] =
      a.prioridade === "alta" ? [185, 28, 28] : a.prioridade === "media" ? [146, 64, 14] : [71, 85, 105];
    const label =
      prioridadeConfig[a.prioridade as keyof typeof prioridadeConfig]?.label ?? a.prioridade;
    doc.setFillColor(...badgeCor);
    doc.roundedRect(margin + 168, y + 1.5, 22, 5, 1, 1, "F");
    doc.setTextColor(...badgeTexCor);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin + 179, y + 5.3, { align: "center" });

    y += rowH;
  });

  // ── Página do Plano de Estudos ────────────────────────────────────
  if (planoData && !planoData.erro && planoData.semanas) {
    doc.addPage();
    y = 14;

    // Header plano
    doc.setFillColor(...corPrimaria);
    doc.rect(0, 0, W, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Plano de Estudos", margin, 12);
    y = 26;

    // Resumo do plano
    if (planoData.resumo) {
      doc.setFillColor(...corBg);
      doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
      doc.setTextColor(...corCinza);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("Total de horas", margin + 4, y + 5.5);
      doc.text("Meta de acerto", margin + 60, y + 5.5);
      doc.setTextColor(...corTexto);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${planoData.resumo.totalHoras}h`, margin + 4, y + 12);
      doc.setTextColor(16, 185, 129);
      doc.text(`${planoData.resumo.metaAcerto}`, margin + 60, y + 12);
      y += 20;
    }

    // Semanas
    for (const semana of planoData.semanas) {
      if (y > 260) { doc.addPage(); y = 14; }

      // Header semana
      doc.setFillColor(219, 234, 254);
      doc.roundedRect(margin, y, contentW, 9, 2, 2, "F");
      doc.setTextColor(...corPrimaria);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text(`Semana ${semana.semana}`, margin + 3, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...corCinza);
      const focoLinhas = doc.splitTextToSize(semana.foco ?? "", 120);
      doc.text(focoLinhas[0], margin + 35, y + 6);
      y += 9;

      // Dias
      for (const dia of semana.dias ?? []) {
        if (y > 270) { doc.addPage(); y = 14; }
        const diaH = 8;
        const bgDia: [number, number, number] = dia.tipo === "revisao" ? [255, 251, 235] : [255, 255, 255];
        doc.setFillColor(...bgDia);
        doc.rect(margin, y, contentW, diaH, "F");
        // linha separadora
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y + diaH, margin + contentW, y + diaH);

        doc.setTextColor(...corCinza);
        doc.setFontSize(7);
        doc.setFont("helvetica", dia.tipo === "revisao" ? "bold" : "normal");
        const diaTex = dia.tipo === "revisao" ? `${dia.diaSemana} ★` : dia.diaSemana;
        doc.text(diaTex, margin + 3, y + 5.5);

        const assStr = (dia.assuntos ?? []).join(" · ");
        const assLinhas = doc.splitTextToSize(assStr, 140);
        doc.setTextColor(...corTexto);
        doc.setFont("helvetica", "normal");
        doc.text(assLinhas[0], margin + 28, y + 5.5);

        doc.setTextColor(...corCinza);
        doc.text(`${dia.horas}h`, margin + contentW - 8, y + 5.5, { align: "right" });

        y += diaH;
      }
      y += 4;
    }
  }

  // ── Rodapé em todas as páginas ───────────────────────────────────
  const totalPags = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p);
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 285, W, 12, "F");
    doc.setTextColor(...corCinza);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Pareto Concursos — Estude menos, acerte mais.", margin, 292);
    doc.text(`${p} / ${totalPags}`, W - margin, 292, { align: "right" });
  }

  doc.save(`pareto-${titulo.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export default function AnalisePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [aba, setAba] = useState<"ranking" | "plano">("ranking");
  const [exportando, setExportando] = useState(false);
  const [gerandoPlano, setGerandoPlano] = useState(false);
  const queryClient = useQueryClient();

  // Polling de status enquanto processando
  const { data: statusData } = useQuery<{ id: number; status: string; erroMsg: string | null }>({
    queryKey: ["analise-status", id],
    queryFn: async () => {
      const res = await apiFetch(`/api/analises/${id}/status`);
      if (!res.ok) throw new Error("não encontrada");
      return res.json();
    },
    refetchInterval: (query) => {
      const st = query.state.data?.status;
      return st === "processando" ? 3000 : false;
    },
  });

  const { data, isLoading, error } = useQuery<AnaliseData>({
    queryKey: ["analise", id],
    queryFn: async () => {
      const res = await apiFetch(`/api/analises/${id}`);
      if (!res.ok) throw new Error("Análise não encontrada");
      return res.json();
    },
    enabled: statusData?.status === "concluido",
  });

  // Processando — tela de espera
  if (!statusData || statusData.status === "processando") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#1E40AF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#F8FAFC] font-semibold">Analisando com IA...</p>
          <p className="text-[#94A3B8] text-sm max-w-xs">
            O Gemini está lendo seus PDFs e gerando o plano de estudos. Pode levar 1-2 minutos.
          </p>
          <div className="flex items-center justify-center gap-1.5 text-[#475569] text-xs">
            <Loader2 size={12} className="animate-spin" />
            Atualizando automaticamente...
          </div>
        </div>
      </div>
    );
  }

  // Erro no processamento
  if (statusData.status === "erro") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <AlertTriangle size={32} className="text-red-400 mx-auto" />
          <p className="text-[#F8FAFC] font-semibold">Erro ao processar</p>
          <p className="text-red-400 text-sm max-w-sm">{statusData.erroMsg || "Erro desconhecido"}</p>
          <button
            onClick={() => setLocation("/")}
            className="text-sm text-[#1E40AF] hover:underline mt-2"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-[#1E40AF] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-2" />
          <p className="text-[#94A3B8]">Análise não encontrada.</p>
        </div>
      </div>
    );
  }

  const { analise, assuntos, plano } = data;
  const totalQuestoes = assuntos.reduce((s, a) => s + a.totalQuestoes, 0);
  const assuntosAlta = assuntos.filter((a) => a.prioridade === "alta");
  const maxQuestoes = Math.max(...assuntos.map((a) => a.totalQuestoes || a.pesoEdital || 1));

  let planoData: any = null;
  if (plano?.planoJson) {
    try { planoData = JSON.parse(plano.planoJson); } catch {}
  }
  const planoComErro = !planoData || planoData.erro;

  const handleGerarPlano = async () => {
    setGerandoPlano(true);
    try {
      const res = await apiFetch(`/api/analises/${id}/gerar-plano`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diasEstudo: 30, horasDia: 3 }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["analise", id] });
      }
    } finally {
      setGerandoPlano(false);
    }
  };

  const handleExportar = async () => {
    setExportando(true);
    try {
      await exportarPDF(analise.titulo, assuntos, planoData);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <button onClick={() => setLocation("/historico")} className="mt-1 text-[#94A3B8] hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#F8FAFC]">{analise.titulo}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-[#94A3B8]">
            <span>{analise.cargo}</span>
            {analise.banca && <><span>·</span><span>{analise.banca}</span></>}
          </div>
        </div>
        {/* Botão Exportar PDF */}
        <button
          onClick={handleExportar}
          disabled={exportando}
          className="flex items-center gap-2 bg-[#F59E0B] hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed text-[#0F172A] font-semibold text-sm px-4 py-2 rounded-lg transition-all shrink-0"
        >
          {exportando ? (
            <><Loader2 size={15} className="animate-spin" /> Exportando...</>
          ) : (
            <><Download size={15} /> Exportar PDF</>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#94A3B8] text-xs mb-1"><BarChart3 size={14} /> Assuntos mapeados</div>
          <div className="text-2xl font-bold text-[#F8FAFC]">{assuntos.length}</div>
        </div>
        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#94A3B8] text-xs mb-1"><Target size={14} /> Questões analisadas</div>
          <div className="text-2xl font-bold text-[#F8FAFC]">{totalQuestoes || "—"}</div>
        </div>
        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#94A3B8] text-xs mb-1"><TrendingUp size={14} /> Alta prioridade (Pareto)</div>
          <div className="text-2xl font-bold text-[#F59E0B]">{assuntosAlta.length} assuntos</div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setAba("ranking")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === "ranking" ? "bg-[#1E40AF] text-white" : "text-[#94A3B8] hover:bg-[#334155]"
          }`}
        >
          <BarChart3 size={16} /> Ranking Pareto
        </button>
        <button
          onClick={() => setAba("plano")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === "plano" ? "bg-[#1E40AF] text-white" : "text-[#94A3B8] hover:bg-[#334155]"
          }`}
        >
          <Calendar size={16} /> Plano de Estudos
        </button>
      </div>

      {/* Ranking */}
      {aba === "ranking" && (
        <div className="space-y-3">
          <div className="bg-[#1E293B] border border-amber-800 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <TrendingUp size={20} className="text-[#F59E0B] mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#F8FAFC]">Princípio de Pareto aplicado</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Os <span className="text-[#F59E0B] font-medium">{assuntosAlta.length} assuntos de alta prioridade</span> representam ~80% das questões. Foque neles primeiro.
                  Os de média prioridade complementam o restante.
                </p>
              </div>
            </div>
          </div>

          {assuntos.map((a, i) => {
            const config = prioridadeConfig[a.prioridade as keyof typeof prioridadeConfig] || prioridadeConfig.baixa;
            const questoes = a.totalQuestoes || a.pesoEdital || 0;
            const barWidth = maxQuestoes > 0 ? (questoes / maxQuestoes) * 100 : 10;

            return (
              <div key={a.id} className={`bg-[#1E293B] border ${config.border} rounded-xl p-4`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-[#475569] text-sm font-mono w-6 shrink-0 mt-0.5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[#F8FAFC] text-sm leading-snug">{a.nome}</div>
                      <div className="text-xs text-[#94A3B8] mt-0.5">{a.disciplina}</div>
                      <div className="mt-2 h-1.5 bg-[#0F172A] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barWidth}%`, backgroundColor: config.bar }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.text} font-medium mb-1`}>
                      {config.label}
                    </div>
                    <div className="text-sm font-bold text-[#F8FAFC]">{a.percentual}%</div>
                    <div className="text-xs text-[#475569]">acum. {a.percentualAcumulado}%</div>
                    {questoes > 0 && (
                      <div className="text-xs text-[#94A3B8] mt-0.5">{questoes} questões</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Plano de Estudos */}
      {aba === "plano" && (
        <div>
          {planoComErro ? (
            <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-8 text-center">
              <Calendar size={32} className="text-[#475569] mx-auto mb-2" />
              <p className="text-[#94A3B8] mb-4">Plano não disponível para esta análise.</p>
              <button
                onClick={handleGerarPlano}
                disabled={gerandoPlano}
                className="inline-flex items-center gap-2 bg-[#1E40AF] hover:bg-[#1D4ED8] disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {gerandoPlano ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Gerando plano...</>
                ) : (
                  <><Calendar size={16} /> Gerar Plano de Estudos</>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {planoData.resumo && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[#94A3B8] text-xs mb-1"><Clock size={14} /> Total de horas</div>
                    <div className="text-2xl font-bold text-[#F8FAFC]">{planoData.resumo.totalHoras}h</div>
                  </div>
                  <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[#94A3B8] text-xs mb-1"><Target size={14} /> Meta de acerto</div>
                    <div className="text-2xl font-bold text-[#10B981]">{planoData.resumo.metaAcerto}</div>
                  </div>
                </div>
              )}

              {planoData.semanas?.map((semana: any) => (
                <div key={semana.semana} className="bg-[#1E293B] border border-slate-700 rounded-xl overflow-hidden">
                  <div className="bg-[#1E40AF]/20 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
                    <div className="font-semibold text-[#F8FAFC] text-sm">Semana {semana.semana}</div>
                    <div className="text-xs text-[#94A3B8]">{semana.foco}</div>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {semana.dias?.map((dia: any) => (
                      <div key={dia.dia} className={`px-4 py-3 flex items-start gap-4 ${dia.tipo === "revisao" ? "bg-[#F59E0B]/5" : ""}`}>
                        <div className="w-20 shrink-0">
                          <span className="text-xs font-medium text-[#94A3B8]">{dia.diaSemana}</span>
                          {dia.tipo === "revisao" && (
                            <span className="block text-xs text-[#F59E0B]">Revisão</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-1">
                            {dia.assuntos?.map((ass: string, j: number) => (
                              <span key={j} className="text-xs bg-[#334155] text-[#F8FAFC] px-2 py-0.5 rounded">
                                {ass}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-[#94A3B8] shrink-0">{dia.horas}h</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
