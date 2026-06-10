import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { Play, Pause, RotateCcw, Coffee, Timer } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────
type Fase = "foco" | "pausa_curta" | "pausa_longa";

interface PomodoroState {
  fase: Fase;
  segundosRestantes: number;
  rodando: boolean;
  pomodorosHoje: number;
  pomodorosSessao: number;
}

// ── Constantes ───────────────────────────────────────────────────
const DURACAO: Record<Fase, number> = {
  foco: 25 * 60,
  pausa_curta: 5 * 60,
  pausa_longa: 15 * 60,
};

const LABEL_FASE: Record<Fase, string> = {
  foco: "Foco",
  pausa_curta: "Pausa",
  pausa_longa: "Pausa Longa",
};

const COR_FASE: Record<Fase, string> = {
  foco: "#3B82F6",
  pausa_curta: "#10B981",
  pausa_longa: "#8B5CF6",
};

function tocarSom(tipo: "inicio" | "fim") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (tipo === "fim") {
      const freqs = [880, 660, 440];
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = f;
        g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.3);
        o.start(ctx.currentTime + i * 0.25);
        o.stop(ctx.currentTime + i * 0.25 + 0.35);
      });
    } else {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 660;
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.35);
    }
  } catch {}
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

// ── Context ──────────────────────────────────────────────────────
interface PomodoroCtx {
  iniciarParaAula: (nomeAula: string) => void;
  pomodorosHoje: number;
  rodando: boolean;
  fase: Fase;
}

export const PomodoroContext = createContext<PomodoroCtx>({
  iniciarParaAula: () => {},
  pomodorosHoje: 0,
  rodando: false,
  fase: "foco",
});

export function usePomodoroContext() {
  return useContext(PomodoroContext);
}

// ── Provider (sem UI — só lógica + contexto) ─────────────────────
export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PomodoroState>(() => {
    try {
      const saved = localStorage.getItem("pomodoro_state");
      if (saved) return { ...JSON.parse(saved), rodando: false };
    } catch {}
    return { fase: "foco" as Fase, segundosRestantes: DURACAO.foco, rodando: false, pomodorosHoje: 0, pomodorosSessao: 0 };
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    localStorage.setItem("pomodoro_state", JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const hoje = new Date().toDateString();
    if (localStorage.getItem("pomodoro_data") !== hoje) {
      localStorage.setItem("pomodoro_data", hoje);
      setState(s => ({ ...s, pomodorosHoje: 0 }));
    }
  }, []);

  useEffect(() => {
    if (state.rodando) {
      document.title = `${fmt(state.segundosRestantes)} • ${LABEL_FASE[state.fase]} — Pareto`;
    } else {
      document.title = "Pareto Concursos";
    }
    return () => { document.title = "Pareto Concursos"; };
  }, [state.rodando, state.segundosRestantes, state.fase]);

  useEffect(() => {
    if (state.rodando) {
      intervalRef.current = setInterval(() => {
        setState(prev => {
          if (prev.segundosRestantes <= 1) {
            tocarSom("fim");
            if (Notification.permission === "granted") {
              new Notification(
                prev.fase === "foco" ? "⏰ Pomodoro concluído!" : "💪 Hora de focar!",
                { body: prev.fase === "foco" ? "Tire uma pausa merecida." : "De volta ao foco." }
              );
            }
            let novaFase: Fase;
            let novosSessao = prev.pomodorosSessao;
            let novosHoje = prev.pomodorosHoje;
            if (prev.fase === "foco") {
              novosSessao += 1;
              novosHoje += 1;
              novaFase = novosSessao % 4 === 0 ? "pausa_longa" : "pausa_curta";
            } else {
              novaFase = "foco";
            }
            return { ...prev, fase: novaFase, segundosRestantes: DURACAO[novaFase], rodando: false, pomodorosSessao: novosSessao, pomodorosHoje: novosHoje };
          }
          return { ...prev, segundosRestantes: prev.segundosRestantes - 1 };
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state.rodando]);

  const iniciarParaAula = useCallback((nomeAula: string) => {
    setState(s => ({ ...s, fase: "foco", segundosRestantes: DURACAO.foco, rodando: true }));
    tocarSom("inicio");
    if (Notification.permission === "default") Notification.requestPermission();
    // Salvar nome da aula atual para o widget ler
    localStorage.setItem("pomodoro_aula", nomeAula);
  }, []);

  return (
    <PomodoroContext.Provider value={{ iniciarParaAula, pomodorosHoje: state.pomodorosHoje, rodando: state.rodando, fase: state.fase }}>
      {children}
    </PomodoroContext.Provider>
  );
}

// ── Widget visual (para colocar na sidebar) ──────────────────────
export function PomodoroSidebar() {
  const [state, setState] = useState<PomodoroState>(() => {
    try {
      const saved = localStorage.getItem("pomodoro_state");
      if (saved) return { ...JSON.parse(saved), rodando: false };
    } catch {}
    return { fase: "foco" as Fase, segundosRestantes: DURACAO.foco, rodando: false, pomodorosHoje: 0, pomodorosSessao: 0 };
  });

  const [aulaAtual, setAulaAtual] = useState<string | null>(null);
  const [piscando, setPiscando] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync bidirecional via localStorage
  useEffect(() => {
    localStorage.setItem("pomodoro_state", JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const hoje = new Date().toDateString();
    if (localStorage.getItem("pomodoro_data") !== hoje) {
      localStorage.setItem("pomodoro_data", hoje);
      setState(s => ({ ...s, pomodorosHoje: 0 }));
    }
    // Aula atual
    setAulaAtual(localStorage.getItem("pomodoro_aula"));
    const onStorage = () => setAulaAtual(localStorage.getItem("pomodoro_aula"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Reagir ao iniciarParaAula (via evento customizado)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setState(s => ({ ...s, fase: "foco", segundosRestantes: DURACAO.foco, rodando: true }));
      setAulaAtual(e.detail?.aula ?? null);
    };
    window.addEventListener("pomodoro:iniciar" as any, handler);
    return () => window.removeEventListener("pomodoro:iniciar" as any, handler);
  }, []);

  useEffect(() => {
    if (state.rodando) {
      document.title = `${fmt(state.segundosRestantes)} • ${LABEL_FASE[state.fase]} — Pareto`;
    } else {
      document.title = "Pareto Concursos";
    }
    return () => { document.title = "Pareto Concursos"; };
  }, [state.rodando, state.segundosRestantes, state.fase]);

  useEffect(() => {
    if (state.rodando) {
      intervalRef.current = setInterval(() => {
        setState(prev => {
          if (prev.segundosRestantes <= 1) {
            tocarSom("fim");
            setPiscando(true);
            setTimeout(() => setPiscando(false), 3000);
            if (Notification.permission === "granted") {
              new Notification(
                prev.fase === "foco" ? "⏰ Pomodoro concluído!" : "💪 Hora de focar!",
                { body: prev.fase === "foco" ? "Tire uma pausa merecida." : "De volta ao foco." }
              );
            }
            let novaFase: Fase;
            let novosSessao = prev.pomodorosSessao;
            let novosHoje = prev.pomodorosHoje;
            if (prev.fase === "foco") {
              novosSessao += 1; novosHoje += 1;
              novaFase = novosSessao % 4 === 0 ? "pausa_longa" : "pausa_curta";
              // Salvar histórico de estudo por dia (25min por pomodoro)
              try {
                const chave = `estudo_${new Date().toISOString().slice(0, 10)}`;
                const minAtual = parseInt(localStorage.getItem(chave) ?? "0");
                localStorage.setItem(chave, String(minAtual + 25));
              } catch {}
            } else { novaFase = "foco"; }
            return { ...prev, fase: novaFase, segundosRestantes: DURACAO[novaFase], rodando: false, pomodorosSessao: novosSessao, pomodorosHoje: novosHoje };
          }
          return { ...prev, segundosRestantes: prev.segundosRestantes - 1 };
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state.rodando]);

  const toggleRodar = useCallback(() => {
    if (Notification.permission === "default") Notification.requestPermission();
    setState(s => { if (!s.rodando) tocarSom("inicio"); return { ...s, rodando: !s.rodando }; });
  }, []);

  const resetar = useCallback(() => {
    setState(s => ({ ...s, rodando: false, segundosRestantes: DURACAO[s.fase] }));
  }, []);

  const mudarFase = useCallback((fase: Fase) => {
    setState(s => ({ ...s, fase, rodando: false, segundosRestantes: DURACAO[fase] }));
  }, []);

  const progresso = 1 - state.segundosRestantes / DURACAO[state.fase];
  const circunferencia = 2 * Math.PI * 38;

  return (
    <div className={`mx-3 my-2 rounded-xl border border-blue-500/30 bg-gradient-to-b from-[#0f2040] to-[#0d1a30] shadow-lg shadow-blue-950/40 px-3 py-3 transition-all ${piscando ? "animate-pulse" : ""}`}>
      {/* Título */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-200 font-semibold uppercase tracking-wide">
          <Timer size={12} className="text-slate-300" />
          Pomodoro
        </div>
        <span className="text-[10px] text-slate-200 bg-slate-600 px-1.5 py-0.5 rounded-full font-medium">
          {state.pomodorosHoje} hoje
        </span>
      </div>

      {/* Seletor de fase */}
      <div className="flex gap-1 mb-3">
        {(["foco", "pausa_curta", "pausa_longa"] as Fase[]).map(f => (
          <button
            key={f}
            onClick={() => mudarFase(f)}
            className={`flex-1 text-[10px] py-1 rounded transition-all font-semibold ${
              state.fase === f
                ? "bg-[#334155] text-white ring-1 ring-white/20"
                : "text-slate-300 hover:text-white hover:bg-slate-700"
            }`}
          >
            {f === "foco" ? "Foco" : f === "pausa_curta" ? "Pausa" : "Longa"}
          </button>
        ))}
      </div>

      {/* Timer circular compacto */}
      <div className="flex items-center gap-3">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="38" fill="none" stroke="#334155" strokeWidth="7" />
            <circle
              cx="44" cy="44" r="38" fill="none"
              stroke={COR_FASE[state.fase]}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circunferencia}
              strokeDashoffset={circunferencia * (1 - progresso)}
              style={{ transition: "stroke-dashoffset 0.9s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-mono font-bold text-white leading-none">{fmt(state.segundosRestantes)}</span>
            <span className="text-[9px] text-slate-300 mt-0.5 font-medium">{LABEL_FASE[state.fase]}</span>
          </div>
        </div>

        {/* Controles + info */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Aula atual */}
          {aulaAtual && state.fase === "foco" && (
            <p className="text-[10px] text-slate-300 leading-tight line-clamp-2">📖 {aulaAtual}</p>
          )}

          {/* Botões */}
          <div className="flex gap-1.5">
            <button
              onClick={resetar}
              className="p-1.5 rounded-md bg-slate-600 text-slate-200 hover:bg-slate-500 hover:text-white transition-all"
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={toggleRodar}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-bold text-white transition-all hover:brightness-110 shadow-sm"
              style={{ backgroundColor: COR_FASE[state.fase] }}
            >
              {state.rodando ? <><Pause size={11} /> Pausar</> : <><Play size={11} /> {state.segundosRestantes === DURACAO[state.fase] ? "Iniciar" : "Continuar"}</>}
            </button>
          </div>

          {/* Bolinhas da rodada */}
          <div className="flex items-center gap-1">
            {Array.from({ length: 4 }).map((_, i) => {
              const completado = (state.pomodorosSessao % 4) > i;
              const atual = (state.pomodorosSessao % 4) === i && state.fase === "foco" && state.rodando;
              return (
                <div key={i} className={`h-1.5 w-1.5 rounded-full transition-all ${
                  completado ? "bg-yellow-400" : atual ? "bg-blue-400 animate-pulse" : "bg-slate-500"
                }`} />
              );
            })}
            <Coffee size={9} className="ml-0.5 text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
