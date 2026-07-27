import { instructionsAllowed } from './eligibility.js'

export const CHANGE_CHECKS = Object.freeze(['Leaking','Movement','Heat','Odour','Sparking','Smoke','Swelling','Worsening damage','Newly exposed material','Water near electrical fittings'])
export function canEnterGuided(result, acknowledged=false){return instructionsAllowed(result?.diy_assessment,acknowledged)&&result?.instructions_suppressed!==true&&Array.isArray(result?.steps)&&result.steps.length>0}
export function progressKey(result){return `taskai:guided:${result?.diy_assessment?.validation_version||'unknown'}:${result?.diy_assessment?.assessed_at||'unknown'}`}
export function applyProgress(stepCount,index){return Math.max(0,Math.min(index,Math.max(0,stepCount-1)))}
export function shouldEscalate(changes){return Object.values(changes||{}).some(Boolean)}
