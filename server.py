import os
import sys
import json
import time
import sqlite3
import hashlib
import secrets
import threading
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

SITE_ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SITE_ROOT, "toshibadlc.db")
PORT = 8080
COOKIE = "tdlc_token"
SESSION_TTL = 60 * 60 * 24 * 7

PROMOS = {"TOSHIBA": 15, "DLC": 10, "ADMIN": 50}

DEFAULT_SETTINGS = {
    "clientName": "ToshibaDLC",
    "shortClientName": "ToshibaDLC",
    "version": "1.21.4",
    "discord": "https://discord.gg/cWNcdk8xS",
    "telegram": "https://t.me/toshibadlc",
}

_db_lock = threading.Lock()


def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def hash_pw(password, salt=None):
    if salt is None:
        salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return salt.hex() + "$" + dk.hex()


def verify_pw(password, stored):
    try:
        salt_hex, hash_hex = stored.split("$")
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
        return secrets.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def init_db():
    conn = db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'Member',
            banned INTEGER DEFAULT 0,
            hwid TEXT DEFAULT '',
            subscriptionTill TEXT DEFAULT '',
            hasActiveSub INTEGER DEFAULT 0,
            registrationId TEXT,
            created INTEGER,
            lastLogin TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            created INTEGER
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        """
    )
    cur = conn.execute("SELECT COUNT(*) c FROM users")
    if cur.fetchone()["c"] == 0:
        conn.execute(
            "INSERT INTO users (username,email,password,role,banned,subscriptionTill,hasActiveSub,registrationId,created) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            ("admin", "admin@toshibadlc.space", hash_pw("admin123"), "Admin", 0, "Lifetime", 1, "TDLC-0001", int(time.time())),
        )
    cur = conn.execute("SELECT COUNT(*) c FROM settings")
    if cur.fetchone()["c"] == 0:
        for k, v in DEFAULT_SETTINGS.items():
            conn.execute("INSERT INTO settings (key,value) VALUES (?,?)", (k, v))
    conn.commit()
    conn.close()


def user_to_dict(row):
    return {
        "username": row["username"],
        "email": row["email"],
        "role": row["role"],
        "banned": bool(row["banned"]),
        "hwid": row["hwid"],
        "subscriptionTill": row["subscriptionTill"],
        "hasActiveSub": bool(row["hasActiveSub"]),
        "registrationId": row["registrationId"],
        "created": row["created"],
        "lastLogin": row["lastLogin"],
        "avatarUrl": "/resources/images/img_1.png",
    }


def get_user(username):
    conn = db()
    row = conn.execute("SELECT * FROM users WHERE lower(username)=lower(?)", (username,)).fetchone()
    conn.close()
    return row


def get_settings():
    conn = db()
    rows = conn.execute("SELECT key,value FROM settings").fetchall()
    conn.close()
    s = dict(DEFAULT_SETTINGS)
    for r in rows:
        s[r["key"]] = r["value"]
    return s


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE_ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def _read_body(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = 0
        raw = self.rfile.read(length) if length else b""
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            return {}

    def _token(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        if COOKIE in cookie:
            return cookie[COOKIE].value
        return None

    def _current_user(self):
        token = self._token()
        if not token:
            return None
        conn = db()
        row = conn.execute("SELECT username,created FROM sessions WHERE token=?", (token,)).fetchone()
        conn.close()
        if not row:
            return None
        if time.time() - row["created"] > SESSION_TTL:
            return None
        u = get_user(row["username"])
        return u

    def _json(self, obj, status=200, set_cookie=None):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        if set_cookie:
            self.send_header("Set-Cookie", set_cookie)
        self.end_headers()
        self.wfile.write(data)

    def _make_cookie(self, token):
        return "%s=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d" % (COOKIE, token, SESSION_TTL)

    def _clear_cookie(self):
        return "%s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" % COOKIE

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/settings":
            return self._json({"success": True, "settings": get_settings()})
        if path.startswith("/api/"):
            return self._json({"success": False, "message": "Not found"}, 404)
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if not path.startswith("/api/"):
            return self._json({"success": False, "message": "Not found"}, 404)
        body = self._read_body()
        try:
            with _db_lock:
                return self.route(path, body)
        except Exception as e:
            return self._json({"success": False, "message": "Server error: %s" % e}, 500)

    def route(self, path, body):
        if path == "/api/login":
            return self.api_login(body)
        if path == "/api/register":
            return self.api_register(body)
        if path == "/api/logout":
            return self.api_logout()
        if path == "/api/profile":
            return self.api_profile()
        if path == "/api/activate-key":
            return self.api_activate_key(body)
        if path == "/api/promo/check":
            return self.api_promo(body)
        if path == "/api/create-platega-order":
            return self._json({"success": False, "message": "Оплата недоступна в локальной версии"})
        if path == "/api/change-password":
            return self.api_change_password(body)
        if path == "/api/change-email":
            return self.api_change_email(body)
        if path == "/api/admin/stats":
            return self.api_admin_stats()
        if path == "/api/admin/users":
            return self.api_admin_users()
        if path == "/api/admin/user/update":
            return self.api_admin_user_update(body)
        if path == "/api/admin/settings":
            return self.api_admin_settings(body)
        return self._json({"success": False, "message": "Unknown endpoint"}, 404)

    def api_login(self, body):
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        u = get_user(username)
        if not u or not verify_pw(password, u["password"]):
            return self._json({"success": False, "message": "Неверный логин или пароль"})
        if u["banned"]:
            return self._json({"success": False, "message": "Аккаунт заблокирован администратором"})
        token = secrets.token_hex(32)
        conn = db()
        conn.execute("INSERT INTO sessions (token,username,created) VALUES (?,?,?)", (token, u["username"], int(time.time())))
        conn.execute("UPDATE users SET lastLogin=? WHERE username=?", (time.strftime("%d.%m.%Y, %H:%M:%S"), u["username"]))
        conn.commit()
        conn.close()
        fresh = get_user(u["username"])
        return self._json({"success": True, "user": user_to_dict(fresh)}, set_cookie=self._make_cookie(token))

    def api_register(self, body):
        username = (body.get("username") or "").strip()
        email = (body.get("email") or "").strip()
        password = body.get("password") or ""
        import re
        if not re.match(r"^[A-Za-z0-9_]{3,}$", username):
            return self._json({"success": False, "message": "Имя: минимум 3 символа (A-Z, 0-9, _)"})
        if "@" not in email:
            return self._json({"success": False, "message": "Введите корректный email"})
        if len(password) < 4:
            return self._json({"success": False, "message": "Пароль: минимум 4 символа"})
        if get_user(username):
            return self._json({"success": False, "message": "Пользователь уже существует"})
        conn = db()
        count = conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
        conn.execute(
            "INSERT INTO users (username,email,password,role,banned,subscriptionTill,hasActiveSub,registrationId,created) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (username, email, hash_pw(password), "Member", 0, "", 0, "TDLC-%04d" % (count + 1), int(time.time())),
        )
        conn.commit()
        conn.close()
        return self._json({"success": True})

    def api_logout(self):
        token = self._token()
        if token:
            conn = db()
            conn.execute("DELETE FROM sessions WHERE token=?", (token,))
            conn.commit()
            conn.close()
        return self._json({"success": True}, set_cookie=self._clear_cookie())

    def api_profile(self):
        u = self._current_user()
        if not u:
            return self._json({"success": False, "message": "Unauthorized"}, 401)
        return self._json({
            "success": True,
            "user": user_to_dict(u),
            "profile": {
                "subscriptionTill": u["subscriptionTill"],
                "hwid": u["hwid"],
                "hasActiveSub": bool(u["hasActiveSub"]),
            },
        })

    def api_activate_key(self, body):
        u = self._current_user()
        if not u:
            return self._json({"success": False, "message": "Unauthorized"}, 401)
        key = (body.get("key") or "").strip().upper()
        if not key:
            return self._json({"success": False, "message": "Введите ключ!"})
        conn = db()
        if "LIFE" in key:
            till, active = "Lifetime", 1
        else:
            days = 90 if "90" in key else (7 if "FREE" in key else 30)
            till = time.strftime("%d.%m.%Y", time.localtime(time.time() + days * 86400))
            active = 1
        conn.execute("UPDATE users SET subscriptionTill=?, hasActiveSub=? WHERE username=?", (till, active, u["username"]))
        conn.commit()
        conn.close()
        return self._json({"success": True, "message": "Ключ активирован! Подписка обновлена."})

    def api_promo(self, body):
        code = (body.get("code") or "").strip().upper()
        if code in PROMOS:
            return self._json({"success": True, "discount": PROMOS[code]})
        return self._json({"success": False, "message": "Неверный промокод"})

    def api_change_password(self, body):
        u = self._current_user()
        if not u:
            return self._json({"success": False, "message": "Unauthorized"}, 401)
        old = body.get("oldPassword") or ""
        new = body.get("newPassword") or ""
        if not verify_pw(old, u["password"]):
            return self._json({"success": False, "message": "Текущий пароль неверен"})
        if len(new) < 4:
            return self._json({"success": False, "message": "Новый пароль слишком короткий"})
        conn = db()
        conn.execute("UPDATE users SET password=? WHERE username=?", (hash_pw(new), u["username"]))
        conn.commit()
        conn.close()
        return self._json({"success": True, "message": "Пароль успешно изменен."})

    def api_change_email(self, body):
        u = self._current_user()
        if not u:
            return self._json({"success": False, "message": "Unauthorized"}, 401)
        pw = body.get("currentPassword") or ""
        email = (body.get("newEmail") or "").strip()
        if not verify_pw(pw, u["password"]):
            return self._json({"success": False, "message": "Пароль неверен"})
        if "@" not in email:
            return self._json({"success": False, "message": "Некорректный email"})
        conn = db()
        conn.execute("UPDATE users SET email=? WHERE username=?", (email, u["username"]))
        conn.commit()
        conn.close()
        return self._json({"success": True, "message": "Email успешно изменен."})

    def _require_admin(self):
        u = self._current_user()
        if not u:
            self._json({"success": False, "message": "Unauthorized"}, 401)
            return None
        if u["role"] != "Admin":
            self._json({"success": False, "message": "Forbidden"}, 403)
            return None
        return u

    def api_admin_stats(self):
        if not self._require_admin():
            return
        conn = db()
        total = conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
        active = conn.execute("SELECT COUNT(*) c FROM users WHERE hasActiveSub=1").fetchone()["c"]
        banned = conn.execute("SELECT COUNT(*) c FROM users WHERE banned=1").fetchone()["c"]
        admins = conn.execute("SELECT COUNT(*) c FROM users WHERE role='Admin'").fetchone()["c"]
        recent = conn.execute("SELECT * FROM users ORDER BY created DESC LIMIT 5").fetchall()
        conn.close()
        return self._json({
            "success": True,
            "stats": {"total": total, "active": active, "banned": banned, "admins": admins},
            "recent": [user_to_dict(r) for r in recent],
        })

    def api_admin_users(self):
        if not self._require_admin():
            return
        conn = db()
        rows = conn.execute("SELECT * FROM users ORDER BY created DESC").fetchall()
        conn.close()
        return self._json({"success": True, "users": [user_to_dict(r) for r in rows]})

    def api_admin_user_update(self, body):
        if not self._require_admin():
            return
        username = body.get("username") or ""
        action = body.get("action") or ""
        u = get_user(username)
        if not u:
            return self._json({"success": False, "message": "Пользователь не найден"})
        conn = db()
        if action == "ban":
            conn.execute("UPDATE users SET banned=1 WHERE username=?", (username,))
        elif action == "unban":
            conn.execute("UPDATE users SET banned=0 WHERE username=?", (username,))
        elif action == "admin":
            conn.execute("UPDATE users SET role='Admin' WHERE username=?", (username,))
        elif action == "sub":
            till = time.strftime("%d.%m.%Y", time.localtime(time.time() + 30 * 86400))
            # Исправлено: передаем till, флаг активной подписки (1) и имя пользователя
            conn.execute("UPDATE users SET subscriptionTill=?, hasActiveSub=1 WHERE username=?", (till, username))
        elif action == "hwid":
            conn.execute("UPDATE users SET hwid='' WHERE username=?", (username,))
        elif action == "del":
            if u["role"] == "Admin":
                conn.close()
                return self._json({"success": False, "message": "Нельзя удалить администратора"})
            conn.execute("DELETE FROM users WHERE username=?", (username,))
            conn.execute("DELETE FROM sessions WHERE username=?", (username,))
        else:
            conn.close()
            return self._json({"success": False, "message": "Неизвестное действие"})
        conn.commit()
        conn.close()
        return self._json({"success": True})

    def api_admin_settings(self, body):
        if not self._require_admin():
            return
        settings = body.get("settings") or {}
        conn = db()
        for k, v in settings.items():
            conn.execute(
                "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (k, str(v)),
            )
        conn.commit()
        conn.close()
        return self._json({"success": True, "settings": get_settings()})


def main():
    init_db()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("============================================")
    print("  ToshibaDLC - Local Server + SQLite DB")
    print("  URL:         http://localhost:%d" % PORT)
    print("  Admin login: admin / admin123")
    print("  Admin panel: http://localhost:%d/admin/" % PORT)
    print("  DB file:     %s" % DB_PATH)
    print("  Press Ctrl+C to stop")
    print("============================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping...")
        server.shutdown()


if __name__ == "__main__":
    main()