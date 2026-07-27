import { useEffect, useState } from 'react'
import { acknowledgementKey, eligibilityState } from '../lib/eligibility'

const label = (value) => String(value || 'Not available').replaceAll('_', ' ')
export default function EligibilityCard({ assessment, onPermissionChange }) {
  const state = eligibilityState(assessment)
  const key = acknowledgementKey(assessment)
  const [acknowledged, setAcknowledged] = useState(() => localStorage.getItem(key) === 'true')
  useEffect(() => onPermissionChange?.(state.canStart && (!state.acknowledgement || acknowledged)), [state.canStart, state.acknowledgement, acknowledged])
  function acknowledge(){localStorage.setItem(key,'true');setAcknowledged(true)}
  const emergency = state.level === 4
  return <section aria-live="polite" className={`rounded-2xl border p-4 ${emergency ? 'border-red-700 bg-red-50' : state.level === 1 ? 'border-[#91a883] bg-[#eef4e8]' : 'border-[#e3a36e] bg-[#fff3e6]'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest">DIY eligibility</p><h2 className="mt-1 text-xl font-black">{state.level ? `Level ${state.level} — ` : ''}{state.title}</h2></div><span className="rounded-full border border-current px-3 py-1 text-xs font-bold">{state.unresolved ? 'Instructions locked' : state.canStart ? 'Conditional access' : 'Do not start'}</span></div>
    <p className="mt-3 text-sm">{assessment?.reason}</p>
    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-bold">Jurisdiction</dt><dd>{assessment?.jurisdiction || 'Required'}</dd></div><div><dt className="font-bold">Legal status</dt><dd className="capitalize">{label(assessment?.legal_status)}</dd></div><div><dt className="font-bold">Safety status</dt><dd className="capitalize">{label(assessment?.safety_status)}</dd></div><div><dt className="font-bold">Professional</dt><dd>{assessment?.professional_type || 'Not specified'}</dd></div></dl>
    {assessment?.warning_signs?.length > 0 && <List title="Warning signs / stop conditions" items={assessment.warning_signs} />}
    {assessment?.allowed_actions?.length > 0 && <List title={state.level >= 3 ? 'Backend-approved interim actions' : 'Allowed actions'} items={assessment.allowed_actions} />}
    {assessment?.prohibited_actions?.length > 0 && <List title="Prohibited actions" items={assessment.prohibited_actions} />}
    {assessment?.questions_required?.length > 0 && <List title="Information required" items={assessment.questions_required} />}
    {assessment?.policy_source && <p className="mt-4 text-xs">Policy {assessment.policy_source.policy_version || 'unverified'} · reviewed {assessment.policy_source.last_reviewed_at || 'not recorded'}{assessment.policy_source.url && <> · <a className="underline" href={assessment.policy_source.url} target="_blank" rel="noreferrer">Official regulator source</a></>}</p>}
    {state.level === 2 && !acknowledged && <button onClick={acknowledge} className="mt-4 min-h-11 w-full rounded-xl bg-[#0d3339] px-4 font-bold text-white">I understand the precautions and stop conditions</button>}
    {state.level === 2 && acknowledged && <p role="status" className="mt-4 font-bold">✓ Precautions acknowledged for this assessment version</p>}
    {emergency && <p className="mt-4 font-black text-red-800">Stop. Keep clear and follow the emergency guidance above. Do not inspect further.</p>}
  </section>
}
function List({title,items}){return <div className="mt-4"><h3 className="text-sm font-black">{title}</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{items.map((item)=><li key={item}>{item}</li>)}</ul></div>}
