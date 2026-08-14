const express = require('express');
const path = require('path');

const app = express();

// Мидлвары для чтения JSON и данных из форм
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Отдача статических файлов (index.html, styles, client JS)
app.use(express.static(path.join(__dirname)));

// Хранилище юзеров в памяти (для тестов и работы фронта)
// Если у тебя подключена внешняя база или Гугл-таблицы — вставь их логику сюда
const users = [];

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Проверка статуса сервера
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Сервер VerseDLC полностью работает!' });
});

// 1. МАРШРУТ РЕГИСТРАЦИИ
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Заполните все поля!' });
    }

    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Пользователь уже существует!' });
    }

    const newUser = { id: Date.now(), username, password, email: email || '' };
    users.push(newUser);

    return res.json({ 
        success: true, 
        message: 'Регистрация успешна!', 
        user: { username: newUser.username } 
    });
});

// 2. МАРШРУТ ВХОДА (АВТОРИЗАЦИЯ)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Заполните логин и пароль!' });
    }

    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ success: false, message: 'Неверный логин или пароль!' });
    }

    return res.json({ 
        success: true, 
        message: 'Успешный вход!', 
        user: { username: user.username } 
    });
});

// Локальный запуск для ПК
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`[VerseDLC] Сервер запущен на порту ${PORT}`);
    });
}

// Экспорт для Vercel
module.exports = app;