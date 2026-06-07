'use client';

interface LoadingScreenProps {
  label?: string;
  sublabel?: string;
}

export function LoadingScreen({ label = 'Loading Benz Tech', sublabel }: LoadingScreenProps) {
  return (
    <div className="app-container flex flex-col items-center justify-center min-h-dvh px-6 text-center">
      <div className="loading-spinner mb-5" aria-hidden="true" />
      <p className="text-sm text-[#c7c7cc] font-medium">{label}</p>
      {sublabel && <p className="text-xs text-[#8e8e93] mt-2 max-w-xs">{sublabel}</p>}
    </div>
  );
}