import { useEffect, useRef } from 'react'
import { makeProclamation } from './cutscene/proclamation'
import './battle/battle.css'

// Debug-only viewer for the Proclamation of the Continuing Order: the document
// on a dark backdrop, exactly as a cutscene would summon it. `brief` shows the
// broadside variant. CLOSE returns to the debug screen.
export default function ProclamationView({ onBack, brief = false }) {
  const hostRef = useRef(null)

  useEffect(() => {
    const p = makeProclamation(hostRef.current, { onClose: onBack, brief })
    const t = setTimeout(() => p.show(), 150)
    return () => { clearTimeout(t); p.dispose() }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return <div id="proclamation-view" ref={hostRef} />
}
