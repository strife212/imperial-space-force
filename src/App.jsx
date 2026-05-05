import { useState } from 'react'
import LoginScreen from './screens/LoginScreen'
import BootScreen from './screens/BootScreen'
import MainPanel from './screens/MainPanel'
import LaunchMonitorScreen from './screens/LaunchMonitorScreen'
import DebugScreen from './screens/DebugScreen'
import MenuScreen from './screens/MenuScreen'
import ReactorScreen from './screens/ReactorScreen'
import MailOverlay from './components/MailOverlay'
import { INITIAL_MESSAGES } from './data/messages'

export default function App() {
  const [screen,        setScreen]        = useState('login')
  const [launchPackage, setLaunchPackage] = useState('')
  const [plasmaLevel,   setPlasmaLevel]   = useState(0)
  const [messages,      setMessages]      = useState(INITIAL_MESSAGES)
  const [mailOpen,      setMailOpen]      = useState(false)
  const [repliedIds,    setRepliedIds]    = useState(new Set())

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
      {screen === 'menu'    && <MenuScreen  onManage={() => setScreen('boot')} onLogout={() => setScreen('login')} />}
      {screen === 'boot'    && <BootScreen  onComplete={() => setScreen('main')} />}
      {screen === 'main'    && <MainPanel onLogout={() => setScreen('login')} onLaunchComplete={(pkg) => { setLaunchPackage(pkg); setScreen('monitor') }} onReactor={() => setScreen('reactor')} reactorPlasma={plasmaLevel} {...mailProps} />}
      {screen === 'monitor' && <LaunchMonitorScreen onReturn={() => setScreen('main')} onLogout={() => setScreen('login')} packageName={launchPackage} {...mailProps} />}
      {screen === 'debug'   && <DebugScreen onNavigate={setScreen} />}
      {screen === 'reactor' && <ReactorScreen onReturn={(density) => { setPlasmaLevel(density); setScreen('main') }} onLogout={() => setScreen('login')} initialPlasma={plasmaLevel} />}
      {mailOpen && <MailOverlay messages={messages} onRead={markRead} onClose={() => setMailOpen(false)} repliedIds={repliedIds} onReply={markReplied} />}
    </>
  )
}
