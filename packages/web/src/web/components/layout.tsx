import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  Upload,
  BookOpen,
  History,
  TrendingUp,
  Brain,
  Swords,
  LayoutDashboard,
  Crown,
  LogOut,
} from "lucide-react";
import { PomodoroSidebar } from "./pomodoro";
import { authClient, clearToken } from "../lib/auth";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [badgeRevisoes, setBadgeRevisoes] = useState(0);

  // Checar revisões pendentes hoje
  useEffect(() => {
    async function checarRevisoes() {
      try {
        const r = await fetch("/api/revisoes/contagem").then(r => r.json());
        setBadgeRevisoes(r.total ?? 0);
      } catch {}
    }
    checarRevisoes();
    const interval = setInterval(checarRevisoes, 60_000); // re-checar a cada minuto
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard", badge: 0 },
    { to: "/nova-analise", icon: Upload, label: "Nova Análise", badge: 0 },
    { to: "/historico", icon: History, label: "Histórico", badge: 0 },
    { to: "/aulas", icon: BookOpen, label: "Aulas", badge: 0 },
    { to: "/revisoes", icon: Brain, label: "Revisões", badge: badgeRevisoes },
    { to: "/simulado", icon: Swords, label: "Simulados", badge: 0 },
    { to: "/planos", icon: Crown, label: "Planos", badge: 0 },
  ];

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#1E293B] border-r border-slate-700 flex flex-col fixed h-full z-10">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1E40AF] rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-[#F59E0B]" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">Pareto</div>
              <div className="text-[10px] text-[#94A3B8] leading-tight">Concursos</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, badge }) => {
            const isActive = location === to || (to !== "/" && location.startsWith(to));
            return (
              <Link key={to} to={to}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${
                    isActive
                      ? "bg-[#1E40AF] text-white font-medium"
                      : "text-[#94A3B8] hover:bg-[#334155] hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                  {badge > 0 && (
                    <span className="bg-[#F59E0B] text-[#0F172A] text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Pomodoro */}
        <PomodoroSidebar />

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 space-y-3">
          <p className="text-xs text-[#475569] text-center">Estude menos, acerte mais.</p>
          <button
            onClick={async () => {
              await authClient.signOut();
              clearToken();
              window.location.href = "/sign-in";
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#94A3B8] hover:bg-[#334155] hover:text-white transition-all"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-60 p-8 min-h-screen">
        {children}
      </main>

    </div>
  );
}
