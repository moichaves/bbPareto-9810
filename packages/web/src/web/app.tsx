import { Route, Switch } from "wouter";
import { Layout } from "./components/layout";
import { ProtectedRoute } from "./components/protected-route";
import DashboardPage from "./pages/dashboard";
import NovaAnalise from "./pages/index";
import AnalisePage from "./pages/analise";
import HistoricoPage from "./pages/historico";
import AulasPage from "./pages/aulas";
import AulasCursoPage from "./pages/aulas-curso";
import RevisoesPage from "./pages/revisoes";
import SimuladoPage from "./pages/simulado";
import PlanosPage from "./pages/planos";
import SignInPage from "./pages/sign-in";

function App() {
  return (
    <Switch>
      <Route path="/sign-in" component={SignInPage} />
      <Route>
        <ProtectedRoute>
          <Layout>
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/nova-analise" component={NovaAnalise} />
              <Route path="/analise/:id" component={AnalisePage} />
              <Route path="/historico" component={HistoricoPage} />
              <Route path="/aulas" component={AulasPage} />
              <Route path="/aulas/:id" component={AulasCursoPage} />
              <Route path="/revisoes" component={RevisoesPage} />
              <Route path="/simulado" component={SimuladoPage} />
              <Route path="/planos" component={PlanosPage} />
              <Route>
                <div className="text-center py-20 text-[#94A3B8]">Página não encontrada.</div>
              </Route>
            </Switch>
          </Layout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

export default App;
