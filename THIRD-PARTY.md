# Componentes e dados de terceiros

A [licença MIT](LICENSE) cobre apenas o código escrito para este projeto. Os itens abaixo mantêm as próprias licenças e termos.

## Incluídos no repositório
- **Símbolos de jogo e de facção da Null Signal Games** — [NSG Visual Assets v1.5](https://nullsignal.games/about/nsg-visual-assets/), licença [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/). Embutidos em `site/index.html`. Alteração feita: apenas a cor dos símbolos monocromáticos (para seguir as cores da interface) e a conversão dos símbolos de facção em imagens pequenas. Não são cobertos pela licença MIT e não podem ser redesenhados. A Null Signal Games não é associada a este projeto nem o endossa. Conforme a orientação da NSG, os símbolos só aparecem junto de cartas impressas pela NSG, nunca com arte da Fantasy Flight Games.

## Carregados pelo navegador (não incluídos no repositório)
- **PeerJS** (MIT) — conexão entre os jogadores. Carregado de cdn.jsdelivr.net.
- **Tesseract.js** (Apache-2.0) — leitura do texto das cartas. Carregado de cdn.jsdelivr.net sob demanda.
- **OpenCV.js** (`@techstark/opencv-js`, Apache-2.0) — contorno e comparação das cartas. Carregado de cdn.jsdelivr.net sob demanda.
- **wsrv.nl** — proxy público de imagens, usado só quando o servidor de imagens não libera a leitura dos pixels.
- **NetrunnerDB** — dados das cartas, imagens e decks, pela API pública (netrunnerdb.com) e pela cópia oficial dos dados no GitHub ([netrunner-cards-json](https://github.com/NetrunnerDB/netrunner-cards-json)); imagens em card-images.netrunnerdb.com, com o Jinteki.net como alternativa.
- **Fontes** Chakra Petch e IBM Plex Sans (SIL Open Font License 1.1), via Google Fonts.

## Marcas e imagens das cartas
Netrunner, os nomes e as imagens das cartas pertencem aos seus respectivos detentores de direitos (Null Signal Games, Fantasy Flight Games, Wizards of the Coast). As imagens são exibidas a partir do NetrunnerDB e não fazem parte deste repositório.
