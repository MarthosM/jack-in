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

# Estética sombria: tudo grave, filtrado, intervalos menores/diminutos, nada de bipe agudo.
def sub(f0, dur, k=8, amp=1.0):
    t = t_(dur); return np.sin(2 * np.pi * np.cumsum(f0 * (1 + 1.5 * expd(t, 30))) / SR) * expd(t, k) * amp
def thud(dur=0.35, f0=55, k=9): return sub(f0, dur, k)
def dark_saw(n, dur, cut=700, k=4.0, att=0.01):
    t = t_(dur); f = midi(n)
    s = saw(f, t) + saw(f * 1.006, t) + saw(f * 0.5, t) * 0.6
    return filt(s, "low", cut) * np.minimum(1, t / att) * expd(t, k)
def metal(dur, f0, k=3.0, amp=1.0):
    t = t_(dur)
    parts = [1.0, 1.47, 2.09, 2.56]
    return sum(np.sin(2 * np.pi * f0 * p * t) * expd(t, k + i * 1.5) for i, p in enumerate(parts)) * amp / 3
def grit(dur, lo=150, hi=1400, k=10):
    t = t_(dur); return filt(noise(len(t)), "band", (lo, hi)) * expd(t, k)
def rev(x, n=4, d=0.07, g=0.45):
    return filt(echo(x, d, g, n), "low", 2500)

# --- interface / economia
save("clique", seq((thud(0.18, 70, 22), 0), (grit(0.06, 300, 1200, 60) * 0.5, 0)))                 # clique: toque surdo de relé
save("credito", rev(seq((metal(0.5, 196, 7), 0), (thud(0.25, 60, 14) * 0.6, 0))))                   # crédito: moeda pesada de metal
t = t_(0.32); save("comprar", filt(noise(len(t)), "band", (140, 800)) * np.sin(np.pi * np.clip(t / 0.32, 0, 1)) ** 2)   # carta deslizando, abafado
save("instalar", seq((thud(0.4, 48, 10), 0), (grit(0.2, 150, 900, 18), 0), (metal(0.4, 147, 9) * 0.5, 0.05)))   # encaixe pesado
t = t_(0.9); f = 45 + 160 * (t / 0.9) ** 2                                                                  # rez: gerador ligando, grave
save("rez", seq((filt(saw(f, t) + saw(f * 1.01, t), "low", 900) * np.sin(np.pi * np.clip(t / 0.9, 0, 1)) * (0.7 + 0.3 * sq(25, t)), 0), (thud(0.4, 40, 7), 0.75)))
save("avancar", seq((thud(0.3, 52, 12), 0), (thud(0.3, 46, 12), 0.18), (grit(0.3, 100, 700, 8) * 0.4, 0.18)))   # dois golpes graves
t = t_(0.5); save("jogar", seq((filt(sq(220 * expd(t, 3) + 70, t), "low", 1200) * expd(t, 6) * 0.6, 0), (thud(0.3, 50, 12) * 0.5, 0)))

# --- run
t = t_(1.6); f = 260 * expd(t, 2.2) + 32                                                                  # jack in: mergulho grave + estática abafada
jack = filt(saw(f, t) + saw(f * 1.5, t) * 0.4, "low", 1100) * np.sin(np.pi * np.clip(t / 1.6, 0, 1)) ** 0.6
save("jack-in", seq((jack, 0), (grit(1.2, 300, 2200, 3) * 0.35, 0), (thud(0.6, 38, 5) * 1.3, 1.0)))
t = t_(1.1); al = filt(saw(midi(31), t) + saw(midi(32), t), "low", 500) * (0.55 + 0.45 * (sq(4.5, t) > 0))   # ice: sirene grave com segunda menor
save("ice", al * np.sin(np.pi * np.clip(t / 1.1, 0, 1)))
t = t_(0.45); save("subrotina", seq((filt(saw(400 * expd(t, 8) + 40, t), "low", 1500) * expd(t, 6), 0), (grit(0.2, 400, 2500, 20) * 0.5, 0)))  # descarga
save("quebrar", seq((grit(0.35, 250, 1300, 14), 0), (metal(0.6, 185, 6) * 0.7, 0), (thud(0.25, 55, 14) * 0.7, 0)))        # vidro grosso partindo
t = t_(0.8); f = 140 * expd(t, 4) + 30                                                                   # fim de run: desligamento
save("fim-run", seq((filt(saw(f, t), "low", 700) * expd(t, 3), 0), (thud(0.4, 42, 8), 0)))
save("sucesso", rev(dark_saw(50, 1.2, 1100, 2.5) + dark_saw(53, 1.2, 1100, 2.5) + dark_saw(57, 1.2, 1100, 2.5)))   # acorde menor que se abre
save("acessar", seq((metal(0.6, 165, 6) * 0.7, 0), (thud(0.2, 55, 18) * 0.5, 0)))
t = t_(0.55); save("lixar", filt(noise(len(t)), "band", (70, 650)) * expd(t, 6) * (0.6 + 0.4 * sq(32, t)))    # triturador

# --- agendas, dano, tags
save("roubar", rev(seq(*[(dark_saw(n, 0.7, 1300, 4), i * 0.16) for i, n in enumerate((50, 53, 57, 62))]), 3, 0.12, 0.35))   # Ré menor subindo, escuro
save("pontuar", rev(seq((dark_saw(38, 1.4, 700, 2) + dark_saw(45, 1.4, 700, 2) + dark_saw(48, 1.4, 700, 2), 0), (thud(0.6, 36, 5) * 1.2, 0)), 3, 0.15, 0.3))
t = t_(0.6); save("dano", np.tanh(3 * (sub(48, 0.6, 6) * 1.2 + filt(noise(len(t)), "low", 1200) * expd(t, 9))))   # impacto
t = t_(0.5); save("tag", seq((filt(sq(midi(45), t) , "low", 900) * expd(t, 7), 0), (filt(sq(midi(44), t), "low", 900) * expd(t, 7), 0.22)))  # trava de rastreio, grave

# --- turno e fim de jogo
save("turno", rev(seq((metal(1.2, 98, 2.5), 0), (thud(0.5, 41, 6) * 0.7, 0))))                                # sino grave distante
save("vitoria", rev(dark_saw(38, 3.5, 900, 0.9) + dark_saw(45, 3.5, 1100, 0.9) + dark_saw(50, 3.5, 1300, 0.9) + dark_saw(57, 3.5, 1500, 0.9), 4, 0.2, 0.3))   # quinta aberta, sóbria
save("derrota", rev(seq((dark_saw(37, 3.5, 600, 0.9) + dark_saw(40, 3.5, 600, 0.9) + dark_saw(43, 3.5, 600, 0.9), 0), (sub(36, 3.0, 1.2) * 0.8, 0)), 4, 0.25, 0.3))    # diminuto grave
print("ok", sorted(os.listdir(OUT)))
