import re, json
from html.parser import HTMLParser
ROOT="/home/claude/jack-in/site/"
ACC=re.compile(r"[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]")
PTW=re.compile(r"\b(você|não|nao|para|com|uma|um|da|do|das|dos|de|na|nas|nos|ou|sua|seu|seus|mesa|carta|cartas|jogar|clique|entrar|sair|criar|sala|baralho|mão|turno|ganhar|instalar|comprar|lixar|pôr|usar|escolha|acessar|quebrar|aqui|pela|pelo|mais|menos|sem|ainda|agora|vez|lado|deck|partida|treino|digital|física|físicas|ligar|desligar|copiar|link|código)\b",re.I)
ENW=re.compile(r"\b(the|you|your|this|that|with|when|install|trash|subroutine|runner's|corp's|access|ice protecting)\b",re.I)
def is_pt(s):
    if not re.search('[A-Za-zÀ-ú]{2}',s): return False
    if ACC.search(s): return True
    if ENW.search(s) and not ACC.search(s): return False
    return len(PTW.findall(s))>=1 and not re.search(r'^[\w.\-]+$',s)
def junk(s):
    return (re.search(r'^(https?:|turn:|[\w.]+@|#|\.|\[)',s) or re.search(r'[{};]\s*$',s) and not '${' in s or s.count('(')>3)
entries={}
def add(seg, kind, f):
    seg=re.sub(r'\s+',' ',seg)
    raw=seg
    seg=seg.strip()
    if len(seg)<2 or not is_pt(seg) or junk(seg): return
    if kind=='js':
        if '${' in seg: k='tpl'
        elif raw!=raw.strip() or re.search(r'[:(,]$|^[),:.]',seg): k='frag'
        else: k='exact'
    else: k='exact'
    e=entries.setdefault(seg,{'kind':k,'files':set()}); e['files'].add(f)
    if k=='exact' and e['kind']!='exact': e['kind']='exact'
class P(HTMLParser):
    def __init__(s,f): super().__init__(convert_charrefs=True); s.f=f; s.skip=0
    def handle_starttag(s,t,a):
        if t in('script','style'): s.skip+=1
        for k,v in a:
            if k in('title','placeholder','aria-label','alt','value') and v: add(v,'html',s.f)
    def handle_endtag(s,t):
        if t in('script','style'): s.skip-=1
    def handle_data(s,d):
        if not s.skip: add(d,'html',s.f)
def jsstrings(src,f):
    for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`", src):
        s=m.group(1) if m.group(1) is not None else (m.group(2) if m.group(2) is not None else (m.group(3) or ''))
        s=s.replace("\\'","'").replace('\\"','"')
        for seg in re.split(r'<[^<>]*>', s):
            # templates: normalize ${...} -> {0},{1}
            add(seg,'js',f)
import sys
groups={'camera':['index.html'],
 'treino':['treino/index.html','treino/mesa.html','treino/sala.html','treino/jkboard.js','treino/jkrun.js','treino/reveal.js','treino/x1.js','treino/physical.js','treino/som.js','treino/decklist.js','treino/jklog.js','treino/version.js'],
 'cartas':['treino/sets/jackin.js','treino/sets/jackin_corp.js','treino/sets/jackin_corp2.js','treino/sets/jackin_corp3.js','treino/sets/jackin_corp4.js','treino/sets/jackin_corp5.js','treino/sets/jackin_runner2.js','treino/sets/jackin_runner3.js','treino/sets/systemupdate2021.js','treino/utility.js','treino/phase.js','treino/ai_corp.js']}
import os
allout={}
for g,files in groups.items():
    entries.clear()
    for f in files:
        if not os.path.exists(ROOT+f): continue
        src=open(ROOT+f,encoding='utf8').read()
        if f.endswith('.html'):
            P(f).feed(src)
            for sc in re.findall(r'<script[^>]*>(.*?)</script>', src, re.S): jsstrings(sc,f)
        else:
            # só comentários fora: remove // e /* */ simples
            src2=re.sub(r'/\*.*?\*/', '', src, flags=re.S)
            src2=re.sub(r'(?m)^\s*//.*$', '', src2)
            jsstrings(src2,f)
    out=[]
    for k,v in entries.items():
        t=k
        if v['kind']=='tpl':
            n=[0]
            def rep(m):
                r='{%d}'%n[0]; n[0]+=1; return r
            t=re.sub(r'\$\{[^}]*\}', rep, k)
        out.append({'pt':t,'kind':v['kind']})
    allout[g]=out
    json.dump(out, open(f'{g}.json','w'), ensure_ascii=False, indent=0)
    print(g, len(out), sum(1 for o in out if o['kind']=='tpl'), sum(1 for o in out if o['kind']=='frag'))
