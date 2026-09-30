# Jack In — arquitetura (v2.2, set/2026)

Mesa online de **Netrunner** com cartas físicas e câmeras. Projeto irmão do **The Elysium** (VTES), mas **totalmente separado**: pasta, site no Netlify, prefixo de rede e armazenamento próprios.

## Pastas no projeto (não misturar)
- VTES / The Elysium: `claude/site/index.html` + `claude/arquitetura-mesa-vtes.md`
- Netrunner / Jack In: `netrunner/site/index.html` + `netrunner/arquitetura-mesa-netrunner.md`
- Toda sessão sobre Netrunner parte de `netrunner/site/index.html`, edita, sobe o `APP_VERSION` e salva de volta **na pasta netrunner**.

## Hospedagem
- **Site próprio no Netlify Drop**, diferente do The Elysium. Primeira publicação: arrastar a pasta `jack-in/` (com o `index.html`) em app.netlify.com/drop, o que cria um endereço novo.
- Atualizações: Netlify → site **Jack In** → Deploys → arrastar a pasta. Conferir o nome do site antes de soltar, para não sobrescrever o The Elysium.
- `APP_VERSION` aparece no lobby; mudanças nas mensagens entre navegadores exigem que os dois jogadores recarreguem.

## Separação técnica em relação ao The Elysium
- ID do anfitrião no PeerJS: `jack-in-netrunner-<CÓDIGO>` (VTES usa `the-elysium-vtes-`). Um código de mesa de um nunca abre no outro.
- localStorage com prefixo `jackin.` (nome, lado, deck, orientação, TURN, tamanho de carta).

## Mesa
- 2 jogadores (Corporação × Runner), vídeo direto entre os dois (PeerJS/WebRTC). O anfitrião guarda o estado oficial.
- Lado escolhido no lobby (Tanto faz / Corporação / Runner); ajustável na aba Mesa antes de começar. "Trocar de lado" encerra a partida e inverte os lados (a segunda partida da rodada).
- Layout: duas mesas lado a lado; modo foco (⤢, teclas 1–2, Esc) e tela cheia (⛶).

## Links, observadores e microfones (v1.4)
- **Links:** (v1.6) botões "🔗 Link de jogador" e "👁 Link de observador" sempre visíveis na barra do topo; se o navegador não deixar copiar, o link aparece numa janela para copiar à mão. Clicar no código da mesa também abre um menu com "Copiar link de jogador" (`#CÓDIGO`) e "Copiar link de observador" (`#CÓDIGO-OBS`); os mesmos botões ficam na aba Mesa. Quem abre por link vê só a opção de entrar (jogador) ou assistir (observador); o botão de criar mesa fica escondido.
- **Observadores:** até 4 (`MAX_OBS`), em `state.obs` (não ocupam lugar de jogador). Não enviam vídeo; veem as duas mesas, placar e registro; podem identificar cartas, conversar no chat e falar. O anfitrião ignora deles qualquer ação que não seja `chat`, `reveal` ou `micInfo`. Na interface, os controles de jogo e a aba Deck ficam escondidos (`body.obs`). Microfone do observador é opcional ("Entrar com o microfone aberto", lembrado em `jackin.obsMic`).
- **Chamadas:** o jogador liga para o observador (a oferta sai de quem tem vídeo); entre iguais, o menor id liga. As chamadas pedem recebimento de áudio e vídeo.
- **Mute do anfitrião:** ação `hostMute` (por pessoa, nas mesas e na lista "Pessoas e microfones"), `muteObs` e `unmuteAll`. É aplicado em dois lados: o microfone da pessoa é desligado no navegador dela (botão travado em "Mutado pelo anfitrião") e todos os outros silenciam o áudio dela localmente.
- **Barra de observadores (v1.7):** acima das mesas (também em tela cheia), aparece quando há observadores: nome, estado do microfone (🎤 ligado, 🔕 desligado pela pessoa, 🔇 mutado pelo anfitrião, — sem microfone) e brilho verde enquanto a pessoa fala (nível medido pelo áudio recebido). Para o anfitrião: 🔇/🔈 mutar ou liberar cada um, ✕ remover, e "Mutar todos" / "Liberar todos" (`muteObs` / `unmuteObs`). Entrada e saída de observadores geram aviso na tela.
- **Remover:** ✕ do anfitrião remove jogador ou observador (`{t:'kicked'}`, volta ao lobby com aviso).
- **Estado do microfone de cada um:** cada navegador envia `micInfo` (on / off / none); a lista mostra 🎤, 🔇 ou "sem microfone", para o anfitrião achar quem está com problema.

### Correções de microfone
- A conexão sempre é criada com uma trilha de áudio: se o microfone falhar, entra uma trilha silenciosa. Depois, ligar o microfone só troca a trilha (`replaceTrack`), sem refazer a conexão. Antes, quem entrava sem microfone nunca mais era ouvido.
- Microfone salvo que sumiu: tenta o escolhido e, se falhar, o padrão. Microfone desconectado no meio do jogo: reconecta sozinho.
- Mensagens específicas: bloqueado pelo navegador, não encontrado, em uso por outro programa.
- Painel **⚙ Áudio** durante o jogo: trocar microfone e saída de som (onde o navegador permite), medidor de nível, "Reiniciar áudio" e dicas. No lobby também há medidor e saída de som.
- Se o navegador bloquear o som automático, aparece o botão "Clique aqui para ativar o som da mesa".
- `autoGainControl` ligado, junto com cancelamento de eco e supressão de ruído.

## Layout (v1.5)
- **Painel lateral recolhível:** ⟫ na barra de abas recolhe; "⟪ Painel" (na borda direita) reabre. A borda esquerda do painel pode ser arrastada (260–760 px). Largura e estado ficam salvos (`jackin.sideW`, `jackin.sideClosed`). Com o painel recolhido ou em tela cheia, o resultado da identificação aparece num aviso com a imagem da carta.
- **Tela cheia (⛶):** coloca em tela cheia a área das mesas (não só um vídeo): a mesa escolhida grande, a outra em miniatura e, no topo, o placar dos dois jogadores (cliques, créditos, mão, pontos, tags etc.), que também aceita cliques. Avisos e revelações aparecem dentro da tela cheia. Ao sair, volta ao layout anterior.

## Logo e símbolos (v2.1)
- **Logo do Jack In:** nuca em curva com porta, plugue encaixado, circuitos acendendo e pulso no cabo (desenho próprio, não derivado da NSG). No lobby e nas telas vazias (`#i-logo`); ícone da aba com traços mais grossos, fundo escuro e enquadramento mais fechado (data URI SVG).
- **Símbolos da Null Signal Games** (NSG Visual Assets v1.5, licença CC BY-ND 4.0):
  - Convertidos do pacote para `<symbol>` na página (ids `g-click`, `g-credit`, `g-rcredit`, `g-agenda`, `g-tag`, `g-core`, `g-bp`, `g-link`, `g-mu`, `g-sub`, `g-trash`, `g-interrupt`, `g-hq`, `g-rd`, `g-arch`, `g-virus`). Desenho intacto; a única alteração é a cor dos símbolos pretos, que passam a usar a cor da interface. Tag, dano central, má publicidade e vírus mantêm as cores originais. A regra de preenchimento original (`fill-rule:evenodd`) é mantida para não perder os recortes internos. Estilos internos (`.cls-N`) viram estilo por elemento, para não colidir entre símbolos.
  - Facções (HB, Jinteki, NBN, Weyland, Anarch, Criminal, Shaper, Adam, Apex, Sunny) como imagens PNG de 80 px embutidas (`FACTION_IMG`), porque o SVG da HB tem 3,9 MB.
  - **Onde aparecem sempre (controles da interface):** bolinhas e botão de clique, aviso "1º clique", contadores (crédito, agenda, tag, dano central, má publicidade, link), custos das ações básicas, registro (◷ e N¢ viram símbolos), botões de corrida (HQ, P&D, Arquivos).
  - **Onde só aparecem com cartas impressas pela NSG** (`isNSGPrint`: coleção de Downfall, mar/2019, em diante, exceto Magnum Opus Reprint e System Core 2019, que no NetrunnerDB usam imagens da FFG): símbolos no texto da carta ([click], [credit], [subroutine]…), símbolo de facção na ficha da carta e na identidade do jogador. Em cartas da FFG o texto usa os caracteres neutros de antes. Motivo: a regra 1 da NSG pede para não misturar os símbolos deles com arte da FFG.
  - Crédito na aba Créditos, com link para a página dos recursos e para a licença, indicando a alteração (cor) e que a NSG não é associada nem endossa o site.
  - Pacote original guardado fora do site; para atualizar os símbolos, rodar de novo a conversão a partir dos SVGs.

## Botão de clique (v2.0)
- A primeira linha do painel de cada jogador é dividida em três: à esquerda nome, lado e etiquetas; **no centro, o botão "◷ Clique" (tamanho médio, na cor do lado) com o contador restantes/total**, e ao lado o botão menor **"↩ Voltar"** (devolve o último clique do turno); à direita os ícones de maximizar, tela cheia, câmera e anfitrião. Em mesas estreitas o botão desce para uma linha própria, centralizado.
- Cada toque em "Clique" gasta 1 clique e mostra o aviso "1º clique", "2º clique"… para todos. Quando os cliques acabam, o botão vira "Passar a vez ➜" (com "↩ Voltar" ao lado, caso tenha sido engano).
- O botão fica apagado fora da vez do jogador e desativado sem cliques; observadores não veem esses botões. Também aparece no placar da tela cheia.

## Aviso de clique (v1.9)
- Cada clique gasto no turno aparece em destaque sobre o vídeo de quem joga, para todos (jogadores e observadores): "1º clique", "2º clique"… (ou "2º a 4º cliques" quando vários de uma vez), a ação quando houver ("Ganhar 1 crédito", "Corrida em P&D"), quantos restam e bolinhas com o clique atual destacado. No último: "último clique: passe a vez".
- No início de cada turno: "Turno de <nome> · Corporação/Runner · N cliques". Devolver um clique (tocar numa bolinha apagada) mostra "Clique devolvido" e ajusta a contagem.
- Vale para qualquer forma de gastar: bolinhas no painel da mesa, placar da tela cheia, ações básicas e corrida. O anfitrião registra `state.clickNo` (cliques gastos no turno) e `state.lastClick`; cada navegador mostra o aviso quando `lastClick.ts` muda (ao entrar numa mesa em andamento, o último aviso não é repetido).
- Sem cliques, aparece "Passar a vez ➜" pulsando no painel do jogador da vez (não precisa abrir a aba Mesa).
- Som curto opcional ao gastar clique (duas notas no início do turno e no último clique), ligado por padrão; desliga em ⚙ Áudio (`jackin.clickSound`).

## Visual (v1.9)
- Símbolo do Jack In: plugue P10 (mono, 1/4") inclinado.
- Removidas do lobby a frase sob a barra do microfone ("Fale algo…") e a instrução sobre apontar a câmera; o texto sob a barra só aparece quando há problema (sem microfone, mutado).

## Estado e marcadores
- Por jogador: créditos (começa com 5), **cartas na mão** (começa com 5), pontos de agenda, cliques, identidade.
- Mão (v1.5): comprar +1; instalar e jogar operação/evento −1; compra obrigatória da Corporação +1 automaticamente no início de cada turno dela (menos o primeiro). Ao lado, o máximo de mão (5, menos o dano central do Runner); se passar, o chip fica vermelho com "descartar N".
- Corporação: má publicidade. Runner: tags, dano central (mostra mão máx. = 5 − dano), link (começa com o link da identidade).
- **Cliques:** bolinhas no rodapé de cada mesa e grandes na aba Mesa. Tocar numa bolinha acesa gasta até ela; numa apagada, devolve. "+" dá clique extra (bolinha tracejada). No início do turno: Corporação 3, Runner 4; o jogador que sai fica com 0.
- **Turnos/fases:** Corporação: Compra → Ações → Descarte. Runner: Ações → Descarte. A Corporação começa (sem compra no 1º turno).
- **Ações básicas** do jogador da vez gastam cliques e ajustam créditos/tags automaticamente (ganhar crédito, comprar, instalar, operação/evento, avançar 1¢, descartar recurso 2¢, expurgar 3 cliques, remover tag 2¢).
- **Corrida:** HQ, P&D, Arquivos ou Remoto N; gasta 1 clique (grátis se não houver cliques, para corridas de eventos); fecha como bem-sucedida ou encerrada. Tudo vai para o Registro.
- Vitória automática com 7 pontos de agenda.

## Cartas (NetrunnerDB)
- Banco: `GET https://netrunnerdb.com/api/2.0/public/cards` (+ `/packs`). Se falhar (bloqueio do navegador ou fora do ar em 12 s), usa a cópia oficial dos dados no GitHub: `raw.githubusercontent.com/NetrunnerDB/netrunner-cards-json/master/packs.json` + `pack/<código>.json` (liberada para navegadores). Reimpressões agrupadas pelo título; a mais nova aparece primeiro.
- Imagens: o endereço mudou ao longo do tempo, então cada imagem tenta em sequência `card-images.netrunnerdb.com/v2/large/{code}.jpg`, `v1/large/{code}.jpg`, `v2/large/{code}.webp`, `v2/xlarge/{code}.webp`, `v2/medium/{code}.jpg` e os endereços antigos do site. O formato que funcionar fica memorizado (`jackin.imgPref`) e passa a ser o primeiro. (v1.2) A página não envia o endereço de origem (`referrer`) ao servidor de imagens, para evitar bloqueio de hotlink; ao abrir, testa os formatos com uma carta conhecida e mostra no lobby qual fonte funcionou ("Imagens: …"). Última alternativa: `jinteki.net/img/cards/en/default/stock/{code}.png`.
- Texto das cartas: símbolos `[click]`, `[credit]`, `[subroutine]`, `[trash]` etc. convertidos em ◷ ¢ ↳ 🗑.
- Texto exportado do NetrunnerDB (v1.1): primeira linha = nome do deck; identidade sem número; cabeçalhos de seção ("Agenda (9)", "Sentry (8)") e linhas de resumo ("influence spent", "agenda points", "cards (min", "Deck built on") são ignorados; bolinhas de influência (●) removidas. Testado com uma lista real de 45 cartas + identidade: 100% reconhecida.
- Deck: link do NetrunnerDB (`/decklist/<id>` publicado ou `/deck/view/<id>` compartilhado) via `/api/2.0/public/decklist/<id>` ou `/deck/<id>`; ou texto colado ("3x Nome", "3 Nome", "Nome x3", identidade sem número).
- Privacidade: lista só no navegador; o oponente vê apenas a identidade (pública no jogo) e que existe um deck.

## ICE deitada (v1.8)
- Quando o contorno encontrado está deitado (lado maior na horizontal), além da versão "em pé" (usada na comparação por imagem), a carta também é desentortada **deitada, do jeito que aparece na mesa** (754×540, `det.land`). O dono da mesa envia essa versão junto (`land`, `lying`).
- A leitura do nome começa pela carta deitada: faixa do nome no topo (e virada 180°, para ICE vista do outro lado) e a carta inteira. Só depois tenta as leituras da carta em pé.
- Carta deitada recebe preferência para ICE (+0,12 na pontuação), porque carta deitada na mesa quase sempre é ICE instalada. Vale também na busca restrita ao deck.
- Sem contorno, o recorte deitado ao redor do clique é lido como está, antes dos recortes girados.
- Imagens de referência que vierem deitadas são giradas (não esticadas) para a comparação por imagem.
- Na tela da identificação aparece a etiqueta "deitada".

## Identificação só no deck do jogador (v1.5)
- Se o dono da mesa carregou o deck, a busca fica **só nas cartas do deck dele**. O navegador do dono compara a imagem com todas as cartas do deck (ORB) e, se não tiver certeza, lê o nome (OCR) filtrando apenas os títulos do deck (`scoreGroups(..., allow)`), devolvendo no máximo 3 nomes (`reply.deckOnly`, `reply.texts`). Quem clicou confere esses nomes pela imagem oficial. Prazo de resposta: 25 s quando o dono tem deck (9 s sem deck).
- Na própria mesa, com deck carregado, vale a mesma restrição.
- Sem deck carregado (ou sem resposta do dono), a busca continua em todas as cartas, e a tela mostra a etiqueta "todas as cartas" em vez de "só o deck".

## Identificação de cartas (v1.3: a imagem decide, o texto só sugere)
1. Clique/arraste → o navegador do dono da mesa acha o contorno (OpenCV.js), corrige a perspectiva (540×754) e, se tiver deck, compara com as assinaturas ORB do deck (inliers da homografia RANSAC ≥ 20 e ≥ 2× o ruído). Resultado forte → fim, sem OCR.
2. **Cartas já vistas nesta mesa** (e a identidade do jogador): comparação só por imagem, antes de qualquer leitura de texto. A lista cresce quando uma carta é reconhecida pela imagem ou quando o jogador escolhe uma candidata (memória da sessão, por nome do jogador, até 30 cartas).
3. Se ainda não reconheceu: OCR do nome → as 8 melhores candidatas por texto são **conferidas pela imagem oficial** (impressão mais nova e a anterior). Aceita quando inliers ≥ 18 e ≥ 2× o 2º colocado; candidatas cuja imagem não bate (< 12) são rebaixadas. Cada passada extra de OCR (cabeça para baixo, carta inteira, girada 90°/270° para ICE) só acontece se a imagem ainda não confirmou.
4. Imagens de referência: lidas direto do NetrunnerDB; se o servidor não liberar a leitura de pixels (CORS), passam pelo proxy público **wsrv.nl**. O caminho que funcionou fica memorizado (`jackin.pixelVia`). Assinaturas ficam em memória (até 160 cartas).
5. Sem nenhuma imagem de referência disponível, o resultado é só pelo texto, e isso aparece na tela.

## Limitações / próximos passos
- Não testado ainda com cartas reais nem entre duas máquinas; a leitura de pixels das imagens do NetrunnerDB depende de CORS (se bloqueada, cai para o reconhecimento pelo nome).
- Sem o banco do NetrunnerDB carregado, a busca e o OCR ficam indisponíveis (não há API de busca por nome como a da KRCG).
- Cartas da Corporação instaladas viradas para baixo não podem ser identificadas (é o esperado).
- Ideias: espectadores; contadores em cartas (avanço, vírus, poder); sorteio de quem começa na rodada; migração de anfitrião.

## Publicação pelo GitHub (a partir da v2.2)
- Repositório: https://github.com/MarthosM/jack-in (licença MIT, código de conduta, README e THIRD-PARTY.md na raiz).
- O Netlify fica ligado ao repositório: cada commit na branch `main` gera um deploy de produção. O `netlify.toml` publica a pasta `site/`, sem etapa de build.
- Para economizar créditos do Netlify, juntar várias mudanças num commit só; testes podem ir para outra branch (prévias de deploy não gastam créditos).
- O rodapé do lobby traz os links exigidos pelo plano Open Source do Netlify: licença, código-fonte, código de conduta e "This site is powered by Netlify".
