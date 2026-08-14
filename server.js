const express = require('express');
const path = require('path');

const app = express();

// Мидлвары для обработки JSON и форм
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Отдача статических файлов (HTML, CSS, JS клиентской части)
app.use(express.static(path.join(__dirname)));

// Роут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Тестовый роут для проверки работы API авторизации/ЛК
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Сервер VerseDLC работает на Vercel!' });
});

// ПРИМЕЧАНИЕ: Логика авторизации, БД/файлов личного кабинета обрабатывается через Vercel Handlers.
// Для локального запуска на ПК:
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`[VerseDLC] Сервер запущен локально на порту ${PORT}`);
    });
}

// Экспорт для Vercel Serverless Function
module.exports = app;