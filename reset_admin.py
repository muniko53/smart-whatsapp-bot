import os
import bcrypt
from core.db import legacy_get_db as get_db, init_db

ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@example.com')

init_db()  # ensure tables exist

db = get_db()

pw_hash = bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode()

existing = db.execute("SELECT id FROM users WHERE email=?", (ADMIN_EMAIL,)).fetchone()
if existing:
    db.execute("UPDATE users SET password_hash=? WHERE email=?", (pw_hash, ADMIN_EMAIL))
    print('Admin password reset to admin123')
else:
    db.execute(
        "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')",
        (ADMIN_EMAIL, pw_hash)
    )
    print('Admin user created with password admin123')

db.commit()
db.close()

# Verify it works
db2 = get_db()
user = db2.execute("SELECT * FROM users WHERE email=?", (ADMIN_EMAIL,)).fetchone()
db2.close()
ok = bcrypt.checkpw(b'admin123', user['password_hash'].encode())
print(f'Verification: {"OK" if ok else "FAILED"}')
