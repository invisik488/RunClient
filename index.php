<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#0c0d0f">
    <title>Aethra DLC — Главная и Покупки</title>

    <link rel="stylesheet" href="static/css/site.css?v=1784935229">
    <link rel="stylesheet" href="static/css/rockstar-theme.css?v=1784935230">
    <script defer src="static/js/silk-background.js?v=1784935233"></script>
    <script defer src="static/js/site.js?v=1784935233"></script>

    <style>
        .hidden { display: none !important; }
        
        /* Блок подписок / покупок */
        .pricing-section { padding: 60px 0; }
        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; margin-top: 30px; }
        .price-card { background: rgba(18, 20, 26, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 30px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; transition: 0.3s ease; }
        .price-card:hover { border-color: rgba(255,255,255,0.25); transform: translateY(-4px); }
        .price-card.popular { border-color: #ff3333; }
        .price-card.popular::before { content: 'ПОПУЛЯРНОЕ'; position: absolute; top: 15px; right: -30px; background: #ff3333; color: #fff; font-size: 9px; font-weight: 800; padding: 4px 30px; transform: rotate(45deg); }
        .price-title { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        .price-amount { font-size: 32px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .price-amount span { font-size: 14px; color: #777; font-weight: 400; }
        .price-features { list-style: none; padding: 0; margin-bottom: 24px; color: #aaa; font-size: 14px; }
        .price-features li { margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
        .price-features li::before { content: '✓'; color: #00ff66; font-weight: bold; }
        .btn-buy { display: inline-block; width: 100%; text-align: center; background: #ff3333; color: #fff; border: none; padding: 12px; border-radius: 10px; font-weight: 700; cursor: pointer; text-decoration: none; transition: 0.2s; }
        .btn-buy:hover { background: #cc0000; }

        /* Всплывающие уведомления */
        #toast-container { position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; }
        .toast { background: #111; border: 1px solid #222; border-left: 4px solid #fff; padding: 14px 20px; border-radius: 12px; color: #fff; font-size: 13px; font-weight: 500; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 10px; }
        .toast.success { border-left-color: #00ff66; }
        .toast.error { border-left-color: #ff3333; }
        .toast.warning { border-left-color: #ffaa00; }

        /* Кастомный кастом модалок в стиле Aethra */
        .auth-modal-card { background: rgba(12, 13, 15, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 30px; max-width: 420px; margin: 40px auto; }
        .auth-input { width: 100%; background: #15171e; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 12px 16px; color: #fff; font-size: 14px; margin-bottom: 15px; outline: none; }
        .auth-input:focus { border-color: #ff3333; }
        .btn-danger { background: #220a0a; color: #ff4444; border: 1px solid #441111; padding: 8px 16px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: 0.2s; margin-top: 15px; font-size: 12px; }
        .btn-danger:hover { background: #441111; color: #fff; }
    </style>
</head>
<body data-page="home">

    <canvas id="bg-canvas" aria-hidden="true"></canvas>
    <div id="toast-container"></div>

    <!-- ШАПКА САЙТА -->
    <header class="site-header">
        <div class="container">
            <a class="site-brand" href="index.php">
                <img class="brand-mark" src="static/img/aethra-mark.svg" alt="Aethra">
                <span class="title">Aethra</span>
            </a>
            <nav aria-label="Основная навигация">
                <ul>
                    <li><a class="is-active" href="#home" onclick="showMainSection('home')"><svg class="nav-icon"><use href="static/img/ui-icons.svg#home"></use></svg>Главная</a></li>
                    <li><a href="#store" onclick="showMainSection('store')"><svg class="nav-icon"><use href="static/img/ui-icons.svg#chart"></use></svg>Покупки</a></li>
                    <li><a href="#statistics" onclick="showMainSection('home')"><svg class="nav-icon"><use href="static/img/ui-icons.svg#chart"></use></svg>Статистика</a></li>
                </ul>
            </nav>
            <div class="header-actions">
                <button id="headerAuthBtn" class="primary-action" onclick="showMainSection('auth')">Войти</button>
                <button id="headerProfileBtn" class="header-logout hidden" onclick="showMainSection('profile')">Профиль</button>
                <button id="headerLogoutBtn" class="header-logout hidden" onclick="logout()"><svg class="nav-icon"><use href="static/img/ui-icons.svg#logout"></use></svg>Выйти</button>
            </div>
        </div>
    </header>

    <!-- ОСНОВНОЙ КОНТЕНТ -->
    <main class="home-page container">

        <!-- 1. ГЛАВНЫЙ БАННЕР -->
        <section id="sec-home" class="mission" style="padding-top: 60px;">
            <p class="section-label">Aethra legit (Minecraft 1.21.4)</p>
            <h1>Контроль игры.<br>Без лишнего шума.</h1>
            <p class="mission-copy">Личный кабинет, подписка и загрузка лоадера в одном защищённом месте.</p>
            <div class="hero-actions">
                <a class="primary-action" href="#store" onclick="showMainSection('store')">Купить подписку</a>
                <a class="primary-action" style="background: #222;" href="#statistics" onclick="showMainSection('home')">Статистика</a>
            </div>
        </section>

        <!-- 2. СЕКЦИЯ ПОКУПОК / ТАРИФЫ -->
        <section id="sec-store" class="pricing-section hidden">
            <div class="statistics-heading">
                <p class="section-label">ПОДПИСКИ</p>
                <h2>Выберите подходящий тариф</h2>
                <p>Получите моментальный доступ к клиенту Aethra для версии 1.21.4</p>
            </div>

            <div class="pricing-grid">
                <!-- Тариф 1 -->
                <div class="price-card">
                    <div>
                        <div class="price-title">Старт</div>
                        <div class="price-amount">199 ₽ <span>/ 7 дней</span></div>
                        <ul class="price-features">
                            <li>Полный доступ к Aethra Client</li>
                            <li>Версия Minecraft 1.21.4</li>
                            <li>Обход анархических серверов</li>
                            <li>Техподдержка 24/7</li>
                        </ul>
                    </div>
                    <button class="btn-buy" onclick="buyPlan('7 дней')">Приобрести</button>
                </div>

                <!-- Тариф 2 -->
                <div class="price-card popular">
                    <div>
                        <div class="price-title">Месяц</div>
                        <div class="price-amount">499 ₽ <span>/ 30 дней</span></div>
                        <ul class="price-features">
                            <li>Всё из тарифа Старт</li>
                            <li>Приоритетные обновления</li>
                            <li>Доступ к закрытому Discord</li>
                            <li>Кастомные конфиги</li>
                        </ul>
                    </div>
                    <button class="btn-buy" onclick="buyPlan('30 дней')">Приобрести</button>
                </div>

                <!-- Тариф 3 -->
                <div class="price-card">
                    <div>
                        <div class="price-title">Навсегда</div>
                        <div class="price-amount">1499 ₽ <span>/ Lifetime</span></div>
                        <ul class="price-features">
                            <li>Навсегда без продлений</li>
                            <li>Все будущие обновления</li>
                            <li>Роль VIP в дискорде</li>
                            <li>Личный приоритетный саппорт</li>
                        </ul>
                    </div>
                    <button class="btn-buy" onclick="buyPlan('Lifetime')">Приобрести</button>
                </div>
            </div>
        </section>

        <!-- 3. АВТОРИЗАЦИЯ / РЕГИСТРАЦИЯ -->
        <section id="sec-auth" class="hidden">
            <div class="auth-modal-card">
                <h2 id="authTitle" style="text-align: center; margin-bottom: 20px;">Авторизация</h2>
                
                <form id="authForm">
                    <input type="text" id="usernameInput" class="auth-input" placeholder="Введите ваш ник" required>
                    <input type="password" id="passwordInput" class="auth-input" placeholder="Введите пароль" required>
                    
                    <button type="submit" class="btn-buy" id="authSubmitBtn" style="margin-bottom: 12px;">Войти</button>
                </form>
                
                <div style="text-align: center;">
                    <a href="#" id="toggleAuthModeBtn" onclick="toggleAuthMode(); return false;" style="color: #777; font-size: 13px; text-decoration: underline;">Зарегистрироваться</a>
                </div>
            </div>
        </section>

        <!-- 4. ЛИЧНЫЙ КАБИНЕТ (ПРОФИЛЬ) -->
        <section id="sec-profile" class="hidden" style="padding-top: 40px;">
            <div class="statistics-heading">
                <p class="section-label">ЛИЧНЫЙ КАБИНЕТ</p>
                <h2 id="profileUsername">Player</h2>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
                <div class="price-card">
                    <div>
                        <div class="price-title">Аккаунт</div>
                        <p style="color: #888; font-size: 14px; margin-top: 6px;">Роль: <strong id="profileRole" style="color: #ff3333;">USER</strong></p>
                        <p style="color: #888; font-size: 14px; margin-top: 4px;">Версия: <strong>1.21.4</strong></p>
                    </div>
                    <button class="btn-danger" onclick="deleteAccount()">🗑️ Удалить аккаунт</button>
                </div>

                <div class="price-card">
                    <div>
                        <div class="price-title">Подписка</div>
                        <div id="profileSub" style="font-size: 22px; font-weight: 700; color: #ff3333; margin: 10px 0;">No Active Subscription</div>
                    </div>
                    <button class="btn-buy" onclick="showMainSection('store')">Продлить / Купить</button>
                </div>
            </div>
        </section>

        <!-- 5. СТАТИСТИКА АКТИВНОСТИ -->
        <section id="statistics" class="statistics" aria-labelledby="statistics-title">
            <div class="statistics-heading">
                <p class="section-label">АКТИВНОСТЬ</p>
                <h2 id="statistics-title">Где наши игроки<br>наиболее активны</h2>
                <p>Три ключевых сервера, где игроки чаще всего используют наш клиент.</p>
            </div>
            <div class="statistics-layout">
                <div class="server-comparison">
                    <svg class="activity-graph" viewBox="0 0 600 250"><path class="activity-axis" d="M50 215H550"></path><path class="activity-line" d="M70 190 C145 150 215 80 300 115 S445 185 530 145"></path><circle cx="70" cy="190" r="6"></circle><circle cx="300" cy="115" r="6"></circle><circle cx="530" cy="145" r="6"></circle></svg>
                    <div class="server-graph-label server-graph-label--holyworld"><img src="static/img/holyWorld.webp" alt=""><strong>HolyWorld</strong><span>1 240 ч.</span></div>
                    <div class="server-graph-label server-graph-label--funtime"><img src="static/img/funTime.webp" alt=""><strong>FunTime</strong><span>3 890 ч.</span></div>
                    <div class="server-graph-label server-graph-label--spookytime"><img src="static/img/spookyTime.webp" alt=""><strong>SpookyTime</strong><span>950 ч.</span></div>
                </div>
            </div>
        </section>

    </main>

    <footer class="site-footer">
        <div class="container">
            <span>© 2026 aethradlc.ru — Aethra Client 1.21.4</span>
        </div>
    </footer>

    <!-- СКРИПТЫ СИНХРОНИЗАЦИИ И ЛОГИКИ -->
    <script>
        let isRegisterMode = false;

        const DEFAULT_DATABASE = {
            users: [
                { username: 'invisik', password: '123', role: 'OWNER', sub: 'Active (Lifetime)' }
            ]
        };

        function getDB() {
            let raw = localStorage.getItem('aethra_db');
            if (!raw) {
                localStorage.setItem('aethra_db', JSON.stringify(DEFAULT_DATABASE));
                return DEFAULT_DATABASE;
            }
            return JSON.parse(raw);
        }

        function saveDB(data) {
            localStorage.setItem('aethra_db', JSON.stringify(data));
        }

        function showToast(msg, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerText = msg;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }

        function showMainSection(sec) {
            ['home', 'store', 'auth', 'profile'].forEach(s => {
                const el = document.getElementById('sec-' + s);
                if (el) el.classList.toggle('hidden', s !== sec);
            });
        }

        function toggleAuthMode() {
            isRegisterMode = !isRegisterMode;
            document.getElementById('authTitle').innerText = isRegisterMode ? 'Регистрация' : 'Авторизация';
            document.getElementById('authSubmitBtn').innerText = isRegisterMode ? 'Зарегистрироваться' : 'Войти';
            document.getElementById('toggleAuthModeBtn').innerText = isRegisterMode ? 'Уже есть аккаунт? Войти' : 'Зарегистрироваться';
        }

        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const userIn = document.getElementById('usernameInput').value.trim();
            const passIn = document.getElementById('passwordInput').value.trim();

            let db = getDB();
            let user = db.users.find(u => u.username.toLowerCase() === userIn.toLowerCase());

            if (isRegisterMode) {
                if (user) return showToast('Никнейм уже занят!', 'error');
                
                const newUser = {
                    username: userIn,
                    password: passIn,
                    role: (userIn.toLowerCase() === 'invisik') ? 'OWNER' : 'USER',
                    sub: (userIn.toLowerCase() === 'invisik') ? 'Active (Lifetime)' : 'No Active Subscription'
                };
                db.users.push(newUser);
                saveDB(db);

                localStorage.setItem('aethra_session', newUser.username);
                showToast('Успешная регистрация!');
                updateAuthState();
                showMainSection('profile');
            } else {
                if (!user) {
                    // Если чистили кэш - восстанавливаем пользователя автоматически
                    user = {
                        username: userIn,
                        password: passIn,
                        role: (userIn.toLowerCase() === 'invisik') ? 'OWNER' : 'USER',
                        sub: (userIn.toLowerCase() === 'invisik') ? 'Active (Lifetime)' : 'No Active Subscription'
                    };
                    db.users.push(user);
                    saveDB(db);
                }

                localStorage.setItem('aethra_session', user.username);
                showToast('С возвращением!');
                updateAuthState();
                showMainSection('profile');
            }
        });

        function updateAuthState() {
            const session = localStorage.getItem('aethra_session');
            const btnAuth = document.getElementById('headerAuthBtn');
            const btnProf = document.getElementById('headerProfileBtn');
            const btnLogout = document.getElementById('headerLogoutBtn');

            if (session) {
                let db = getDB();
                let u = db.users.find(x => x.username.toLowerCase() === session.toLowerCase());

                btnAuth.classList.add('hidden');
                btnProf.classList.remove('hidden');
                btnLogout.classList.remove('hidden');

                if (u) {
                    document.getElementById('profileUsername').innerText = u.username;
                    document.getElementById('profileRole').innerText = u.role;
                    
                    const subEl = document.getElementById('profileSub');
                    subEl.innerText = u.sub || 'No Active Subscription';
                    subEl.style.color = (u.sub && u.sub.includes('Active')) ? '#00ff66' : '#ff3333';
                }
            } else {
                btnAuth.classList.remove('hidden');
                btnProf.classList.add('hidden');
                btnLogout.classList.add('hidden');
            }
        }

        function buyPlan(planName) {
            const session = localStorage.getItem('aethra_session');
            if (!session) {
                showToast('Сначала войдите в аккаунт!', 'warning');
                showMainSection('auth');
                return;
            }

            let db = getDB();
            let u = db.users.find(x => x.username.toLowerCase() === session.toLowerCase());
            if (u) {
                u.sub = `Active (${planName})`;
                saveDB(db);
                showToast(`Подписка ${planName} успешно оформлена!`);
                updateAuthState();
                showMainSection('profile');
            }
        }

        function deleteAccount() {
            const session = localStorage.getItem('aethra_session');
            if (!session) return;

            if (confirm(`Вы действительно хотите удалить аккаунт ${session}?`)) {
                let db = getDB();
                db.users = db.users.filter(u => u.username.toLowerCase() !== session.toLowerCase());
                saveDB(db);

                localStorage.removeItem('aethra_session');
                showToast('Аккаунт успешно удален!', 'warning');
                updateAuthState();
                showMainSection('home');
            }
        }

        function logout() {
            localStorage.removeItem('aethra_session');
            showToast('Вы вышли из системы');
            updateAuthState();
            showMainSection('home');
        }

        window.addEventListener('DOMContentLoaded', () => {
            updateAuthState();
        });
    </script>
</body>
</html>