const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function ensureSchema() {
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription TEXT DEFAULT 'free'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS discount INTEGER DEFAULT 0");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS access_key TEXT");
}

async function ensureOwnerUser() {
  await ensureSchema();
  const found = await pool.query("SELECT id FROM users WHERE LOWER(username) = 'boomba' LIMIT 1");
  if (found.rows.length) {
    await pool.query("UPDATE users SET username = 'Boomba', role = 'Owner+', subscription = 'lifetime' WHERE id = $1", [found.rows[0].id]);
  } else {
    await pool.query("INSERT INTO users (username, role, subscription, discount) VALUES ('Boomba', 'Owner+', 'lifetime', 0)");
  }
}

async function requireBoomba(req, res, next) {
  const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!ADMIN_TOKEN || !token || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(ADMIN_TOKEN))) {
    return res.status(401).json({ error: 'Неверный токен админки' });
  }
  const user = String(req.get('x-admin-user') || '').trim().toLowerCase();
  if (user !== 'boomba') return res.status(403).json({ error: 'Админка доступна только Boomba' });
  next();
}

app.post('/api/search', async (req, res) => {
  const username = String(req.body.username || req.body.nickname || '').trim().toLowerCase();
  if (!username) return res.status(400).json({ success: false, message: 'Введите ник' });
  try {
    const result = await pool.query('SELECT id, username, role, subscription, discount, access_key FROM users WHERE LOWER(username) = $1', [username]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Ошибка базы данных' }); }
});

app.get('/api/admin/status', requireBoomba, (req, res) => res.json({ success: true, ownerPlus: true }));

app.get('/api/users', requireBoomba, async (req, res) => {
  const result = await pool.query('SELECT id, username, role, subscription, discount, access_key FROM users ORDER BY id');
  res.json(result.rows);
});

app.put('/api/users/:id/role', requireBoomba, async (req, res) => {
  const role = String(req.body.role || 'User').trim();
  if (!['User', 'Admin', 'Owner'].includes(role)) return res.status(400).json({ error: 'Разрешены User, Admin или Owner' });
  const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 AND LOWER(username) <> \'boomba\' RETURNING id, username, role', [role, req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден или это Boomba' });
  res.json({ success: true, user: result.rows[0] });
});

app.put('/api/users/:id/subscription', requireBoomba, async (req, res) => {
  const subscription = String(req.body.subscription || 'free').trim();
  const result = await pool.query('UPDATE users SET subscription = $1 WHERE id = $2 RETURNING id, username, subscription', [subscription, req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ success: true, user: result.rows[0] });
});

app.delete('/api/users/:id/subscription', requireBoomba, async (req, res) => {
  const result = await pool.query("UPDATE users SET subscription = 'free', access_key = NULL WHERE id = $1 RETURNING id, username, subscription", [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ success: true, user: result.rows[0] });
});

app.put('/api/users/:id/discount', requireBoomba, async (req, res) => {
  const discount = Number(req.body.discount);
  if (!Number.isInteger(discount) || discount < 0 || discount > 100) return res.status(400).json({ error: 'Скидка: целое число от 0 до 100' });
  const result = await pool.query('UPDATE users SET discount = $1 WHERE id = $2 RETURNING id, username, discount', [discount, req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ success: true, user: result.rows[0] });
});

app.post('/api/keys', requireBoomba, async (req, res) => {
  const count = Math.max(1, Math.min(100, Number(req.body.count) || 1));
  const keys = Array.from({ length: count }, () => `RUN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`);
  res.json({ success: true, keys });
});

app.use(express.static(__dirname));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, async () => {
  try { await ensureOwnerUser(); console.log('Boomba назначен Owner+.'); }
  catch (err) { console.error('Не удалось подготовить базу:', err); }
  console.log(`Сервер запущен на порту ${PORT}`);
});
