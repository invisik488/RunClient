const express = require('express');
const path = require('path');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// 👑 СПИСОК ПОЛЬЗОВАТЕЛЕЙ С ЖЁСТКО ЗАКРЕПЛЁННЫМИ РОЛЯМИ
// Добавляй сюда любых друзей, и их роль НИКОГДА не сбросится!
const users = [
    { id: 1, username: 'invisik', role: 'owner', hwid: 'Привязан' },
    { id: 2, username: 'Krisstina', role: 'owner', hwid: 'Не привязан' }, // Подруга теперь ЖЕЛЕЗНО OWNER
    { id: 3, username: 'skqu1ze', role: 'owner', hwid: 'Не привязан' }
];

function isSameName(name1, name2) {
    if (!name1 || !name2) return false;
    // Сравнение имён без учёта регистра и символов вроде @
    const clean1 = name1.split('@')[0].trim().toLowerCase();
    const clean2 = name2.split('@')[0].trim().toLowerCase();
    return clean1 === clean2;
}

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

// АВТОРИЗАЦИЯ
app.post('/api/auth/login', (req, res) => {
    const { username, password, login, nickname } = req.body;
    const userLogin = (username || login || nickname || '').trim();

    if (!userLogin) return res.status(400).json({ success: false, message: 'Заполните поля!' });

    let user = users.find(u => isSameName(u.username, userLogin));

    if (!user) {
        // Если заходит новый юзер — создаём его
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

// РЕГИСТРАЦИЯ
app.post('/api/auth/register', (req, res) => {
    const { username, password, login, nickname } = req.body;
    const userLogin = (username || login || nickname || '').trim();

    if (!userLogin) return res.status(400).json({ success: false, message: 'Заполните поля!' });

    let existingUser = users.find(u => isSameName(u.username, userLogin));
    if (!existingUser) {
        existingUser = { id: Date.now(), username: userLogin, role: 'user', hwid: 'Не привязан' };
        users.push(existingUser);
    }

    const formatted = formatUserForFrontend(existingUser);

    return res.json({ 
        success: true, 
        message: 'Регистрация успешна!', 
        user: formatted,
        data: formatted
    });
});

// ПОИСК ПОЛЬЗОВАТЕЛЯ ДЛЯ АДМИНКИ
app.get('/api/admin/user/:username', (req, res) => {
    const reqUsername = req.params.username.trim();
    let user = users.find(u => isSameName(u.username, reqUsername));

    if (!user) {
        user = {
            id: Math.floor(Math.random() * 8999) + 1000,
            username: reqUsername,
            role: 'user',
            hwid: 'Не привязан'
        };
        users.push(user);
    }

    const formatted = formatUserForFrontend(user);

    return res.json({
        success: true,
        user: formatted,
        data: formatted,
        result: formatted,
        ...formatted
    });
});

// СОХРАНЕНИЕ РОЛИ ИЗ АДМИНКИ
const saveUserChanges = (req, res) => {
    const paramUser = req.params.username;
    const { targetUser, username, nickname, user, role, selectedRole, newRole } = req.body;
    
    const target = paramUser || targetUser || username || nickname || user;
    const finalRole = role || selectedRole || newRole || 'user';

    if (!target) return res.status(400).json({ success: false, message: 'Не указан игрок!' });

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

app.post('/api/admin/user/:username', saveUserChanges);
app.put('/api/admin/user/:username', saveUserChanges);
app.post('/api/admin/user/:username/update', saveUserChanges);
app.post('/api/admin/user/:username/role', saveUserChanges);
app.post('/api/admin/change-role', saveUserChanges);

app.get('/api/status', (req, res) => res.json({ status: 'ok' }));

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`[VerseDLC] Сервер запущен на порту ${PORT}`));
}

module.exports = app;