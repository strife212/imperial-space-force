const SCREENS = [
  { key: 'login',     label: 'Login Screen'           },
  { key: 'boot',      label: 'Boot / Loading Screen'  },
  { key: 'menu',      label: 'Menu Screen'             },
  { key: 'main',      label: 'Main Panel'              },
  { key: 'monitor',   label: 'Launch Monitor Screen'  },
  { key: 'reactor',   label: 'Reactor Control Screen' },
  { key: 'targeting', label: 'Targeting Screen'        },
]

export default function DebugScreen({ onNavigate }) {
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
    </div>
  )
}
