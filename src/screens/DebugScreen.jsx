import { getFlag } from '../lib/store'

const SCREENS = [
  { key: 'login',     label: 'Login Screen'           },
  { key: 'boot',      label: 'Boot / Loading Screen'  },
  { key: 'menu',      label: 'Menu Screen'             },
  { key: 'main',      label: 'Main Panel'              },
  { key: 'monitor',   label: 'Launch Monitor Screen'  },
  { key: 'reactor',   label: 'Reactor Control Screen' },
  { key: 'targeting', label: 'Targeting Screen'        },
  { key: 'gameover',     label: 'Game Over Screen'     },
  { key: 'encyclopedia', label: 'Encyclopedia Screen'  },
]

export default function DebugScreen({ onNavigate }) {
  const empressSeen = getFlag('empressPanelVisited')

  return (
    <div id="debug-screen">
      <div className="debug-title">⬢ DEBUG // SCREEN SELECT</div>
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
        <div className="debug-flag-row">
          <span className="debug-flag-key">empressPanelVisited</span>
          <span className={`debug-flag-val${empressSeen ? ' flag-true' : ' flag-false'}`}>
            {String(empressSeen)}
          </span>
        </div>
      </div>
    </div>
  )
}
