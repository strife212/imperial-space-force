import { useRef, useEffect } from 'react'

// Full-screens that pass SCREEN_DESIGN_HEIGHT scale by the SAME factor on a
// given device (instead of each fitting its own content), so shared chrome like
// the header renders at a consistent size across those screens.
export const SCREEN_DESIGN_HEIGHT = 920

export function useScreenScale(designHeight) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const apply = () => {
      // With a fixed designHeight, scale by viewport vs that shared reference;
      // otherwise fit the element's own measured content.
      const sh = designHeight || el.scrollHeight
      if (sh < 10) return
      const scale = Math.min(1, (window.innerHeight - 24) / sh)
      el.style.transform = scale < 1 ? `scale(${scale})` : ''
    }

    // Initial measurement after fonts are ready
    document.fonts.ready.then(() => requestAnimationFrame(apply))
    // Re-measure after a short delay to catch images that load after first paint
    // (e.g. cached images that still load async when returning from another screen)
    document.fonts.ready.then(() => setTimeout(apply, 300))
    // Keep it correct if the window is resized
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [designHeight])
  return ref
}
