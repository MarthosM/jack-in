# Jack In Treino

Netrunner contra a IA ou contra outra pessoa, de Runner ou de Corp, com cartas digitais ou com as cartas físicas na mão.
Publicado em https://jack-in.netlify.app/treino/ (página inicial `index.html`; a mesa é `mesa.html`; quem entra numa sala de outra pessoa usa `sala.html`).

Derivado do motor [Chiriboga](https://github.com/bobtheuberfish/chiriboga), de bobtheuberfish. Por isso esta pasta
inteira está sob a **GPL-3.0** (arquivo `LICENSE`), diferente do restante do repositório (MIT).

- Arquivos do Chiriboga (regras, IA, cartas): `init.js`, `phase.js`, `command.js`, `checks.js`, `mechanics.js`, `utility.js`, `runcalculator.js`, `ai_corp.js`, `ai_runner.js`, `decks.js`, `sets/systemgateway.js`, `sets/systemupdate2021.js`, `sets/midnightsun.js`, `sets/tutorial.js`, `cardrenderer/`, `deck/`, `jquery/`, `images/`, `style.css`.
- Adições do Jack In: `index.html` (abertura e configuração), `physical.js`/`physical.css` (modo de cartas físicas), `jkboard.js`/`jkboard.css` (mesa visual), `reveal.js` (painel do que a IA revelou), `jklog.js` (registro), `x1.js`/`sala.html` (partida entre duas pessoas: o anfitrião roda o motor, o convidado recebe só a visão dele; rede e voz por PeerJS, em `deck/peerjs.min.js`, MIT), `decklist.js` (leitura da lista), `cards.json` (nomes para ler a lista do NetrunnerDB) e `sets/jackin*.js` (cartas programadas para os decks usados no treino).

Projeto de fã, sem fins comerciais. Netrunner é marca de seus respectivos donos.
