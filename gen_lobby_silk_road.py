#!/usr/bin/env python3
"""
Generate Kitaro Silk Road style ambient lobby music.
20-second loopable WAV, 22050 Hz mono 16-bit.
"""

import wave, struct, math, random, os

SR = 22050
DURATION = 20.0
N = int(SR * DURATION)
OUTPUT = "/home/user/NameRally2/mobile/src/assets/sounds/bg_lobby_silkroad.wav"

random.seed(12345)

def note_freq(name):
    notes = {'C':0,'Db':1,'D':2,'Eb':3,'E':4,'F':5,'Gb':6,'G':7,'Ab':8,'A':9,'Bb':10,'B':11}
    if len(name) == 2:
        nn, oct_ = name[0], int(name[1])
    else:
        nn, oct_ = name[:2], int(name[2])
    semis = notes[nn] + (oct_ + 1) * 12 - 69
    return 440.0 * (2.0 ** (semis / 12.0))

def exp_decay(t, dur, steep=5.0):
    if t < 0 or t > dur: return 0.0
    return math.exp(-steep * t / dur)

samples = [0.0] * N

# ── 1. DRONE ─────────────────────────────────────────────────────────────────
# Deep D pentatonic drone: D2, A2 with subtle beating / LFO
D2 = note_freq("D2")
A2 = note_freq("A2")
D3 = note_freq("D3")

for i in range(N):
    t = i / SR
    lfo  = 0.006 * math.sin(2 * math.pi * 0.12 * t)
    lfo2 = 0.004 * math.sin(2 * math.pi * 0.07 * t + 1.1)

    d = math.sin(2 * math.pi * D2 * (1 + lfo) * t)
    d += 0.6 * math.sin(2 * math.pi * D2 * 1.0025 * t)   # beating voice
    d += 0.4 * math.sin(2 * math.pi * A2 * (1 + lfo2) * t)
    d += 0.3 * math.sin(2 * math.pi * A2 * 0.9975 * t)
    d += 0.15 * math.sin(2 * math.pi * D3 * (1 + lfo * 0.5) * t)
    d /= 2.45
    samples[i] += d * 0.055

# ── 2. KOTO plucks ────────────────────────────────────────────────────────────
D3f  = note_freq("D3");  F3  = note_freq("F3")
G3   = note_freq("G3");  A3  = note_freq("A3")
C4   = note_freq("C4");  D4  = note_freq("D4")
A3h  = note_freq("A3");  G3h = note_freq("G3")

def koto(start, freq, vol=0.28):
    decay = 2.8
    for i in range(int(SR * 3.2)):
        idx = int(start * SR) + i
        if idx >= N: break
        t = i / SR
        atk = min(1.0, t / 0.004)
        env = exp_decay(t, decay, 3.2)
        tone  = math.sin(2 * math.pi * freq * t) * 0.55
        tone += math.sin(2 * math.pi * 2 * freq * t) * 0.28
        tone += math.sin(2 * math.pi * 3 * freq * t) * 0.12
        tone += math.sin(2 * math.pi * 4 * freq * t) * 0.05
        tone /= 1.0
        if t < 0.012:
            tone += (random.random() * 2 - 1) * 0.18 * (1 - t / 0.012)
        samples[idx] += tone * env * atk * vol

# Slow pentatonic melody spread over 20 seconds
koto(0.8,  D4,  0.28)
koto(3.2,  A3,  0.24)
koto(5.5,  G3,  0.22)
koto(7.5,  F3,  0.20)
koto(9.8,  D3f, 0.18)
koto(11.5, A3,  0.22)
koto(13.0, C4,  0.26)
koto(15.2, G3,  0.22)
koto(17.0, D4,  0.28)
koto(18.8, A3,  0.20)

# ── 3. SHAKUHACHI flute ───────────────────────────────────────────────────────
def flute(start, freq, dur, vol=0.13):
    nn = int(SR * dur)
    for i in range(nn):
        idx = int(start * SR) + i
        if idx >= N: break
        t  = i / SR
        fr = t / dur
        # Slow attack / slow release
        if fr < 0.18:
            env = fr / 0.18
        elif fr > 0.72:
            env = (1 - fr) / 0.28
        else:
            env = 1.0
        # Gentle vibrato (increases with time into note)
        vib = 0.003 * min(1.0, t * 1.5) * math.sin(2 * math.pi * 5.2 * t)
        tone = math.sin(2 * math.pi * freq * (1 + vib) * t) * 0.72
        tone += math.sin(2 * math.pi * 2 * freq * t) * 0.18
        # Breathiness
        breath = (random.random() * 2 - 1) * 0.10 * (1 - 0.4 * fr)
        samples[idx] += (tone + breath) * env * vol

flute(0.0,  D4,  4.5,  0.11)
flute(5.0,  A3,  4.0,  0.10)
flute(10.5, C4,  5.0,  0.12)
flute(16.5, G3,  3.2,  0.10)

# ── 4. GONG / BOWL accents ────────────────────────────────────────────────────
def gong(start, freq, vol=0.18):
    decay = 3.5
    nn = int(SR * decay)
    for i in range(nn):
        idx = int(start * SR) + i
        if idx >= N: break
        t = i / SR
        env = exp_decay(t, decay, 2.2)
        atk = min(1.0, t / 0.006)
        tone  = math.sin(2 * math.pi * freq * t) * 0.50
        tone += math.sin(2 * math.pi * freq * 2.73 * t) * 0.22  # inharmonic
        tone += math.sin(2 * math.pi * freq * 5.35 * t) * 0.10
        tone /= 0.82
        samples[idx] += tone * env * atk * vol

gong(0.0,  note_freq("D3"), 0.17)   # opening bowl
gong(7.0,  note_freq("A2"), 0.14)
gong(13.5, note_freq("D3"), 0.15)
gong(19.2, note_freq("A2"), 0.12)   # near-loop-point

# ── 5. Crossfade for seamless loop + normalize ────────────────────────────────
peak = max(abs(s) for s in samples) or 1.0
fade = 1.2   # seconds
for i in range(N):
    t = i / SR
    if t < fade:
        w = 0.5 - 0.5 * math.cos(math.pi * t / fade)
    elif t > DURATION - fade:
        w = 0.5 - 0.5 * math.cos(math.pi * (DURATION - t) / fade)
    else:
        w = 1.0
    samples[i] = (samples[i] / peak) * 0.62 * w   # master gain

# ── Write WAV ─────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
with wave.open(OUTPUT, 'w') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    data = b''.join(struct.pack('<h', max(-32767, min(32767, int(s * 32767)))) for s in samples)
    wf.writeframes(data)

size_kb = os.path.getsize(OUTPUT) / 1024
print(f"Written: {OUTPUT}")
print(f"Duration: {DURATION}s | SR: {SR}Hz | Size: {size_kb:.0f} KB")
