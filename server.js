const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== БАЗА ДАННЫХ =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Гарантируем, что владелец проекта всегда имеет максимальную роль.
async function ensureOwnerUser() {
  const username = 'Boomba';
  const role = 'Owner';
  const subscription = 'lifetime';

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE users SET username = $1, role = $2, subscription = $3 WHERE id = $4',
        [username, role, subscription, existing.rows[0].id]
      );
      return;
    }

    const columns = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
    );
    const hasRole = columns.rows.some(c => c.column_name === 'role');
    const hasSubscription = columns.rows.some(c => c.column_name === 'subscription');

    if (!hasRole) {
      await pool.query('ALTER TABLE users ADD COLUMN role TEXT DEFAULT  \'' + 'User' + '\'');
    }
    if (!hasSubscription) {
      await pool.query("ALTER TABLE users ADD COLUMN subscription TEXT DEFAULT 'free'");
    }

    await pool.query(
      'INSERT INTO users (username, role, subscription) VALUES ($1, $2, $3)',
      [username, role, subscription]
    );
  } catch (err) {
    console.error('ensureOwnerUser error:', err);
    throw err;
  }
}

// ===== API ЭНДПОИНТЫ =====

app.post('/api/search', async (req, res) => {
  const rawInput = req.body.username || req.body.nickname || "";
  const cleanSearch = String(rawInput).trim().toLowerCase();
  if (!cleanSearch) return res.status(400).json({ success: false, message: "Введите ник" });
  try {
    const result = await pool.query(
      'SELECT id, username, role, subscription FROM users WHERE LOWER(username) = $1',
      [cleanSearch]
    );
    if (result.rows.length > 0) return res.json({ success: true, user: result.rows[0] });
    return res.status(404).json({ success: false, message: "Пользователь не найден" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Ошибка базы данных" });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, subscription FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

app.post('/api/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  try {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ success: true, message: `Роль ${role} выдана` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

app.post('/api/users/:id/subscription', async (req, res) => {
  const { id } = req.params;
  const { subscription } = req.body;
  try {
    await pool.query('UPDATE users SET subscription = $1 WHERE id = $2', [subscription, id]);
    res.json({ success: true, message: `Подписка ${subscription} выдана` });
  } catch (err) {
    if (err.code === '42703') {
      await pool.query("ALTER TABLE users ADD COLUMN subscription TEXT DEFAULT 'free'");
      await pool.query('UPDATE users SET subscription = $1 WHERE id = $2', [subscription, id]);
      res.json({ success: true, message: `Колонка subscription создана.` });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Ошибка базы данных' });
    }
  }
});

// ===== СТАТИКА (ПОСЛЕ API) =====
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, async () => {
  try {
    await ensureOwnerUser();
    console.log('Пользователь Boomba назначен Owner.');
  } catch (err) {
    console.error('Не удалось создать или обновить пользователя Boomba:', err);
  }
  console.log(`Сервер запущен на порту ${PORT}`);
});
