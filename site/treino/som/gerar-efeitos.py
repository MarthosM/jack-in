# Jack In Treino — efeitos sonoros (sintetizados do zero, mesma estética da trilha)
import numpy as np, subprocess, os
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sfx")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(11)

def t_(s): return np.arange(int(s * SR)) / SR
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def filt(x, kind, f):
    if kind == "band": sos = butter(2, [f[0] / (SR / 2), f[1] / (SR / 2)], btype="band", output="sos")
    else: sos = butter(2, f / (SR / 2), btype=kind, output="sos")
    return sosfilt(sos, x)
def expd(t, k): return np.exp(-t * k)
def sine(f, t): return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape)) / SR)
def sq(f, t): return np.sign(sine(f, t)) * 0.6
def saw(f, t):
    ph = np.cumsum(np.broadcast_to(f, t.shape)) / SR
    return 2 * (ph - np.floor(ph + 0.5))
def noise(n): return rng.standard_normal(n)
def echo(x, d=0.11, g=0.35, n=3):
    out = np.concatenate([x, np.zeros(int(d * SR * n) + 1)])
    for k in range(1, n + 1):
        i = int(d * SR * k); out[i:i + len(x)] += x * (g ** k)
    return out
def seq(*parts):
    # junta pedaços com sobreposição: (sinal, início em s)
    end = max(int(at * SR) + len(s) for s, at in parts)
    out = np.zeros(end)
    for s, at in parts:
        i = int(at * SR); out[i:i + len(s)] += s
    return out

def save(name, x, vol=0.7):
    # volume parecido entre os efeitos: RMS alvo (os de interface mais baixos) e pico máximo
    quiet = name in ("clique", "comprar", "credito", "acessar", "turno")
    target = 10 ** ((-26 if quiet else -21) / 20)
    rms = np.sqrt(np.mean(x ** 2)) or 1
    x = x / rms * target
    pk = np.max(np.abs(x))
    if pk > 0.9: x = x / pk * 0.9
    fade = min(len(x), int(0.01 * SR)); x[-fade:] *= np.linspace(1, 0, fade)
    st = np.stack([x, np.concatenate([np.zeros(200), x[:-200]])], axis=1)
    wav = os.path.join(OUT, name + ".wav")
    wavfile.write(wav, SR, (st * 32767).astype(np.int16))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-b:a", "112k", os.path.join(OUT, name + ".mp3")], check=True)
    os.remove(wav)

# --- interface / economia
t = t_(0.12); save("clique", filt(sq(1800 * expd(t, 25) + 600, t), "low", 5000) * expd(t, 40), 0.35)
t = t_(0.35); save("credito", seq((sine(midi(88), t) * expd(t, 12), 0), (sine(midi(95), t) * expd(t, 10), 0.06)), 0.4)
t = t_(0.25); n = noise(len(t)); save("comprar", filt(n, "band", (1500, 6000)) * np.sin(np.pi * np.clip(t / 0.25, 0, 1)) ** 2, 0.4)
t = t_(0.3); save("instalar", seq((filt(noise(len(t)), "band", (300, 2500)) * expd(t, 25), 0), (sine(midi(52), t) * expd(t, 18), 0.02), (sine(midi(64), t_(0.08)) * expd(t_(0.08), 40), 0.12)), 0.45)
# rez: zumbido elétrico subindo
t = t_(0.7); f = 80 + 600 * (t / 0.7) ** 2
save("rez", filt(saw(f, t) + 0.5 * saw(f * 1.01, t), "low", 2500) * np.sin(np.pi * np.clip(t / 0.7, 0, 1)) * (0.6 + 0.4 * sq(30, t)), 0.45)
# avançar: dois pulsos de energia
t = t_(0.18); p = sine(midi(57) * (1 + 0.5 * expd(t, 20)), t) * expd(t, 14)
save("avancar", seq((p, 0), (p * 0.8, 0.12)), 0.45)
# jogar evento/operação: varredura de dados
t = t_(0.45); f = 2000 * expd(t, 4) + 300
save("jogar", filt(sq(f, t), "low", 4000) * expd(t, 6) * 0.5 + filt(noise(len(t)), "high", 4000) * expd(t, 15) * 0.2, 0.4)

# --- run
# jack in: sintetizador descendo + estática + batida grave
t = t_(1.2); f = 900 * expd(t, 3) + 55
jack = filt(saw(f, t) + saw(f * 1.5, t) * 0.5, "low", 3000) * np.sin(np.pi * np.clip(t / 1.2, 0, 1)) ** 0.5
stat = filt(noise(len(t)), "band", (2000, 9000)) * expd(t, 5) * 0.4
tk = t_(0.4); kick = np.sin(2 * np.pi * (45 + 100 * expd(tk, 25)) * tk) * expd(tk, 8)
save("jack-in", seq((jack, 0), (stat, 0), (kick * 1.5, 0.75)), 0.8)
# encontro com ice: alarme grave pulsante
t = t_(0.8); al = filt(sq(midi(45) * (1 + 0.03 * sine(6, t)), t), "low", 1200) * (0.5 + 0.5 * (sq(7, t) > 0))
save("ice", al * np.sin(np.pi * np.clip(t / 0.8, 0, 1)), 0.55)
# subrotina disparou: zap
t = t_(0.35); save("subrotina", filt(saw(1200 * expd(t, 9) + 80, t), "low", 6000) * expd(t, 7) + filt(noise(len(t)), "high", 3000) * expd(t, 25) * 0.4, 0.55)
# quebrar subrotina: vidro rachando
t = t_(0.4); br = filt(noise(len(t)), "high", 3500) * expd(t, 18)
bells = sum(sine(f, t) * expd(t, 9 + i * 3) for i, f in enumerate([2350, 3170, 4210]))
save("quebrar", br + bells * 0.25, 0.5)
# run encerrada (ETR / jack out)
t = t_(0.6); f = 300 * expd(t, 5) + 40
save("fim-run", seq((filt(saw(f, t), "low", 1500) * expd(t, 4), 0), (filt(noise(int(0.08 * SR)), "low", 1500), 0)), 0.55)
# run com sucesso: acorde brilhante
t = t_(0.9); ch = sum(saw(midi(n), t) for n in (62, 66, 69, 74))
save("sucesso", echo(filt(ch, "low", 3500) * np.minimum(1, t / 0.02) * expd(t, 3.5)), 0.5)
# acessar carta
t = t_(0.3); save("acessar", seq((sine(midi(81), t) * expd(t, 14), 0), (sine(midi(76), t) * expd(t, 14), 0.08)), 0.35)
# trash (lixar carta): ruído triturando
t = t_(0.45); save("lixar", filt(noise(len(t)), "band", (200, 3000)) * expd(t, 7) * (0.6 + 0.4 * sq(40, t)), 0.5)

# --- agendas, dano, tags
# roubar agenda (Runner): fanfarra curta
t = t_(0.5)
st = seq(*[(filt(saw(midi(n), t) + saw(midi(n) * 1.005, t), "low", 3000) * np.minimum(1, t / 0.015) * expd(t, 5), i * 0.11) for i, n in enumerate((62, 69, 74, 78))])
save("roubar", echo(st, 0.13, 0.3, 2), 0.6)
# pontuar agenda (Corp): acordes graves "corporativos"
t = t_(0.9)
sc = seq((filt(sum(saw(midi(n), t) for n in (45, 52, 57, 60)), "low", 1600) * np.minimum(1, t / 0.03) * expd(t, 3), 0),
         (filt(sum(saw(midi(n), t) for n in (48, 55, 60, 64)), "low", 2200) * np.minimum(1, t / 0.03) * expd(t, 2.5), 0.32))
save("pontuar", echo(sc, 0.16, 0.25, 2), 0.6)
# dano: impacto + distorção
t = t_(0.5); hit = np.tanh(4 * (np.sin(2 * np.pi * (60 + 200 * expd(t, 30)) * t) * expd(t, 7) + filt(noise(len(t)), "low", 2500) * expd(t, 12)))
save("dano", hit, 0.7)
# tag: bipe de rastreio
t = t_(0.09); b = sine(midi(93), t) * np.minimum(1, (0.09 - t) / 0.01)
save("tag", seq((b, 0), (b, 0.14), (b, 0.28)), 0.35)

# --- turno e fim de jogo
t = t_(0.6); save("turno", echo(seq((sine(midi(69), t) * expd(t, 6), 0), (sine(midi(76), t) * expd(t, 6), 0.1)), 0.15, 0.3, 2), 0.35)
t = t_(2.6); ch = sum(saw(midi(n), t) + saw(midi(n) * 1.004, t) for n in (50, 57, 62, 66, 69, 74))
save("vitoria", echo(filt(ch, "low", 3200) * np.minimum(1, t / 0.4) * expd(t, 1.2), 0.2, 0.3, 3), 0.6)
t = t_(2.6); ch = sum(saw(midi(n), t) + saw(midi(n) * 0.996, t) for n in (38, 45, 48, 53, 56))
save("derrota", echo(filt(ch, "low", 1200) * np.minimum(1, t / 0.3) * expd(t, 1.0) * (1 - 0.15 * t), 0.25, 0.3, 3), 0.6)
print("ok", sorted(os.listdir(OUT)))
