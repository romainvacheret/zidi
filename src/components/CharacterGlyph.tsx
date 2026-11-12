import type { ReactNode } from 'react';

export default function CharacterGlyph({ label, children }: { label: string; children: ReactNode }) {
  return <svg className="writing-glyph" viewBox="0 0 1024 1024" role="img" aria-label={label}>
    <path className="writing-grid" d="M0 512H1024 M512 0V1024 M0 0L1024 1024 M0 1024L1024 0" />
    <g transform="translate(0,900) scale(1,-1)">{children}</g>
  </svg>;
}
