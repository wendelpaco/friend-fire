# Sprint 1 · Entrega 5 — Lobby + loading premium

**Prompt Claude Code** — colar como tarefa única. Última entrega do Sprint 1 (polish de produto).

---

## Contexto

Locks: sem contas/login, sem matchmaking público.

Arquivos âncora:

- Lobby: `src/presentation/lobby/MainMenu.tsx`, `RoomPanel.tsx`, `CopyInviteLink.tsx`, `ServerBrowser.tsx`  
- Invite/codes: `src/domains/session/invite.ts`, `codes.ts`  
- Loading: `src/presentation/session/MatchLoadingScreen.tsx`  
- Splash: `src/presentation/session/SplashScreen.tsx`  
- Operator: `src/presentation/session/OperatorSelect.tsx`  
- Ping/region: `src/infrastructure/realtime/ping.ts`, room client  
- Design tokens: `src/app/design-tokens.css`  
- Git City lessons: craft C9/C10 do design v2  

**Objetivo:** primeira impressão nível Git City — time-to-first-shot path limpo.

## Trabalho

### 1. Código da sala como herói

- Campo **CÓDIGO DA SALA** grande, mono tabular, **autofocus**.  
- Colar-automático do clipboard se o conteúdo for código válido (padrão de `codes.ts`).  
- Deep link `?sala=CODIGO` (ou query já existente) preenche e destaca o campo (pulso âmbar 1×).  
- **CRIAR SALA** = CTA primary; **ENTRAR** = secondary.  
- Botão **COPIAR CONVITE** com deep link completo (`CopyInviteLink` — reforçar UX).

### 2. Chip de região com ping vivo

- Chip tipo `BR · 46ms` clicável → modal de região existente (padrão de modal referência).  
- Ping atualiza periodicamente (não estático).  
- Não inventar UI SaaS; seguir tokens FF.

### 3. Presença online real (ou honesta)

- Se houver contador de jogadores no server/Colyseus presence: exibir “N jogando agora”.  
- Se **não** houver backend: ou implementar contagem mínima via room listing **ou** omitir o número falso — **nunca** inventar “342” estático. Preferir “Sala privada · bots preenchem” se zero data.

### 4. Loading com progresso real

- Manter arte cinematográfica (logo + operador + scanlines) — **não** redesenhar direção.  
- Trocar spinner por **barra de progresso real** (assets carregados / total ou etapas ponderadas).  
- Etapas nomeadas: `Conectando à sala` · `Carregando mapa` · `Sincronizando`.  
- 1 dica tática rotativa, 1 linha (ex. “Parado, seu primeiro tiro é perfeito.”).

### 5. Qualidade / som no rodapé do lobby

- Toggle Baixa/Média/Alta se já existir em prefs (`src/domains/prefs/quality*`) — expor no lobby de forma discreta.  
- Volume já existe em MainMenu — alinhar visual aos tokens.

### 6. Segurança de códigos (G3, se touch)

- Se tocar join: rate-limit client-side debounce; server já deve validar ≥6 alfanum — não enfraquecer.

## Não fazer

- Contas / login / OAuth  
- Matchmaking público (ServerBrowser pode permanecer experimental, mas não é o herói)  
- Ads novos no lobby além do que já existe  
- Redesign total do MainMenu do zero — **evoluir** o herói (código) e hierarquia  

## Acceptance criteria

- [ ] Código da sala é o herói: autofocus + colar-automático de código válido  
- [ ] Deep link preenche código  
- [ ] Convite copiável com deep link  
- [ ] Progresso real no loading + etapas nomeadas  
- [ ] Chip região com ping vivo  
- [ ] Presença: real ou omitida — nunca fake estático  
- [ ] Sem login/matchmaking público novo  

## Verificação

```bash
bun test src/domains/session
bun run build  # sanity Next
```

Playtest: abrir `/?sala=XXXXXX` → campo preenchido → entrar → loading com etapas → warmup <30s first shot path.

---

## Após fechar as 5 entregas

- Rodar suite completa de testes client (+ server).  
- Checklist visual: craft anti-padrões C11 (sem banner persistente, vermelho só crítico, zona central livre).  
- Não iniciar Sprint 2 (vision cone) sem playtest de craft do Sprint 1.
