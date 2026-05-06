import { useState } from 'react'
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
import MailOverlay from './components/MailOverlay'
import { INITIAL_MESSAGES } from './data/messages'
import { PLANETS, SUN, SUN_IDX } from './lib/planetData'

export default function App() {
  const [screen,          setScreen]          = useState('login')
  const [launchPackage,   setLaunchPackage]   = useState('')
  const [plasmaLevel,     setPlasmaLevel]     = useState(0)
  const [targetIdx,       setTargetIdx]       = useState(-1)
  const [targetingSource, setTargetingSource] = useState('debug')
  const [messages,      setMessages]      = useState(INITIAL_MESSAGES)
  const [mailOpen,      setMailOpen]      = useState(false)
  const [repliedIds,    setRepliedIds]    = useState(new Set())

  const targetName  = targetIdx === SUN_IDX ? SUN.name
                    : targetIdx >= 0        ? PLANETS[targetIdx].name
                    : 'CLASSIFIED'
  const unreadCount = messages.filter(m => !m.read).length
  const markRead    = (id) => setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m))
  const markReplied = (id) => setRepliedIds(prev => new Set([...prev, id]))
  const mailProps   = { unreadCount, onMailOpen: () => setMailOpen(true) }

  return (
    <>
      <div className="crt-overlay" />
      <div className="scanlines" />
      <div className="vignette" />
      {screen === 'login'   && <LoginScreen onComplete={() => setScreen('menu')} onDebug={() => setScreen('debug')} />}
      {screen === 'menu'    && <MenuScreen  onManage={() => setScreen('boot')} onLogout={() => setScreen('login')} onEncyclopedia={() => setScreen('encyclopedia')} />}
      {screen === 'boot'    && <BootScreen  onComplete={() => setScreen('main')} />}
      {screen === 'main'    && <MainPanel onLogout={() => setScreen('login')} onLaunchComplete={(pkg) => { setLaunchPackage(pkg); setScreen('monitor') }} onReactor={() => setScreen('reactor')} onTargeting={() => { setTargetingSource('main'); setScreen('targeting') }} reactorPlasma={plasmaLevel} targetIdx={targetIdx} {...mailProps} />}
      {screen === 'monitor' && <LaunchMonitorScreen onReturn={() => setScreen('gameover')} onLogout={() => setScreen('gameover')} packageName={launchPackage} targetName={targetName} {...mailProps} />}
      {screen === 'debug'     && <DebugScreen onNavigate={(s) => { if (s === 'targeting') setTargetingSource('debug'); setScreen(s) }} />}
      {screen === 'reactor'   && <ReactorScreen onReturn={(density) => { setPlasmaLevel(density); setScreen('main') }} onLogout={() => setScreen('main')} initialPlasma={plasmaLevel} {...mailProps} />}
      {screen === 'targeting' && <TargetingScreen onBack={(idx) => { setTargetIdx(idx); setScreen(targetingSource) }} initialSelectedIdx={targetIdx} {...mailProps} />}
      {screen === 'gameover'      && <GameOverScreen />}
      {screen === 'encyclopedia'  && <EncyclopediaScreen onReturn={() => setScreen('menu')} />}
      {mailOpen && <MailOverlay messages={messages} onRead={markRead} onClose={() => setMailOpen(false)} repliedIds={repliedIds} onReply={markReplied} />}
    </>
  )
}
