import { useState } from 'react'
import { getFlags, setFlag } from '../lib/store'
import { useScreenScale } from '../hooks/useScreenScale'

const SCREENS = [
  { key: 'login',        label: 'Login Screen'           },
  { key: 'boot',         label: 'Boot / Loading Screen'  },
  { key: 'menu',         label: 'Menu Screen'             },
  { key: 'main',         label: 'Main Panel'              },
  { key: 'monitor',      label: 'Launch Monitor Screen'  },
  { key: 'reactor',      label: 'Reactor Control Screen' },
  { key: 'targeting',    label: 'Targeting Screen'        },
  { key: 'gameover',     label: 'Game Over Screen'        },
  { key: 'encyclopedia', label: 'Encyclopedia Screen'     },
  { key: 'antenna',      label: 'Antenna Alignment Screen'},
]

const FLAG_LABELS = {
  empressPanelVisited: 'Empress Panel Visited',
  throneworldTargeted: 'Throneworld Targeted',
  worldengineTargeted: 'World Engine Targeted',
  seenSelene:          'Seen Selene',
  mainPanelSeen:       'Main Panel Seen',
  lancecast:           'Lance Cast',
}

export default function DebugScreen({ onNavigate, onDebugMain, onDebugFail }) {
  const [flags, setFlags] = useState(getFlags)
  const innerRef = useScreenScale()

  const toggle = (name) => {
    const next = !flags[name]
    setFlag(name, next)
    setFlags(f => ({ ...f, [name]: next }))
  }

  return (
    <div id="debug-screen">
      <div className="debug-inner" ref={innerRef}>
      <div className="debug-title">⬢ DEBUG // SCREEN SELECT</div>
      <div className="debug-body">
        <ul className="debug-list">
          {SCREENS.map(({ key, label }) => (
            <li key={key}>
              <button className="debug-item" onClick={() => onNavigate(key)}>
                <span className="debug-item-key">[{key}]</span>
                <span className="debug-item-label">{label}</span>
              </button>
            </li>
          ))}
          <li>
            <button className="debug-item debug-item--shortcut" onClick={onDebugMain}>
              <span className="debug-item-key">[⚡]</span>
              <span className="debug-item-label">Main Panel — power 75, target Aethon</span>
            </button>
          </li>
          <li>
            <button className="debug-item debug-item--shortcut" onClick={onDebugFail}>
              <span className="debug-item-key">[✕]</span>
              <span className="debug-item-label">Game Over Screen — fail / court martial sequence</span>
            </button>
          </li>
        </ul>

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
    </div>
  )
}
