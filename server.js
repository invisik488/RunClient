const express = require('express');
const path = require('path');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// База данных в памяти
const users = [
    { id: 1, username: 'invisik', role: 'owner', isOwner: true }
];

function isSameName(name1, name2) {
    if (!name1 || !name2) return false;
    return name1.trim().localeCompare(name2.trim(), 'ru', { sensitivity: 'accent' }) === 0;
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. АВТОРИЗАЦИЯ
app.post('/api/auth/login', (req, res) => {
    const { username, password, login, nickname } = req.body;
    const userLogin = (username || login || nickname || '').trim();

    if (!userLogin) {
        return res.status(400).json({ success: false, message: 'Заполните поля!' });
    }

    let user = users.find(u => isSameName(u.username, userLogin));

    if (!user && isSameName(userLogin, 'invisik')) {
        user = { id: Date.now(), username: userLogin, role: 'owner', isOwner: true };
        users.push(user);
    } else if (!user) {
        user = { id: Date.now(), username: userLogin, role: 'user', isOwner: false };
        users.push(user);
    }

    const userRole = user.role || 'user';

    // Отдаем ник во ВСЕХ возможных полях, чтобы фронтенд точно отобразил его в ЛК!
    return res.json({ 
        success: true, 
        message: 'Успешный вход!', 
        user: { 
            id: user.id,
            username: user.username,
            login: user.username,
            nickname: user.username,
            role: userRole,
            isAdmin: userRole === 'admin' || userRole === 'owner',
            isOwner: userRole === 'owner'
        },
        token: 'versedlc-token-123'
    });
});

// 2. РЕГИСТРАЦИЯ
app.post('/api/auth/register', (req, res) => {
    const { username, password, login, nickname } = req.body;
    const userLogin = (username || login || nickname || '').trim();

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
        username: userLogin, 
        password: password || '',
        role: defaultRole,
        isOwner: defaultRole === 'owner'
    };
    users.push(newUser);

    return res.json({ 
        success: true, 
        message: 'Регистрация успешна!', 
        user: { 
            username: newUser.username, 
            login: newUser.username,
            nickname: newUser.username,
            role: newUser.role 
        } 
    });
});

// 🔍 3. ПОИСК И ПОЛУЧЕНИЕ СПИСКА ПОЛЬЗОВАТЕЛЕЙ (ДЛЯ АДМИН-ПАНЕЛИ)
app.get('/api/admin/users', (req, res) => {
    const query = (req.query.search || req.query.q || '').trim().toLowerCase();

    let result = users;
    if (query) {
        result = users.filter(u => u.username.toLowerCase().includes(query));
    }

    // Возвращаем юзеров с понятной структурой для фронтенда
    const formattedUsers = result.map(u => ({
        id: u.id,
        username: u.username,
        login: u.username,
        nickname: u.username,
        role: u.role || 'user'
    }));

    res.json({ success: true, users: formattedUsers });
});

// 👑 4. СМЕНА РОЛИ ПРЯМО ИЗ АДМИНКИ НА САЙТЕ
app.post('/api/admin/change-role', (req, res) => {
    const { targetUser, username, role } = req.body;
    const userToFind = targetUser || username;

    if (!userToFind || !role) {
        return res.status(400).json({ success: false, message: 'Укажите пользователя и роль!' });
    }

    let user = users.find(u => isSameName(u.username, userToFind));

    if (!user) {
        // Если юзера ещё не было в массиве — создаём запись с этой ролью
        user = { 
            id: Date.now(), 
            username: userToFind.trim(), 
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
        message: `Роль пользователя ${user.username} успешно изменена на ${role.toUpperCase()}!`,
        user: {
            username: user.username,
            role: user.role
        }
    });
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Сервер VerseDLC работает!' });
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`[VerseDLC] Сервер запущен на порту ${PORT}`));
}

module.exports = app;