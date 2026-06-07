import { Settings } from 'lucide-react';

interface AppHeaderProps {
  onOpenSettings: () => void;
}

export function AppHeader({ onOpenSettings }: AppHeaderProps) {
  return (
    <header className="ios-header h-14 px-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2 font-semibold tracking-tight">
        <img src="/icon-512.png" alt="Benz Tech" className="w-6 h-6 rounded" />
        Benz Tech
      </div>
      <button onClick={onOpenSettings} className="p-2 text-[#8e8e93]">
        <Settings size={20} />
      </button>
    </header>
  );
}