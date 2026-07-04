import { io } from 'socket.io-client';

async function run() {
  console.log('Registering test user...');
  const res = await fetch('http://localhost:3302/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test',
      email: `test${Date.now()}@example.com`,
      password: 'password123'
    })
  });
  const data = await res.json();
  const token = data.token;
  console.log('Got token:', token);
  
  const socket = io('http://localhost:3302', { auth: { token } });
  socket.on('connect', () => console.log('Socket connected:', socket.id));
  socket.on('connect_error', (err) => console.log('Socket connect error:', err));
  socket.on('whatsapp_qr', (qr) => {
    console.log('RECEIVED QR:', qr.substring(0, 20) + '...');
    process.exit(0);
  });
  socket.on('whatsapp_connected', () => {
    console.log('RECEIVED WHATSAPP CONNECTED');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.log('Timeout waiting for QR');
    process.exit(1);
  }, 10000);
}
run();
