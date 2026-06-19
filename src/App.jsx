import { useState, useEffect, useRef } from 'react'
import { getFlags, setFlag } from './lib/store'
import StartScreen from './screens/StartScreen'
import LoginScreen from './screens/legacy/LoginScreen'
import BootScreen from './screens/legacy/BootScreen'
import MainPanel from './screens/legacy/MainPanel'
import LaunchMonitorScreen from './screens/legacy/LaunchMonitorScreen'
import DebugScreen from './screens/DebugScreen'
import MenuScreen from './screens/legacy/MenuScreen'
import ReactorScreen from './screens/legacy/ReactorScreen'
import TargetingScreen from './screens/legacy/TargetingScreen'
import GameOverScreen from './screens/legacy/GameOverScreen'
import EncyclopediaScreen from './screens/legacy/EncyclopediaScreen'
import LaunchSequenceScreen from './screens/legacy/LaunchSequenceScreen'
import BlackHoleScreen from './screens/legacy/BlackHoleScreen'
import PowerManagementScreen from './screens/legacy/PowerManagementScreen'
import SpaceBattleScreen from './screens/SpaceBattleScreen'
import VisualTestScreen from './screens/VisualTestScreen'
import CutsceneScreen from './screens/CutsceneScreen'
import CutsceneAlephScreen from './screens/CutsceneAlephScreen'
import AntennaAlignmentScreen from './screens/legacy/AntennaAlignmentScreen'
import MailOverlay from './components/MailOverlay'
import UrgentMessageOverlay from './components/UrgentMessageOverlay'
import { INITIAL_MESSAGES, ALL_TRIGGERED_MESSAGES } from './data/messages'
import { getTargetName, TARGETS } from './lib/planetData'

const countTrueFlags = () => Object.values(getFlags()).filter(Boolean).length

// ── Deep links: a bare path (e.g. /battlesim) opens straight to that screen ───
// On GitHub Pages the unknown path is served by 404.html, which bounces it back
// to index.html where a snippet restores the real URL before React mounts.
const DEEP_LINKS = { battlesim: 'home' }
const pathScreen = () => {
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
  return DEEP_LINKS[slug] || null
}

// ── Urgent-message sequence triggered by under-attack ────────────────────────
const URGENT_ATTACK_SEQ = [
  {
    sender:  'Admiralty Command',
    subject: 'CHRONOLOGY PROTECTION ALERT',
    body:    'The chronology protection readings have gone off the charts... what is happening over there?',
  },
  {
    sender:   'UNKNOWN SENDER',
    portrait: `${import.meta.env.BASE_URL}darkness.webp`,
    body:     '▓▓ ░░ ▓░ ░▓ ▓▓ ░░ ▓░ ░▓ ▓▓ ░░ ▓░ ░▓ ▓▓ ░░ ▓░ ░▓ ▓▓ ░░ ▓░ ░▓...',
  },
  {
    sender:  'Admiralty Command',
    subject: 'THREAT ASSESSMENT',
    body:    '**TIER 1 THREAT DETECTED**\n\n**STRATCON ONE**\n\n##WEAPONS FREE##',
  },
]

export default function App() {
  const [screen,            setScreen]            = useState(() => pathScreen() || 'home')
  const [launchPackage,     setLaunchPackage]     = useState('')
  const [plasmaLevel,       setPlasmaLevel]       = useState(0)
  const [targetIdx,         setTargetIdx]         = useState(-1)
  const [targetingSource,   setTargetingSource]   = useState('debug')
  const [reactorSource,     setReactorSource]     = useState('main')
  const [blackholeSource,   setBlackholeSource]   = useState('debug')
  const [powerSource,       setPowerSource]       = useState('debug')
  const [battleSource,      setBattleSource]      = useState('debug')
  const [cutsceneSource,    setCutsceneSource]    = useState('debug')
  const [bhOutput,          setBhOutput]          = useState(0)
  const [bhYield,           setBhYield]           = useState(0)
  const [messages,          setMessages]          = useState([])   // inbox fills on first main-panel visit
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
  const [radioFreq,          setRadioFreq]          = useState(8.0)
  const [darknessKey,        setDarknessKey]        = useState(0)
  const [urgentIdx,          setUrgentIdx]          = useState(null)
  const [sequenceLocked,     setSequenceLocked]     = useState(false)
  const prevUnderAttack = useRef(false)
  const urgentTimerRef  = useRef(null)

  // ── Under-attack sequence: darkness flash → blocker → 3 urgent messages ──
  // Triggers exactly once when underAttack transitions false→true and
  // persists across screen navigation.
  useEffect(() => {
    if (underAttack && !prevUnderAttack.current) {
      setDarknessKey(k => k + 1)
      setSequenceLocked(true)
      urgentTimerRef.current = setTimeout(() => setUrgentIdx(0), 5200)
    } else if (!underAttack && prevUnderAttack.current) {
      // reset on attack-off so a future attack can trigger fresh
      clearTimeout(urgentTimerRef.current)
      setSequenceLocked(false)
      setUrgentIdx(null)
    }
    prevUnderAttack.current = underAttack
  }, [underAttack])
  useEffect(() => () => clearTimeout(urgentTimerRef.current), [])

  const triggerFlag = (name) => setSessionFlags(prev => new Set([...prev, name]))

  useEffect(() => {
    if (screen === 'main' && !hasShownInitialToast.current) {
      hasShownInitialToast.current = true
      setMessages(INITIAL_MESSAGES)   // initial mail arrives on first main-panel visit
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
      {screen === 'home'    && <StartScreen onCampaign={() => { setCutsceneSource('home'); setScreen('cutscene') }} onSkirmish={() => { setBattleSource('home'); setScreen('battle') }} onPlay={() => setScreen('login')} onDebug={() => setScreen('debug')} />}
      {screen === 'login'   && <LoginScreen onComplete={() => setScreen('menu')} onBack={() => setScreen('home')} />}
      {screen === 'menu'    && <MenuScreen  onManage={() => setScreen('boot')} onLogout={() => setScreen('login')} onEncyclopedia={() => goEncyclopedia('menu')} />}
      {screen === 'boot'    && <BootScreen  onComplete={() => setScreen('main')} />}
      {screen === 'main'    && <MainPanel onLogout={() => setScreen('login')} onLaunchComplete={(pkg) => { setLaunchPackage(pkg); setCountdownSeconds(10); setScreen('monitor') }} onPower={() => { setPowerSource('main'); setScreen('power') }} onTargeting={() => { setTargetingSource('main'); setScreen('targeting') }} onAdjustAntenna={() => setScreen('antenna')} antennaAligned={antennaAligned} reactorPlasma={plasmaLevel} bhOutput={bhOutput} bhYield={bhYield} targetIdx={targetIdx} countdownSeconds={countdownSeconds} underAttack={underAttack} onRadioFreq={(f) => { setRadioFreq(f); if (f === 9.2 && antennaAligned) setUnderAttack(true) }} radioFreq={radioFreq} {...mailProps} />}
      {screen === 'monitor' && <LaunchMonitorScreen onReturn={() => { const imperial = !!TARGETS[targetIdx]?.system?.imperial; setGameOverFail(imperial); setScreen('gameover') }} onLogout={() => { const imperial = !!TARGETS[targetIdx]?.system?.imperial; setGameOverFail(imperial); setScreen('gameover') }} packageName={launchPackage} targetName={targetName} {...mailProps} />}
      {screen === 'debug'     && <DebugScreen onNavigate={(s) => { if (s === 'targeting') setTargetingSource('debug'); if (s === 'reactor') setReactorSource('main'); if (s === 'blackhole') setBlackholeSource('debug'); if (s === 'power') setPowerSource('debug'); if (s === 'battle') setBattleSource('debug'); if (s === 'cutscene' || s === 'cutscene-aleph') setCutsceneSource('debug'); setGameOverFail(false); setUnderAttack(false); setScreen(s) }} onDebugMain={() => { setPlasmaLevel(75); setBhOutput(4.3); setBhYield(50); setTargetIdx(2); setCountdownSeconds(2); setUnderAttack(false); setScreen('main') }} onDebugAttack={() => { setPlasmaLevel(75); setBhOutput(4.3); setBhYield(50); setTargetIdx(2); setCountdownSeconds(2); setUnderAttack(true); setScreen('main') }} onDebugFail={() => { setGameOverFail(true); setScreen('gameover') }} />}
      {screen === 'reactor'   && <ReactorScreen onReturn={(density) => { setPlasmaLevel(density); setScreen(reactorSource) }} onLogout={() => setScreen(reactorSource)} initialPlasma={plasmaLevel} {...mailProps} />}
      {screen === 'targeting' && <TargetingScreen onBack={(idx) => { setTargetIdx(idx); setScreen(targetingSource) }} initialSelectedIdx={targetIdx} {...mailProps} />}
      {screen === 'gameover'      && <GameOverScreen initialFlagCount={initialFlagCount} onEncyclopedia={() => goEncyclopedia('gameover')} fail={gameOverFail} targetName={targetName} />}
      {screen === 'encyclopedia'  && <EncyclopediaScreen onReturn={() => setScreen(encyclopediaSource)} />}
      {screen === 'antenna'         && <AntennaAlignmentScreen onBack={() => setScreen('main')} onAlignComplete={() => { setAntennaAligned(true); triggerFlag('antennaAligned') }} {...mailProps} />}
      {screen === 'launch-sequence' && <LaunchSequenceScreen onReturn={() => setScreen('debug')} />}
      {screen === 'blackhole'       && <BlackHoleScreen onReturn={() => setScreen(blackholeSource)} initialYield={bhYield} onPower={(out, yld) => { setBhOutput(out); setBhYield(yld); if (out > 1) triggerFlag('penroseActivated') }} {...mailProps} />}
      {screen === 'battle'          && <SpaceBattleScreen onReturn={() => setScreen(battleSource)} {...mailProps} />}
      {screen === 'vistest'         && <VisualTestScreen onReturn={() => setScreen('debug')} />}
      {screen === 'cutscene'        && <CutsceneScreen onReturn={() => setScreen(cutsceneSource)} onComplete={() => { setBattleSource(cutsceneSource); setScreen('battle') }} />}
      {screen === 'cutscene-aleph'  && <CutsceneAlephScreen onReturn={() => setScreen(cutsceneSource)} onComplete={() => { setBattleSource(cutsceneSource); setScreen('battle') }} />}
      {screen === 'power'           && <PowerManagementScreen onReactor={() => { setReactorSource('power'); setScreen('reactor') }} onBlackHole={() => { setBlackholeSource('power'); setScreen('blackhole') }} onReturn={() => setScreen(powerSource)} reactorPlasma={plasmaLevel} bhOutput={bhOutput} bhYield={bhYield} {...mailProps} />}
      {mailOpen && <MailOverlay messages={messages} onRead={markRead} onClose={() => setMailOpen(false)} repliedIds={repliedIds} onReply={markReplied} />}

      {/* ── Under-attack sequence overlays ────────────────────────────── */}
      {darknessKey > 0 && <img key={darknessKey} src={`${import.meta.env.BASE_URL}darkness.webp`} className="darkness-flash-overlay" alt="" />}
      {sequenceLocked && <div className="attack-seq-blocker" />}
      {urgentIdx !== null && urgentIdx < URGENT_ATTACK_SEQ.length && (
        <UrgentMessageOverlay
          key={urgentIdx}
          {...URGENT_ATTACK_SEQ[urgentIdx]}
          onClose={() => {
            const next = urgentIdx + 1 < URGENT_ATTACK_SEQ.length ? urgentIdx + 1 : null
            setUrgentIdx(null)
            if (next !== null) setTimeout(() => setUrgentIdx(next), 200)
            else setSequenceLocked(false)
          }}
        />
      )}

      {toastVisible && <>
        <div key={`dim-${toastKey}`} className="msg-toast-dim" onAnimationEnd={() => setToastVisible(false)} />
        <div key={toastKey} className="msg-toast"><span>✉</span>NEW MESSAGE RECEIVED</div>
      </>}
    </>
  )
}
