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

// АВТОРИЗАЦИЯ
app.post('/api/auth/login', (req, res) => {
    const { username, password, login, nickname } = req.body;
    const userLogin = (username || login || nickname || '').trim();

    if (!userLogin) return res.status(400).json({ success: false, message: 'Заполните поля!' });

    let user = users.find(u => isSameName(u.username, userLogin));

    if (!user && isSameName(userLogin, 'invisik')) {
        user = { id: Date.now(), username: userLogin, role: 'owner', isOwner: true };
        users.push(user);
    } else if (!user) {
        user = { id: Date.now(), username: userLogin, role: 'user', isOwner: false };
        users.push(user);
    }

    const userRole = user.role || 'user';

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

// РЕГИСТРАЦИЯ
app.post('/api/auth/register', (req, res) => {
    const { username, password, login, nickname } = req.body;
    const userLogin = (username || login || nickname || '').trim();

    if (!userLogin) return res.status(400).json({ success: false, message: 'Заполните поля!' });

    let existingUser = users.find(u => isSameName(u.username, userLogin));
    if (existingUser) return res.status(400).json({ success: false, message: 'Пользователь уже существует!' });

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
        user: { username: newUser.username, login: newUser.username, nickname: newUser.username, role: newUser.role } 
    });
});

// 🔍 ВСЕВОЗМОЖНЫЕ ЭНДПОИНТЫ ПОИСКА (Ответит на любой запрос фронтенда)
const handleSearch = (req, res) => {
    const q = (req.query.search || req.query.q || req.query.query || req.query.username || req.query.name || '').trim().toLowerCase();

    let filtered = users;
    if (q) {
        filtered = users.filter(u => u.username.toLowerCase().includes(q));
    }

    const resultList = filtered.map(u => ({
        id: u.id,
        username: u.username,
        login: u.username,
        nickname: u.username,
        name: u.username,
        role: u.role || 'user'
    }));

    // Отдаем массив и в поле users, и в data, и напрямую массивом
    res.json({ success: true, users: resultList, data: resultList, result: resultList });
};

app.get('/api/admin/users', handleSearch);
app.get('/api/users/search', handleSearch);
app.get('/api/users/find', handleSearch);
app.get('/api/users', handleSearch);
app.get('/api/search', handleSearch);

// 👑 ВЫДАЧА И СМЕНА РОЛИ
const handleChangeRole = (req, res) => {
    const { targetUser, username, nickname, user, role } = req.body;
    const target = targetUser || username || nickname || user;

    if (!target || !role) {
        return res.status(400).json({ success: false, message: 'Укажите пользователя и роль!' });
    }

    let found = users.find(u => isSameName(u.username, target));

    if (!found) {
        found = { 
            id: Date.now(), 
            username: target.trim(), 
            role: role.toLowerCase(),
            isOwner: role.toLowerCase() === 'owner'
        };
        users.push(found);
    } else {
        found.role = role.toLowerCase();
        found.isOwner = role.toLowerCase() === 'owner';
    }

    return res.json({ 
        success: true, 
        message: `Роль пользователя ${found.username} изменена на ${role.toUpperCase()}!`,
        user: { username: found.username, role: found.role }
    });
};

app.post('/api/admin/change-role', handleChangeRole);
app.post('/api/admin/set-role', handleChangeRole);
app.post('/api/users/set-role', handleChangeRole);

app.get('/api/status', (req, res) => res.json({ status: 'ok' }));

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`[VerseDLC] Сервер запущен на порту ${PORT}`));
}

module.exports = app;