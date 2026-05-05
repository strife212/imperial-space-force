import { useState } from 'react'
import LoginScreen from './screens/LoginScreen'
import BootScreen from './screens/BootScreen'
import MainPanel from './screens/MainPanel'
import LaunchMonitorScreen from './screens/LaunchMonitorScreen'
import DebugScreen from './screens/DebugScreen'
import MenuScreen from './screens/MenuScreen'
import ReactorScreen from './screens/ReactorScreen'

export default function App() {
  const [screen,        setScreen]        = useState('login')
  const [launchPackage, setLaunchPackage] = useState('')
  const [plasmaLevel,   setPlasmaLevel]   = useState(75)

  return (
    <>
      <div className="crt-overlay" />
      <div className="scanlines" />
      <div className="vignette" />
      {screen === 'login'   && <LoginScreen onComplete={() => setScreen('menu')} onDebug={() => setScreen('debug')} />}
      {screen === 'menu'    && <MenuScreen  onManage={() => setScreen('boot')} onLogout={() => setScreen('login')} />}
      {screen === 'boot'    && <BootScreen  onComplete={() => setScreen('main')} />}
      {screen === 'main'    && <MainPanel onLogout={() => setScreen('login')} onLaunchComplete={(pkg) => { setLaunchPackage(pkg); setScreen('monitor') }} onReactor={() => setScreen('reactor')} reactorPlasma={plasmaLevel} />}
      {screen === 'monitor' && <LaunchMonitorScreen onReturn={() => setScreen('main')} onLogout={() => setScreen('login')} packageName={launchPackage} />}
      {screen === 'debug'   && <DebugScreen onNavigate={setScreen} />}
      {screen === 'reactor' && <ReactorScreen onReturn={(density) => { setPlasmaLevel(density); setScreen('main') }} onLogout={() => setScreen('login')} initialPlasma={plasmaLevel} />}
    </>
  )
}
