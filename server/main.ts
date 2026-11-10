import { startServer } from './server';

const port = Number(process.env.PORT ?? 3000);
startServer(port, { accessCode: process.env.ACCESS_CODE });
console.log(`Joker Karo Online berjalan di http://localhost:${port}${process.env.ACCESS_CODE ? ' (kode akses aktif)' : ''}`);
