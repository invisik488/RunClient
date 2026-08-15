const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Дефолтная стильная аватарка в стиле "жидкое стекло" (SVG-градиент)
const DEFAULT_GLASS_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%236366f1'/><stop offset='100%' stop-color='%23a855f7'/></linearGradient></defs><circle cx='50' cy='50' r='45' fill='url(%23g)' stroke='rgba(255,255,255,0.4)' stroke-width='2'/></svg>";

// Твой массив пользователей (вместо этого может быть загрузка из базы/Google Таблиц)
let users = [
    { username: "Подруга", avatar: DEFAULT_GLASS_AVATAR }
];

// --- 1. РОУТ ДЛЯ ПОИСКА ПОЛЬЗОВАТЕЛЯ ---
app.post('/api/search', (req, res) => {
    const rawInput = req.body.username || req.body.nickname || req.body.query || "";
    
    // Очищаем то, что ввели (убираем пробелы и переводим в нижний регистр)
    const cleanSearch = String(rawInput).trim().toLowerCase();

    if (!cleanSearch) {
        return res.status(400).json({ success: false, message: "Введите ник для поиска" });
    }

    // Железобетонный поиск с игнорированием регистра и пробелов
    const foundUser = users.find(user => {
        const dbNick = String(user.username || user.nickname || "").trim().toLowerCase();
        return dbNick === cleanSearch;
    });

    if (foundUser) {
        return res.json({
            success: true,
            user: {
                username: foundUser.username,
                avatar: foundUser.avatar || DEFAULT_GLASS_AVATAR
            }
        });
    } else {
        return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
});

// --- 2. РОУТ ДЛЯ РЕГИСТРАЦИИ (автоматически ставит стеклянную аватарку) ---
app.post('/api/register', (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ success: false, message: "Укажите ник" });
    }

    const newUser = {
        username: username.trim(),
        avatar: DEFAULT_GLASS_AVATAR
    };

    users.push(newUser);
    return res.json({ success: true, user: newUser });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});