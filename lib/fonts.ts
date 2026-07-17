import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';

// CHORE-23: variable fonts — no `weight` needed (Next.js recommendation).
// subsets include 'latin-ext' alongside 'latin' to guarantee full pt-PT
// glyph coverage (ã, õ, ç, etc.) rather than assuming the base 'latin'
// subset covers them.
export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});
