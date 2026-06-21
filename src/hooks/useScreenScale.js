import { useRef, useLayoutEffect } from 'react'

// Full-screens that pass SCREEN_DESIGN_HEIGHT scale by the SAME factor on a
// given device (instead of each fitting its own content), so shared chrome like
// the header renders at a consistent size across those screens.
export const SCREEN_DESIGN_HEIGHT = 920

export function useScreenScale(designHeight) {
  const ref = useRef(null)
  // useLayoutEffect (not useEffect) so the initial scale is applied before the
  // browser paints — otherwise the screen renders full-size for a frame and
  // then snaps to the scaled size (a visible flash on mount).
  useLayoutEffect(() => {
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

    // Apply synchronously before first paint (no unscaled flash)
    apply()
    // Re-apply once fonts/late images settle, in case content height shifted
    document.fonts.ready.then(() => requestAnimationFrame(apply))
    document.fonts.ready.then(() => setTimeout(apply, 300))
    // Keep it correct if the window is resized
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [designHeight])
  return ref
}

// Scale the ref element down uniformly to fit its PARENT's height — for content
// that sits between fixed chrome (e.g. a header/footer) and would otherwise
// overflow/scroll. The parent should be the height-constrained container.
export function useFitScale() {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const apply = () => {
      const parent = el.parentElement
      if (!parent) return
      el.style.transform = ''                 // measure unscaled
      const content = el.scrollHeight
      const avail = parent.clientHeight
      if (content < 10 || avail < 10) return
      const scale = Math.min(1, avail / content)
      el.style.transform = scale < 1 ? `scale(${scale})` : ''
    }

    apply()
    document.fonts.ready.then(() => requestAnimationFrame(apply))
    document.fonts.ready.then(() => setTimeout(apply, 300))
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])
  return ref
}
