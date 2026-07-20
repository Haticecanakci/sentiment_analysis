import { LayoutDashboard, HelpCircle, Hotel } from 'lucide-react';

export default function Sidebar() {
  return (
    <nav className="hidden md:flex flex-col h-full py-6 fixed left-0 top-0 w-[280px] bg-white border-r border-slate-100 shadow-sm z-40">
      {/* Brand Header */}
      <div className="px-6 flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
          <Hotel className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800">Otel Yönetimi</h1>
          <p className="text-xs font-medium text-slate-400">Admin Paneli</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-4 space-y-1">
        <a 
          href="#" 
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-600 bg-indigo-50/50 font-semibold text-sm transition-colors"
        >
          <LayoutDashboard className="w-4 h-4 text-indigo-600" />
          <span>Dashboard</span>
        </a>
      </div>

      {/* Action Buttons & Support */}
      <div className="px-4 mt-auto space-y-3">
        <a 
          href="#" 
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 text-sm transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Destek</span>
        </a>
      </div>
    </nav>
  );
}
