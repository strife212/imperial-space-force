import { useState } from 'react'
import { getFlags, setFlag } from '../lib/store'
import { useScreenScale } from '../hooks/useScreenScale'
import UrgentMessageOverlay from '../components/UrgentMessageOverlay'

const SAMPLE_URGENT = {
  sender:  'Admiralty Command',
  subject: 'DEEP SPACE ARRAY ALERT',
  body:    "Astraia! What in the throne are you doing? The deep space array is showing that the Annunciator has launched towards the Throne System.\n\nYou'd destroy the !!Universal Order!!?",
}

const SCREENS_COL1 = [
  { key: 'login',        label: 'Login Screen'           },
  { key: 'boot',         label: 'Boot / Loading Screen'  },
  { key: 'menu',         label: 'Menu Screen'             },
  { key: 'main',         label: 'Main Panel'              },
  { key: 'power',        label: 'Power Management Screen' },
  { key: 'monitor',      label: 'Launch Monitor Screen'  },
  { key: 'reactor',      label: 'Reactor Control Screen'  },
]

const SCREENS_COL2 = [
  { key: 'targeting',       label: 'Targeting Screen'          },
  { key: 'gameover',        label: 'Game Over Screen'          },
  { key: 'encyclopedia',    label: 'Encyclopedia Screen'       },
  { key: 'antenna',         label: 'Antenna Alignment Screen'  },
  { key: 'launch-sequence', label: 'Launch Sequence Dialogue'  },
  { key: 'blackhole',       label: 'Black Hole Visualisation'  },
  { key: 'battle',          label: 'Space Battle Simulation'   },
]

const FLAG_LABELS = {
  empressPanelVisited: 'Empress Panel Visited',
  throneworldTargeted: 'Throneworld Targeted',
  worldengineTargeted: 'World Engine Targeted',
  seenSelene:          'Seen Selene',
  mainPanelSeen:       'Main Panel Seen',
  lancecast:           'Lance Cast',
}

export default function DebugScreen({ onNavigate, onDebugMain, onDebugAttack, onDebugFail }) {
  const [flags, setFlags] = useState(getFlags)
  const [urgentShown, setUrgentShown] = useState(false)
  const innerRef = useScreenScale()

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
        <div className="debug-title">⬢ DEBUG // SCREEN SELECT</div>
        <div className="debug-body">

          {/* Column 1 — screens + shortcuts */}
          <ul className="debug-list">
            {SCREENS_COL1.map(screenBtn)}
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
            {SCREENS_COL2.map(screenBtn)}
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
