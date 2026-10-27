# Jack In Treino — exemplos de trilha (composições originais, sintetizadas do zero)
# Estética: sintetizadores analógicos dos anos 80 (pads "brass" com dessintonia, chuva,
# reverberação longa, baixo pulsante). Nenhuma melodia de terceiros.
import numpy as np, subprocess, sys, os
from scipy.signal import butter, sosfilt, lfilter

SR = 44100
OUT = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)

def t_(sec): return np.arange(int(sec * SR)) / SR
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

def saw(f, t, phase=0.0):
    # dente-de-serra com banda limitada (soma de harmônicos) para não serrilhar
    out = np.zeros_like(t)
    nmax = int(min(40, (SR / 2) / max(f, 1)))
    for k in range(1, nmax + 1):
        out += ((-1) ** (k + 1)) * np.sin(2 * np.pi * k * f * t + k * phase) / k
    return out * (2 / np.pi)

def lp(x, fc, order=2):
    sos = butter(order, min(fc, SR / 2 - 100) / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, x)

def hp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype="high", output="sos")
    return sosfilt(sos, x)

def bp(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos")
    return sosfilt(sos, x)

def env(n, a, d, s, r, sus_len):
    A = int(a * SR); D = int(d * SR); S = max(0, int(sus_len * SR)); R = int(r * SR)
    e = np.concatenate([np.linspace(0, 1, A, endpoint=False), np.linspace(1, s, D, endpoint=False),
                        np.full(S, s), np.linspace(s, 0, R)])
    if len(e) < n: e = np.concatenate([e, np.zeros(n - len(e))])
    return e[:n]

def sweep_lp(x, f0, f1):
    # filtro passa-baixa varrendo no tempo (blocos), o "abrir" típico dos pads de metal
    n = len(x); out = np.zeros(n); blk = 2048
    zi = None
    for i in range(0, n, blk):
        fc = f0 + (f1 - f0) * (i / n)
        b, a = butter(2, min(fc, SR / 2 - 200) / (SR / 2), btype="low")
        seg = x[i:i + blk]
        if zi is None: zi = np.zeros(max(len(a), len(b)) - 1)
        y, zi = lfilter(b, a, seg, zi=zi)
        out[i:i + blk] = y
    return out

def cs_pad(notes, dur, atk=1.6, rel=3.0, bright=(500, 3200), detune=0.12, vib=0.25):
    # pad dessintonizado estilo polifônico analógico, com vibrato lento e filtro que abre
    t = t_(dur + rel)
    sig = np.zeros_like(t)
    for n in notes:
        f = midi(n)
        lfo = 1 + 0.0025 * np.sin(2 * np.pi * vib * t + rng.uniform(0, 6.28))
        for d in (-detune, 0.0, detune):
            ff = f * 2 ** (d / 12)
            # vibrato via modulação de fase aproximada
            ph = 2 * np.pi * np.cumsum(ff * lfo) / SR
            sig += np.sum([((-1) ** (k + 1)) * np.sin(k * ph) / k for k in range(1, int(min(30, 18000 / ff)) + 1)], axis=0)
    sig = sweep_lp(sig, bright[0], bright[1])
    e = env(len(t), atk, 1.0, 0.75, rel, dur - atk - 1.0)
    return sig * e / (len(notes) * 3)

def bell(n, dur, amp=0.25):
    # sino FM suave (o "brilho" de vidro nas notas altas)
    t = t_(dur); f = midi(n)
    mod = 2.0 * np.exp(-t * 2.5) * np.sin(2 * np.pi * f * 3.5 * t)
    return amp * np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.6)

def rain(dur, amp=0.05):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    r = bp(noise, 800, 7000) * amp
    # gotas: estalos curtos aleatórios
    drops = np.zeros(n)
    for _ in range(int(dur * 30)):
        i = rng.integers(0, n - 400)
        drops[i:i + 400] += rng.uniform(0.2, 1) * np.exp(-np.arange(400) / 40) * rng.standard_normal(400)
    return r + hp(drops, 2500) * amp * 0.8

def reverb(x, wet=0.45, size=1.0):
    # reverberação simples (Schroeder): 4 pentes + 2 passa-tudo, longa como em cidade molhada
    def comb(x, d, g):
        y = np.zeros(len(x) + d);
        out = np.copy(x)
        buf = np.zeros(d); idx = 0
        for i in range(len(x)):
            pass
        return None
    # implementação vetorizada por blocos de atraso (aproximação rápida)
    delays = [int(s * size * SR) for s in (0.0297, 0.0371, 0.0411, 0.0437)]
    out = np.zeros(len(x) + int(3.5 * SR))
    xp = np.concatenate([x, np.zeros(int(3.5 * SR))])
    for d, g in zip(delays, (0.84, 0.83, 0.82, 0.81)):
        b = np.zeros(d + 1); b[0] = 1
        a = np.zeros(d + 1); a[0] = 1; a[d] = -g
        out += lfilter(b, a, xp)
    out /= 4
    for d, g in ((int(0.005 * SR), 0.7), (int(0.0017 * SR), 0.7)):
        b = np.zeros(d + 1); b[0] = -g; b[d] = 1
        a = np.zeros(d + 1); a[0] = 1; a[d] = -g
        out = lfilter(b, a, out)
    out = lp(out, 6000)
    dry = np.concatenate([x, np.zeros(int(3.5 * SR))])
    return dry * (1 - wet) + out * wet

def stereo(x, width=0.012):
    # alarga com um atraso curto e leve filtro no canal direito
    d = int(width * SR)
    L = x; R = np.concatenate([np.zeros(d), x[:-d]]) * 0.95 + x * 0.05
    return np.stack([L, R], axis=1)

def place(buf, sig, at):
    i = int(at * SR); j = min(len(buf), i + len(sig))
    buf[i:j] += sig[:j - i]

def master(x, name, gain_db=-1.0):
    # suaviza, normaliza e grava MP3 + OGG
    # nível por RMS (todas as faixas com o mesmo volume percebido) + limitador suave só nos picos
    rms = np.sqrt(np.mean(x ** 2)) or 1
    x = x / rms * 0.11
    over = np.abs(x) > 0.85
    x[over] = np.sign(x[over]) * (0.85 + 0.13 * np.tanh((np.abs(x[over]) - 0.85) / 0.13))
    # corta o silêncio do fim (mantém 3 s depois do último som audível)
    lvl = np.abs(x).max(axis=1)
    idx = np.where(lvl > 10 ** (-45 / 20))[0]
    if len(idx): x = x[:min(len(x), idx[-1] + 3 * SR)]
    fade = int(2.5 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)[:, None]
    wav = os.path.join(OUT, name + ".wav")
    from scipy.io import wavfile
    wavfile.write(wav, SR, (x * 32767).astype(np.int16))
    af = []
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav] + af + ["-ar", "44100", "-b:a", "160k", os.path.join(OUT, name + ".mp3")], check=True)
    os.remove(wav)
    print("ok", name)

# ------------------------------------------------------------ 1) Abertura: "Chuva sobre a Arcologia"
def piece_intro():
    dur = 44
    buf = np.zeros(int((dur + 6) * SR))
    # progressão lenta em Ré menor (acordes com 9ª e sus), cada um ~8 s
    chords = [[50, 57, 62, 64, 69], [46, 53, 58, 62, 65], [43, 50, 55, 58, 62, 69], [45, 52, 57, 61, 64]]
    for i, ch in enumerate(chords + chords[:1]):
        place(buf, cs_pad(ch, 9.0, atk=2.2, rel=3.5, bright=(380, 2600)), i * 8.0)
    # baixo grave sustentado
    for i, n in enumerate([38, 34, 31, 33, 38]):
        t = t_(9); s = lp(saw(midi(n), t), 220) * env(len(t), 1.5, 1, 0.8, 2, 5) * 0.35
        place(buf, s, i * 8.0)
    # melodia lenta "metal" (pad com ataque mais rápido, uma voz) — original
    mel = [(69, 4.0, 3.0), (72, 7.5, 2.0), (70, 9.5, 4.0), (67, 16.0, 2.5), (69, 18.5, 1.5), (65, 20.0, 4.5),
           (64, 27.0, 2.0), (67, 29.0, 2.0), (69, 31.0, 6.0), (74, 38.0, 4.0)]
    for n, at, d in mel:
        place(buf, cs_pad([n], d, atk=0.35, rel=2.2, bright=(900, 4200), detune=0.08, vib=5.0) * 1.3, at)
    # sinos de vidro esparsos
    for n, at in [(81, 6.0), (86, 14.0), (84, 22.5), (88, 30.0), (81, 37.0)]:
        place(buf, bell(n, 4.0, 0.12), at)
    mono = reverb(buf, wet=0.5, size=1.3)
    mono = mono / (np.max(np.abs(mono)) or 1)
    r = rain(len(mono) / SR, 0.010)[:len(mono)]
    mono = mono + r * np.clip(np.arange(len(mono)) / (3 * SR), 0, 1)
    mono = mono[:int((dur + 4) * SR)]
    master(stereo(mono), "trilha-1-abertura-chuva-na-arcologia")

# ------------------------------------------------------------ 2) Partida: "Subsolo" (sombria, loop)
def drone(n, dur, cutoff=260, amp=0.4):
    t = t_(dur)
    f = midi(n)
    s = sum(saw(f * 2 ** (d / 1200), t) for d in (-9, 0, 7)) / 3
    s = lp(s, cutoff) * amp
    # respiração lenta do volume
    return s * (0.75 + 0.25 * np.sin(2 * np.pi * t / 11.0))

def metal_hit(dur=3.5, f0=140, amp=0.18):
    # batida metálica distante: parciais inarmônicas graves com decaimento longo
    t = t_(dur)
    parts = [1.0, 1.47, 2.09, 2.56, 3.18]
    s = sum(np.sin(2 * np.pi * f0 * p * t + rng.uniform(0, 6)) * np.exp(-t * (1.2 + i * 0.6)) for i, p in enumerate(parts))
    s += lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 25) * 0.6
    return s * amp

def low_pulse(n, at_list, beat, amp=0.3):
    out = []
    for at in at_list:
        t = t_(beat * 0.9)
        s = lp(saw(midi(n), t) + saw(midi(n) * 0.5, t) * 0.7, 180) * np.exp(-t * 3.5) * amp
        out.append((s, at))
    return out

def piece_ambient():
    dur = 64
    buf = np.zeros(int((dur + 6) * SR))
    # drone em Ré, com a segunda menor (Mi bemol) aparecendo: modo frígio, sombrio
    place(buf, drone(26, dur + 2, 240, 0.45), 0)
    place(buf, drone(38, dur + 2, 320, 0.22), 0)
    beat = 60 / 64
    # pulso grave lento, como coração de máquina: dois toques, pausa
    hits = []
    tpos = 4.0
    while tpos < dur - 2:
        hits += [tpos, tpos + beat * 0.5]
        tpos += beat * 4
    for s, at in low_pulse(26, hits, beat, 0.32):
        place(buf, s, at)
    # acordes escuros, longos, que mal abrem o filtro (Dm, Eb, Dm(add9), Bbmaj7/D)
    chords = [[50, 53, 57, 62], [51, 55, 58, 63], [50, 53, 57, 64], [50, 53, 58, 62]]
    for k, ch in enumerate(chords * 2):
        place(buf, cs_pad(ch, 9.0, atk=3.0, rel=4.0, bright=(260, 900), detune=0.14, vib=0.15) * 0.75, 2.0 + k * 7.6)
    # tema lento e grave (3-4 notas por frase), em registro médio-baixo
    mel = [(62, 10.0, 3.0), (63, 13.2, 1.6), (62, 15.0, 4.0), (60, 25.0, 2.0), (58, 27.2, 2.0), (57, 29.4, 5.0),
           (62, 41.0, 2.5), (65, 43.6, 1.5), (63, 45.3, 6.0)]
    for n, at, d in mel:
        place(buf, cs_pad([n], d, atk=0.6, rel=2.5, bright=(500, 1500), detune=0.07, vib=4.5) * 0.9, at)
    # batidas metálicas distantes, esparsas
    for at in (7.0, 22.5, 36.0, 51.5):
        place(buf, metal_hit(4.0, float(rng.choice([96, 110, 123]))), at)
    mono = reverb(buf, wet=0.45, size=1.4)
    mono = mono / (np.max(np.abs(mono)) or 1)
    # chuva bem baixa e escura (filtrada)
    r = lp(rain(len(mono) / SR, 0.006)[:len(mono)], 3000)
    mono = mono + r
    master(stereo(mono), "trilha-2-partida-subsolo")

# ------------------------------------------------------------ 3) Run: "Intrusão" (tensa, industrial, grave)
def piece_run():
    dur = 40
    buf = np.zeros(int((dur + 6) * SR))
    bpm = 96; beat = 60 / bpm
    # baixo em semicolcheias, Ré grave com Mi bemol (frígio), filtro abrindo devagar
    seqn = [26, 26, 26, 27, 26, 26, 38, 26, 26, 26, 27, 26, 24, 26, 25, 26]
    tpos = 0.0; k = 0
    while tpos < dur:
        n = seqn[k % len(seqn)]
        t = t_(beat * 0.25)
        cut = 260 + 520 * min(1, tpos / dur * 1.4)
        s = lp(saw(midi(n), t) + saw(midi(n) * 1.005, t), cut) * env(len(t), 0.002, 0.08, 0.3, 0.03, beat * 0.1) * 0.38
        place(buf, s, tpos); tpos += beat * 0.25; k += 1
    # bumbo grave e "porta de ferro" no contratempo
    tpos = 0.0; b = 0
    while tpos < dur:
        t = t_(0.5)
        kick = np.sin(2 * np.pi * (38 + 90 * np.exp(-t * 28)) * t) * np.exp(-t * 7) * 0.7
        place(buf, kick, tpos)
        if b % 4 == 2:
            place(buf, metal_hit(1.4, 180, 0.22), tpos)
        tpos += beat; b += 1
    # acordes graves de tensão (diminutos / menor com segunda menor), crescendo
    stabs = [[38, 41, 44, 47], [39, 42, 45, 48], [38, 41, 45, 50], [37, 40, 43, 46]]
    for i, ch in enumerate(stabs * 2):
        place(buf, cs_pad(ch, beat * 7, atk=0.4, rel=1.5, bright=(300, 1100), detune=0.18, vib=0.3) * (0.55 + 0.05 * i), 1.0 + i * beat * 4)
    # ruído de estática passando (varredura), a cada 8 tempos
    for at in np.arange(beat * 8, dur - 2, beat * 8):
        t = t_(1.6)
        nz = rng.standard_normal(len(t))
        sw = sweep_lp(nz, 200, 2200) * np.sin(np.pi * np.clip(t / 1.6, 0, 1)) ** 2 * 0.12
        place(buf, sw, at)
    mono = reverb(buf, wet=0.3, size=0.9)
    master(stereo(mono), "trilha-3-run-intrusao")

if __name__ == "__main__":
    which = sys.argv[1:] or ["1", "2", "3"]
    if "1" in which: piece_intro()
    if "2" in which: piece_ambient()
    if "3" in which: piece_run()
