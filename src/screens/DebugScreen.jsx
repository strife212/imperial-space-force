import { useState } from 'react'
import { getFlags, setFlag } from '../lib/store'

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
]

const FLAG_LABELS = {
  empressPanelVisited: 'Empress Panel Visited',
  throneworldTargeted: 'Throneworld Targeted',
  worldengineTargeted: 'World Engine Targeted',
  seenSelene:          'Seen Selene',
  mainPanelSeen:       'Main Panel Seen',
}

export default function DebugScreen({ onNavigate }) {
  const [flags, setFlags] = useState(getFlags)

  const toggle = (name) => {
    const next = !flags[name]
    setFlag(name, next)
    setFlags(f => ({ ...f, [name]: next }))
  }

  return (
    <div id="debug-screen">
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
  )
}
