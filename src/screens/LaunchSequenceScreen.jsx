import { useState, useRef, useCallback, useEffect } from 'react'
import LaunchCodeVerifier from './LaunchCodeVerifier'

const PKG_NAME = 'PHYSICS PROJECTILE // TYPE-IV RKV'
const CD_SECS  = 10

export default function LaunchSequenceScreen({ onReturn }) {
  const [launchPhase,  setLaunchPhase]  = useState('verifying')
  const [launchLabel,  setLaunchLabel]  = useState('INITIATE LAUNCH SEQUENCE')
  const [launchCdText, setLaunchCdText] = useState('')
  const [cdVisible,    setCdVisible]    = useState(true)
  const [launchFiring, setLaunchFiring] = useState(false)

  const phaseRef   = useRef('verifying')
  const cdTimerRef = useRef(null)
  const codetickRef = useRef(null)

  useEffect(() => {
    const sfx = new Audio(`${import.meta.env.BASE_URL}codetick.wav`)
    sfx.preload = 'auto'
    codetickRef.current = sfx
    return () => { clearTimeout(cdTimerRef.current) }
  }, [])

  const playTick = useCallback(() => {
    if (codetickRef.current) {
      codetickRef.current.currentTime = 0
      codetickRef.current.volume = 0.1
      codetickRef.current.play().catch(() => {})
    }
  }, [])

  const handleVerifyComplete = useCallback(() => {
    if (phaseRef.current !== 'verifying') return
    phaseRef.current = 'armed'
    setLaunchPhase('armed')
  }, [])

  const handleFire = useCallback(() => {
    if (phaseRef.current !== 'armed') return
    phaseRef.current = 'countdown'
    setLaunchPhase('countdown')
    setLaunchFiring(true)

    let val = CD_SECS
    const tick = () => {
      if (val > 0) {
        setLaunchCdText(`T− ${String(val).padStart(2, '0')}`)
        val--
        cdTimerRef.current = setTimeout(tick, 1000)
      } else {
        phaseRef.current = 'fired'
        setLaunchPhase('fired')
        setLaunchCdText('LAUNCHED')
        setLaunchLabel('PACKAGE AWAY')
      }
    }
    tick()
  }, [])

  return (
    <div id="launch-sequence-screen">
      <div className="lss-backdrop" />
      <div className="lss-body">
        <div className="lss-title">LAUNCH SEQUENCE DIAGNOSTIC</div>
        <div className="lss-verifier-wrap">
          <LaunchCodeVerifier
            onComplete={handleVerifyComplete}
            onTick={playTick}
            onFire={handleFire}
            launchPhase={launchPhase}
            launchLabel={launchLabel}
            launchFiring={launchFiring}
            launchCdText={launchCdText}
            cdVisible={cdVisible}
            noTarget={false}
            onDismiss={null}
          />
        </div>
        <button className="lss-return-btn" onClick={onReturn}>
          RETURN TO DEBUG
        </button>
      </div>
    </div>
  )
}
