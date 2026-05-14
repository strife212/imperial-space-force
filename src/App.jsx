import { useState, useEffect, useRef } from 'react'
import { getFlags, setFlag } from './lib/store'
import LoginScreen from './screens/LoginScreen'
import BootScreen from './screens/BootScreen'
import MainPanel from './screens/MainPanel'
import LaunchMonitorScreen from './screens/LaunchMonitorScreen'
import DebugScreen from './screens/DebugScreen'
import MenuScreen from './screens/MenuScreen'
import ReactorScreen from './screens/ReactorScreen'
import TargetingScreen from './screens/TargetingScreen'
import GameOverScreen from './screens/GameOverScreen'
import EncyclopediaScreen from './screens/EncyclopediaScreen'
import AntennaAlignmentScreen from './screens/AntennaAlignmentScreen'
import MailOverlay from './components/MailOverlay'
import { INITIAL_MESSAGES, ALL_TRIGGERED_MESSAGES } from './data/messages'
import { getTargetName, TARGETS } from './lib/planetData'

const countTrueFlags = () => Object.values(getFlags()).filter(Boolean).length

export default function App() {
  const [screen,            setScreen]            = useState('login')
  const [launchPackage,     setLaunchPackage]     = useState('')
  const [plasmaLevel,       setPlasmaLevel]       = useState(0)
  const [targetIdx,         setTargetIdx]         = useState(-1)
  const [targetingSource,   setTargetingSource]   = useState('debug')
  const [messages,          setMessages]          = useState(INITIAL_MESSAGES)
  const [mailOpen,          setMailOpen]          = useState(false)
  const [repliedIds,        setRepliedIds]        = useState(new Set())
  const [sessionFlags,      setSessionFlags]      = useState(new Set())
  const [antennaAligned,    setAntennaAligned]    = useState(false)
  const [toastKey,          setToastKey]          = useState(0)
  const [toastVisible,      setToastVisible]      = useState(false)
  const seenMessageIds      = useRef(new Set(INITIAL_MESSAGES.map(m => m.id)))
  const hasShownInitialToast = useRef(false)
  const [initialFlagCount]                        = useState(() => countTrueFlags())
  const [encyclopediaSource, setEncyclopediaSource] = useState('menu')
  const [countdownSeconds,   setCountdownSeconds]   = useState(10)
  const [gameOverFail,       setGameOverFail]       = useState(false)
  const [underAttack,        setUnderAttack]        = useState(false)

  const triggerFlag = (name) => setSessionFlags(prev => new Set([...prev, name]))

  useEffect(() => {
    if (screen === 'main' && !hasShownInitialToast.current) {
      hasShownInitialToast.current = true
      const t = setTimeout(() => {
        setToastKey(k => k + 1)
        setToastVisible(true)
      }, 1600)
      return () => clearTimeout(t)
    }
  }, [screen])

  useEffect(() => {
    const toAdd = ALL_TRIGGERED_MESSAGES.filter(m =>
      m.enabled &&
      sessionFlags.has(m.requires) &&
      !seenMessageIds.current.has(m.id)
    )
    if (!toAdd.length) return
    toAdd.forEach(m => seenMessageIds.current.add(m.id))
    setMessages(prev => [...prev, ...toAdd.map(({ enabled: _e, requires: _r, ...rest }) => ({ ...rest, read: false }))])
    setToastKey(k => k + 1)
    setToastVisible(true)
  }, [sessionFlags])

  const goEncyclopedia = (source) => { setEncyclopediaSource(source); setScreen('encyclopedia') }

  const targetName  = targetIdx >= 0 ? getTargetName(targetIdx) : 'CLASSIFIED'
  const unreadCount = messages.filter(m => !m.read).length
  const markRead    = (id) => setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m))
  const markReplied = (id) => setRepliedIds(prev => new Set([...prev, id]))
  const mailProps   = { unreadCount, onMailOpen: () => { setMailOpen(true); setFlag('seenSelene', true) }, triggerFlag }

  return (
    <>
      <div className="crt-overlay" />
      <div className="scanlines" />
      <div className="vignette" />
      {screen === 'login'   && <LoginScreen onComplete={() => setScreen('menu')} onDebug={() => setScreen('debug')} />}
      {screen === 'menu'    && <MenuScreen  onManage={() => setScreen('boot')} onLogout={() => setScreen('login')} onEncyclopedia={() => goEncyclopedia('menu')} />}
      {screen === 'boot'    && <BootScreen  onComplete={() => setScreen('main')} />}
      {screen === 'main'    && <MainPanel onLogout={() => setScreen('login')} onLaunchComplete={(pkg) => { setLaunchPackage(pkg); setCountdownSeconds(10); setScreen('monitor') }} onReactor={() => setScreen('reactor')} onTargeting={() => { setTargetingSource('main'); setScreen('targeting') }} onAdjustAntenna={() => setScreen('antenna')} antennaAligned={antennaAligned} reactorPlasma={plasmaLevel} targetIdx={targetIdx} countdownSeconds={countdownSeconds} underAttack={underAttack} onRadioFreq={(f) => { if (f === 9.2) setUnderAttack(true) }} {...mailProps} />}
      {screen === 'monitor' && <LaunchMonitorScreen onReturn={() => { const imperial = !!TARGETS[targetIdx]?.system?.imperial; setGameOverFail(imperial); setScreen('gameover') }} onLogout={() => { const imperial = !!TARGETS[targetIdx]?.system?.imperial; setGameOverFail(imperial); setScreen('gameover') }} packageName={launchPackage} targetName={targetName} {...mailProps} />}
      {screen === 'debug'     && <DebugScreen onNavigate={(s) => { if (s === 'targeting') setTargetingSource('debug'); setGameOverFail(false); setUnderAttack(false); setScreen(s) }} onDebugMain={() => { setPlasmaLevel(75); setTargetIdx(2); setCountdownSeconds(2); setUnderAttack(false); setScreen('main') }} onDebugAttack={() => { setPlasmaLevel(75); setTargetIdx(2); setCountdownSeconds(2); setUnderAttack(true); setScreen('main') }} onDebugFail={() => { setGameOverFail(true); setScreen('gameover') }} />}
      {screen === 'reactor'   && <ReactorScreen onReturn={(density) => { setPlasmaLevel(density); if (density >= 25) triggerFlag('reactorPoweredUp'); setScreen('main') }} onLogout={() => setScreen('main')} initialPlasma={plasmaLevel} {...mailProps} />}
      {screen === 'targeting' && <TargetingScreen onBack={(idx) => { setTargetIdx(idx); setScreen(targetingSource) }} initialSelectedIdx={targetIdx} {...mailProps} />}
      {screen === 'gameover'      && <GameOverScreen initialFlagCount={initialFlagCount} onEncyclopedia={() => goEncyclopedia('gameover')} fail={gameOverFail} />}
      {screen === 'encyclopedia'  && <EncyclopediaScreen onReturn={() => setScreen(encyclopediaSource)} />}
      {screen === 'antenna'       && <AntennaAlignmentScreen onBack={() => setScreen('main')} onAlignComplete={() => { setAntennaAligned(true); triggerFlag('antennaAligned') }} {...mailProps} />}
      {mailOpen && <MailOverlay messages={messages} onRead={markRead} onClose={() => setMailOpen(false)} repliedIds={repliedIds} onReply={markReplied} />}
      {toastVisible && <>
        <div key={`dim-${toastKey}`} className="msg-toast-dim" onAnimationEnd={() => setToastVisible(false)} />
        <div key={toastKey} className="msg-toast"><span>✉</span>NEW MESSAGE RECEIVED</div>
      </>}
    </>
  )
}
