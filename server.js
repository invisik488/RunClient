const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// База пользователей (добавлен ник Quesst)
let users = [
    { username: "Quesst" }
];

// --- Поиск пользователя (Игнорирует регистр и пробелы) ---
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

// Отдача index.html на главный роут
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});