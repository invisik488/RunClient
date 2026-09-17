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

// ===== API ЭНДПОИНТЫ (должны быть ВЫШЕ статики) =====

// 1. Поиск пользователя
app.post('/api/search', async (req, res) => {
  const rawInput = req.body.username || req.body.nickname || "";
  const cleanSearch = String(rawInput).trim().toLowerCase();

  if (!cleanSearch) {
    return res.status(400).json({ success: false, message: "Введите ник" });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, role FROM users WHERE LOWER(username) = $1',
      [cleanSearch]
    );

    if (result.rows.length > 0) {
      return res.json({ success: true, user: result.rows[0] });
    } else {
      return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Ошибка базы данных" });
  }
});

// 2. Получить всех пользователей
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

// 3. Выдать роль пользователю
app.post('/api/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  try {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ success: true, message: `Роль ${role} выдана пользователю ${id}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

// 4. Выдать подписку
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
      res.json({ success: true, message: `Колонка subscription создана. Подписка ${subscription} выдана.` });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Ошибка базы данных' });
    }
  }
});

// ===== СТАТИКА (должна быть ПОСЛЕ API) =====
app.use(express.static(__dirname));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
