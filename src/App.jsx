import { useState, useEffect, useRef } from 'react'
import { getFlags, getFlag, setFlag } from './lib/store'
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
import Cutscene from './screens/cutscene/Cutscene'
import { SCENES, STORY } from './screens/cutscene/scenes'
import CampaignMap from './screens/CampaignMap'
import ShipyardScreen from './screens/ShipyardScreen'
import CharacterSelect from './screens/CharacterSelect'
import FleetReview from './screens/FleetReview'
import UpgradeScreen from './screens/UpgradeScreen'
import CardVaultScreen from './screens/CardVaultScreen'
import DrawTestScreen from './screens/DrawTestScreen'
import FleetBoot from './screens/FleetBoot'
import { NODE_BATTLES, getFleet, getDeployFleet, getFlagshipName, getCapMaxHp, hasCapMissile, hasMacroMissile, getCombatMods, addUpgrade, recordBattle, resetCampaign } from './lib/campaign'
import AntennaAlignmentScreen from './screens/legacy/AntennaAlignmentScreen'
import MailOverlay from './components/MailOverlay'
import UrgentMessageOverlay from './components/UrgentMessageOverlay'
import { INITIAL_MESSAGES, ALL_TRIGGERED_MESSAGES } from './data/messages'
import { getTargetName, TARGETS } from './lib/planetData'

const countTrueFlags = () => Object.values(getFlags()).filter(Boolean).length

// ── Deep links: a bare path (e.g. /battlesim) opens straight to that screen ───
// On GitHub Pages the unknown path is served by 404.html, which bounces it back
// to index.html where a snippet restores the real URL before React mounts.
const DEEP_LINKS = { battlesim: 'home', fleetbuilder: 'fleetbuilder' }
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
  const [cutsceneId,        setCutsceneId]        = useState('firstContact')   // which cutscene is showing
  const [cutsceneChain,     setCutsceneChain]     = useState(false)            // advance through STORY on complete
  const [campaignNode,      setCampaignNode]      = useState(null)             // active campaign node: cutscene → shipyard → battle (null = not in campaign flow)
  const [fleetReviewSource, setFleetReviewSource] = useState('campaign-map')   // where the Fleet Review screen returns to
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

  // Build the campaign-engagement config for a node: locked fleets (player from the
  // persistent roster, enemy fixed for the node), plus result/exit/retry callbacks.
  const exitCampaign = () => { setCampaignNode(null); setScreen('campaign-map') }
  const campaignBattle = (i) => ({
    nodeIndex:  i,
    nodeTitle:  NODE_BATTLES[i].title,
    enemyName:  NODE_BATTLES[i].enemyName,
    enemyComp:  NODE_BATTLES[i].enemy,
    sky:        NODE_BATTLES[i].sky,              // nebula backdrop for this node (default first sky)
    playerComp: getDeployFleet(),                 // buyable fleet + permanent (unsellable) fighters
    capMaxHp:   getCapMaxHp(),                     // flagship hull upgrades
    capMissile: hasCapMissile(),                  // flagship missile-launcher upgrade
    macroMissile: hasMacroMissile(),              // 2nd admiral skill: macro-missile barrage
    mods:       getCombatMods(),                  // aggregated stat upgrades applied to blue ships
    flagshipName: getFlagshipName(),
    reward:     NODE_BATTLES[i].reward,
    onResolve:  (won) => recordBattle(i, won),    // banks Requisition + unlocks next node (once)
    onExit:     exitCampaign,
    onRetry:    () => setScreen('shipyard'),       // rebuild the fleet, then re-deploy
    // a first-clear win offers a roguelike upgrade; otherwise straight back to the map
    onContinue: (result) => { if (result && result.firstClear) setScreen('upgrade'); else exitCampaign() },
  })
  // Where a finished cutscene goes next: campaign → muster the fleet (shipyard);
  // a debug playthrough → the next story beat; a single scene → back to source.
  const afterCutscene = (id) => {
    if (cutsceneSource === 'campaign') { setScreen('shipyard'); return }
    const i = STORY.indexOf(id)
    if (cutsceneChain && i >= 0 && i < STORY.length - 1) { setCutsceneId(STORY[i + 1]); setScreen('cutscene'); return }
    setScreen(cutsceneSource)
  }
  // Enter a campaign node from the map: always play the story cutscene. A first
  // run must watch it; a replay of a cleared node may skip (see canSkip below).
  const playCampaignNode = (i) => {
    setCampaignNode(i)
    setCutsceneId(STORY[i]); setCutsceneSource('campaign'); setCutsceneChain(false); setScreen('cutscene')
  }

  // ── Debug screen navigation (shared by the New and Legacy debug pages) ────────
  const debugNavigate = (s) => {
    // cutscenes: `campaign` plays the whole story chain; `cut:<id>` plays one scene
    if (s === 'reset-campaign') { resetCampaign(); setScreen('campaign-map'); return }
    if (s === 'shipyard') { setCampaignNode(Math.min(NODE_BATTLES.length - 1, getFlag('campaignProgress') || 0)); setScreen('shipyard'); return }
    if (s === 'fleet-review') { setFleetReviewSource('debug'); setScreen('fleet-review'); return }
    if (s === 'campaign') { setCutsceneSource('debug'); setCutsceneId(STORY[0]); setCutsceneChain(true); setScreen('cutscene'); return }
    if (s.startsWith('cut:')) { setCutsceneSource('debug'); setCutsceneId(s.slice(4)); setCutsceneChain(false); setScreen('cutscene'); return }
    if (s === 'targeting') setTargetingSource('debug'); if (s === 'reactor') setReactorSource('main'); if (s === 'blackhole') setBlackholeSource('debug'); if (s === 'power') setPowerSource('debug'); if (s === 'battle') setBattleSource('debug'); setGameOverFail(false); setUnderAttack(false); setScreen(s)
  }
  const debugMain   = () => { setPlasmaLevel(75); setBhOutput(4.3); setBhYield(50); setTargetIdx(2); setCountdownSeconds(2); setUnderAttack(false); setScreen('main') }
  const debugAttack = () => { setPlasmaLevel(75); setBhOutput(4.3); setBhYield(50); setTargetIdx(2); setCountdownSeconds(2); setUnderAttack(true); setScreen('main') }
  const debugFail   = () => { setGameOverFail(true); setScreen('gameover') }

  return (
    <>
      <div className="crt-overlay" />
      <div className="scanlines" />
      <div className="vignette" />
      {screen === 'home'    && <StartScreen onCampaign={() => setScreen('campaign-map')} onSkirmish={() => { setBattleSource('home'); setScreen('battle') }} onPlay={() => setScreen('login')} onDebug={() => setScreen('debug')} />}
      {screen === 'campaign-map' && <CampaignMap onExit={() => setScreen('home')} onPlay={playCampaignNode} onReviewFleet={() => { setFleetReviewSource('campaign-map'); setScreen('fleet-review') }} onCards={() => setScreen('card-vault')} onDrawTest={() => setScreen('draw-test')} />}
      {screen === 'card-vault'   && <CardVaultScreen onBack={() => setScreen('campaign-map')} />}
      {screen === 'draw-test'    && <DrawTestScreen onBack={() => setScreen('campaign-map')} />}
      {screen === 'fleet-review' && <FleetReview onExit={() => setScreen(fleetReviewSource)} backLabel={fleetReviewSource === 'shipyard' ? '◂ BACK TO BATTLE' : '◂ RETURN TO MAP'} />}
      {screen === 'fleetbuilder' && <FleetReview testMode onExit={() => setScreen('home')} backLabel="◂ HOME" />}
      {screen === 'upgrade'      && <UpgradeScreen onChoose={(id) => { addUpgrade(id); exitCampaign() }} />}
      {screen === 'shipyard'     && <ShipyardScreen nodeIndex={campaignNode ?? 0} onDeploy={() => setScreen('battle')} onExit={exitCampaign} onPreview={() => { setFleetReviewSource('shipyard'); setScreen('fleet-review') }} />}
      {screen === 'login'   && <LoginScreen onComplete={() => setScreen('menu')} onBack={() => setScreen('home')} />}
      {screen === 'menu'    && <MenuScreen  onManage={() => setScreen('boot')} onLogout={() => setScreen('login')} onEncyclopedia={() => goEncyclopedia('menu')} />}
      {screen === 'boot'    && <BootScreen  onComplete={() => setScreen('main')} />}
      {screen === 'main'    && <MainPanel onLogout={() => setScreen('login')} onLaunchComplete={(pkg) => { setLaunchPackage(pkg); setCountdownSeconds(10); setScreen('monitor') }} onPower={() => { setPowerSource('main'); setScreen('power') }} onTargeting={() => { setTargetingSource('main'); setScreen('targeting') }} onAdjustAntenna={() => setScreen('antenna')} antennaAligned={antennaAligned} reactorPlasma={plasmaLevel} bhOutput={bhOutput} bhYield={bhYield} targetIdx={targetIdx} countdownSeconds={countdownSeconds} underAttack={underAttack} onRadioFreq={(f) => { setRadioFreq(f); if (f === 9.2 && antennaAligned) setUnderAttack(true) }} radioFreq={radioFreq} {...mailProps} />}
      {screen === 'monitor' && <LaunchMonitorScreen onReturn={() => { const imperial = !!TARGETS[targetIdx]?.system?.imperial; setGameOverFail(imperial); setScreen('gameover') }} onLogout={() => { const imperial = !!TARGETS[targetIdx]?.system?.imperial; setGameOverFail(imperial); setScreen('gameover') }} packageName={launchPackage} targetName={targetName} {...mailProps} />}
      {screen === 'debug'        && <DebugScreen variant="new"    onNavigate={debugNavigate} onDebugMain={debugMain} onDebugAttack={debugAttack} onDebugFail={debugFail} />}
      {screen === 'debug-legacy' && <DebugScreen variant="legacy" onNavigate={debugNavigate} onDebugMain={debugMain} onDebugAttack={debugAttack} onDebugFail={debugFail} />}
      {screen === 'reactor'   && <ReactorScreen onReturn={(density) => { setPlasmaLevel(density); setScreen(reactorSource) }} onLogout={() => setScreen(reactorSource)} initialPlasma={plasmaLevel} {...mailProps} />}
      {screen === 'targeting' && <TargetingScreen onBack={(idx) => { setTargetIdx(idx); setScreen(targetingSource) }} initialSelectedIdx={targetIdx} {...mailProps} />}
      {screen === 'gameover'      && <GameOverScreen initialFlagCount={initialFlagCount} onEncyclopedia={() => goEncyclopedia('gameover')} fail={gameOverFail} targetName={targetName} />}
      {screen === 'encyclopedia'  && <EncyclopediaScreen onReturn={() => setScreen(encyclopediaSource)} />}
      {screen === 'antenna'         && <AntennaAlignmentScreen onBack={() => setScreen('main')} onAlignComplete={() => { setAntennaAligned(true); triggerFlag('antennaAligned') }} {...mailProps} />}
      {screen === 'launch-sequence' && <LaunchSequenceScreen onReturn={() => setScreen('debug')} />}
      {screen === 'blackhole'       && <BlackHoleScreen onReturn={() => setScreen(blackholeSource)} initialYield={bhYield} onPower={(out, yld) => { setBhOutput(out); setBhYield(yld); if (out > 1) triggerFlag('penroseActivated') }} {...mailProps} />}
      {screen === 'battle'          && (campaignNode !== null
        ? <SpaceBattleScreen key={`camp-${campaignNode}`} campaign={campaignBattle(campaignNode)} onReturn={exitCampaign} />
        : <SpaceBattleScreen onReturn={() => setScreen(battleSource)} {...mailProps} />)}
      {screen === 'vistest'         && <VisualTestScreen onReturn={() => setScreen('debug')} />}
      {screen === 'cutscene'        && (() => {
          // A campaign replay (re-watching a cleared node) may be skipped; a
          // first run of the current node must be watched. Debug always skippable.
          // Special case: once the player has *ever* chosen an operator, node 1's
          // intro is always skippable — even after a campaign-progress reset.
          const isCampaignReplay = cutsceneSource === 'campaign' && campaignNode !== null && campaignNode < (getFlag('campaignProgress') || 0)
          const node1Veteran = cutsceneSource === 'campaign' && campaignNode === 0 && !!getFlag('everSelectedOperator')
          const canSkip = cutsceneSource !== 'campaign' || isCampaignReplay || node1Veteran
          return <Cutscene key={cutsceneId} scene={SCENES[cutsceneId]} canSkip={canSkip} onReturn={() => setScreen(cutsceneSource === 'campaign' ? 'campaign-map' : cutsceneSource)} onComplete={() => {
            // First Contact picks the operator — but only if one hasn't been
            // chosen yet; once selected, go straight from the cutscene to the shipyard
            if (cutsceneId === 'firstContact' && !getFlag('operator')) { setScreen('character-select'); return }
            afterCutscene(cutsceneId)
          }} />
        })()}
      {screen === 'character-select' && <CharacterSelect
          onComplete={(op) => { if (op) { setFlag('operator', op.name); setFlag('operatorPortrait', op.portrait); setFlag('fleetName', op.fleet); setFlag('campaignFlagship', `HMSS ${op.flagship}`); setFlag('everSelectedOperator', true) } setScreen('fleet-boot') }}
          onBack={() => setScreen(campaignNode !== null ? 'campaign-map' : (cutsceneSource === 'debug' ? 'debug' : 'home'))} />}
      {screen === 'fleet-boot' && <FleetBoot onComplete={() => afterCutscene('firstContact')} />}
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
