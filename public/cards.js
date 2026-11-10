/* Grafik kartu Joker Karo Online. Semua gambar dibuat sendiri (SVG), termasuk badut Joker orisinal.
   Dipakai di browser (window.CardArt) dan bisa diuji di Node (globalThis.CardArt). */
(function (root) {
  var THEMES = {
    klasik: { name: 'Klasik', face: '#ffffff', edge: '#cfcabd', ink: '#1c1c1a', red: '#c0392b', accent: '#1f6f4a', back: '#1f6f4a' },
    malam: { name: 'Malam', face: '#23272d', edge: '#4a505a', ink: '#ececea', red: '#ff7b6b', accent: '#3fae7a', back: '#2f3a52' },
    retro: { name: 'Retro', face: '#f3e9d2', edge: '#c8b78f', ink: '#3b2a1e', red: '#a8321f', accent: '#7a4b22', back: '#7a4b22' },
  };
  var SUIT_PATH = {
    H: 'M12 21C3 14 1 9 1 6.5C1 3.5 3.5 1.5 6 1.5C8.5 1.5 10.5 3 12 5C13.5 3 15.5 1.5 18 1.5C20.5 1.5 23 3.5 23 6.5C23 9 21 14 12 21Z',
    D: 'M12 1L22 12L12 23L2 12Z',
    S: 'M12 1C12 1 1 9 1 15C1 18.5 4 20 6.5 20C8.5 20 10.2 19.2 11 18C10.8 20.5 10 22 8 23H16C14 22 13.2 20.5 13 18C13.8 19.2 15.5 20 17.5 20C20 20 23 18.5 23 15C23 9 12 1 12 1Z',
    C: 'M12 1C9.5 1 7.5 3 7.5 5.5C7.5 7 8.2 8.2 9.2 9C8.5 8.8 7.8 8.7 7 8.7C4 8.7 1.5 11 1.5 14C1.5 17 4 19.2 7 19.2C8.8 19.2 10.4 18.4 11.3 17C11.2 19.5 10.4 21.8 8.5 23H15.5C13.6 21.8 12.8 19.5 12.7 17C13.6 18.4 15.2 19.2 17 19.2C20 19.2 22.5 17 22.5 14C22.5 11 20 8.7 17 8.7C16.2 8.7 15.5 8.8 14.8 9C15.8 8.2 16.5 7 16.5 5.5C16.5 3 14.5 1 12 1Z',
  };
  var LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var L = 34, C = 50, R = 66;
  var Y = [30, 56, 84, 110]; // empat baris pip
  var PIPS = {
    2: [[C, Y[0]], [C, Y[3]]],
    3: [[C, Y[0]], [C, 70], [C, Y[3]]],
    4: [[L, Y[0]], [R, Y[0]], [L, Y[3]], [R, Y[3]]],
    5: [[L, Y[0]], [R, Y[0]], [C, 70], [L, Y[3]], [R, Y[3]]],
    6: [[L, Y[0]], [R, Y[0]], [L, 70], [R, 70], [L, Y[3]], [R, Y[3]]],
    7: [[L, Y[0]], [R, Y[0]], [C, 50], [L, 70], [R, 70], [L, Y[3]], [R, Y[3]]],
    8: [[L, Y[0]], [R, Y[0]], [C, 50], [L, 70], [R, 70], [C, 90], [L, Y[3]], [R, Y[3]]],
    9: [[L, Y[0]], [R, Y[0]], [L, Y[1] + 4], [R, Y[1] + 4], [C, 70], [L, Y[2] - 4], [R, Y[2] - 4], [L, Y[3]], [R, Y[3]]],
    10: [[L, Y[0]], [R, Y[0]], [C, 43], [L, Y[1] + 4], [R, Y[1] + 4], [L, Y[2] - 4], [R, Y[2] - 4], [C, 97], [L, Y[3]], [R, Y[3]]],
  };

  function colorOf(suit, t) { return suit === 'H' || suit === 'D' ? t.red : t.ink; }
  function pip(suit, x, y, size, flip, fill) {
    var s = size / 24;
    return '<path d="' + SUIT_PATH[suit] + '" fill="' + fill + '" transform="translate(' + (x - size / 2) + ' ' + (y - size / 2) + ') scale(' + s + ')' + (flip ? ' rotate(180 12 12)' : '') + '"/>';
  }
  function frame(t, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" class="cardsvg" role="img">' +
      '<rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="' + t.face + '" stroke="' + t.edge + '" stroke-width="2"/>' + inner + '</svg>';
  }
  function corners(rank, suit, t) {
    var col = colorOf(suit, t), lab = LABEL[rank], fs = lab.length > 1 ? 17 : 20;
    var one = '<text x="12" y="22" text-anchor="middle" font-family="Georgia,\'Times New Roman\',serif" font-weight="700" font-size="' + fs + '" fill="' + col + '">' + lab + '</text>' + pip(suit, 12, 34, 13, false, col);
    return one + '<g transform="rotate(180 50 70)">' + one + '</g>';
  }

  /* Badut Joker orisinal: topi dua ujung dengan lonceng, riasan berlian, hidung merah, kerah renda. */
  function clown(t) {
    var skin = '#f6efe4', line = '#2b2b2b';
    return '<g>' +
      '<rect x="14" y="10" width="72" height="120" rx="8" fill="' + t.accent + '" opacity="0.14"/>' +
      '<path d="M27 56C23 36 28 20 40 11C38 25 44 33 50 36C56 33 62 25 60 11C72 20 77 36 73 56Z" fill="#1f9d8f" stroke="' + line + '" stroke-width="1.4"/>' +
      '<circle cx="40" cy="10" r="4.2" fill="#f2c230" stroke="' + line + '" stroke-width="1"/>' +
      '<circle cx="60" cy="10" r="4.2" fill="#f2c230" stroke="' + line + '" stroke-width="1"/>' +
      '<path d="M27 52H73V58H27Z" fill="#c8362b" stroke="' + line + '" stroke-width="1.2"/>' +
      '<circle cx="26" cy="70" r="10" fill="#e8742f" stroke="' + line + '" stroke-width="1.2"/>' +
      '<circle cx="74" cy="70" r="10" fill="#e8742f" stroke="' + line + '" stroke-width="1.2"/>' +
      '<ellipse cx="50" cy="75" rx="23" ry="20" fill="' + skin + '" stroke="' + line + '" stroke-width="1.6"/>' +
      '<path d="M36 68L42 59L48 68L42 77Z" fill="#2c6fd1" stroke="' + line + '" stroke-width="1"/>' +
      '<path d="M52 68L58 59L64 68L58 77Z" fill="#2c6fd1" stroke="' + line + '" stroke-width="1"/>' +
      '<circle cx="42" cy="68" r="2.6" fill="#111"/><circle cx="58" cy="68" r="2.6" fill="#111"/>' +
      '<path d="M33 60Q40 55 46 59M54 59Q60 55 67 60" fill="none" stroke="' + line + '" stroke-width="1.4" stroke-linecap="round"/>' +
      '<circle cx="50" cy="77" r="4.6" fill="#d6281f" stroke="' + line + '" stroke-width="1"/>' +
      '<path d="M33 84Q50 102 67 84Q50 91 33 84Z" fill="#b01c1c" stroke="' + line + '" stroke-width="1.2"/>' +
      '<path d="M38 86.4Q50 93 62 86.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M25 101q4.6-7 9.2 0q4.6-7 9.2 0q4.6-7 9.2 0q4.6-7 9.2 0q4.6-7 9.2 0q3-4.6 4 0v8H25Z" fill="' + skin + '" stroke="' + line + '" stroke-width="1.3"/>' +
      '<path d="M27 109H73L78 128H22Z" fill="#c8362b" stroke="' + line + '" stroke-width="1.3"/>' +
      '<path d="M50 109V128" stroke="' + line + '" stroke-width="1.2"/>' +
      '<circle cx="50" cy="116" r="2.3" fill="#f2c230" stroke="' + line + '" stroke-width="0.8"/><circle cx="50" cy="123" r="2.3" fill="#f2c230" stroke="' + line + '" stroke-width="0.8"/>' +
      '<text x="9" y="34" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="9" fill="' + t.ink + '" transform="rotate(-90 9 34)">JOKER</text>' +
      '</g>';
  }

  function face(rank, suit, t) {
    var col = colorOf(suit, t), lab = LABEL[rank];
    return corners(rank, suit, t) +
      '<rect x="27" y="26" width="46" height="88" rx="5" fill="none" stroke="' + col + '" stroke-width="1.6"/>' +
      pip(suit, 34, 34, 11, false, col) + pip(suit, 66, 106, 11, true, col) +
      '<text x="50" y="84" text-anchor="middle" font-family="Georgia,\'Times New Roman\',serif" font-weight="700" font-size="46" fill="' + col + '">' + lab + '</text>' +
      pip(suit, 50, 99, 12, false, col);
  }

  /** card: {joker:true} atau {suit:'S'|'H'|'D'|'C', rank:1..13}. */
  function svg(card, themeName) {
    var t = THEMES[themeName] || THEMES.klasik;
    if (card.joker) return frame(t, clown(t));
    var s = card.suit, r = card.rank, col = colorOf(s, t), inner = corners(r, s, t);
    if (r === 1) inner += pip(s, 50, 70, 44, false, col);
    else if (r >= 11) inner = face(r, s, t);
    else PIPS[r].forEach(function (p) { inner += pip(s, p[0], p[1], 22, p[1] > 70, col); });
    return frame(t, inner);
  }

  /** Punggung kartu (untuk tumpukan ambil). */
  function back(themeName) {
    var t = THEMES[themeName] || THEMES.klasik;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" class="cardsvg" role="img">' +
      '<rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="' + t.back + '" stroke="' + t.edge + '" stroke-width="2"/>' +
      '<rect x="10" y="10" width="80" height="120" rx="6" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.5"/>' +
      '<path d="M50 30L72 70L50 110L28 70Z" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="2"/>' +
      '<circle cx="50" cy="70" r="7" fill="#ffffff" fill-opacity="0.75"/></svg>';
  }

  /** Label teks singkat (untuk aksesibilitas dan tombol). */
  function label(card) {
    return card.joker ? 'Joker' : LABEL[card.rank] + { S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663' }[card.suit];
  }

  root.CardArt = { svg: svg, back: back, label: label, themes: THEMES };
})(typeof window !== 'undefined' ? window : globalThis);
