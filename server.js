const express = require('express');
const path = require('path');

const app = express();

// Настройка правильного декодирования UTF-8 для кириллицы
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Хранилище в памяти
const users = [
    { id: 1, username: 'invisik', role: 'owner', isOwner: true }
];

// Функция безопасного сравнения ников (учитывает русский язык и регистр)
function isSameName(name1, name2) {
    if (!name1 || !name2) return false;
    return name1.trim().localeCompare(name2.trim(), 'ru', { sensitivity: 'accent' }) === 0;
}

// Главная
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// АВТОРИЗАЦИЯ
app.post('/api/auth/login', (req, res) => {
    const { username, password, login } = req.body;
    const userLogin = username || login;

    if (!userLogin) {
        return res.status(400).json({ success: false, message: 'Заполните поля!' });
    }

    let user = users.find(u => isSameName(u.username, userLogin));

    if (!user && isSameName(userLogin, 'invisik')) {
        user = { id: Date.now(), username: userLogin, role: 'owner', isOwner: true };
        users.push(user);
    }

    const userRole = user ? user.role : 'user';

    return res.json({ 
        success: true, 
        message: 'Успешный вход!', 
        user: { 
            username: user ? user.username : userLogin,
            role: userRole,
            isAdmin: userRole === 'admin' || userRole === 'owner',
            isOwner: userRole === 'owner'
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

    let existingUser = users.find(u => isSameName(u.username, userLogin));
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Пользователь уже существует!' });
    }

    const defaultRole = isSameName(userLogin, 'invisik') ? 'owner' : 'user';

    const newUser = { 
        id: Date.now(), 
        username: userLogin.trim(), 
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

// 👑 ВЫДАЧА РОЛИ (С ПОДДЕРЖКОЙ КИРИЛЛИЦЫ)
app.post('/api/admin/set-role', (req, res) => {
    const { secretKey, username, role } = req.body;

    if (secretKey !== 'versedlc-secret-owner-key-123') {
        return res.status(403).json({ success: false, message: 'Неверный секретный ключ!' });
    }

    if (!username || !role) {
        return res.status(400).json({ success: false, message: 'Укажите username и role!' });
    }

    const cleanUsername = username.trim();
    let user = users.find(u => isSameName(u.username, cleanUsername));

    if (!user) {
        user = { 
            id: Date.now(), 
            username: cleanUsername, 
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
        message: `[VerseDLC] Пользователю ${cleanUsername} успешно выдана роль: ${role.toUpperCase()}!` 
    });
});

// ПОИСК / СПИСОК ЮЗЕРОВ (Для работы поиска на сайте)
app.get('/api/users', (req, res) => {
    res.json({ success: true, users });
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Сервер VerseDLC работает!' });
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`[VerseDLC] Сервер запущен на порту ${PORT}`));
}

module.exports = app;