const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Хранилище пользователей в памяти
const users = [
    { id: 1, username: 'invisik', role: 'owner', isOwner: true } // Ты сразу Owner по умолчанию
];

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// АВТОРИЗАЦИЯ (ВХОД)
app.post('/api/auth/login', (req, res) => {
    const { username, password, login } = req.body;
    const userLogin = username || login;

    if (!userLogin) {
        return res.status(400).json({ success: false, message: 'Заполните поля!' });
    }

    // Ищем пользователя в массиве
    let user = users.find(u => u.username.toLowerCase() === userLogin.toLowerCase());

    // Если заходит invisik, а его нет — создаём его как Owner
    if (!user && userLogin.toLowerCase() === 'invisik') {
        user = { id: Date.now(), username: userLogin, role: 'owner', isOwner: true };
        users.push(user);
    }

    // Роль по умолчанию — user, если пользователь ещё не зарегистрирован или не нашел роль
    const userRole = user ? user.role : 'user';
    const isOwnerUser = userRole === 'owner';
    const isAdminUser = userRole === 'admin' || userRole === 'owner';

    return res.json({ 
        success: true, 
        message: 'Успешный вход!', 
        user: { 
            username: userLogin,
            role: userRole,
            isAdmin: isAdminUser,
            isOwner: isOwnerUser
        },
        token: 'versedlc-token-123'
    });
});

// РЕГИСТРАЦИЯ
app.post('/api/auth/register', (req, res) => {
    const { username, password, login } = req.body;
    const userLogin = username || login;

    if (!userLogin) {
        return res.status(400).json({ success: false, message: 'Заполните поля!' });
    }

    let existingUser = users.find(u => u.username.toLowerCase() === userLogin.toLowerCase());
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Пользователь уже существует!' });
    }

    const defaultRole = userLogin.toLowerCase() === 'invisik' ? 'owner' : 'user';

    const newUser = { 
        id: Date.now(), 
        username: userLogin, 
        password: password || '',
        role: defaultRole,
        isOwner: defaultRole === 'owner'
    };
    users.push(newUser);

    return res.json({ 
        success: true, 
        message: 'Регистрация успешна!', 
        user: { username: newUser.username, role: newUser.role } 
    });
});

// 👑 УНИВЕРСАЛЬНАЯ КОМАНДА ДЛЯ CMD: ВЫДАЧА РОЛИ ЛЮБОМУ ЮЗЕРУ (admin, owner, vip, user)
app.post('/api/admin/set-role', (req, res) => {
    const { secretKey, username, role } = req.body;

    // Секретный ключ для защиты от левых людей
    if (secretKey !== 'versedlc-secret-owner-key-123') {
        return res.status(403).json({ success: false, message: 'Неверный секретный ключ!' });
    }

    if (!username || !role) {
        return res.status(400).json({ success: false, message: 'Укажите username и role!' });
    }

    let user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
        // Если юзер еще не заходил/не регистрировался, создаем запись под него с этой ролью
        user = { 
            id: Date.now(), 
            username: username, 
            role: role.toLowerCase(),
            isOwner: role.toLowerCase() === 'owner'
        };
        users.push(user);
    } else {
        user.role = role.toLowerCase();
        user.isOwner = role.toLowerCase() === 'owner';
    }

    return res.json({ 
        success: true, 
        message: `[VerseDLC] Пользователю ${username} успешно выдана роль: ${role.toUpperCase()}!` 
    });
});

// Статусный роут
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Сервер VerseDLC работает!' });
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`[VerseDLC] Сервер запущен на порту ${PORT}`));
}

module.exports = app;