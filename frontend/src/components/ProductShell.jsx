import { NavLink, Outlet } from 'react-router-dom'
import { WEB_NAVIGATION } from '../lib/navigation'

const ICONS = {
  home: '⌂', camera: '⌁', repairs: '▤', list: '☷', settings: '⚙',
}

export default function ProductShell() {
  return (
    <div className="min-h-dvh bg-[#f7f3e9] text-[#102f36] md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden md:flex min-h-dvh flex-col bg-[#0d3339] text-white px-4 py-6">
        <NavLink to="/app" className="px-3 text-2xl font-black tracking-tight">task<span className="text-[#f28b45]">.ai</span></NavLink>
        <p className="px-3 mt-2 text-xs text-[#bad0c9]">Practical repair guidance for Australian homes</p>
        <nav aria-label="Primary" className="mt-9 space-y-2">
          {WEB_NAVIGATION.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `min-h-11 flex items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${isActive ? 'bg-[#eaf0df] text-[#15383d]' : 'text-[#dce9e4] hover:bg-white/10'}`}>
              <span aria-hidden="true" className="w-6 text-center text-lg">{ICONS[item.icon]}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-[#bad0c9]">
          Safety decisions come from the backend assessment and your selected jurisdiction.
        </div>
      </aside>

      <main className="min-w-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[#d9d2c2] bg-[#fffdf7]/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {WEB_NAVIGATION.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `min-h-[4.75rem] flex flex-col items-center justify-center gap-1 px-1 text-[10px] font-bold ${isActive ? 'text-[#b95320]' : 'text-[#52676a]'}`}>
            <span aria-hidden="true" className={`grid h-9 w-9 place-items-center rounded-full text-lg ${item.path === '/diagnose' ? 'bg-[#f28b45] text-[#102f36] shadow-lg -mt-5' : ''}`}>{ICONS[item.icon]}</span>
            {item.label.replace('New ', '')}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
