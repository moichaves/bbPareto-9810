import { useEffect, useState, useRef } from "react";
import {
import { apiFetch } from "../lib/api";
  Crown, Check, Zap, BookOpen, Brain, BarChart2,
  RefreshCw, Loader2, AlertCircle, Lock, CreditCard, X
} from "lucide-react";

type Plano = "free" | "pro_mensal" | "pro_anual";
type StatusAssinatura = {
  plano: Plano;
  status: string;
  renovaEm: string | null;
};

// ── Utilitário: formatar CPF e telefone ───────────────────────────────────────
function fmtCpf(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function fmtTel(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}
function fmtCartao(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim();
}
function fmtValidade(v: string) {
  return v.replace(/\D/g, "").slice(0, 4)
    .replace(/(\d{2})(\d)/, "$1/$2");
}

const FEATURES_FREE = [
  "1 análise de edital",
  "2 aulas por dia",
  "Quiz por aula",
  "Revisão espaçada básica",
];
const FEATURES_PRO = [
  "Análises ilimitadas",
  "Aulas ilimitadas por dia",
  "Simulados cronometrados",
  "Ranking de erros por assunto",
  "Revisão inteligente automática",
  "Plano de estudos personalizado",
  "Pomodoro + histórico completo",
  "Suporte prioritário",
];

export default function PlanosPage() {
  const [status, setStatus] = useState<StatusAssinatura | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [selecionado, setSelecionado] = useState<"pro_mensal" | "pro_anual">("pro_mensal");
  const [modalAberto, setModalAberto] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelado, setCancelado] = useState(false);

  useEffect(() => {
    apiFetch("/api/assinatura/status")
      .then(r => r.json())
      .then(d => { setStatus(d); setLoadingStatus(false); })
      .catch(() => setLoadingStatus(false));
  }, []);

  const isPro = status?.plano === "pro_mensal" || status?.plano === "pro_anual";

  async function cancelarAssinatura() {
    setCancelando(true);
    try {
      const r = await apiFetch("/api/assinatura/cancelar", { method: "POST" });
      if (r.ok) {
        setCancelado(true);
        setStatus(s => s ? { ...s, status: "cancelada" } : s);
      }
    } finally {
      setCancelando(false);
    }
  }

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-[#94A3B8]" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-[#F59E0B]/10 border border-amber-700 text-amber-400 text-xs font-semibold px-3 py-1 rounded-full mb-4">
          <Crown size={13} /> Pareto Pro
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Estude menos. Acerte mais.</h1>
        <p className="text-[#94A3B8] text-base">Escolha o plano certo para sua aprovação.</p>
      </div>

      {/* Status atual */}
      {isPro && !cancelado && (
        <div className="bg-emerald-500/10 border border-emerald-700 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown size={18} className="text-emerald-400" />
            <div>
              <span className="text-emerald-300 font-semibold text-sm">Você é Pro!</span>
              <span className="text-[#94A3B8] text-xs ml-2">
                {status?.plano === "pro_mensal" ? "Plano Mensal" : "Plano Anual"}
                {status?.renovaEm && ` — renova em ${new Date(status.renovaEm).toLocaleDateString("pt-BR")}`}
              </span>
            </div>
          </div>
          <button
            onClick={cancelarAssinatura}
            disabled={cancelando}
            className="text-xs text-red-400 hover:text-red-300 border border-red-800 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
          >
            {cancelando ? <Loader2 size={13} className="animate-spin" /> : null}
            Cancelar assinatura
          </button>
        </div>
      )}

      {cancelado && (
        <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-4 mb-6 text-sm text-[#94A3B8] text-center">
          Assinatura cancelada. Seu acesso Pro permanece até o fim do período pago.
        </div>
      )}

      {/* Cards de planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {/* Free */}
        <div className="bg-[#1E293B] border border-slate-700 rounded-2xl p-6">
          <div className="mb-4">
            <div className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-1">Gratuito</div>
            <div className="text-3xl font-bold text-white">R$ 0</div>
            <div className="text-xs text-[#475569] mt-1">Para sempre</div>
          </div>
          <ul className="space-y-2 mb-6">
            {FEATURES_FREE.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-[#94A3B8]">
                <Check size={14} className="text-[#475569] mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <div className={`w-full py-2.5 rounded-xl text-sm font-medium text-center ${
            !isPro ? "bg-slate-700 text-white" : "bg-slate-800 text-[#475569] cursor-default"
          }`}>
            {!isPro ? "Plano atual" : "Incluso"}
          </div>
        </div>

        {/* Pro Mensal */}
        <div
          onClick={() => { setSelecionado("pro_mensal"); }}
          className={`bg-[#1E293B] border-2 rounded-2xl p-6 cursor-pointer transition-all ${
            selecionado === "pro_mensal" && !isPro
              ? "border-[#7C3AED] shadow-lg shadow-violet-900/30"
              : "border-slate-700 hover:border-slate-500"
          }`}
        >
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-sm font-semibold text-violet-400 uppercase tracking-wider">Pro Mensal</div>
            </div>
            <div className="text-3xl font-bold text-white">R$ 27<span className="text-base font-normal text-[#94A3B8]">/mês</span></div>
            <div className="text-xs text-[#475569] mt-1">Cancele quando quiser</div>
          </div>
          <ul className="space-y-2 mb-6">
            {FEATURES_PRO.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-[#CBD5E1]">
                <Check size={14} className="text-violet-400 mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {!isPro && (
            <div className={`w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all ${
              selecionado === "pro_mensal"
                ? "bg-[#7C3AED] text-white"
                : "bg-slate-700 text-[#94A3B8]"
            }`}>
              {selecionado === "pro_mensal" ? "Selecionado" : "Selecionar"}
            </div>
          )}
          {isPro && status?.plano === "pro_mensal" && (
            <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center bg-violet-900/40 text-violet-300">Plano atual</div>
          )}
        </div>

        {/* Pro Anual */}
        <div
          onClick={() => { setSelecionado("pro_anual"); }}
          className={`bg-[#1E293B] border-2 rounded-2xl p-6 cursor-pointer relative transition-all ${
            selecionado === "pro_anual" && !isPro
              ? "border-[#F59E0B] shadow-lg shadow-amber-900/30"
              : "border-slate-700 hover:border-slate-500"
          }`}
        >
          {/* Badge economia */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F59E0B] text-[#0F172A] text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
            ECONOMIZE R$ 127/ANO
          </div>
          <div className="mb-4">
            <div className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-1">Pro Anual</div>
            <div className="text-3xl font-bold text-white">R$ 197<span className="text-base font-normal text-[#94A3B8]">/ano</span></div>
            <div className="text-xs text-[#94A3B8] mt-1">≈ R$ 16,40/mês · melhor custo</div>
          </div>
          <ul className="space-y-2 mb-6">
            {FEATURES_PRO.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-[#CBD5E1]">
                <Check size={14} className="text-[#F59E0B] mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {!isPro && (
            <div className={`w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all ${
              selecionado === "pro_anual"
                ? "bg-[#F59E0B] text-[#0F172A]"
                : "bg-slate-700 text-[#94A3B8]"
            }`}>
              {selecionado === "pro_anual" ? "Selecionado" : "Selecionar"}
            </div>
          )}
          {isPro && status?.plano === "pro_anual" && (
            <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center bg-amber-900/40 text-amber-300">Plano atual</div>
          )}
        </div>
      </div>

      {/* Botão de assinar */}
      {!isPro && (
        <div className="text-center">
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all shadow-lg shadow-violet-900/40"
          >
            <Zap size={18} />
            Assinar {selecionado === "pro_mensal" ? "por R$ 27/mês" : "por R$ 197/ano"}
          </button>
          <p className="text-xs text-[#475569] mt-3">
            Pagamento seguro via PagBank · Cartão de crédito · Cancele quando quiser
          </p>
        </div>
      )}

      {/* FAQ rápido */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: CreditCard, titulo: "Pagamento seguro", desc: "Processado pelo PagBank com criptografia de ponta a ponta." },
          { icon: RefreshCw,   titulo: "Cancele quando quiser", desc: "Sem fidelidade. Cancele com 1 clique pelo painel." },
          { icon: Lock,        titulo: "Seus dados protegidos", desc: "Não armazenamos dados de cartão — tudo via PagBank." },
        ].map(({ icon: Icon, titulo, desc }) => (
          <div key={titulo} className="bg-[#1E293B] border border-slate-700 rounded-xl p-4">
            <Icon size={18} className="text-[#94A3B8] mb-2" />
            <div className="text-sm font-semibold text-white mb-1">{titulo}</div>
            <div className="text-xs text-[#475569] leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>

      {/* Modal checkout */}
      {modalAberto && (
        <ModalCheckout
          tipo={selecionado}
          onFechar={() => setModalAberto(false)}
          onSucesso={() => {
            setModalAberto(false);
            setStatus({ plano: selecionado, status: "ativa", renovaEm: null });
          }}
        />
      )}
    </div>
  );
}

// ── Modal Checkout ────────────────────────────────────────────────────────────
function ModalCheckout({
  tipo,
  onFechar,
  onSucesso,
}: {
  tipo: "pro_mensal" | "pro_anual";
  onFechar: () => void;
  onSucesso: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cartao, setCartao] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [titular, setTitular] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  // IMPORTANTE: em produção, o número do cartão deve ser encriptado
  // usando o SDK JS do PagBank (pagbank-connect) antes de enviar ao backend.
  // Aqui simulamos o campo "token" como placeholder.
  // Veja: https://developer.pagbank.com.br/docs/criptografia-e-chave-publica

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome || !email || !cpf || !telefone || !cartao || !validade || !cvv || !titular) {
      setErro("Preencha todos os campos.");
      return;
    }

    setLoading(true);
    try {
      const [mes, ano] = validade.split("/");
      const r = await apiFetch("/api/assinatura/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          nome,
          email,
          cpf: cpf.replace(/\D/g, ""),
          telefone: telefone.replace(/\D/g, ""),
          cartao: {
            // Em produção: substituir pelo token encriptado do SDK PagBank JS
            token: cartao.replace(/\D/g, ""),
            mes,
            ano: ano?.length === 2 ? `20${ano}` : ano,
            cvv,
            titular,
          },
        }),
      });

      const data = await r.json();
      if (!r.ok) {
        setErro(data.error ?? "Erro ao processar pagamento.");
        return;
      }

      setSucesso(true);
      setTimeout(onSucesso, 2000);
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const valor = tipo === "pro_mensal" ? "R$ 27,00/mês" : "R$ 197,00/ano";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-amber-400" />
            <span className="font-semibold text-white">Pareto Pro — {tipo === "pro_mensal" ? "Mensal" : "Anual"}</span>
          </div>
          <button onClick={onFechar} className="text-[#94A3B8] hover:text-white">
            <X size={20} />
          </button>
        </div>

        {sucesso ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Pagamento confirmado!</h3>
            <p className="text-[#94A3B8] text-sm">Bem-vindo ao Pareto Pro. Seu acesso foi liberado.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Resumo */}
            <div className="bg-slate-800/60 rounded-xl p-3 flex items-center justify-between text-sm">
              <span className="text-[#94A3B8]">Total a cobrar</span>
              <span className="font-bold text-white">{valor}</span>
            </div>

            {/* Dados pessoais */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Dados pessoais</p>
              <Input label="Nome completo" value={nome} onChange={setNome} placeholder="João da Silva" />
              <Input label="E-mail" value={email} onChange={setEmail} placeholder="joao@email.com" type="email" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="CPF" value={cpf} onChange={v => setCpf(fmtCpf(v))} placeholder="000.000.000-00" />
                <Input label="Telefone" value={telefone} onChange={v => setTelefone(fmtTel(v))} placeholder="(11) 99999-9999" />
              </div>
            </div>

            {/* Dados cartão */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={13} /> Cartão de crédito
              </p>
              <Input label="Número do cartão" value={cartao} onChange={v => setCartao(fmtCartao(v))} placeholder="0000 0000 0000 0000" />
              <Input label="Nome no cartão" value={titular} onChange={setTitular} placeholder="JOAO DA SILVA" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Validade" value={validade} onChange={v => setValidade(fmtValidade(v))} placeholder="MM/AA" />
                <Input label="CVV" value={cvv} onChange={v => setCvv(v.replace(/\D/g, "").slice(0, 4))} placeholder="123" />
              </div>
            </div>

            {erro && (
              <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-800 rounded-lg p-3">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                {erro}
              </div>
            )}

            <div className="bg-slate-800/40 rounded-lg p-2.5 text-[10px] text-[#475569] flex items-start gap-2">
              <Lock size={11} className="mt-0.5 flex-shrink-0" />
              Dados de pagamento processados com segurança pelo PagBank. Não armazenamos seu cartão.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all"
            >
              {loading ? <><Loader2 className="animate-spin" size={18} />Processando...</> : <><CreditCard size={18} />Confirmar pagamento</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Input helper ──────────────────────────────────────────────────────────────
function Input({
  label, value, onChange, placeholder, type = "text"
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-[#94A3B8] mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#7C3AED] transition-colors"
      />
    </div>
  );
}
