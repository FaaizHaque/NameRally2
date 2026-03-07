/**
 * NotebookBackground — aged school notebook paper
 *
 * Uses only React Native-compatible techniques (no % strings in absolute layout,
 * no CSS gradients). Every visual effect is built from opaque pixel-positioned Views.
 *
 * Layers (bottom → top):
 *  1. Base: warm yellowed off-white  (#F0E6C8)
 *  2. Paper grain: 180 tiny fibrous strokes in sepia tones
 *  3. Horizontal ruled lines — sepia, slightly uneven
 *  4. Left red margin line
 *  5. Vignette: darker edges, lighter centre — 8 gradient strips per side
 *  6. Page-edge shadow: thin dark strips right at the borders
 *  7. Irregular corner wear: tiny rotated scraps at the four corners
 *  8. Children on top
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Seeded PRNG ──────────────────────────────────────────────────────────────
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ── Types ────────────────────────────────────────────────────────────────────
interface GrainFiber {
  x: number; y: number;
  w: number; h: number;
  color: string;
  opacity: number;
  rot: number;
}

interface Props {
  children?: React.ReactNode;
  lineStartY?: number;
  lineSpacing?: number;
  lineCount?: number;
  showMargin?: boolean;
  marginX?: number;
}

// ── Pre-baked grain colours (warm sepia range) ───────────────────────────────
const GRAIN_COLORS = [
  '#6B4820', '#7A5530', '#8A6238', '#5A3D18',
  '#9B7045', '#4E3210', '#B08050', '#3E2808',
];

export function NotebookBackground({
  children,
  lineStartY = 0,
  lineSpacing = 30,
  lineCount = 50,
  showMargin = true,
  marginX = 58,
}: Props) {

  // ── 1. Paper grain fibers (pixel-based, no % strings) ──────────────────────
  const fibers = useMemo<GrainFiber[]>(() => {
    const r = rng(0xDEAD_BEEF);
    const out: GrainFiber[] = [];
    for (let i = 0; i < 220; i++) {
      const x = r() * SW;
      const y = r() * SH;
      const w = 6 + r() * 38;    // 6–44 px wide
      const h = 1 + r() * 3.5;   // 1–4.5 px tall
      const color = GRAIN_COLORS[Math.floor(r() * GRAIN_COLORS.length)];
      const opacity = 0.04 + r() * 0.09;   // 0.04–0.13 — clearly visible but subtle
      const rot = r() * 160 - 80;
      out.push({ x, y, w, h, color, opacity, rot });
    }
    return out;
  }, []);

  // ── 2. Heavier smudge blobs for coarser paper feel ────────────────────────
  const smudges = useMemo(() => {
    const r = rng(0xCAFE_BABE);
    const out: { x: number; y: number; w: number; h: number; op: number }[] = [];
    for (let i = 0; i < 55; i++) {
      out.push({
        x: r() * SW,
        y: r() * SH,
        w: 20 + r() * 90,
        h: 3 + r() * 12,
        op: 0.03 + r() * 0.07,   // 0.03–0.10
      });
    }
    return out;
  }, []);

  // ── 3. Ruled lines with slight positional jitter ──────────────────────────
  const lines = useMemo(() => {
    const r = rng(0xF00D_CAFE);
    return Array.from({ length: lineCount }, (_, i) => {
      const jitter = i % 9 === 0 ? (r() * 2 - 1) : 0; // ±1 px every 9th line
      const opacity = i % 6 === 0 ? 0.55 : 0.28;
      return { y: lineStartY + i * lineSpacing + jitter, opacity };
    });
  }, [lineCount, lineStartY, lineSpacing]);

  // ── 4. Edge vignette strips ───────────────────────────────────────────────
  //    We stack 6 strips of increasing opacity near each edge.
  const VIGNETTE_STRIPS = 6;
  const TOP_DEPTH = 90;
  const BOTTOM_DEPTH = 110;
  const SIDE_DEPTH = 40;

  const vigTopStrips = useMemo(() =>
    Array.from({ length: VIGNETTE_STRIPS }, (_, i) => {
      const frac = (VIGNETTE_STRIPS - i) / VIGNETTE_STRIPS; // 1..1/n top→down
      const h = (TOP_DEPTH / VIGNETTE_STRIPS) * (i + 1);
      const opacity = frac * 0.14;
      return { h, opacity };
    }), []);

  const vigBottomStrips = useMemo(() =>
    Array.from({ length: VIGNETTE_STRIPS }, (_, i) => {
      const frac = (VIGNETTE_STRIPS - i) / VIGNETTE_STRIPS;
      const h = (BOTTOM_DEPTH / VIGNETTE_STRIPS) * (i + 1);
      const opacity = frac * 0.16;
      return { h, opacity };
    }), []);

  const vigSideStrips = useMemo(() =>
    Array.from({ length: VIGNETTE_STRIPS }, (_, i) => {
      const frac = (VIGNETTE_STRIPS - i) / VIGNETTE_STRIPS;
      const w = (SIDE_DEPTH / VIGNETTE_STRIPS) * (i + 1);
      const opacity = frac * 0.10;
      return { w, opacity };
    }), []);

  return (
    <View style={styles.root}>

      {/* ── Layer 2: paper grain fibers ── */}
      {fibers.map((f, i) => (
        <View
          key={`f${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: f.x,
            top: f.y,
            width: f.w,
            height: f.h,
            borderRadius: f.h / 2,
            backgroundColor: f.color,
            opacity: f.opacity,
            transform: [{ rotate: `${f.rot}deg` }],
          }}
        />
      ))}

      {/* ── Layer 2b: coarser smudge blobs ── */}
      {smudges.map((s, i) => (
        <View
          key={`s${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.w,
            height: s.h,
            borderRadius: 3,
            backgroundColor: '#6B4820',
            opacity: s.op,
          }}
        />
      ))}

      {/* ── Layer 3: ruled lines ── */}
      {lines.map((l, i) => (
        <View
          key={`l${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: l.y,
            height: 1,
            backgroundColor: '#7A5A2A',
            opacity: l.opacity,
          }}
        />
      ))}

      {/* ── Layer 4: margin line ── */}
      {showMargin && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: marginX,
            width: 1.5,
            backgroundColor: '#C04040',
            opacity: 0.30,
          }}
        />
      )}

      {/* ── Layer 5: vignette — top ── */}
      {vigTopStrips.map((v, i) => (
        <View
          key={`vt${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: v.h,
            backgroundColor: '#4A2E0A',
            opacity: v.opacity,
          }}
        />
      ))}

      {/* ── Layer 5: vignette — bottom ── */}
      {vigBottomStrips.map((v, i) => (
        <View
          key={`vb${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: v.h,
            backgroundColor: '#4A2E0A',
            opacity: v.opacity,
          }}
        />
      ))}

      {/* ── Layer 5: vignette — left ── */}
      {vigSideStrips.map((v, i) => (
        <View
          key={`vl${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, bottom: 0, left: 0,
            width: v.w,
            backgroundColor: '#4A2E0A',
            opacity: v.opacity,
          }}
        />
      ))}

      {/* ── Layer 5: vignette — right ── */}
      {vigSideStrips.map((v, i) => (
        <View
          key={`vr${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, bottom: 0, right: 0,
            width: v.w,
            backgroundColor: '#4A2E0A',
            opacity: v.opacity,
          }}
        />
      ))}

      {/* ── Layer 6: hard page-edge shadow strip ── */}
      <View pointerEvents="none" style={styles.edgeTop} />
      <View pointerEvents="none" style={styles.edgeBottom} />
      <View pointerEvents="none" style={styles.edgeLeft} />
      <View pointerEvents="none" style={styles.edgeRight} />

      {/* ── Layer 7: irregular corner wear ── */}
      {/* Top-left: torn fibres */}
      <View pointerEvents="none" style={[styles.corner, { top: 2, left: 0, width: 32, height: 4, transform: [{ rotate: '3deg' }] }]} />
      <View pointerEvents="none" style={[styles.corner, { top: 6, left: 0, width: 18, height: 2, opacity: 0.18, transform: [{ rotate: '-2deg' }] }]} />
      {/* Top-right */}
      <View pointerEvents="none" style={[styles.corner, { top: 1, right: 0, width: 28, height: 3, transform: [{ rotate: '-4deg' }] }]} />
      <View pointerEvents="none" style={[styles.corner, { top: 5, right: 0, width: 16, height: 2, opacity: 0.15, transform: [{ rotate: '2deg' }] }]} />
      {/* Bottom-left */}
      <View pointerEvents="none" style={[styles.corner, { bottom: 2, left: 0, width: 36, height: 4, transform: [{ rotate: '-3deg' }] }]} />
      <View pointerEvents="none" style={[styles.corner, { bottom: 7, left: 0, width: 20, height: 2, opacity: 0.16, transform: [{ rotate: '2deg' }] }]} />
      {/* Bottom-right */}
      <View pointerEvents="none" style={[styles.corner, { bottom: 1, right: 0, width: 30, height: 3, transform: [{ rotate: '4deg' }] }]} />
      <View pointerEvents="none" style={[styles.corner, { bottom: 6, right: 0, width: 22, height: 2, opacity: 0.14, transform: [{ rotate: '-3deg' }] }]} />

      {/* ── Children ── */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Warm aged paper: yellowed off-white with a strong sepia undertone
    backgroundColor: '#EEE3BE',
    overflow: 'hidden',
  },

  // Hard shadow strips at page borders (darkest, thinnest)
  edgeTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 6,
    backgroundColor: '#2E1A04',
    opacity: 0.12,
  },
  edgeBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 8,
    backgroundColor: '#2E1A04',
    opacity: 0.14,
  },
  edgeLeft: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    width: 5,
    backgroundColor: '#2E1A04',
    opacity: 0.10,
  },
  edgeRight: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    width: 5,
    backgroundColor: '#2E1A04',
    opacity: 0.10,
  },

  // Irregular corner fiber scraps
  corner: {
    position: 'absolute',
    backgroundColor: '#7A5020',
    opacity: 0.22,
    borderRadius: 2,
  },
});
