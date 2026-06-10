import { useEffect, useState } from "react";
import { Network } from "lucide-react";

interface No {
  texto: string;
  nivel: number; // 0 = raiz, 1 = ramo, 2 = folha
  filhos: No[];
}

function parseMapaMental(md: string): No[] {
  // Extrai bloco entre "## 🗺 Mapa Mental" e o próximo "##"
  const blocoMatch = md.match(/##\s*🗺\s*Mapa Mental\s*\n([\s\S]*?)(?=\n##\s|$)/);
  const bloco = blocoMatch ? blocoMatch[1] : md;

  const linhas = bloco
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith("[") && !l.trim().startsWith("]"));

  const raizes: No[] = [];
  const pilha: No[] = [];

  for (const linha of linhas) {
    const indent = linha.length - linha.trimStart().length;
    const texto = linha
      .replace(/^[\s]*[•◦\-\*]+\s*/, "")
      .trim();
    if (!texto) continue;

    // Nível baseado na indentação: 0-1 espaços = raiz, 2-3 = nível1, 4+ = nível2
    let nivel = 0;
    if (indent >= 4) nivel = 2;
    else if (indent >= 2) nivel = 1;

    const no: No = { texto, nivel, filhos: [] };

    // Encaixar na árvore
    while (pilha.length > 0 && pilha[pilha.length - 1].nivel >= nivel) {
      pilha.pop();
    }

    if (pilha.length === 0) {
      raizes.push(no);
    } else {
      pilha[pilha.length - 1].filhos.push(no);
    }
    pilha.push(no);
  }

  return raizes;
}

// ── Cores por nível ────────────────────────────────────────────────────────────
const COR_RAIZ = "bg-[#F59E0B]/15 border border-[#F59E0B]/50 text-[#FCD34D]";
const COR_RAMO = "bg-[#1E3A8A]/40 border border-[#3B82F6]/30 text-[#93C5FD]";
const COR_FOLHA = "bg-[#1E293B] border border-slate-700 text-[#94A3B8]";

function NoVisual({ no, isLast }: { no: No; isLast: boolean }) {
  const [aberto, setAberto] = useState(true);
  const temFilhos = no.filhos.length > 0;

  const corClasse = no.nivel === 0 ? COR_RAIZ : no.nivel === 1 ? COR_RAMO : COR_FOLHA;
  const paddingLeft = no.nivel === 0 ? "pl-0" : no.nivel === 1 ? "pl-6" : "pl-12";

  return (
    <div className={`${paddingLeft}`}>
      <div className="flex items-start gap-2 my-1">
        {/* Linha conectora vertical */}
        {no.nivel > 0 && (
          <div className="flex flex-col items-center shrink-0 mt-1.5">
            <div
              className={`w-px ${isLast ? "h-3" : "h-full"} bg-slate-700`}
              style={{ minHeight: "12px" }}
            />
          </div>
        )}

        {/* Nó */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {no.nivel > 0 && (
            <div className="w-4 h-px bg-slate-700 shrink-0" />
          )}
          <button
            onClick={() => temFilhos && setAberto(!aberto)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${corClasse}
              ${temFilhos ? "cursor-pointer hover:opacity-80" : "cursor-default"}
              ${no.nivel === 0 ? "text-base font-bold" : ""}
            `}
          >
            {temFilhos && (
              <span className="text-xs opacity-60">{aberto ? "▾" : "▸"}</span>
            )}
            {!temFilhos && no.nivel > 0 && (
              <span className="text-xs opacity-40">·</span>
            )}
            <span className="truncate max-w-[280px]">{no.texto}</span>
            {temFilhos && (
              <span className="text-[10px] opacity-40 ml-1 shrink-0">
                {no.filhos.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filhos */}
      {aberto && temFilhos && (
        <div className="ml-4 border-l border-slate-800 pl-2">
          {no.filhos.map((filho, i) => (
            <NoVisual key={i} no={filho} isLast={i === no.filhos.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MapaMental({ conteudoMd }: { conteudoMd: string }) {
  const [nos, setNos] = useState<No[]>([]);
  const [temMapa, setTemMapa] = useState(false);

  useEffect(() => {
    const arvore = parseMapaMental(conteudoMd);
    setNos(arvore);
    setTemMapa(arvore.length > 0);
  }, [conteudoMd]);

  if (!temMapa) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Network size={40} className="text-slate-700 mb-4" />
        <p className="text-[#94A3B8] text-sm">Mapa mental não disponível para esta aula.</p>
        <p className="text-[#475569] text-xs mt-1">
          Regere a aula para incluir o mapa mental.
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Legenda */}
      <div className="flex items-center gap-4 mb-6 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#F59E0B]/40 border border-[#F59E0B]/50" />
          <span className="text-xs text-[#94A3B8]">Conceito central</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#1E3A8A]/60 border border-[#3B82F6]/30" />
          <span className="text-xs text-[#94A3B8]">Subcategoria</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#1E293B] border border-slate-700" />
          <span className="text-xs text-[#94A3B8]">Detalhe</span>
        </div>
        <span className="text-[10px] text-[#475569] ml-auto">Clique para expandir/recolher</span>
      </div>

      {/* Árvore */}
      <div className="space-y-1 overflow-x-auto pb-4">
        {nos.map((no, i) => (
          <NoVisual key={i} no={no} isLast={i === nos.length - 1} />
        ))}
      </div>
    </div>
  );
}
