import { useState } from 'react'
import LoginScreen from './screens/LoginScreen'
import BootScreen from './screens/BootScreen'
import MainPanel from './screens/MainPanel'

export default function App() {
  const [screen, setScreen] = useState('login')

  return (
    <>
      <div className="crt-overlay" />
      <div className="scanlines" />
      <div className="vignette" />
      {screen === 'login' && <LoginScreen onComplete={() => setScreen('boot')} />}
      {screen === 'boot'  && <BootScreen  onComplete={() => setScreen('main')} />}
      {screen === 'main'  && <MainPanel onLogout={() => setScreen('login')} />}
    </>
  )
}
