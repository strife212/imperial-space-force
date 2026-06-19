import supplyRun from './supplyRun'
import firstContact from './firstContact'
import fleetReview from './fleetReview'

// Registry of cutscene definitions. Add new scenes here — each is a plain
// `{ label, bloom?, create(ctx) -> update(dt) }` object; the <Cutscene> shell
// and the stage engine handle everything else.
export const SCENES = { supplyRun, firstContact, fleetReview }
