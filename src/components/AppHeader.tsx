import { Settings } from 'lucide-react';

interface AppHeaderProps {
  dealershipName?: string;
  technicianName?: string;
  onOpenSettings: () => void;
}

export function AppHeader({ dealershipName, technicianName, onOpenSettings }: AppHeaderProps) {
  return (
    <header className="ios-header h-14 px-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2 min-w-0">
        <img src="/icon-512.png" alt="Benz Tech" className="w-6 h-6 rounded shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold tracking-tight text-sm truncate">Benz Tech</div>
          {dealershipName && (
            <div className="text-[9px] text-[#8e8e93] truncate max-w-[200px]">
              {dealershipName}
              {technicianName ? ` • ${technicianName}` : ''}
            </div>
          )}
        </div>
      </div>
      <button onClick={onOpenSettings} className="p-2 text-[#8e8e93] shrink-0">
        <Settings size={20} />
      </button>
    </header>
  );
}