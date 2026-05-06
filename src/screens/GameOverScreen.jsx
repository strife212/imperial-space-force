export default function GameOverScreen() {
  return (
    <div id="game-over-screen">
      <div className="go-fin">[ FIN. ]</div>
      <div className="go-wip">WORK IN PROGRESS</div>
      <button className="go-again" onClick={() => window.location.reload()}>
        Play again?
      </button>
    </div>
  )
}
