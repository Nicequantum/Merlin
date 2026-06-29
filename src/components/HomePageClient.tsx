'use client';

console.log('[Merlin] HomePageClient module evaluated');

import { BenzTechApp } from '@/components/BenzTechApp';

/** Client entry for / — avoids next/dynamic + ssr:false pitfalls on the server page. */
export default function HomePageClient() {
  console.log('[Merlin] HomePageClient render');
  return <BenzTechApp />;
}