import json, os
data=[]; seen={}
for g in ('camera','treino','cartas'):
    src=json.load(open(g+'.json')); kinds={o['pt']:o['kind'] for o in src}
    p=g+'.en.json'
    if not os.path.exists(p): print('falta', p); continue
    en=json.load(open(p))
    for pt,tr in en.items():
        if not tr or tr==pt: continue
        k=kinds.get(pt,'exact')
        if pt in seen: continue
        seen[pt]=1; data.append([pt,tr,k])
# termos fixos que aparecem montados por código
extra=[["Conecte-se ao Sprawl.","Jack into the Sprawl.","exact"],["Treine nas sombras do Sprawl.","Train in the shadows of the Sprawl.","exact"],["Run sem sucesso","Unsuccessful run","exact"],["Run com sucesso","Successful run","exact"],["Fechar","Close","exact"],
 ["Som","Sound","exact"],["Cliques","Clicks","exact"],["Pontos","Points","exact"],["Créditos","Credits","exact"],["Mão","Hand","exact"],["Mão máx.","Max hand","exact"],
 ["Mão (HQ)","Hand (HQ)","exact"],["Identidade","Identity","exact"],["Poder (ID)","Power (ID)","exact"],["Dano núcleo","Core damage","exact"],["Tags do Runner","Runner tags","exact"],
 ["Sua mão","Your grip","exact"],["Sua mão (HQ)","Your hand (HQ)","exact"],["Mão do Runner","Runner's grip","exact"],["Você ·","You ·","exact"],["mão vazia","empty hand","exact"],
 ["Ver a mesa","View table","exact"],["Ver as cartas","See the cards","exact"],["Ice não rezzada","Unrezzed ice","exact"],["Run iniciada","Run started","exact"],
 ["Chegou ao servidor","Reached the server","exact"],["Desconectar ou seguir","Jack out or continue","exact"],["Acessando cartas","Accessing cards","exact"],
 ["Você desconectou (jack out).","You jacked out.","exact"],["A run terminou sem sucesso.","The run ended unsuccessfully.","exact"],
 ["{0} · Início","{0} · Start","tpl"],["{0} · Ice de fora","{0} · Outer ice","tpl"],["{0} · Ice de dentro","{0} · Inner ice","tpl"],["{0} · Servidor","{0} · Server","tpl"],["{0} · Acesso","{0} · Access","tpl"],
 ["{0} · aproximação","{0} · approach","tpl"],["{0} · encontro","{0} · encounter","tpl"],["{0} · subrotinas disparando","{0} · subroutines firing","tpl"],["{0} · passou","{0} · passed","tpl"],
 ["✓ {0} · passou","✓ {0} · passed","tpl"],["✓ {0}","✓ {0}","tpl"],
 ["Instalar · {0}","Install · {0}","tpl"],["Jogar · {0}","Play · {0}","tpl"],["Rezzar · {0}","Rez · {0}","tpl"],["Usar: {0}","Use: {0}","tpl"],["Instalar em {0}","Install in {0}","tpl"],
 ["Instalar","Install","exact"],["Jogar","Play","exact"],["Rezzar","Rez","exact"],["Avançar · 1¢","Advance · 1¢","exact"],["Pontuar","Score","exact"],["Lixar","Trash","exact"],
 ["Instalar num servidor novo","Install in a new server","exact"],
 ["{0}. Escolha o que fazer com a carta nos botões abaixo.","{0}. Choose what to do with the card using the buttons below.","tpl"],
 ["Você acessou · {0}","You accessed · {0}","tpl"],["Rezzou · {0}","Rezzed · {0}","tpl"],["Jogou · {0}","Played · {0}","tpl"],["Pontuou · {0}","Scored · {0}","tpl"],
 ["Exposta · {0}","Exposed · {0}","tpl"],["Revelou · {0}","Revealed · {0}","tpl"],["Instalou · {0}","Installed · {0}","tpl"],["Roubou · {0}","Stole · {0}","tpl"],
 ["Você acessou","You accessed","exact"],["Rezzou","Rezzed","exact"],["Jogou","Played","exact"],["Pontuou","Scored","exact"],["Exposta","Exposed","exact"],["Revelou","Revealed","exact"],["Instalou","Installed","exact"],["Roubou","Stole","exact"],
 ["A run foi encerrada pela ice {0}: {1}","The run was ended by {0}: {1}","tpl"],
 ["+{0} de força só neste encontro","+{0} strength for this encounter only","tpl"],
 
 ["(fonte: dados oficiais do NetrunnerDB no GitHub).","(source: official NetrunnerDB data on GitHub).","exact"],
 [". Alteração feita: apenas a cor de alguns símbolos. A Null Signal Games não é associada a este site nem o endossa.",". Change made: only the color of some symbols. Null Signal Games is not associated with this site and does not endorse it.","exact"],
 [". Clique na miniatura para trocar; teclas",". Click the thumbnail to switch; keys","exact"],
 [". O oponente vê apenas a sua identidade (que no jogo já é pública). Quando ele clica numa carta da sua mesa, é o seu navegador que compara a imagem com o seu deck e responde qual carta está lá.",". Your opponent only sees your identity (which is already public in the game). When they click a card on your table, your browser compares the image with your deck and answers which card it is.","exact"],
 ["Cartas reveladas pela Corp","Cards revealed by the Corp","exact"],["Como o oponente vai te ver","How your opponent will see you","exact"],
 ["Espelhar (esquerda ↔ direita)","Mirror (left ↔ right)","exact"],["Fechar menu","Close menu","exact"],["Inverter (cima ↕ baixo)","Flip (top ↕ bottom)","exact"],
 ["Ligar ou desligar o seu microfone","Turn your microphone on or off","exact"],["Mesa","Table","exact"],["Recolher o painel","Collapse the panel","exact"],
 ["Tela cheia","Full screen","exact"],["senha","password","exact"],["Agradecimentos","Thanks","exact"],["Colar a minha lista","Paste my list","exact"],
 ["Como funciona","How it works","exact"],["Contra a IA","Against the AI","exact"],["Convidar","Invite","exact"],["Efeitos","Effects","exact"],["Entrar","Join","exact"],
 ["Enviar","Send","exact"],["Feito por Marthos Freitas ·","Made by Marthos Freitas ·","exact"],["Importar","Import","exact"],["Jogadores","Players","exact"],["Ler lista","Read list","exact"],
 ["Liberar todos os microfones","Unmute all microphones","exact"],["Microfone","Microphone","exact"],["Mutar observadores","Mute spectators","exact"],["Sair","Leave","exact"],
 ["Tanto faz","Either","exact"],["Tela cheia e paisagem","Full screen and landscape","exact"],["Treinar contra a","Practice against the","exact"],["Trilha sonora","Soundtrack","exact"],
 ["Turno","Turn","exact"],["contra quem?","against whom?","exact"],["escolhem a mesa;","pick the table;","exact"],["nenhuma","none","exact"],["ou","or","exact"],
 ["⇅ Inverter","⇅ Flip","exact"],["⇋ Espelhar","⇋ Mirror","exact"],["🔒 A lista fica","🔒 The list stays","exact"],["sem câmera","no camera","exact"],
 ["Gire o celular para jogar","Turn your phone sideways to play","exact"],["No celular, a mesa funciona deitada. Dica: trave a rotação depois de girar.","On phones the table works in landscape. Tip: lock rotation after turning.","exact"],
 ["Sair da tela cheia","Exit full screen","exact"],["Registro da partida","Game log","exact"],["Rig do Runner","Runner's rig","exact"],["Subrotinas","Subroutines","exact"],
 ["Outras habilidades","Other abilities","exact"],["Hardware e recursos","Hardware and resources","exact"],["Revelada pelo Runner","Revealed by the Runner","exact"],["Revelada pela Corp","Revealed by the Corp","exact"],
 ["Na mesa","On the table","exact"],["Revelando: {0}","Revealing: {0}","tpl"],["Voltar à run em {0}","Back to the run on {0}","tpl"],["Terminar de quebrar","Done breaking","exact"],
 ["Termina a run.","End the run.","exact"],["Você chegou ao servidor. Agora vem o acesso.","You reached the server. Access comes next.","exact"],["Nenhuma ice pela frente.","No ice ahead.","exact"],["Carta","Card","exact"],["Quebrada","Broken","exact"],["Ativa","Active","exact"],["Disparando","Firing","exact"],["Disparou","Fired","exact"],["Não disparou","Did not fire","exact"],
]
for e in extra:
    if e[0] not in seen: data.append(e)
js="// gerado automaticamente a partir das páginas (pt -> en). Não edite à mão: veja /i18n no repositório.\nvar JKI18N_DATA = "+json.dumps(data,ensure_ascii=False,separators=(',',':'))+";\n"
open('/home/claude/trainer/i18n-data.js','w').write(js)
print(len(data),'entradas', len(js)//1024,'KB')
