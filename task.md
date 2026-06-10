# Pareto Concursos — Task Tracker

## Status: Active
Last updated: 2026-06-08

---

## COMPLETED THIS SESSION
- [x] Fixed `aulas.tsx` syntax error (duplicate JSX block from botched edit)
- [x] Removed orphan `aulas-novo.tsx` page + import/route from `app.tsx`
- [x] Confirmed `GET /api/analises` exists → `novoCurso()` button works
- [x] Confirmed `?aulaId=` deep-link already in dashboard + aulas-curso.tsx reads it
- [x] Fixed `POST /cursos/:id/gerar` to delete existing aulas before regenerating (prevent duplicates)
- [x] Reset stuck curso 6 `gerando_status` → `pendente`, deleted 19 stale aulas
- [x] Retriggered generation for curso 6 (30 aulas expected, ~2s each + rate limit delays)

## IN PROGRESS
- [ ] Curso 6 generation: 0/30 aulas done (running, rate-limited — 60s waits on free tier)

## PENDING
- [ ] Test full quiz flow once aulas finish + revision is scheduled (manual test)
- [ ] Verify "Novo Curso" one-click button works end-to-end in browser

## KNOWN ISSUES
- Gemini free tier: 60s+ waits between retries on rate limit. Generation of 30 aulas takes ~10-20 min.

## ARCHITECTURE NOTES
- DB tables: analises, assuntos, planos_estudo, aulas, cursos_aula, revisoes
- cursos_aula: gerando_status (pendente/gerando/concluido/erro), total_aulas_geradas
- Generation: fire-and-forget background task, dies on server restart
- If server restarts mid-generation: reset status to pendente, DELETE aulas WHERE curso_id=X, POST /api/aulas/cursos/X/gerar
- Model: gemini-2.5-flash-lite
- Dev server: tmux session "dev", port 4200
