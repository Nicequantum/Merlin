interface MerlinLogoProps {
  className?: string;
}

export function MerlinLogo({ className = 'w-full h-full rounded-[18px]' }: MerlinLogoProps) {
  return <img src="/logo.svg" alt="Merlin" className={className} />;
}