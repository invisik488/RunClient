const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const db = new sqlite3.Database('./database.db');

// Обработка JSON и раздача файлов веб-сайта
app.use(express.json());
app.use(express.static(__dirname));

// --------------------------------------------------
// 1. ИНИЦИАЛИЗАЦИЯ ПАПОК И БАЗЫ ДАННЫХ
// --------------------------------------------------
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

db.serialize(() => {
  // Таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT UNIQUE NOT NULL,
    login TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('owner', 'moderator', 'media', 'user')) DEFAULT 'user',
    sub_expires_at DATETIME NULL,
    hwid TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица настроек (для Тех. работ)
  db.run(`CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  db.run(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('maintenance_mode', 'false')`);

  // Промокоды медиа
  db.run(`CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    owner_id INTEGER REFERENCES users(id),
    uses_count INTEGER DEFAULT 0
  )`);

  // Ключи активации
  db.run(`CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_code TEXT UNIQUE NOT NULL,
    duration_days INTEGER NOT NULL,
    created_by INTEGER REFERENCES users(id),
    is_used INTEGER DEFAULT 0,
    used_by INTEGER REFERENCES users(id)
  )`);

  // Сброс пароля (OTP)
  db.run(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL
  )`);
});

// Настройка сохранения файла лаунчера
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, 'launcher.exe')
});
const upload = multer({ storage });

// --------------------------------------------------
// 2. MIDDLEWARE ТЕХНИЧЕСКИХ РАБОТ
// --------------------------------------------------
app.use((req, res, next) => {
  db.get("SELECT value FROM system_settings WHERE key = 'maintenance_mode'", [], (err, row) => {
    const isMaintenance = row && row.value === 'true';
    const isOwnerAction = req.path.startsWith('/api/admin/maintenance') || req.path === '/api/auth/login';

    if (isMaintenance && !isOwnerAction) {
      return res.status(503).json({
        success: false,
        maintenance: true,
        message: 'На сервере ведутся технические работы.'
      });
    }
    next();
  });
});

// --------------------------------------------------
// 3. АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ НА САЙТЕ
// --------------------------------------------------

// Регистрация аккаунта
app.post('/api/auth/register', async (req, res) => {
  const { nickname, login, email, password } = req.body;
  if (!nickname || !login || !email || !password) return res.status(400).json({ message: 'Заполните все поля' });

  const hash = await bcrypt.hash(password, 10);
  db.run(
    'INSERT INTO users (nickname, login, email, password_hash) VALUES (?, ?, ?, ?)',
    [nickname, login, email, hash],
    function (err) {
      if (err) return res.status(400).json({ success: false, message: 'Никнейм, логин или email уже заняты' });
      res.json({ success: true, message: 'Успешная регистрация!' });
    }
  );
});

// Вход на сайт
app.post('/api/auth/login', (req, res) => {
  const { login, password } = req.body;
  db.get('SELECT * FROM users WHERE login = ?', [login], async (err, user) => {
    if (err || !user) return res.status(401).json({ success: false, message: 'Неверные данные' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Неверные данные' });

    res.json({
      success: true,
      user: { id: user.id, nickname: user.nickname, role: user.role, sub_expires_at: user.sub_expires_at }
    });
  });
});

// Восстановление пароля (OTP)
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  db.run('INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)', [email, code, expiresAt], (err) => {
    if (err) return res.status(500).json({ success: false });
    console.log(`[OTP КОД ВОССТАНОВЛЕНИЯ] Email: ${email} | Код: ${code}`);
    res.json({ success: true, message: 'Код отправлен на почту' });
  });
});

// Подтверждение кода и смена пароля
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  const now = new Date().toISOString();

  db.get('SELECT * FROM password_resets WHERE email = ? AND code = ? AND expires_at > ?', [email, code, now], async (err, record) => {
    if (err || !record) return res.status(400).json({ success: false, message: 'Неверный или истекший код' });

    const newHash = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password_hash = ? WHERE email = ?', [newHash, email], () => {
      db.run('DELETE FROM password_resets WHERE email = ?', [email]);
      res.json({ success: true, message: 'Пароль успешно обновлен!' });
    });
  });
});

// --------------------------------------------------
// 4. ЛАУНЧЕР: СКАЧИВАНИЕ И АВТОРИЗАЦИЯ
// --------------------------------------------------

// Скачивание файла лаунчера из папки /uploads/
app.get('/download/launcher', (req, res) => {
  const file = path.join(UPLOADS_DIR, 'launcher.exe');
  if (fs.existsSync(file)) {
    res.download(file, 'Launcher.exe');
  } else {
    res.status(404).send('Файл лаунчера не найден на сервере.');
  }
});

// Вход из лаунчера с проверкой подписки и HWID
app.post('/api/launcher/login', (req, res) => {
  const { login, password, hwid } = req.body;

  db.get('SELECT * FROM users WHERE login = ?', [login], async (err, user) => {
    if (err || !user) return res.status(401).json({ success: false, message: 'Пользователь не найден' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Неверный пароль' });

    const now = new Date();
    const subExpires = user.sub_expires_at ? new Date(user.sub_expires_at) : null;

    if (!subExpires || subExpires < now) {
      return res.status(403).json({
        success: false,
        hasSub: false,
        redirectUrl: 'http://localhost:3000/#shop',
        message: 'Подписка закончилась или отсутствует.'
      });
    }

    if (!user.hwid) {
      db.run('UPDATE users SET hwid = ? WHERE id = ?', [hwid, user.id]);
    } else if (user.hwid !== hwid && user.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Ошибка привязки HWID.' });
    }

    res.json({ success: true, hasSub: true, nickname: user.nickname, sub_expires_at: user.sub_expires_at });
  });
});

// --------------------------------------------------
// 5. АДМИН-ПАНЕЛЬ И СИСТЕМА ЗАЩИТЫ РОЛЕЙ
// --------------------------------------------------

// Поиск игрока по никнейму
app.get('/api/admin/user/:nickname', (req, res) => {
  db.get('SELECT id, nickname, login, email, role, sub_expires_at, hwid FROM users WHERE nickname = ?', [req.params.nickname], (err, user) => {
    if (err || !user) return res.status(404).json({ message: 'Пользователь не найден' });
    res.json(user);
  });
});

// Выдача подписки и смены ролей с защитой от превышения прав
app.post('/api/admin/update-user', (req, res) => {
  const { adminUserId, adminRole, targetUserId, newRole, daysToAdd } = req.body;

  db.get('SELECT role, sub_expires_at FROM users WHERE id = ?', [targetUserId], (err, targetUser) => {
    if (!targetUser) return res.status(404).json({ message: 'Игрок не найден' });

    // Модератор не может менять параметры Владельца
    if (adminRole === 'moderator' && targetUser.role === 'owner') {
      return res.status(403).json({ success: false, message: 'Запрещено: Модератор не может менять параметры Владельца!' });
    }

    // Владелец не может забрать роль у другого Владельца
    if (adminRole === 'owner' && targetUser.role === 'owner' && adminUserId !== targetUserId && newRole !== 'owner') {
      return res.status(403).json({ success: false, message: 'Запрещено: Нельзя забрать Владельца у другого Владельца!' });
    }

    let newExpires = targetUser.sub_expires_at;
    if (daysToAdd !== undefined && daysToAdd !== 0) {
      let baseDate = (targetUser.sub_expires_at && new Date(targetUser.sub_expires_at) > new Date())
        ? new Date(targetUser.sub_expires_at)
        : new Date();
      baseDate.setDate(baseDate.getDate() + parseInt(daysToAdd));
      newExpires = baseDate.toISOString();
    }

    db.run(
      'UPDATE users SET role = COALESCE(?, role), sub_expires_at = ? WHERE id = ?',
      [newRole, newExpires, targetUserId],
      () => res.json({ success: true, message: 'Данные успешно обновлены!' })
    );
  });
});

// Сброс HWID
app.post('/api/admin/reset-hwid', (req, res) => {
  const { adminRole, targetUserId } = req.body;

  db.get('SELECT role FROM users WHERE id = ?', [targetUserId], (err, targetUser) => {
    if (adminRole === 'moderator' && targetUser.role === 'owner') {
      return res.status(403).json({ success: false, message: 'Модератор не может менять Владельца' });
    }

    db.run('UPDATE users SET hwid = NULL WHERE id = ?', [targetUserId], () => {
      res.json({ success: true, message: 'HWID успешно сброшен!' });
    });
  });
});

// Переключение Тех. работ
app.post('/api/admin/maintenance', (req, res) => {
  const { enable } = req.body;
  db.run("UPDATE system_settings SET value = ? WHERE key = 'maintenance_mode'", [enable ? 'true' : 'false'], () => {
    res.json({ success: true, message: enable ? 'Тех. работы включены' : 'Тех. работы выключены' });
  });
});

// Загрузка файла лаунчера через панель
app.post('/api/admin/upload-launcher', upload.single('launcher'), (req, res) => {
  res.json({ success: true, message: 'Файл лаунчера обновлен!' });
});

// Старт сервера
app.listen(3000, () => console.log('СЕРВЕР УСПЕШНО ЗАПУЩЕН НА ПОРТУ 3000'));