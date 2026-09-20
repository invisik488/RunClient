const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const app = express();

const PORT = process.env.PORT || 3000;
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
  const result = await pool.query(
    'SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
    ['Boomba']
  );
  if (result.rows.length) {
    await pool.query(
      "UPDATE users SET username = 'Boomba', role = 'Owner', subscription = 'lifetime' WHERE id = $1",
      [result.rows[0].id]
    );
  } else {
    await pool.query(
      "INSERT INTO users (username, role, subscription, discount) VALUES ('Boomba', 'Owner', 'lifetime', 0)"
    );
  }
}

async function requireOwner(req, res, next) {
  try {
    const username = String(req.get('x-admin-user') || '').trim().toLowerCase();
    if (!username) return res.status(401).json({ error: 'Требуется авторизация владельца' });
    const result = await pool.query(
      "SELECT role FROM users WHERE LOWER(username) = $1 LIMIT 1",
      [username]
    );
    if (!result.rows.length || String(result.rows[0].role).toLowerCase() !== 'owner') {
      return res.status(403).json({ error: 'Только Owner может выполнить это действие' });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка проверки прав' });
  }
}

app.post('/api/search', async (req, res) => {
  const username = String(req.body.username || req.body.nickname || '').trim().toLowerCase();
  if (!username) return res.status(400).json({ success: false, message: 'Введите ник' });
  try {
    const result = await pool.query(
      'SELECT id, username, role, subscription, discount, access_key FROM users WHERE LOWER(username) = $1',
      [username]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных' });
  }
});

app.get('/api/users', requireOwner, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, subscription, discount, access_key FROM users ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

app.post('/api/users/:id/role', requireOwner, async (req, res) => {
  const role = String(req.body.role || 'User').trim();
  try {
    const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role', [role, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

app.put('/api/users/:id/subscription', requireOwner, async (req, res) => {
  const subscription = String(req.body.subscription || 'free').trim();
  try {
    const result = await pool.query('UPDATE users SET subscription = $1 WHERE id = $2 RETURNING id, username, subscription', [subscription, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

app.delete('/api/users/:id/subscription', requireOwner, async (req, res) => {
  try {
    const result = await pool.query("UPDATE users SET subscription = 'free', access_key = NULL WHERE id = $1 RETURNING id, username, subscription", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

app.put('/api/users/:id/discount', requireOwner, async (req, res) => {
  const discount = Math.max(0, Math.min(100, Number(req.body.discount)));
  if (!Number.isFinite(discount)) return res.status(400).json({ error: 'Скидка должна быть числом от 0 до 100' });
  try {
    const result = await pool.query('UPDATE users SET discount = $1 WHERE id = $2 RETURNING id, username, discount', [discount, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

app.post('/api/keys', requireOwner, async (req, res) => {
  const count = Math.max(1, Math.min(100, Number(req.body.count) || 1));
  const keys = Array.from({ length: count }, () => `RUN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`);
  res.json({ success: true, keys });
});

app.use(express.static(__dirname));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, async () => {
  try {
    await ensureOwnerUser();
    console.log('Boomba назначен Owner.');
  } catch (err) {
    console.error('Не удалось подготовить базу:', err);
  }
  console.log(`Сервер запущен на порту ${PORT}`);
});
