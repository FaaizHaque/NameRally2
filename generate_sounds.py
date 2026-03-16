#!/usr/bin/env python3
"""Generate high-quality WAV sound files for NameRally2 mobile game."""

import wave
import struct
import math
import random
import os

SAMPLE_RATE = 44100
OUTPUT_DIR = "/home/user/NameRally2/mobile/src/assets/sounds"


def write_wav(filename, samples):
    """Write mono 16-bit WAV file from float samples [-1.0, 1.0]."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    n = len(samples)
    with wave.open(filepath, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        data = b""
        for s in samples:
            s = max(-1.0, min(1.0, s))
            data += struct.pack("<h", int(s * 32767))
        w.writeframes(data)
    print(f"  Written: {filepath} ({n} samples, {n/SAMPLE_RATE:.3f}s)")


def adsr_envelope(t, attack, decay, sustain_level, sustain_time, release):
    """ADSR envelope. t is time in seconds. Returns amplitude 0-1."""
    if t < 0:
        return 0.0
    if t < attack:
        return t / attack
    t -= attack
    if t < decay:
        # Exponential decay
        return 1.0 - (1.0 - sustain_level) * (1.0 - math.exp(-5 * t / decay)) / (1.0 - math.exp(-5))
    t -= decay
    if t < sustain_time:
        return sustain_level
    t -= sustain_time
    if t < release:
        # Exponential release
        return sustain_level * math.exp(-5 * t / release)
    return 0.0


def exp_decay(t, duration, steepness=5.0):
    """Simple exponential decay from 1 to ~0 over duration."""
    if t < 0 or t > duration:
        return 0.0
    return math.exp(-steepness * t / duration)


def sine_with_harmonics(t, freq, h2=0.3, h3=0.15, h4=0.0):
    """Sine wave with harmonics. Returns value in [-1, 1] range (approx)."""
    val = math.sin(2 * math.pi * freq * t)
    val += h2 * math.sin(2 * math.pi * 2 * freq * t)
    val += h3 * math.sin(2 * math.pi * 3 * freq * t)
    if h4 > 0:
        val += h4 * math.sin(2 * math.pi * 4 * freq * t)
    return val / (1.0 + h2 + h3 + h4)


def noise():
    """White noise sample."""
    return random.uniform(-1, 1)


def bandpass_simple(samples, center_freq, bandwidth, sample_rate=SAMPLE_RATE):
    """Simple resonant bandpass filter using biquad."""
    Q = center_freq / bandwidth if bandwidth > 0 else 1.0
    w0 = 2 * math.pi * center_freq / sample_rate
    alpha = math.sin(w0) / (2 * Q)
    b0 = alpha
    b1 = 0
    b2 = -alpha
    a0 = 1 + alpha
    a1 = -2 * math.cos(w0)
    a2 = 1 - alpha
    # Normalize
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0
    out = [0.0] * len(samples)
    x1 = x2 = y1 = y2 = 0.0
    for i, x0 in enumerate(samples):
        y0 = b0*x0 + b1*x1 + b2*x2 - a1*y1 - a2*y2
        out[i] = y0
        x2 = x1; x1 = x0; y2 = y1; y1 = y0
    return out


def lowpass_simple(samples, cutoff, sample_rate=SAMPLE_RATE):
    """Simple one-pole lowpass filter."""
    rc = 1.0 / (2 * math.pi * cutoff)
    dt = 1.0 / sample_rate
    alpha = dt / (rc + dt)
    out = [0.0] * len(samples)
    prev = 0.0
    for i, s in enumerate(samples):
        prev = prev + alpha * (s - prev)
        out[i] = prev
    return out


def soft_clip(x, threshold=0.8):
    """Soft clipping for slight distortion."""
    if x > threshold:
        return threshold + (1 - threshold) * math.tanh((x - threshold) / (1 - threshold))
    elif x < -threshold:
        return -threshold - (1 - threshold) * math.tanh((-x - threshold) / (1 - threshold))
    return x


def note_freq(name):
    """Get frequency for note name like C4, Eb4, G5, etc."""
    notes = {
        'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5,
        'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11
    }
    # Parse note name
    if len(name) == 2:
        note_name = name[0]
        octave = int(name[1])
    else:
        note_name = name[:2]
        octave = int(name[2])
    semitones = notes[note_name] + (octave + 1) * 12 - 69
    return 440.0 * (2.0 ** (semitones / 12.0))


# ============================================================
# Sound generators
# ============================================================

def gen_tap():
    """1. tap.wav - Short crisp UI click."""
    duration = 0.06
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        # Main tone 800Hz with harmonic at 1600Hz
        env = exp_decay(t, duration, steepness=8.0)
        # Quick attack (first 2ms)
        attack = min(1.0, t / 0.002)
        tone = 0.7 * math.sin(2 * math.pi * 800 * t)
        tone += 0.25 * math.sin(2 * math.pi * 1600 * t)
        tone += 0.1 * math.sin(2 * math.pi * 2400 * t)
        # Add tiny noise click at start
        click = 0.3 * noise() * exp_decay(t, 0.005, steepness=10)
        samples.append((tone * env * attack + click) * 0.7)
    write_wav("tap.wav", samples)


def gen_navigate():
    """2. navigate.wav - Smooth whoosh with rising pitch sweep."""
    duration = 0.18
    n = int(SAMPLE_RATE * duration)
    # Generate noise, then filter it with a sweeping bandpass
    raw = [noise() for _ in range(n)]
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        frac = t / duration
        # Rising pitch sweep 400->1200
        freq = 400 + 800 * frac * frac  # quadratic sweep
        # Envelope: fade in then fade out
        env = math.sin(math.pi * frac)  # smooth bell curve
        env *= 0.6
        samples.append(raw[i] * env)
    # Apply sweeping filter by processing in short chunks
    chunk = 256
    filtered = [0.0] * n
    x1 = x2 = y1 = y2 = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        frac = t / duration
        freq = 400 + 800 * frac * frac
        Q = 2.0
        w0 = 2 * math.pi * freq / SAMPLE_RATE
        sw = math.sin(w0)
        cw = math.cos(w0)
        alpha = sw / (2 * Q)
        b0 = alpha; b1 = 0; b2 = -alpha
        a0 = 1 + alpha; a1_c = -2 * cw; a2_c = 1 - alpha
        b0 /= a0; b1 /= a0; b2 /= a0; a1_c /= a0; a2_c /= a0
        x0 = samples[i]
        y0 = b0*x0 + b1*x1 + b2*x2 - a1_c*y1 - a2_c*y2
        filtered[i] = y0
        x2 = x1; x1 = x0; y2 = y1; y1 = y0
    # Normalize
    peak = max(abs(s) for s in filtered) or 1
    samples = [s / peak * 0.5 for s in filtered]
    write_wav("navigate.wav", samples)


def gen_typing():
    """3. typing.wav - Soft pencil scratch with metallic quality."""
    duration = 0.05
    n = int(SAMPLE_RATE * duration)
    raw = [noise() for _ in range(n)]
    # Bandpass for metallic quality
    filtered = bandpass_simple(raw, 3000, 2000)
    # Add a tiny tonal component for metallic ring
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = exp_decay(t, duration, steepness=10)
        attack = min(1.0, t / 0.001)
        metallic = 0.2 * math.sin(2 * math.pi * 4500 * t) * exp_decay(t, 0.02, 12)
        samples.append((filtered[i] * 0.6 + metallic) * env * attack * 0.5)
    write_wav("typing.wav", samples)


def gen_round_start():
    """4. round_start.wav - Ascending three-note chime C5->E5->G5."""
    note_dur = 0.12
    total = 0.38
    n = int(SAMPLE_RATE * total)
    freqs = [note_freq("C5"), note_freq("E5"), note_freq("G5")]
    starts = [0.0, 0.10, 0.20]
    samples = [0.0] * n
    for note_idx in range(3):
        f = freqs[note_idx]
        start = starts[note_idx]
        for i in range(n):
            t = i / SAMPLE_RATE - start
            if t < 0:
                continue
            env = adsr_envelope(t, 0.005, 0.04, 0.4, 0.02, 0.12)
            tone = sine_with_harmonics(t, f, h2=0.25, h3=0.12, h4=0.05)
            samples[i] += tone * env * 0.4
    # Soft clip and normalize
    peak = max(abs(s) for s in samples) or 1
    samples = [s / peak * 0.65 for s in samples]
    write_wav("round_start.wav", samples)


def gen_answer_done():
    """5. answer_done.wav - Satisfying pop/ding at C6."""
    duration = 0.12
    n = int(SAMPLE_RATE * duration)
    freq = 1047.0  # C6
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = adsr_envelope(t, 0.002, 0.03, 0.3, 0.0, 0.09)
        tone = sine_with_harmonics(t, freq, h2=0.2, h3=0.08)
        # Add a tiny pop at the start
        pop = 0.3 * noise() * exp_decay(t, 0.004, 15)
        samples.append((tone * env + pop) * 0.6)
    write_wav("answer_done.wav", samples)


def gen_timer_tick():
    """6. timer_tick.wav - Sharp clock tick."""
    duration = 0.04
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        # Sharp percussive: noise burst + brief tone
        env = exp_decay(t, duration, steepness=15)
        attack = min(1.0, t / 0.0005)
        tick_noise = noise() * 0.4 * exp_decay(t, 0.006, 20)
        tone = 0.6 * math.sin(2 * math.pi * 1800 * t) * exp_decay(t, 0.015, 10)
        low = 0.3 * math.sin(2 * math.pi * 400 * t) * exp_decay(t, 0.008, 12)
        samples.append((tick_noise + tone + low) * attack * 0.55)
    write_wav("timer_tick.wav", samples)


def gen_round_end():
    """7. round_end.wav - Low descending buzzer 500->150Hz."""
    duration = 0.25
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        frac = t / duration
        # Descending frequency
        freq = 500 - 350 * frac
        env = adsr_envelope(t, 0.01, 0.05, 0.7, 0.1, 0.09)
        # Rich buzzy tone with strong harmonics
        tone = sine_with_harmonics(t, freq, h2=0.4, h3=0.3, h4=0.15)
        # Add slight distortion
        val = tone * env * 0.8
        val = soft_clip(val, 0.5)
        samples.append(val * 0.6)
    write_wav("round_end.wav", samples)


def gen_success():
    """8. success.wav - Victory fanfare C4->E4->G4->C5 arpeggio."""
    note_dur = 0.14
    total = 0.55
    n = int(SAMPLE_RATE * total)
    freqs = [note_freq("C4"), note_freq("E4"), note_freq("G4"), note_freq("C5")]
    starts = [0.0, 0.10, 0.20, 0.30]
    samples = [0.0] * n
    for note_idx in range(4):
        f = freqs[note_idx]
        start = starts[note_idx]
        # Each successive note slightly louder for building energy
        vol = 0.3 + 0.05 * note_idx
        for i in range(n):
            t = i / SAMPLE_RATE - start
            if t < 0:
                continue
            env = adsr_envelope(t, 0.005, 0.04, 0.5, 0.04, 0.15)
            # Rich harmonics
            tone = sine_with_harmonics(t, f, h2=0.3, h3=0.15, h4=0.08)
            # Add slight detune for richness
            tone += 0.1 * math.sin(2 * math.pi * f * 1.003 * t)
            samples[i] += tone * env * vol
    # Add final chord ring (all notes together, quieter)
    chord_start = 0.35
    for f in freqs:
        for i in range(n):
            t = i / SAMPLE_RATE - chord_start
            if t < 0:
                continue
            env = exp_decay(t, 0.2, 4) * 0.15
            samples[i] += math.sin(2 * math.pi * f * t) * env
    peak = max(abs(s) for s in samples) or 1
    samples = [s / peak * 0.65 for s in samples]
    write_wav("success.wav", samples)


def gen_fail():
    """9. fail.wav - Sad descending G4->Eb4."""
    note_dur = 0.2
    total = 0.42
    n = int(SAMPLE_RATE * total)
    freqs = [note_freq("G4"), note_freq("Eb4")]
    starts = [0.0, 0.20]
    samples = [0.0] * n
    for note_idx in range(2):
        f = freqs[note_idx]
        start = starts[note_idx]
        for i in range(n):
            t = i / SAMPLE_RATE - start
            if t < 0:
                continue
            env = adsr_envelope(t, 0.008, 0.05, 0.4, 0.05, 0.12)
            # Muted tone: less harmonics, lowpass character
            tone = math.sin(2 * math.pi * f * t)
            tone += 0.15 * math.sin(2 * math.pi * 2 * f * t)
            tone += 0.05 * math.sin(2 * math.pi * 3 * f * t)
            tone /= 1.2
            samples[i] += tone * env * 0.45
    write_wav("fail.wav", samples)


def gen_hint():
    """10. hint.wav - Magical sparkle, descending 1200->800Hz."""
    duration = 0.22
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        frac = t / duration
        # Two quick descending tones with overlap
        # Tone 1: starts at 0, descends 1200->900
        f1 = 1200 - 400 * min(1, t / 0.12)
        env1 = exp_decay(t, 0.15, 5) * (min(1, t / 0.003))
        t1 = sine_with_harmonics(t, f1, h2=0.2, h3=0.1) * env1 * 0.4

        # Tone 2: starts at 0.06s, descends 1000->700
        t2_off = t - 0.06
        if t2_off > 0:
            f2 = 1000 - 300 * min(1, t2_off / 0.1)
            env2 = exp_decay(t2_off, 0.14, 5) * min(1, t2_off / 0.003)
            t2 = sine_with_harmonics(t2_off, f2, h2=0.2, h3=0.1) * env2 * 0.35
        else:
            t2 = 0

        # Add sparkle noise
        sparkle = noise() * 0.08 * exp_decay(t, 0.1, 6)

        samples.append(t1 + t2 + sparkle)
    write_wav("hint.wav", samples)


def gen_join():
    """11. join.wav - Notification chime E5->G5."""
    total = 0.2
    n = int(SAMPLE_RATE * total)
    freqs = [note_freq("E5"), note_freq("G5")]
    starts = [0.0, 0.07]
    samples = [0.0] * n
    for note_idx in range(2):
        f = freqs[note_idx]
        start = starts[note_idx]
        for i in range(n):
            t = i / SAMPLE_RATE - start
            if t < 0:
                continue
            env = adsr_envelope(t, 0.003, 0.03, 0.35, 0.01, 0.1)
            tone = sine_with_harmonics(t, f, h2=0.2, h3=0.1)
            samples[i] += tone * env * 0.5
    write_wav("join.wav", samples)


def gen_letter_lock():
    """12. letter_lock.wav - Lock/click with low thud."""
    duration = 0.08
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        attack = min(1.0, t / 0.001)
        # Low thud at 200Hz
        thud = math.sin(2 * math.pi * 200 * t) * exp_decay(t, 0.05, 8) * 0.6
        # Click noise
        click = noise() * exp_decay(t, 0.008, 18) * 0.4
        # Brief higher tone for "lock" character
        lock_tone = math.sin(2 * math.pi * 600 * t) * exp_decay(t, 0.02, 10) * 0.2
        samples.append((thud + click + lock_tone) * attack * 0.6)
    write_wav("letter_lock.wav", samples)


def gen_bg_home():
    """13. bg_home.wav - Calm Am7 drone (A2, C3, E3, G3), 8 seconds, loopable."""
    duration = 8.0
    n = int(SAMPLE_RATE * duration)
    freqs = [note_freq("A2"), note_freq("C3"), note_freq("E3"), note_freq("G3")]
    # Add detuned voices for warmth
    voices = []
    for f in freqs:
        voices.append(f)
        voices.append(f * 1.002)  # slightly sharp
        voices.append(f * 0.998)  # slightly flat
    samples = [0.0] * n
    random.seed(42)  # Reproducible
    # Random phases for each voice
    phases = [random.uniform(0, 2 * math.pi) for _ in voices]
    for i in range(n):
        t = i / SAMPLE_RATE
        # LFO for slow modulation
        lfo = 0.015 * math.sin(2 * math.pi * 0.2 * t)
        lfo2 = 0.01 * math.sin(2 * math.pi * 0.13 * t)
        val = 0.0
        for vi, f in enumerate(voices):
            # Each voice gets slight individual modulation
            mod = 1.0 + lfo * (0.8 if vi % 3 == 0 else 0.5) + lfo2 * (0.6 if vi % 3 == 1 else 0.3)
            val += math.sin(2 * math.pi * f * mod * t + phases[vi])
        val /= len(voices)
        # Seamless loop: crossfade envelope
        # Use a smooth window that's 1.0 in the middle and fades at edges
        fade_len = 0.5  # seconds
        if t < fade_len:
            fade = 0.5 - 0.5 * math.cos(math.pi * t / fade_len)
        elif t > duration - fade_len:
            fade = 0.5 - 0.5 * math.cos(math.pi * (duration - t) / fade_len)
        else:
            fade = 1.0
        samples[i] = val * fade * 0.18  # Very soft
    write_wav("bg_home.wav", samples)


def gen_bg_game():
    """14. bg_game.wav - Fun upbeat C Major drone (C3, E3, G3, C4, E4), 8 seconds, loopable."""
    duration = 8.0
    n = int(SAMPLE_RATE * duration)
    # Use brighter C Major chord with higher octaves for fun, happy feel
    freqs = [note_freq("C3"), note_freq("E3"), note_freq("G3"), note_freq("C4"), note_freq("E4")]
    voices = []
    for f in freqs:
        voices.append(f)
        voices.append(f * 1.003)
        voices.append(f * 0.997)
    samples = [0.0] * n
    random.seed(99)
    phases = [random.uniform(0, 2 * math.pi) for _ in voices]
    for i in range(n):
        t = i / SAMPLE_RATE
        # Faster, energetic LFO for more playful energy
        lfo = 0.03 * math.sin(2 * math.pi * 0.5 * t)
        lfo2 = 0.02 * math.sin(2 * math.pi * 0.33 * t)
        # More prominent rhythmic pulse for fun game feel
        pulse = 1.0 + 0.08 * math.sin(2 * math.pi * 1.5 * t)
        val = 0.0
        for vi, f in enumerate(voices):
            mod = 1.0 + lfo * (0.8 if vi % 3 == 0 else 0.5) + lfo2 * (0.6 if vi % 3 == 1 else 0.3)
            val += math.sin(2 * math.pi * f * mod * t + phases[vi])
            # Add more harmonics for brighter, richer sound
            val += 0.12 * math.sin(2 * math.pi * 2 * f * mod * t + phases[vi])
        val /= len(voices) * 1.12
        val *= pulse
        # Seamless loop crossfade
        fade_len = 0.5
        if t < fade_len:
            fade = 0.5 - 0.5 * math.cos(math.pi * t / fade_len)
        elif t > duration - fade_len:
            fade = 0.5 - 0.5 * math.cos(math.pi * (duration - t) / fade_len)
        else:
            fade = 1.0
        samples[i] = val * fade * 0.24  # Slightly louder for more presence
    write_wav("bg_game.wav", samples)


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Generating sound files...")
    gen_tap()
    gen_navigate()
    gen_typing()
    gen_round_start()
    gen_answer_done()
    gen_timer_tick()
    gen_round_end()
    gen_success()
    gen_fail()
    gen_hint()
    gen_join()
    gen_letter_lock()
    gen_bg_home()
    gen_bg_game()
    print("\nDone! All 14 sound files generated.")
