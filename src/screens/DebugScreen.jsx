import { useState } from 'react'
import { getFlags, setFlag } from '../lib/store'
import { useScreenScale } from '../hooks/useScreenScale'
import UrgentMessageOverlay from '../components/UrgentMessageOverlay'

const SAMPLE_URGENT = {
  sender:  'Admiralty Command',
  subject: 'DEEP SPACE ARRAY ALERT',
  body:    "Astraia! What in the throne are you doing? The deep space array is showing that the Annunciator has launched towards the Throne System.\n\nYou'd destroy the !!Universal Order!!?",
}

// ── NEW: 3D battlesim + campaign screens/scenes ──────────────────────────────
const NEW_SCREENS = [
  { key: 'home',           label: 'Start Screen'             },
  { key: 'battle',         label: 'Space Battle Simulation'  },
  { key: 'vistest',        label: 'Combat Visual Test'       },
  { key: 'campaign-map',   label: 'Campaign Map'             },
  { key: 'shipyard',       label: 'Shipyard (Fleet Command)' },
  { key: 'campaign',       label: 'Story Campaign (1 → 10)'  },
  { key: 'character-select', label: 'Character Select'        },
  { key: 'reset-campaign', label: 'Reset Campaign Progress'  },
]

// The story cutscenes, in order (played individually)
const CUTSCENES = [
  { key: 'cut:firstContact',     label: '1 · First Contact'    },
  { key: 'cut:muster',           label: '2 · The Muster'       },
  { key: 'cut:warfront',         label: '3 · The Warfront'     },
  { key: 'cut:theHush',          label: '4 · The Hush'         },
  { key: 'cut:theLitany',        label: '5 · The Great Litany' },
  { key: 'cut:theFall',          label: '6 · The Fall'         },
  { key: 'cut:theResolve',       label: '7 · The Final Hearing' },
  { key: 'cut:theAnnunciator',   label: '8 · The Annunciator'  },
  { key: 'cut:theLance',         label: '9 · The Lance'        },
  { key: 'cut:theOrderRestored', label: '10 · Order Restored'  },
]

// ── LEGACY: the 2D UI narrative game ─────────────────────────────────────────
const LEGACY_COL1 = [
  { key: 'login',        label: 'Login Screen'           },
  { key: 'boot',         label: 'Boot / Loading Screen'  },
  { key: 'menu',         label: 'Menu Screen'            },
  { key: 'main',         label: 'Main Panel'             },
  { key: 'power',        label: 'Power Management Screen' },
  { key: 'monitor',      label: 'Launch Monitor Screen'  },
  { key: 'reactor',      label: 'Reactor Control Screen' },
]

const LEGACY_COL2 = [
  { key: 'targeting',       label: 'Targeting Screen'         },
  { key: 'gameover',        label: 'Game Over Screen'         },
  { key: 'encyclopedia',    label: 'Encyclopedia Screen'      },
  { key: 'antenna',         label: 'Antenna Alignment Screen' },
  { key: 'launch-sequence', label: 'Launch Sequence Dialogue' },
  { key: 'blackhole',       label: 'Black Hole Visualisation' },
]

const FLAG_LABELS = {
  empressPanelVisited: 'Empress Panel Visited',
  throneworldTargeted: 'Throneworld Targeted',
  worldengineTargeted: 'World Engine Targeted',
  seenSelene:          'Seen Selene',
  mainPanelSeen:       'Main Panel Seen',
  lancecast:           'Lance Cast',
}

export default function DebugScreen({ variant = 'new', onNavigate, onDebugMain, onDebugAttack, onDebugFail }) {
  const [flags, setFlags] = useState(getFlags)
  const [urgentShown, setUrgentShown] = useState(false)
  const innerRef = useScreenScale()
  const legacy = variant === 'legacy'

  const toggle = (name) => {
    const next = !flags[name]
    setFlag(name, next)
    setFlags(f => ({ ...f, [name]: next }))
  }

  const screenBtn = ({ key, label }) => (
    <li key={key}>
      <button className="debug-item" onClick={() => onNavigate(key)}>
        <span className="debug-item-key">[{key}]</span>
        <span className="debug-item-label">{label}</span>
      </button>
    </li>
  )

  return (
    <div id="debug-screen">
      <div className="debug-inner" ref={innerRef}>
        <div className="debug-title">⬢ DEBUG // {legacy ? 'LEGACY (2D UI)' : 'NEW (3D · BATTLESIM · CAMPAIGN)'}</div>

        {!legacy && (
          <div className="debug-body">
            {/* Column 1 — battlesim + campaign screens */}
            <ul className="debug-list">{NEW_SCREENS.map(screenBtn)}</ul>
            {/* Column 2 — story cutscenes */}
            <ul className="debug-list">{CUTSCENES.map(screenBtn)}</ul>
          </div>
        )}

        {legacy && (
          <div className="debug-body">
            {/* Column 1 — screens + shortcuts */}
            <ul className="debug-list">
              {LEGACY_COL1.map(screenBtn)}
              <li>
                <button className="debug-item debug-item--shortcut" onClick={onDebugMain}>
                  <span className="debug-item-key">[⚡]</span>
                  <span className="debug-item-label">Main Panel — power 75, target Aethon</span>
                </button>
              </li>
              <li>
                <button className="debug-item debug-item--shortcut" onClick={onDebugAttack}>
                  <span className="debug-item-key">[⚠]</span>
                  <span className="debug-item-label">Main Panel — under attack mode</span>
                </button>
              </li>
            </ul>

            {/* Column 2 — screens + shortcuts */}
            <ul className="debug-list">
              {LEGACY_COL2.map(screenBtn)}
              <li>
                <button className="debug-item debug-item--shortcut" onClick={onDebugFail}>
                  <span className="debug-item-key">[✕]</span>
                  <span className="debug-item-label">Game Over Screen — fail / court martial</span>
                </button>
              </li>
              <li>
                <button className="debug-item debug-item--shortcut" onClick={() => setUrgentShown(true)}>
                  <span className="debug-item-key">[!]</span>
                  <span className="debug-item-label">Urgent Message Overlay</span>
                </button>
              </li>
            </ul>

            {/* Column 3 — flags */}
            <div className="debug-flags">
              <div className="debug-flags-title">FLAGS</div>
              {Object.entries(FLAG_LABELS).map(([key, label]) => (
                <button key={key} className="debug-flag-row debug-flag-toggle" onClick={() => toggle(key)}>
                  <span className="debug-flag-key">{label}</span>
                  <span className={`debug-flag-val${flags[key] ? ' flag-true' : ' flag-false'}`}>
                    {String(flags[key])}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* large link to the other debug page */}
        {!legacy
          ? <button className="debug-switch" onClick={() => onNavigate('debug-legacy')}>LEGACY DEBUG ▸</button>
          : <button className="debug-switch" onClick={() => onNavigate('debug')}>◂ NEW DEBUG</button>}
      </div>

      {urgentShown && (
        <UrgentMessageOverlay
          {...SAMPLE_URGENT}
          onClose={() => setUrgentShown(false)}
        />
      )}
    </div>
  )
}
