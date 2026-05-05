import { useState } from 'react'
import LoginScreen from './screens/LoginScreen'
import BootScreen from './screens/BootScreen'
import MainPanel from './screens/MainPanel'
import LaunchMonitorScreen from './screens/LaunchMonitorScreen'
import DebugScreen from './screens/DebugScreen'

export default function App() {
  const [screen, setScreen] = useState('login')

  return (
    <>
      <div className="crt-overlay" />
      <div className="scanlines" />
      <div className="vignette" />
      {screen === 'login'   && <LoginScreen onComplete={() => setScreen('boot')} onDebug={() => setScreen('debug')} />}
      {screen === 'boot'    && <BootScreen  onComplete={() => setScreen('main')} />}
      {screen === 'main'    && <MainPanel onLogout={() => setScreen('login')} onLaunchComplete={() => setScreen('monitor')} />}
      {screen === 'monitor' && <LaunchMonitorScreen onReturn={() => setScreen('main')} onLogout={() => setScreen('login')} />}
      {screen === 'debug'   && <DebugScreen onNavigate={setScreen} />}
    </>
  )
}
