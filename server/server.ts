import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { Game } from './game';

interface Room {
  game: Game;
  socks: Map<string, WebSocket>;
  touched: number;
}

export interface ServerOptions {
  /** Bila diisi, pemain baru wajib memasukkan kode ini (untuk pemain terpilih). */
  accessCode?: string;
  maxRooms?: number;
}

export function startServer(port = 3000, opts: ServerOptions = {}) {
  const accessCode = opts.accessCode ?? '';
  const maxRooms = opts.maxRooms ?? 100;
  const rooms = new Map<string, Room>();
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };
  const server = http.createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return void res.end('ok');
    }
    const name = path === '/' ? 'index.html' : path.slice(1);
    const file = join(publicDir, name);
    if (!/^[\w.-]+$/.test(name) || !existsSync(file)) {
      res.writeHead(404);
      return void res.end('Not found');
    }
    res.writeHead(200, {
      'content-type': types[extname(name)] ?? 'application/octet-stream',
      // halaman dan service worker selalu diambil terbaru agar pembaruan cepat sampai ke tester
      'cache-control': name === 'sw.js' || name === 'index.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(readFileSync(file));
  });
  const wss = new WebSocketServer({ server, maxPayload: 4096 });
  const send = (ws: WebSocket, o: unknown) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(o));
  const broadcast = (code: string) => {
    const r = rooms.get(code);
    if (r) for (const [pid, ws] of r.socks) send(ws, { type: 'state', room: code, state: r.game.view(pid) });
  };
  const newCode = () => {
    let c: string;
    do c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
    while (rooms.has(c));
    return c;
  };

  wss.on('connection', (ws) => {
    let code = '';
    let pid = '';
    let burst = 0; // batas laju pesan per soket
    const reset = setInterval(() => (burst = 0), 1000);
    ws.on('message', (raw) => {
      if (++burst > 30) return;
      let m: { type: string; [k: string]: unknown };
      try {
        m = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (m.type === 'ping') return; // keep-alive dari klien (menjaga layanan gratis tetap aktif)
      if (m.type === 'join') {
        if (code) return;
        let c = String(m.room ?? '').toUpperCase();
        const known = rooms.get(c)?.game.players.some((p) => p.id === String(m.token ?? ''));
        if (accessCode && !known && String(m.access ?? '') !== accessCode) return send(ws, { type: 'error', error: 'Kode akses salah' });
        if (!c) {
          if (rooms.size >= maxRooms) return send(ws, { type: 'error', error: 'Server penuh, coba lagi nanti' });
          c = newCode();
          rooms.set(c, { game: new Game(), socks: new Map(), touched: Date.now() });
        }
        const room = rooms.get(c);
        if (!room) return send(ws, { type: 'error', error: 'Room tidak ditemukan' });
        const token = String(m.token ?? '');
        const existing = room.game.players.find((p) => p.id === token);
        if (existing) pid = token;
        else {
          pid = randomBytes(8).toString('hex');
          const r = room.game.addPlayer(pid, String(m.name ?? ''));
          if (!r.ok) return send(ws, { type: 'error', error: r.error }), (pid = '');
        }
        code = c;
        room.socks.get(pid)?.close();
        room.socks.set(pid, ws);
        room.game.setConnected(pid, true);
        send(ws, { type: 'joined', token: pid, room: c });
        return broadcast(c);
      }
      const room = rooms.get(code);
      if (!room || !pid) return;
      room.touched = Date.now();
      const r = room.game.act(pid, m);
      if (!r.ok) send(ws, { type: 'error', error: r.error });
      broadcast(code);
    });
    ws.on('close', () => {
      clearInterval(reset);
      const room = rooms.get(code);
      if (!room || !pid || room.socks.get(pid) !== ws) return;
      room.socks.delete(pid);
      room.game.setConnected(pid, false);
      broadcast(code);
    });
  });

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms) {
      if (r.game.tick()) broadcast(code);
      // bersihkan room kosong yang tidak aktif lebih dari 2 jam
      if (r.socks.size === 0 && now - r.touched > 2 * 3600_000) rooms.delete(code);
    }
  }, 1000);
  server.on('close', () => clearInterval(timer));
  server.listen(port, '0.0.0.0');
  return { server, wss, rooms };
}
