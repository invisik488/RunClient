const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// База данных (пример)
let users = [
    { username: "Quesst", role: "admin", subscription: "Lifetime" }
];

// API: Поиск пользователя
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

// Маршруты страниц
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Catch-all для SPA (чтобы при обновлении страницы не было 404)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 ApexClient Server running on port ${PORT}`);
});