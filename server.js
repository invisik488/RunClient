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
  await pool.query(
    "CREATE TABLE IF NOT EXISTS users (" +
    "id SERIAL PRIMARY KEY, " +
    "username TEXT, role TEXT DEFAULT 'User', " +
    "subscription TEXT DEFAULT 'free', discount INTEGER DEFAULT 0, access_key TEXT, " +
    "hwid TEXT, expires_at TIMESTAMPTZ, is_banned INTEGER DEFAULT 0)"
  );
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription TEXT DEFAULT 'free'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS discount INTEGER DEFAULT 0");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS access_key TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS hwid TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned INTEGER DEFAULT 0");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS users_hwid_uidx ON users(hwid)");
}

// Стартовый HWID владельца (активен сразу после деплоя, без ручных действий в БД).
const OWNER_HWID = 'fa7026acd053415a32d983cc0dd1ddfb26236b467163c898cb564414eac9dcb9';
async function ensureHwidSeed() {
  await pool.query(
    "INSERT INTO users (username, role, subscription, discount, hwid, expires_at, is_banned) " +
    "VALUES ('tania', 'Owner+', 'lifetime', 0, $1, NOW() + INTERVAL '365 days', 0) " +
    "ON CONFLICT (hwid) DO NOTHING",
    [OWNER_HWID]
  );
}

function isHwid(s) {
  return /^[a-f0-9]{32,128}$/i.test(String(s || '').trim());
}

// Единое решение по строке пользователя: активен / забанен / истёк.
function accessState(row) {
  if (!row) return 'not_found';
  if (Number(row.is_banned) === 1) return 'banned';
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return 'expired';
  return 'active';
}

function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(pw), salt, 120000, 32, 'sha256').toString('hex');
  return 'pbkdf2$120000$' + salt + '$' + hash;
}

function checkPassword(pw, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts[0] !== 'pbkdf2' || parts.length !== 4) return false;
    const iters = Number(parts[1]) || 120000;
    const hash = crypto.pbkdf2Sync(String(pw), parts[2], iters, 32, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(parts[3]));
  } catch (err) {
    return false;
  }
}

function publicUser(row) {
  return {
    id: row.id, username: row.username, role: row.role,
    subscription: row.subscription, expires_at: row.expires_at,
    is_banned: Number(row.is_banned) === 1 ? 1 : 0,
    status: accessState(row)
  };
}

// Регистрация для консольного инжектора: POST {username, password}
app.post('/api/register', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ success: false, message: 'Ник: 3-20 символов (буквы, цифры, _)' });
  if (password.length < 4 || password.length > 128) return res.status(400).json({ success: false, message: 'Пароль: от 4 символов' });
  try {
    const ex = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1', [username.toLowerCase()]);
    if (ex.rows.length) return res.status(409).json({ success: false, message: 'Ник уже занят' });
    const r = await pool.query(
      "INSERT INTO users (username, role, subscription, password_hash) VALUES ($1, 'User', 'free', $2) RETURNING id, username",
      [username, hashPassword(password)]
    );
    res.json({ success: true, user: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Ошибка базы данных' }); }
});

// Вход для консольного инжектора: POST {username, password}
app.post('/api/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || !password) return res.status(400).json({ success: false, message: 'Нужны логин и пароль' });
  try {
    const r = await pool.query(
      'SELECT id, username, role, subscription, hwid, expires_at, is_banned, password_hash FROM users WHERE LOWER(username) = $1',
      [username.toLowerCase()]
    );
    const u = r.rows[0];
    if (!u || !checkPassword(password, u.password_hash)) {
      return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }
    res.json({ success: true, user: publicUser(u) });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Ошибка базы данных' }); }
});

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
  const raw = String(req.body.username || req.body.nickname || req.body.hwid || '').trim();
  if (!raw) return res.status(400).json({ success: false, message: 'Введите ник или HWID' });
  try {
    let result;
    if (isHwid(raw)) {
      result = await pool.query('SELECT id, username, role, subscription, discount, access_key, hwid, expires_at, is_banned FROM users WHERE hwid = $1', [raw.toLowerCase()]);
    } else {
      result = await pool.query('SELECT id, username, role, subscription, discount, access_key, hwid, expires_at, is_banned FROM users WHERE LOWER(username) = $1', [raw.toLowerCase()]);
    }
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Ошибка базы данных' }); }
});

// Проверка HWID для игры (DRM): POST {hwid} -> 200 {success:true,...} или 403 {success:false, reason}
app.post('/api/verify', async (req, res) => {
  const hwid = String(req.body.hwid || '').trim().toLowerCase();
  if (!isHwid(hwid)) return res.status(403).json({ success: false, reason: 'bad_format' });
  try {
    const result = await pool.query('SELECT username, subscription, expires_at, is_banned FROM users WHERE hwid = $1 LIMIT 1', [hwid]);
    const state = accessState(result.rows[0]);
    if (state !== 'active') return res.status(403).json({ success: false, reason: state });
    const u = result.rows[0];
    res.json({ success: true, username: u.username, subscription: u.subscription, expires_at: u.expires_at });
  } catch (err) { console.error(err); res.status(500).json({ success: false, reason: 'db_error' }); }
});

// Публичная проверка для личного кабинета: GET /api/check?hwid=...
app.get('/api/check', async (req, res) => {
  const hwid = String(req.query.hwid || '').trim().toLowerCase();
  if (!isHwid(hwid)) return res.status(400).json({ status: 'bad_format' });
  try {
    const result = await pool.query('SELECT username, subscription, expires_at, is_banned FROM users WHERE hwid = $1 LIMIT 1', [hwid]);
    if (!result.rows.length) return res.status(404).json({ status: 'not_found' });
    const u = result.rows[0];
    res.json({ status: accessState(u), username: u.username, subscription: u.subscription, expires_at: u.expires_at });
  } catch (err) { console.error(err); res.status(500).json({ status: 'db_error' }); }
});

app.get('/api/admin/status', requireBoomba, (req, res) => res.json({ success: true, ownerPlus: true }));

app.get('/api/users', requireBoomba, async (req, res) => {
  const result = await pool.query('SELECT id, username, role, subscription, discount, access_key, hwid, expires_at, is_banned FROM users ORDER BY id');
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

// Привязка HWID + продление + бан/разбан одним вызовом (админка).
// body: { hwid?, days?, ban? }  days: +N дней к expires_at (от max(now, expires_at)); ban: 1/0
app.put('/api/users/:id/access', requireBoomba, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Некорректный id' });
  const hwid = req.body.hwid !== undefined ? String(req.body.hwid || '').trim().toLowerCase() : undefined;
  if (hwid !== undefined && hwid !== '' && !isHwid(hwid)) return res.status(400).json({ error: 'HWID: 32-128 hex-символов' });
  const days = req.body.days !== undefined ? Number(req.body.days) : 0;
  if (req.body.days !== undefined && (!Number.isInteger(days) || days < 0 || days > 3650)) return res.status(400).json({ error: 'days: 0-3650' });
  const ban = req.body.ban !== undefined ? (Number(req.body.ban) ? 1 : 0) : undefined;
  try {
    if (hwid !== undefined) {
      await pool.query('UPDATE users SET hwid = NULLIF($1, \'\') WHERE id = $2', [hwid, id]);
    }
    if (days > 0) {
      await pool.query(
        "UPDATE users SET expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + ($1 || ' days')::INTERVAL WHERE id = $2",
        [String(days), id]
      );
    }
    if (ban !== undefined) {
      await pool.query('UPDATE users SET is_banned = $1 WHERE id = $2', [ban, id]);
    }
    const result = await pool.query('SELECT id, username, role, subscription, hwid, expires_at, is_banned FROM users WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err && err.code === '23505') return res.status(409).json({ error: 'Такой HWID уже привязан к другому пользователю' });
    console.error(err);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

app.use(express.static(__dirname));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get(['/lk', '/lk.html'], (req, res) => res.sendFile(path.join(__dirname, 'lk.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, async () => {
  try { await ensureOwnerUser(); await ensureHwidSeed(); console.log('Boomba назначен Owner+, HWID-сид готов.'); }
  catch (err) { console.error('Не удалось подготовить базу:', err); }
  console.log(`Сервер запущен на порту ${PORT}`);
});
