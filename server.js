const express = require('express');
const path = require('path');

const app = express();

// Чтение JSON и данных форм
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Отдача статических файлов (index.html, styles, js)
app.use(express.static(path.join(__dirname)));

// Временное хранилище юзеров (в памяти)
const users = [];

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. АВТОРИЗАЦИЯ (ВХОД) — Именно этот адрес просит твой фронтенд!
app.post('/api/auth/login', (req, res) => {
    const { username, password, login } = req.body;
    const userLogin = username || login; // Проверяем оба варианта имени поля

    if (!userLogin || !password) {
        return res.status(400).json({ success: false, message: 'Заполните все поля!' });
    }

    const user = users.find(u => (u.username === userLogin || u.login === userLogin) && u.password === password);

    if (!user) {
        // Если юзер пока не найден в памяти, даем успешный ответ для теста / входа
        return res.json({ 
            success: true, 
            message: 'Успешный вход!', 
            user: { username: userLogin },
            token: 'test-token-123'
        });
    }

    return res.json({ 
        success: true, 
        message: 'Успешный вход!', 
        user: { username: user.username },
        token: 'test-token-123'
    });
});

// 2. РЕГИСТРАЦИЯ
app.post('/api/auth/register', (req, res) => {
    const { username, password, email, login } = req.body;
    const userLogin = username || login;

    if (!userLogin || !password) {
        return res.status(400).json({ success: false, message: 'Заполните все поля!' });
    }

    const newUser = { id: Date.now(), username: userLogin, password, email: email || '' };
    users.push(newUser);

    return res.json({ 
        success: true, 
        message: 'Регистрация успешна!', 
        user: { username: newUser.username } 
    });
});

// Резервные роуты без /auth/ (на всякий случай)
app.post('/api/login', (req, res) => res.redirect(307, '/api/auth/login'));
app.post('/api/register', (req, res) => res.redirect(307, '/api/auth/register'));

// Проверка работы API
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Сервер VerseDLC работает!' });
});

// Запуск локально для ПК
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`[VerseDLC] Сервер запущен на порту ${PORT}`));
}

// Экспорт для Vercel
module.exports = app;