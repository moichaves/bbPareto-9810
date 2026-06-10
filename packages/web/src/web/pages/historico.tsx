import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { History, ChevronRight, Trash2, Calendar, TrendingUp, Plus } from "lucide-react";
import { apiFetch } from "../lib/api";

type Analise = {
  id: number;
  titulo: string;
  cargo: string;
  banca: string | null;
  createdAt: number;
};

export default function HistoricoPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ analises: Analise[] }>({
    queryKey: ["analises"],
    queryFn: async () => {
      const res = await apiFetch("/api/analises");
      return res.json();
    },
  });

  const deletar = useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/analises/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["analises"] }),
  });

  const analises = data?.analises ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#F8FAFC]">Histórico de Análises</h1>
          <p className="text-[#94A3B8] mt-1 text-sm">{analises.length} análise{analises.length !== 1 ? "s" : ""} salva{analises.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 bg-[#1E40AF] hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
        >
          <Plus size={16} /> Nova Análise
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1E293B] border border-slate-700 rounded-xl p-5 animate-pulse h-20" />
          ))}
        </div>
      ) : analises.length === 0 ? (
        <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-16 text-center">
          <History size={40} className="text-[#475569] mx-auto mb-3" />
          <h3 className="font-medium text-[#F8FAFC] mb-1">Nenhuma análise ainda</h3>
          <p className="text-sm text-[#94A3B8] mb-4">Crie sua primeira análise Pareto para começar.</p>
          <button
            onClick={() => setLocation("/")}
            className="bg-[#1E40AF] hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all"
          >
            Criar análise
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {analises.map((a) => (
            <div
              key={a.id}
              className="bg-[#1E293B] border border-slate-700 hover:border-slate-500 rounded-xl p-5 cursor-pointer transition-all group"
              onClick={() => setLocation(`/analise/${a.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#F8FAFC] truncate">{a.titulo}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#94A3B8]">
                    <span className="flex items-center gap-1">
                      <TrendingUp size={12} /> {a.cargo}
                    </span>
                    {a.banca && <span>· {a.banca}</span>}
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(a.createdAt * 1000).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Deletar esta análise?")) deletar.mutate(a.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-[#94A3B8] hover:text-red-400 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={18} className="text-[#475569] group-hover:text-[#94A3B8] transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
