import { BrainCircuit, CodeXml, FileText, FlaskConical, Network, Pi, BookOpen } from 'lucide-react';
import type { SubjectIcon, Theme } from '../data';

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 40 32" aria-hidden>
      <path d="M2 4.5C8 2 14 2.4 19 5.6V30C14 27 8 26.6 2 29Z" fill="currentColor" />
      <path d="M38 4.5C32 2 26 2.4 21 5.6V30C26 27 32 26.6 38 29Z" fill="currentColor" />
      <path d="M6 9.5c3-.7 6-.4 9 .9M6 14.5c3-.7 6-.4 9 .9" stroke="#f6f3ee" strokeWidth="1.3" fill="none" opacity=".35" />
    </svg>
  );
}

export function PythonLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M15.8 2c-6.6 0-6.2 2.9-6.2 2.9v3h6.3v.9H7.1S2.8 8.3 2.8 15c0 6.6 3.7 6.4 3.7 6.4h2.2v-3.1s-.1-3.7 3.7-3.7h6.3s3.5.1 3.5-3.4V5.5S22.8 2 15.8 2Zm-3.5 2a1.1 1.1 0 1 1 0 2.3 1.1 1.1 0 0 1 0-2.3Z" fill="#5b8fd6" />
      <path d="M16.2 30c6.6 0 6.2-2.9 6.2-2.9v-3h-6.3v-.9h8.8s4.3.5 4.3-6.2c0-6.6-3.7-6.4-3.7-6.4h-2.2v3.1s.1 3.7-3.7 3.7h-6.3s-3.5-.1-3.5 3.4v5.7S9.2 30 16.2 30Zm3.5-2a1.1 1.1 0 1 1 0-2.3 1.1 1.1 0 0 1 0 2.3Z" fill="#f2c94c" />
    </svg>
  );
}

export function YouTubeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="5.5" fill="#ef4f4f" />
      <path d="M11.2 5.8v8.4l7.2-4.2Z" fill="#fff" />
    </svg>
  );
}

export function SubjectGlyph({ icon, size = 22 }: { icon: SubjectIcon; size?: number }) {
  switch (icon) {
    case 'python':
      return <PythonLogo size={size + 4} />;
    case 'pi':
      return <Pi size={size + 4} strokeWidth={2.4} />;
    case 'code':
      return <CodeXml size={size + 2} strokeWidth={2.2} />;
    case 'network':
      return <Network size={size} strokeWidth={2} />;
    case 'brain':
      return <BrainCircuit size={size} />;
    case 'flask':
      return <FlaskConical size={size} />;
    case 'book':
      return <BookOpen size={size} />;
    default:
      return <FileText size={size} />;
  }
}

export function SubjectTile({ icon, theme, size = 'md' }: { icon: SubjectIcon; theme: Theme; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`tile tile-${size} t-${theme}`}>
      <SubjectGlyph icon={icon} size={size === 'lg' ? 26 : size === 'sm' ? 18 : 22} />
    </span>
  );
}
