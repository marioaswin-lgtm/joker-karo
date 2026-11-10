import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../server/server';

const { server, wss } = startServer(0);
afterAll(() => {
  wss.clients.forEach((c) => c.terminate());
  server.close();
});

function client() {
  const port = (server.address() as AddressInfo).port;
  const ws = new WebSocket(`ws://localhost:${port}`);
  const inbox: any[] = [];
  const waiters: Array<() => void> = [];
  ws.on('message', (d) => {
    inbox.push(JSON.parse(String(d)));
    waiters.splice(0).forEach((w) => w());
  });
  const open = new Promise<void>((r) => ws.on('open', () => r()));
  const next = async (pred: (m: any) => boolean, ms = 2000) => {
    const t0 = Date.now();
    for (;;) {
      const i = inbox.findIndex(pred);
      if (i >= 0) return inbox.splice(i, 1)[0];
      if (Date.now() - t0 > ms) throw new Error('timeout menunggu pesan');
      await new Promise<void>((r) => {
        waiters.push(r);
        setTimeout(r, 50);
      });
    }
  };
  const last = (type: string) => [...inbox].reverse().find((m) => m.type === type);
  return { ws, open, next, last, inbox, send: (o: object) => ws.send(JSON.stringify(o)) };
}

describe('Server WebSocket', () => {
  it('membuat room, bergabung, memulai, dan hanya mengirim kartu milik sendiri', async () => {
    const a = client();
    await a.open;
    a.send({ type: 'join', name: 'Ani' });
    const joinedA = await a.next((m) => m.type === 'joined');
    expect(joinedA.room).toHaveLength(4);

    const b = client();
    await b.open;
    b.send({ type: 'join', name: 'Budi', room: joinedA.room.toLowerCase() });
    const joinedB = await b.next((m) => m.type === 'joined');
    expect(joinedB.room).toBe(joinedA.room);

    // bukan host tidak bisa memulai
    b.send({ type: 'start' });
    expect((await b.next((m) => m.type === 'error')).error).toMatch(/host/i);

    a.send({ type: 'start' });
    const sa = (await a.next((m) => m.type === 'state' && m.state.phase === 'discard')).state;
    const sb = (await b.next((m) => m.type === 'state' && m.state.phase === 'discard')).state;
    expect(sa.players).toHaveLength(2);
    expect(sa.hand.length + sb.hand.length).toBe(21); // 11 + 10
    expect(JSON.stringify(sa.players)).not.toContain('suit');
    expect(sa.center).toBe(2);

    // aksi di luar giliran ditolak
    const second = sb.currentId === sb.myId ? a : b;
    second.send({ type: 'draw_deck' });
    expect((await second.next((m) => m.type === 'error')).error).toMatch(/giliran/i);

    // pemain pertama membuang kartu, giliran pindah
    const firstClient = sb.currentId === sb.myId ? b : a;
    const firstState = sb.currentId === sb.myId ? sb : sa;
    firstClient.send({ type: 'discard', cardId: firstState.hand[0].id });
    const after = (await second.next((m) => m.type === 'state' && m.state.phase === 'draw' && m.state.currentId === m.state.myId)).state;
    expect(after.currentId).toBe(after.myId);
    second.send({ type: 'draw_deck' });
    const drawn = (await second.next((m) => m.type === 'state' && m.state.phase === 'discard' && m.state.hand.length === 11)).state;
    expect(drawn.hand).toHaveLength(11);

    // reconnect dengan token mengembalikan kursi yang sama
    a.ws.close();
    const a2 = client();
    await a2.open;
    a2.send({ type: 'join', name: 'Ani', room: joinedA.room, token: joinedA.token });
    const re = await a2.next((m) => m.type === 'joined');
    expect(re.token).toBe(joinedA.token);
    const st = (await a2.next((m) => m.type === 'state')).state;
    expect(st.players).toHaveLength(2);
    expect(st.myId).toBe(joinedA.token);
    a2.ws.close();
    b.ws.close();
  });

  it('room tidak ditemukan', async () => {
    const c = client();
    await c.open;
    c.send({ type: 'join', name: 'X', room: 'ZZZZ' });
    expect((await c.next((m) => m.type === 'error')).error).toMatch(/tidak ditemukan/i);
    c.ws.close();
  });

  it('menyajikan halaman klien', async () => {
    const port = (server.address() as AddressInfo).port;
    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Joker Karo Online');
  });
});

describe('Server untuk alpha/beta: kode akses dan health check', () => {
  const guarded = startServer(0, { accessCode: 'rahasia' });
  const portOf = (srv: typeof guarded) => (srv.server.address() as AddressInfo).port;
  afterAll(() => {
    guarded.wss.clients.forEach((c) => c.terminate());
    guarded.server.close();
  });
  const connect = async () => {
    const ws = new WebSocket(`ws://localhost:${portOf(guarded)}`);
    const msgs: any[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
    await new Promise<void>((r) => ws.on('open', () => r()));
    const waitFor = async (type: string) => {
      for (let i = 0; i < 40; i++) {
        const m = msgs.find((x) => x.type === type);
        if (m) return m;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error('timeout');
    };
    return { ws, waitFor };
  };

  it('/health mengembalikan ok', async () => {
    const res = await fetch(`http://localhost:${portOf(guarded)}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('tanpa atau dengan kode akses salah: ditolak; kode benar: masuk', async () => {
    const bad = await connect();
    bad.ws.send(JSON.stringify({ type: 'join', name: 'Tamu' }));
    expect((await bad.waitFor('error')).error).toMatch(/kode akses/i);
    bad.ws.close();

    const good = await connect();
    good.ws.send(JSON.stringify({ type: 'join', name: 'Tamu', access: 'rahasia' }));
    expect((await good.waitFor('joined')).room).toHaveLength(4);
    good.ws.close();
  });

  it('nama dipotong 16 karakter', async () => {
    const c = await connect();
    c.ws.send(JSON.stringify({ type: 'join', name: 'x'.repeat(60), access: 'rahasia' }));
    const st = await c.waitFor('state');
    expect(st.state.players[0].name).toHaveLength(16);
    c.ws.close();
  });
});

describe('Berkas PWA untuk Android dan iPhone', () => {
  const base = () => `http://localhost:${(server.address() as AddressInfo).port}`;

  it('menyajikan manifest, service worker, ikon, dan grafik kartu dengan tipe yang benar', async () => {
    const cases: Array<[string, string]> = [
      ['/manifest.webmanifest', 'application/manifest+json'],
      ['/sw.js', 'text/javascript'],
      ['/cards.js', 'text/javascript'],
      ['/icon-192.png', 'image/png'],
      ['/icon-512.png', 'image/png'],
      ['/icon-maskable-512.png', 'image/png'],
      ['/icon-180.png', 'image/png'],
      ['/icon.svg', 'image/svg+xml'],
    ];
    for (const [path, type] of cases) {
      const res = await fetch(base() + path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type'), path).toContain(type);
    }
  });

  it('manifest valid untuk instalasi (standalone, ikon 192 dan 512)', async () => {
    const m = await (await fetch(base() + '/manifest.webmanifest')).json();
    expect(m.display).toBe('standalone');
    expect(m.orientation).toBe('landscape');
    expect(m.start_url).toBe('/');
    const sizes = m.icons.map((i: any) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(m.icons.some((i: any) => i.purpose === 'maskable')).toBe(true);
  });

  it('halaman memuat tag iOS/Android dan menolak akses di luar folder public', async () => {
    const html = await (await fetch(base() + '/')).text();
    for (const tag of ['rel="manifest"', 'apple-touch-icon', 'apple-mobile-web-app-capable', 'viewport-fit=cover', '/cards.js', 'id="rotate"', 'overflow:hidden', 'openM(\'skor\')']) {
      expect(html).toContain(tag);
    }
    expect((await fetch(base() + '/%2e%2e/package.json')).status).toBe(404);
    expect((await fetch(base() + '/..%2Fpackage.json')).status).toBe(404);
    expect((await fetch(base() + '/tidak-ada.js')).status).toBe(404);
  });
});

describe('Keep-alive', () => {
  it('pesan ping diabaikan tanpa balasan galat', async () => {
    const c = client();
    await c.open;
    c.send({ type: 'join', name: 'Ani' });
    await c.next((m) => m.type === 'joined');
    c.send({ type: 'ping' });
    await new Promise((r) => setTimeout(r, 200));
    expect(c.inbox.some((m) => m.type === 'error')).toBe(false);
    c.ws.close();
  });
});
