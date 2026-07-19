import { useEffect, useState } from 'react'
import Settings from '../components/Settings'
import { getProfileJurisdiction, supabase, updateProfileJurisdiction } from '../lib/supabase'

export default function SettingsPage() {
  const [jurisdiction, setJurisdiction] = useState(null)
  useEffect(() => { supabase.auth.getSession().then(({ data: { session } }) => session && getProfileJurisdiction(session.user.id).then(setJurisdiction)) }, [])
  async function update(next) { const { data: { session } } = await supabase.auth.getSession(); if (session) await updateProfileJurisdiction(session.user.id, next); setJurisdiction(next) }
  return <section className="mx-auto max-w-5xl px-4 py-8 sm:px-8"><p className="text-sm font-bold uppercase tracking-widest text-[#b95320]">Settings</p><h1 className="mt-2 text-3xl font-black">Your repair preferences</h1><Settings open embedded jurisdiction={jurisdiction} onClose={() => {}} onJurisdictionChange={update} /></section>
}
