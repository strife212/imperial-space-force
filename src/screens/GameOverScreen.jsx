import { getFlags } from '../lib/store'

export default function GameOverScreen({ initialFlagCount = 0, onEncyclopedia }) {
  const currentFlagCount = Object.values(getFlags()).filter(Boolean).length
  const hasNewUnlocks    = currentFlagCount > initialFlagCount

  return (
    <div id="game-over-screen">
      <div className="go-fin">[ FIN. ]</div>
      <div className="go-wip">WORK IN PROGRESS</div>
      {hasNewUnlocks && (
        <div className="go-unlocked" onClick={onEncyclopedia}>
          {currentFlagCount - initialFlagCount === 1
            ? '1 NEW ENCYCLOPEDIA ENTRY PERMANENTLY UNLOCKED — CLICK TO READ'
            : `${currentFlagCount - initialFlagCount} NEW ENCYCLOPEDIA ENTRIES PERMANENTLY UNLOCKED — CLICK TO READ`
          }
        </div>
      )}
      <button className="go-again" onClick={() => window.location.reload()}>
        Play again?
      </button>
    </div>
  )
}
