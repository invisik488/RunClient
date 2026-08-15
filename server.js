const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Стеклянная аватарка по умолчанию
const DEFAULT_GLASS_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%236366f1'/><stop offset='100%' stop-color='%23a855f7'/></linearGradient></defs><circle cx='50' cy='50' r='45' fill='url(%23g)' stroke='rgba(255,255,255,0.4)' stroke-width='2'/></svg>";

// Список пользователей (добавили новый ник подруги прямо сюда)
let users = [
    { username: "Quesst", key: "VERSE-9999-XXXX", avatar: DEFAULT_GLASS_AVATAR }
];

// --- 1. ПОИСК НИКА (Железобетонный) ---
app.post('/api/search', (req, res) => {
    const rawInput = req.body.username || req.body.nickname || req.body.query || "";
    const cleanSearch = String(rawInput).trim().toLowerCase();

    if (!cleanSearch) {
        return res.status(400).json({ success: false, message: "Пустой запрос" });
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

// --- 2. ГЕНЕРАЦИЯ КЛЮЧА И ДОБАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ ---
app.post('/api/generate-key', (req, res) => {
    const username = req.body.username ? req.body.username.trim() : "";
    if (!username) {
        return res.status(400).json({ success: false, message: "Укажите ник" });
    }

    const generatedKey = "VERSE-" + crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Обновляем или добавляем пользователя
    const existingIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    const userData = { username, key: generatedKey, avatar: DEFAULT_GLASS_AVATAR };

    if (existingIndex !== -1) {
        users[existingIndex] = userData;
    } else {
        users.push(userData);
    }

    return res.json({ success: true, key: generatedKey, username });
});

// --- 3. ВЕБ-ИНТЕРФЕЙС С КНОПКОЙ КОПИРОВАНИЯ ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>VerseDLC Panel</title>
            <style>
                body { background: #0f172a; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); padding: 30px; border-radius: 16px; width: 320px; text-align: center; }
                input { width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: white; box-sizing: border-box; }
                button { width: 100%; padding: 10px; border: none; border-radius: 8px; background: #6366f1; color: white; font-weight: bold; cursor: pointer; margin-top: 5px; }
                button:hover { background: #4f46e5; }
                .key-box { margin-top: 15px; display: none; background: #1e293b; padding: 10px; border-radius: 8px; word-break: break-all; }
                .copy-btn { background: #10b981; margin-top: 8px; }
                .copy-btn:hover { background: #059669; }
            </style>
        </head>
        <body>
            <div class="card">
                <h3>Генерация Ключа</h3>
                <input type="text" id="usernameInput" placeholder="Введите ник (например, Quesst)">
                <button onclick="generateKey()">Создать ключ</button>

                <div id="resultBox" class="key-box">
                    <div id="keyDisplay" style="font-weight: bold; color: #38bdf8;"></div>
                    <button class="copy-btn" onclick="copyKey()">Скопировать ключ</button>
                </div>
            </div>

            <script>
                async function generateKey() {
                    const username = document.getElementById('usernameInput').value;
                    if(!username) return alert('Введи ник!');

                    const res = await fetch('/api/generate-key', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username })
                    });
                    const data = await res.json();

                    if(data.success) {
                        document.getElementById('keyDisplay').innerText = data.key;
                        document.getElementById('resultBox').style.display = 'block';
                    } else {
                        alert(data.message);
                    }
                }

                function copyKey() {
                    const keyText = document.getElementById('keyDisplay').innerText;
                    navigator.clipboard.writeText(keyText).then(() => {
                        alert('Ключ скопирован в буфер обмена!');
                    });
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));