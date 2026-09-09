import { ETA_LABELS, STAGES, stageIndex } from '../lib/config'

export interface TrackerProps {
  /** Order.status. Anything unknown is treated as the first stage. */
  status: string
  className?: string
}

/** The eta shown above the tracker: "~35 min" … "Delivered". */
export function etaFor(status: string): string {
  return ETA_LABELS[stageIndex(status)]
}

/** Four-step progress, straight from the artboard: filled bars for every stage
 *  reached, then NOW / DONE / LVL n tags under them. */
export function Tracker({ status, className }: TrackerProps) {
  const current = stageIndex(status)
  return (
    <div className={['tracker', className ?? ''].filter(Boolean).join(' ')}>
      <div className="tracker-bars">
        {STAGES.map((stage, i) => (
          <div key={stage} className={`tracker-bar${i <= current ? ' is-on' : ''}`} />
        ))}
      </div>
      <div className="tracker-steps">
        {STAGES.map((stage, i) => {
          const done = i < current
          const active = i === current
          return (
            <div key={stage} className="tracker-step">
              {active && <span className="step-tag step-tag--now">NOW</span>}
              {done && <span className="step-tag step-tag--done">DONE</span>}
              {!done && !active && <span className="step-tag step-tag--todo">LVL {i + 1}</span>}
              <span className={`step-label${done || active ? '' : ' step-label--todo'}`}>{stage}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Tracker
