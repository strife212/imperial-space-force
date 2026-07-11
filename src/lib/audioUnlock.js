// ── Safari WebAudio unlock ───────────────────────────────────────────────────
// Safari only starts (or resumes) an AudioContext inside a user-gesture call
// stack. Ours are created in mount effects — after the navigation click's
// stack has ended — so on Safari they sit 'suspended' and every synthesised
// voice is silent, while HTMLAudio assets play happily. (Chrome is satisfied
// by any earlier page gesture, which is why this never showed there.)
//
// Every context registers here: persistent capture-phase listeners retry on
// each gesture, resuming whatever Safari has left suspended or interrupted.
// The listeners never detach — Safari re-suspends contexts on tab switches
// and audio-session interruptions. Closed contexts prune themselves.
const ctxs = new Set()
const resumeAll = () => {
  for (const c of ctxs) {
    if (c.state === 'closed') { ctxs.delete(c); continue }
    if (c.state !== 'running') { try { c.resume().catch(() => {}) } catch (_) { ctxs.delete(c) } }
  }
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) {
    window.addEventListener(ev, resumeAll, { capture: true, passive: true })
  }
}

// Register a context for gesture-driven resume (returns it, for chaining).
// Tries once immediately too — that's all Chrome ever needs.
export function registerAudioContext(ctx) {
  if (ctx && typeof ctx.resume === 'function') {
    ctxs.add(ctx)
    try { ctx.resume().catch(() => {}) } catch (_) { /* already closed */ }
  }
  return ctx
}
