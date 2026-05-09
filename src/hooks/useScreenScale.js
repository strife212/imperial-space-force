import { useRef, useEffect } from 'react'

export function useScreenScale() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const apply = () => {
      const sh = el.scrollHeight
      if (sh < 10) return
      const scale = Math.min(1, (window.innerHeight - 24) / sh)
      el.style.transform = scale < 1 ? `scale(${scale})` : ''
    }

    // Initial measurement after fonts are ready
    document.fonts.ready.then(() => requestAnimationFrame(apply))
    // Re-measure after a short delay to catch images that load after first paint
    // (e.g. cached images that still load async when returning from another screen)
    document.fonts.ready.then(() => setTimeout(apply, 300))
  }, [])
  return ref
}
