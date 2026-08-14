const express = require('express');
const path = require('path');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// База данных в памяти
const users = [
    { id: 1, username: 'invisik', role: 'owner', hwid: 'Привязан (HWID-1)' },
    { id: 2, username: 'skqu1ze', role: 'user', hwid: 'Не привязан' }
];

function isSameName(name1, name2) {
    if (!name1 || !name2) return false;
    return name1.trim().localeCompare(name2.trim(), 'ru', { sensitivity: 'accent' }) === 0;
}

// Форматирование объекта юзера под верстку фронтенда (ID, Ник, HWID, Роль)
function formatUserForFrontend(u) {
    return {
        id: u.id || 1,
        username: u.username,
        login: u.username,
        nickname: u.username,
        name: u.username,
        role: u.role || 'user',
        hwid: u.hwid || 'Не привязан',
        isOwner: u.role === 'owner',
        isAdmin: u.role === 'admin' || u.role === 'owner'
    };
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. АВТОРИЗАЦИЯ
app.post('/api/auth/login', (req, res) => {
    const { username, password, login, nickname } = req.body;
    const userLogin = (username || login || nickname || '').trim();

    if (!userLogin) return res.status(400).json({ success: false, message: 'Заполните поля!' });

    let user = users.find(u => isSameName(u.username, userLogin));

    if (!user && isSameName(userLogin, 'invisik')) {
        user = { id: Date.now(), username: userLogin, role: 'owner', hwid: 'Не привязан' };
        users.push(user);
    } else if (!user) {
        user = { id: Date.now(), username: userLogin, role: 'user', hwid: 'Не привязан' };
        users.push(user);
    }

    const formatted = formatUserForFrontend(user);

    return res.json({ 
        success: true, 
        message: 'Успешный вход!', 
        user: formatted,
        data: formatted,
        token: 'versedlc-token-123'
    });
});

// 2. РЕГИСТРАЦИЯ
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
        hwid: 'Не привязан'
    };
    users.push(newUser);

    const formatted = formatUserForFrontend(newUser);

    return res.json({ 
        success: true, 
        message: 'Регистрация успешна!', 
        user: formatted,
        data: formatted
    });
});

// 🎯 3. ПОИСК ИГРОКА ДЛЯ АДМИНКИ (/api/admin/user/:username)
app.get('/api/admin/user/:username', (req, res) => {
    const reqUsername = req.params.username.trim();
    let user = users.find(u => isSameName(u.username, reqUsername));

    if (!user) {
        user = {
            id: Math.floor(Math.random() * 8999) + 1000,
            username: reqUsername,
            role: isSameName(reqUsername, 'invisik') ? 'owner' : 'user',
            hwid: 'Не привязан'
        };
        users.push(user);
    }

    const formatted = formatUserForFrontend(user);

    // Возвращаем данные во всех возможных форматах для JS админки
    return res.json({
        success: true,
        user: formatted,
        data: formatted,
        result: formatted,
        ...formatted
    });
});

// 💾 4. СОХРАНЕНИЕ ИЗМЕНЕНИЙ (СМЕНА РОЛИ + СВОРАЧИВАНИЕ ФОРМЫ)
const saveUserChanges = (req, res) => {
    const paramUser = req.params.username;
    const { targetUser, username, nickname, user, role, selectedRole, newRole } = req.body;
    
    const target = paramUser || targetUser || username || nickname || user;
    const finalRole = role || selectedRole || newRole || 'user';

    if (!target) {
        return res.status(400).json({ success: false, message: 'Не указан игрок!' });
    }

    let found = users.find(u => isSameName(u.username, target));

    if (!found) {
        found = { 
            id: Math.floor(Math.random() * 8999) + 1000, 
            username: target.trim(), 
            role: String(finalRole).toLowerCase(),
            hwid: 'Не привязан'
        };
        users.push(found);
    } else {
        found.role = String(finalRole).toLowerCase();
    }

    const formatted = formatUserForFrontend(found);

    return res.json({ 
        success: true, 
        message: 'Изменения успешно сохранены!',
        user: formatted,
        data: formatted
    });
};

// Все варианты вызовов при клике "Сохранить изменения"
app.post('/api/admin/user/:username', saveUserChanges);
app.put('/api/admin/user/:username', saveUserChanges);
app.post('/api/admin/user/:username/update', saveUserChanges);
app.post('/api/admin/user/:username/role', saveUserChanges);
app.post('/api/admin/change-role', saveUserChanges);
app.post('/api/admin/set-role', saveUserChanges);

app.get('/api/status', (req, res) => res.json({ status: 'ok' }));

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`[VerseDLC] Сервер запущен на порту ${PORT}`));
}

module.exports = app;