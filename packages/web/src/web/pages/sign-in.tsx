import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { BookOpen, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { authClient, captureToken } from "../lib/auth";

type Tab = "login" | "cadastro";
type View = "auth" | "forgot" | "forgot-sent" | "reset-password";

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("login");
  const [view, setView] = useState<View>("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState("");

  // Detectar token de reset na URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const type = params.get("type") ?? params.get("callbackURL");
    if (token) {
      setResetToken(token);
      setView("reset-password");
    }
  }, []);

  function reset() {
    setError("");
    setName("");
    setEmail("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  // Login / Cadastro
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "cadastro") {
        const { error } = await authClient.signUp.email(
          { name, email, password },
          { onSuccess: captureToken }
        );
        if (error) { setError(error.message ?? "Erro ao criar conta"); setLoading(false); return; }
      } else {
        const { error } = await authClient.signIn.email(
          { email, password },
          { onSuccess: captureToken }
        );
        if (error) { setError("Email ou senha inválidos"); setLoading(false); return; }
      }
      setLocation("/");
    } catch {
      setError("Ocorreu um erro. Tente novamente.");
    }
    setLoading(false);
  }

  // Esqueci senha — enviar email
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authClient.forgetPassword({
        email,
        redirectTo: `${window.location.origin}/sign-in`,
      });
      setView("forgot-sent");
    } catch {
      setError("Erro ao enviar email. Tente novamente.");
    }
    setLoading(false);
  }

  // Redefinir senha com token
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword,
        token: resetToken,
      });
      if (error) { setError(error.message ?? "Erro ao redefinir senha"); setLoading(false); return; }
      // Sucesso — redireciona para login
      reset();
      setView("auth");
      setTab("login");
      setError("");
      alert("Senha redefinida com sucesso! Faça login.");
    } catch {
      setError("Erro ao redefinir senha. O link pode ter expirado.");
    }
    setLoading(false);
  }

  const inputClass = "w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-white placeholder-[#475569] focus:outline-none focus:border-violet-500 transition-colors";
  const btnClass = "w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2";

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Pareto Concursos</span>
        </div>

        <div className="bg-[#1E293B] rounded-2xl p-8 border border-[#334155]">

          {/* ── VIEW: Login / Cadastro ── */}
          {view === "auth" && (
            <>
              <div className="flex bg-[#0F172A] rounded-xl p-1 mb-6">
                {(["login", "cadastro"] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setError(""); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tab === t ? "bg-violet-600 text-white" : "text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    {t === "login" ? "Entrar" : "Criar conta"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {tab === "cadastro" && (
                  <div>
                    <label className="block text-sm text-[#94A3B8] mb-1.5">Nome completo</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Seu nome" required className={inputClass} />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com" required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-1.5">Senha</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres" required minLength={8} className={inputClass} />
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
                )}

                <button type="submit" disabled={loading} className={btnClass}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {tab === "login" ? "Entrar" : "Criar conta"}
                </button>

                {tab === "login" && (
                  <button
                    type="button"
                    onClick={() => { reset(); setView("forgot"); }}
                    className="w-full text-center text-sm text-[#475569] hover:text-violet-400 transition-colors mt-1"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </form>
            </>
          )}

          {/* ── VIEW: Esqueci senha ── */}
          {view === "forgot" && (
            <>
              <button
                onClick={() => { reset(); setView("auth"); }}
                className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-white mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
              <h2 className="text-lg font-semibold text-white mb-2">Recuperar senha</h2>
              <p className="text-sm text-[#94A3B8] mb-6">
                Informe seu email e enviaremos um link para redefinir sua senha.
              </p>
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com" required className={inputClass} />
                </div>
                {error && (
                  <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
                )}
                <button type="submit" disabled={loading} className={btnClass}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enviar link de recuperação
                </button>
              </form>
            </>
          )}

          {/* ── VIEW: Email enviado ── */}
          {view === "forgot-sent" && (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Email enviado!</h2>
              <p className="text-sm text-[#94A3B8] mb-6">
                Verifique sua caixa de entrada em <strong className="text-white">{email}</strong>.
                O link expira em 1 hora.
              </p>
              <button
                onClick={() => { reset(); setView("auth"); }}
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Voltar ao login
              </button>
            </div>
          )}

          {/* ── VIEW: Redefinir senha ── */}
          {view === "reset-password" && (
            <>
              <h2 className="text-lg font-semibold text-white mb-2">Nova senha</h2>
              <p className="text-sm text-[#94A3B8] mb-6">Escolha uma nova senha para sua conta.</p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-1.5">Nova senha</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres" required minLength={8} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-1.5">Confirmar senha</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha" required minLength={8} className={inputClass} />
                </div>
                {error && (
                  <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
                )}
                <button type="submit" disabled={loading} className={btnClass}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Redefinir senha
                </button>
              </form>
            </>
          )}

        </div>

        <p className="text-center text-[#475569] text-xs mt-6">
          Estude o que importa. Passe no concurso.
        </p>
      </div>
    </div>
  );
}
