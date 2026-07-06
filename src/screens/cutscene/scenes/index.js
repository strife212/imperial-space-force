import firstContact from './firstContact'
import muster from './muster'
import warfront from './warfront'
import theHush from './theHush'
import theLitany from './theLitany'
import theFall from './theFall'
import theResolve from './theResolve'
import theAnnunciator from './theAnnunciator'
import theLance from './theLance'
import theOrderRestored from './theOrderRestored'
import cosmogony from './cosmogony'

// Registry of cutscene definitions. Each is a plain
// `{ label, bloom?, create(ctx) -> update(dt) }` object; the <Cutscene> shell
// and the stage engine handle everything else. Add a new scene here, then add
// its id to STORY (and a debug entry) to slot it into the campaign.
export const SCENES = {
  firstContact, muster, warfront, theHush, theLitany,
  theFall, theResolve, theAnnunciator, theLance, theOrderRestored,
  cosmogony,   // standalone (debug / extras) — not part of STORY
}

// The campaign, in order. Finishing one scene advances to the next; the last
// returns to where the campaign began. Scene 1 is the Aleph first contact.
export const STORY = [
  'firstContact', 'muster', 'warfront', 'theHush', 'theLitany',
  'theFall', 'theResolve', 'theAnnunciator', 'theLance', 'theOrderRestored',
]
