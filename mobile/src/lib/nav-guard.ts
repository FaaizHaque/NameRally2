/**
 * Global navigation guard — prevents double-tap navigation across the entire app.
 *
 * A single module-level boolean is sufficient because React Native JS runs on a
 * single thread. Once a navigation call fires we lock for `lockMs` milliseconds,
 * which is longer than any screen transition animation (typically 300-400 ms).
 *
 * Two usage patterns:
 *
 *   // Inline (sync navigation):
 *   onPress={() => navGuard(() => router.push('/game-mode'))}
 *
 *   // Async handler (check at the top):
 *   const handleFoo = async () => {
 *     if (!navGuard()) return;
 *     await doSomethingAsync();
 *     router.replace('/bar');
 *   };
 */

let locked = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export function navGuard(fn?: () => void, lockMs = 700): boolean {
  if (locked) return false;
  locked = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    locked = false;
    timer = null;
  }, lockMs);
  if (fn) fn();
  return true;
}
