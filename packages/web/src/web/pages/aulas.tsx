import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Plus, Trash2, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { apiFetch } from "../lib/api";

type Curso = {
  id: number;
  titulo: string;
  cargo: string | null;
  analiseId: number | null;
  totalAulas: number;
  createdAt: string | number | null;
};

export default function AulasPage() {
  const [, navigate] = useLocation();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);

  async function load() {
    try {
      const res = await apiFetch("/api/aulas/cursos");
      const data = await res.json();
      setCursos(data.cursos ?? []);
    } catch {
      setCursos([]);
    } finally {
      setLoading(false);
    }
  }

  async function novoCurso() {
    setCriando(true);
    try {
      // Buscar análise mais recente concluída
      const res = await apiFetch("/api/analises");
      const data = await res.json();
      const analises: Array<{ id: number; titulo: string; cargo: string; status: string }> = data.analises ?? [];
      const analise = analises.find((a) => a.status === "concluido") ?? analises[0];

      if (!analise) {
        alert("Faça uma análise Pareto primeiro (aba Nova Análise).");
        return;
      }

      const form = new FormData();
      form.append("titulo", analise.titulo);
      form.append("cargo", analise.cargo);
      form.append("analiseId", String(analise.id));

      const r = await apiFetch("/api/aulas/cursos", { method: "POST", body: form });
      const d = await r.json();
      if (d.cursoId) navigate(`/aulas/${d.cursoId}`);
    } catch (e) {
      alert("Erro ao criar curso.");
    } finally {
      setCriando(false);
    }
  }

  async function deletar(id: number) {
    if (!confirm("Deletar este curso e todas as aulas?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/aulas/cursos/${id}`, { method: "DELETE" });
      setCursos((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BookOpen className="text-[#F59E0B]" size={28} />
            Aulas
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1">
            Conteúdo gerado por IA baseado no seu plano Pareto
          </p>
        </div>
        <button
          onClick={novoCurso}
          disabled={criando}
          className="flex items-center gap-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          {criando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Novo Curso
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#F59E0B]" size={32} />
        </div>
      ) : cursos.length === 0 ? (
        <div className="text-center py-20">
          <AlertCircle className="mx-auto text-[#475569] mb-4" size={48} />
          <p className="text-[#94A3B8] text-lg mb-2">Nenhum curso ainda</p>
          <p className="text-[#475569] text-sm mb-6">
            Crie um curso vinculando a uma análise Pareto para gerar aulas com IA
          </p>
          <button
            onClick={novoCurso}
            disabled={criando}
            className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 flex items-center gap-2 mx-auto"
          >
            {criando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Criar primeiro curso
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cursos.map((curso) => (
            <div
              key={curso.id}
              className="bg-[#1E293B] border border-slate-700 rounded-xl p-5 flex items-center justify-between group hover:border-[#1E40AF] transition-colors"
            >
              <Link to={`/aulas/${curso.id}`} className="flex-1 min-w-0 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[#1E3A8A] rounded-lg flex items-center justify-center shrink-0">
                    <BookOpen size={20} className="text-[#F59E0B]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white truncate">{curso.titulo}</h3>
                    <p className="text-sm text-[#94A3B8] mt-0.5">{curso.cargo ?? "—"}</p>
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-4 ml-4 shrink-0">
                <div className="text-right">
                  <div className="text-lg font-bold text-[#F59E0B]">{curso.totalAulas}</div>
                  <div className="text-xs text-[#475569]">aulas</div>
                </div>

                <button
                  onClick={() => deletar(curso.id)}
                  disabled={deletingId === curso.id}
                  className="text-[#475569] hover:text-red-400 transition-colors p-1.5 opacity-0 group-hover:opacity-100"
                >
                  {deletingId === curso.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>

                <Link to={`/aulas/${curso.id}`}>
                  <ChevronRight size={18} className="text-[#475569]" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
