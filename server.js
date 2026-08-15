const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Твоя база пользователей (добавили Quesst)
let users = [
    { username: "Quesst" }
];

// 1. Поиск (работает БЕЗ учета регистра и убирает пробелы)
app.post('/api/search', (req, res) => {
    const rawInput = req.body.username || req.body.nickname || "";
    const cleanSearch = String(rawInput).trim().toLowerCase();

    if (!cleanSearch) {
        return res.status(400).json({ success: false, message: "Введите ник" });
    }

    const foundUser = users.find(user => {
        const dbNick = String(user.username || "").trim().toLowerCase();
        return dbNick === cleanSearch;
    });

    if (foundUser) {
        return res.json({ success: true, user: foundUser });
    } else {
        return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
});

// 2. Отдача главной страницы
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. ЭКСПОРТ ДЛЯ VERCEL (Запускаем listen только если запускаем локально)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;