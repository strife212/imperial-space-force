import { useState } from 'react'

const POEM = [
  "O'er silent Star, beneath broken Sky,",
  'A grim Discord the Lost have wrought.',
  'In the Hearing of Her, Sword-Sworn at her Side,',
  "'Gainst the Hush the Empress's Chord is brought.",
  'From the Cathedra high, to the listening below,',
  'Falls the Lance that the Discord besought.',
  '"Long live the Throne, where she hears alone,',
  'For the Day when the Discord comes to Naught."',
]

export default function HudFooter({ children }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <footer className="hud-footer">
        {children}
        <span className="footer-motto" onClick={() => setOpen(true)}>
          ✦ CAELUM CANIT ✦ ILLA AVDIT ✦
        </span>
      </footer>

      {open && (
        <>
          <div className="empress-dim" onClick={() => setOpen(false)} />
          <div className="empress-modal-wrap">
            <div className="empress-modal">
              <div className="empress-motto">✦ CAELUM CANIT ✦ ILLA AVDIT ✦</div>
              <div className="empress-translation">
                <em>The heavens sing; she hears.</em>
              </div>
              <img
                className="empress-img"
                src={`${import.meta.env.BASE_URL}empress.jpg`}
                alt="The Grand Empress"
              />
              <div className="empress-caption">
                HER IMPERIAL MAJESTY EMPRESS Iliantha III
              </div>
              <div className="empress-poem">
                {POEM.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              <button className="empress-close" onClick={() => setOpen(false)}>
                CLOSE
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
