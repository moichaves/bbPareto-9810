import { Hono } from 'hono';
import { cors } from "hono/cors";
import { auth } from "./auth";
import { analiseRoutes } from "./routes/analise";
import { aulasRoutes } from "./routes/aulas";
import { revisoesRoutes } from "./routes/revisoes";
import { simuladoRoutes } from "./routes/simulado";
import { assinaturaRoutes } from "./routes/assinatura";
import { notificacoesRoutes } from "./routes/notificacoes";

const app = new Hono()
  .use(cors({ origin: (origin) => origin ?? "*", credentials: true, exposeHeaders: ["set-auth-token"] }))
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .basePath('api')
  .get('/ping', (c) => c.json({ message: `Pong! ${Date.now()}` }, 200))
  .get('/health', (c) => c.json({ status: 'ok' }, 200))
  .route('/analises', analiseRoutes)
  .route('/aulas', aulasRoutes)
  .route('/revisoes', revisoesRoutes)
  .route('/simulado', simuladoRoutes)
  .route('/assinatura', assinaturaRoutes)
  .route('/notificacoes', notificacoesRoutes);

export type AppType = typeof app;
export default app;
