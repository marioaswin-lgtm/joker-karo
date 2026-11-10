import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// cards.js adalah skrip browser; di Node ia memasang CardArt di globalThis.
new Function(readFileSync(new URL('../public/cards.js', import.meta.url), 'utf8'))();
const A = (globalThis as any).CardArt;
const paths = (svg: string) => (svg.match(/<path /g) ?? []).length;
const balanced = (svg: string) => (svg.match(/<g[ >]/g) ?? []).length === (svg.match(/<\/g>/g) ?? []).length;

describe('Grafik kartu (SVG)', () => {
  it('semua 52 kartu + Joker menghasilkan SVG utuh di tiga tema', () => {
    for (const theme of Object.keys(A.themes)) {
      for (const suit of ['S', 'H', 'D', 'C']) {
        for (let rank = 1; rank <= 13; rank++) {
          const svg = A.svg({ joker: false, suit, rank }, theme);
          expect(svg.startsWith('<svg')).toBe(true);
          expect(svg.endsWith('</svg>')).toBe(true);
          expect(balanced(svg)).toBe(true);
        }
      }
      const joker = A.svg({ joker: true }, theme);
      expect(joker).toContain('JOKER');
      expect(balanced(joker)).toBe(true);
    }
  });

  it('jumlah simbol sesuai angka kartu (2 simbol sudut + isi)', () => {
    for (let rank = 2; rank <= 10; rank++) {
      for (const suit of ['S', 'H', 'D', 'C']) expect(paths(A.svg({ suit, rank }, 'klasik'))).toBe(2 + rank);
    }
    expect(paths(A.svg({ suit: 'S', rank: 1 }, 'klasik'))).toBe(3); // As: 1 simbol besar
    expect(paths(A.svg({ suit: 'H', rank: 12 }, 'klasik'))).toBe(5); // gambar: sudut + 3 ornamen
  });

  it('warna merah untuk heart/diamond dan ink untuk spade/club', () => {
    const t = A.themes.klasik;
    expect(A.svg({ suit: 'H', rank: 5 }, 'klasik')).toContain(t.red);
    expect(A.svg({ suit: 'D', rank: 5 }, 'klasik')).toContain(t.red);
    expect(A.svg({ suit: 'S', rank: 5 }, 'klasik')).not.toContain(t.red);
    expect(A.svg({ suit: 'C', rank: 5 }, 'klasik')).not.toContain(t.red);
  });

  it('tema berbeda menghasilkan warna berbeda; tema tidak dikenal memakai klasik', () => {
    expect(A.svg({ suit: 'S', rank: 9 }, 'malam')).not.toBe(A.svg({ suit: 'S', rank: 9 }, 'klasik'));
    expect(A.svg({ suit: 'S', rank: 9 }, 'tidak-ada')).toBe(A.svg({ suit: 'S', rank: 9 }, 'klasik'));
    expect(Object.keys(A.themes)).toEqual(['klasik', 'malam', 'retro']);
  });

  it('punggung kartu dan label teks', () => {
    expect(A.back('retro')).toContain('<svg');
    expect(A.label({ joker: true })).toBe('Joker');
    expect(A.label({ suit: 'S', rank: 1 })).toBe('A\u2660');
    expect(A.label({ suit: 'H', rank: 10 })).toBe('10\u2665');
  });
});
