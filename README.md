# Jack In

Mesa online de **Netrunner** para jogar com **cartas físicas e câmeras**. Cada jogador aponta a câmera para a própria área de jogo; a plataforma cuida da conexão de vídeo e áudio, do placar (cliques, créditos, cartas na mão, pontos de agenda, tags…), dos turnos e da **identificação das cartas** clicando nelas no vídeo.

**Site:** https://jack-in.netlify.app · **Projeto irmão:** [The Elysium](https://github.com/MarthosM/the-elysium) (Vampire: The Eternal Struggle)

## Recursos
- Vídeo e áudio direto entre os jogadores (WebRTC, via PeerJS), sem servidor próprio: o navegador de quem cria a mesa guarda o estado da partida.
- Corporação × Runner, com botão de clique e aviso "1º clique", placar completo, ações básicas e registro de corridas.
- Identificação de cartas por imagem (OpenCV.js) e por texto (Tesseract.js), restrita ao deck do jogador quando ele carrega a lista do NetrunnerDB; ICE reconhecida deitada.
- Observadores com microfone opcional, controlados pelo anfitrião (mutar e remover).
- Painel lateral recolhível, tela cheia com o placar dos dois jogadores.

## Como rodar
É uma página única, sem etapa de build: abra `site/index.html` no navegador (Chrome, Edge ou Firefox) ou publique a pasta `site/` em qualquer hospedagem estática. No Netlify, o arquivo `netlify.toml` já aponta para `site/`.

Detalhes técnicos: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Contribuindo
Sugestões, relatos de erro e pull requests são bem-vindos. Abra uma issue descrevendo o problema ou a ideia. Todas as interações seguem o [Código de conduta](CODE_OF_CONDUCT.md).

## Licença
O código deste projeto está sob a [licença MIT](LICENSE). Partes de terceiros mantêm as próprias licenças; veja [THIRD-PARTY.md](THIRD-PARTY.md). Em especial, os **símbolos de jogo e de facção da Null Signal Games** embutidos em `site/index.html` continuam sob **CC BY-ND 4.0** e **não** são cobertos pela licença MIT.

Projeto de fãs, gratuito e sem fins lucrativos. Não é afiliado à Null Signal Games, à Fantasy Flight Games nem à Wizards of the Coast.

---

## English summary
**Jack In** is a free, open-source web table for playing **Netrunner** with **physical cards over webcams**. It handles peer-to-peer video/audio (WebRTC via PeerJS), the game state (clicks, credits, hand size, agenda points, tags, turns), spectators with host moderation, and **card identification** by clicking a card in the video (OpenCV.js image matching + Tesseract.js OCR, restricted to the player's NetrunnerDB decklist). It is a single static page with no build step (`site/index.html`).

Code: MIT License. Third-party assets keep their own licenses (see THIRD-PARTY.md); Null Signal Games symbols are CC BY-ND 4.0. Contributions are welcome under our [Code of Conduct](CODE_OF_CONDUCT.md). Non-commercial fan project, not affiliated with Null Signal Games, Fantasy Flight Games or Wizards of the Coast.
