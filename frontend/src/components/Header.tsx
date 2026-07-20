import { Bell, Settings, Menu, Activity } from 'lucide-react';

interface HeaderProps {
  onMenuToggle?: () => void;
  apiConnected: boolean;
  dbConnected: boolean;
}

export default function Header({ onMenuToggle, apiConnected, dbConnected }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30 px-6 py-4 flex justify-between items-center w-full">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuToggle}
          className="md:hidden text-slate-500 hover:bg-slate-50 p-2 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-indigo-900">Otel Yorum Analizi</h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Connection Status Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
          <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span className="text-xs font-semibold">
            API: {apiConnected ? 'Bağlı' : 'Hata'} • DB: {dbConnected ? 'Bağlı' : 'Bağlantı Yok'}
          </span>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-3">
          <button className="text-slate-500 hover:bg-slate-50 p-2 rounded-full transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
          </button>
          <button className="text-slate-500 hover:bg-slate-50 p-2 rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          
          <div className="h-8 w-px bg-slate-100 mx-1"></div>

          {/* User Profile avatar */}
          <div className="flex items-center gap-2">
            <img 
              alt="Kullanıcı Profili" 
              className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-50" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBWnNeVNsIo1jru4j8QFKu-mA5t0c96Ywcu-24E4x_gFMmLxKVRHAZKjBT6eyeTpV-uykafwhjNnSqyyerjHGeYf7QcloIGo_c0d4L_Fe8SOP9c0ruNlSdZ9FmTKdwC-hRLbAFOcVbn7A8k66YRtHy6K5dIrBJg8-7CxYqPc3IhbxtU3_2B8xNZ2-ueq8CbyKhtb2VCUG538wS4aCZTumYn62MjvyhMqndttS_OggbKKbwf--rlBks7PQ"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
