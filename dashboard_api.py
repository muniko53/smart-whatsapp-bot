from flask import Flask, request, jsonify, make_response, send_from_directory
import bcrypt
import jwt as pyjwt
from datetime import datetime, timedelta, timezone
from functools import wraps
import os
import secrets
import uuid
from core.db import init_db, legacy_get_db as get_db

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # global upload/body cap

UPLOAD_FOLDER = '/tmp/uploads'
try:
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
except Exception:
    pass
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
ALLOWED_ORIGINS = {
    'http://localhost:3001',
    'http://localhost:3000',
    'https://smart-sales-assistant-gules.vercel.app',
    'https://smart-sales-assistant-dhwwbdzra-muniko53s-projects.vercel.app',
    'https://smart-sales-assistant-lyart.vercel.app',
    'https://smart-assistant-blond.vercel.app',
}

@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        origin = request.headers.get('Origin', '')
        res = make_response('', 204)
        if origin in ALLOWED_ORIGINS:
            res.headers['Access-Control-Allow-Origin'] = origin
            res.headers['Access-Control-Allow-Credentials'] = 'true'
            res.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
            res.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        return res

@app.after_request
def add_cors(response):
    origin = request.headers.get('Origin', '')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    return response

@app.after_request
def add_security_headers(response):
    # HSTS only when actually served over HTTPS (never on localhost).
    forwarded = request.headers.get('X-Forwarded-Proto', '')
    if request.is_secure or forwarded == 'https':
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response


@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    return e


@app.errorhandler(413)
def handle_413(e):
    return jsonify({'error': 'Upload too large. Maximum is 5MB.'}), 413


@app.errorhandler(500)
def handle_500(e):
    # Never leak tracebacks, paths, or DB details to clients.
    print(f'[ERROR] 500 on {request.method} {request.path}', flush=True)
    return jsonify({'error': 'Something went wrong. Please try again.'}), 500

# ── Lightweight per-key rate limiting (spam/abuse protection) ────
# In-memory and per-process: approximate under gunicorn threads, but
# enough to blunt LLM-cost abuse on public endpoints.
import time as _time

_RATE_BUCKETS = {}

def rate_limited(key, limit=20, window=60):
    now = _time.time()
    hits = [t for t in _RATE_BUCKETS.get(key, []) if t > now - window]
    hits.append(now)
    _RATE_BUCKETS[key] = hits[-limit:]
    return len(hits) > limit

def client_ip():
    forwarded = request.headers.get('X-Forwarded-For', '')
    return (forwarded.split(',')[0].strip() if forwarded
            else (request.remote_addr or 'unknown'))

JWT_SECRET = os.environ.get('JWT_SECRET', 'wa-bot-dashboard-secret-2026-standalone')
ACCESS_EXP  = 15        # minutes
REFRESH_EXP = 7 * 24 * 60  # minutes

# ── JWT helpers ──────────────────────────────────────────────
def _jwt_encode(payload):
    token = pyjwt.encode(payload, JWT_SECRET, algorithm='HS256')
    return token.decode('utf-8') if isinstance(token, bytes) else token

def make_access_token(user_id, role):
    return _jwt_encode({
        'sub': str(user_id), 'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXP)
    })

def make_refresh_token(user_id, role):
    return _jwt_encode({
        'sub': str(user_id), 'role': role, 'refresh': True,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=REFRESH_EXP)
    })

def decode_token(token):
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    return pyjwt.decode(token, JWT_SECRET, algorithms=['HS256'])

def require_auth(role=None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            auth = request.headers.get('Authorization', '')
            print(f'[AUTH] {request.method} {request.path} | Header: {auth[:40] if auth else "MISSING"}', flush=True)
            if not auth.startswith('Bearer '):
                return jsonify({'error': 'Unauthorized'}), 401
            try:
                token_str = auth.split(' ')[1]
                print(f'[AUTH] Decoding token for role check', flush=True)
                payload = decode_token(token_str)
                print(f'[AUTH] Decoded OK: {payload}', flush=True)
            except pyjwt.ExpiredSignatureError:
                print('[AUTH] Token expired', flush=True)
                return jsonify({'error': 'Token expired'}), 401
            except Exception as ex:
                print(f'[AUTH] Decode failed: {type(ex).__name__}: {ex}', flush=True)
                return jsonify({'error': 'Invalid token'}), 401
            if role and payload.get('role') != role:
                return jsonify({'error': 'Forbidden'}), 403
            request.user_id = payload['sub']
            request.user_role = payload['role']
            return f(*args, **kwargs)
        return wrapper
    return decorator

# ── Auth ─────────────────────────────────────────────────────
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if rate_limited(f'login:{client_ip()}', limit=15, window=60):
        print(f'[SEC] login rate-limited ip={client_ip()}', flush=True)
        return jsonify({'error': 'Too many attempts. Please wait a minute.'}), 429
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    db.close()
    if not user or not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        print(f'[SEC] login failed email={email}', flush=True)
        return jsonify({'error': 'Invalid email or password'}), 401
    access  = make_access_token(user['id'], user['role'])
    refresh = make_refresh_token(user['id'], user['role'])
    res = make_response(jsonify({'access_token': access, 'role': user['role'], 'email': user['email']}))
    if not data.get('session_only'):
        is_prod = os.environ.get('RENDER') or os.environ.get('RAILWAY_ENVIRONMENT')
        res.set_cookie('refresh_token', refresh, httponly=False,
                       samesite='None' if is_prod else 'Lax',
                       max_age=REFRESH_EXP * 60,
                       secure=bool(is_prod))
    return res

@app.route('/api/auth/register', methods=['POST'])
def register():
    data     = request.json or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name     = data.get('name', '').strip()
    if not email or not password or not name:
        return jsonify({'error': 'Name, email and password are required'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if rate_limited(f'register:{client_ip()}', limit=5, window=3600):
        return jsonify({'error': 'Too many accounts created. Please try later.'}), 429
    db = get_db()
    if db.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone():
        db.close()
        return jsonify({'error': 'An account with this email already exists'}), 409
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    cur = db.execute("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'business')", (email, pw_hash))
    db.execute("INSERT INTO businesses (user_id, name) VALUES (?, ?)", (cur.lastrowid, name))
    db.commit()
    db.close()
    return jsonify({'message': 'Account created successfully'}), 201

@app.route('/api/debug/login', methods=['GET'])
def debug_login():
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@example.com')
    db = get_db()
    user = db.execute("SELECT id, email, role, password_hash FROM users WHERE email=?", (admin_email,)).fetchone()
    if not user:  # pre-standalone installs keep their original admin address
        user = db.execute("SELECT id, email, role, password_hash FROM users WHERE role='admin' LIMIT 1").fetchone()
    db.close()
    if not user:
        return jsonify({'error': 'admin user not found in DB'})
    return jsonify({
        'user_found': True,
        'email': user['email'],
        'role': user['role'],
    })

@app.route('/api/auth/refresh', methods=['POST'])
def refresh():
    token = request.cookies.get('refresh_token')
    if not token:
        return jsonify({'error': 'No refresh token'}), 401
    try:
        payload = decode_token(token)
        if not payload.get('refresh'):
            raise ValueError()
    except Exception:
        return jsonify({'error': 'Invalid refresh token'}), 401
    access = make_access_token(payload['sub'], payload['role'])
    return jsonify({'access_token': access, 'role': payload['role']})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    res = make_response(jsonify({'message': 'Logged out'}))
    res.delete_cookie('refresh_token')
    return res

# ── Admin: Stats ─────────────────────────────────────────────
@app.route('/api/admin/stats', methods=['GET'])
@require_auth(role='admin')
def admin_stats():
    from services.dashboard.stats import admin_stats as _admin_stats
    return jsonify(_admin_stats())

# ── Admin: Businesses ────────────────────────────────────────
@app.route('/api/admin/businesses', methods=['GET'])
@require_auth(role='admin')
def list_businesses():
    db = get_db()
    rows = db.execute("""
        SELECT b.*, u.email,
            (SELECT COUNT(*) FROM conversations c WHERE c.business_id=b.id) as conv_count,
            (SELECT COUNT(*) FROM conversations c
             JOIN messages m ON m.conversation_id=c.id
             WHERE c.business_id=b.id) as msg_count
        FROM businesses b JOIN users u ON u.id=b.user_id
        ORDER BY b.created_at DESC
    """).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/admin/businesses', methods=['POST'])
@require_auth(role='admin')
def create_business():
    data = request.json or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', 'changeme123')
    name     = data.get('name', '')
    if not email or not name:
        return jsonify({'error': 'Email and name are required'}), 400
    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone()
    if existing:
        db.close()
        return jsonify({'error': 'Email already exists'}), 409
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    cur = db.execute("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'business')",
                     (email, pw_hash))
    user_id = cur.lastrowid
    biz_cur = db.execute("""
        INSERT INTO businesses (user_id, name, type, location, hours, phone, owner_number, whatsapp_token, phone_number_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, name, data.get('type',''), data.get('location',''),
          data.get('hours',''), data.get('phone',''), data.get('owner_number',''),
          data.get('whatsapp_token',''), data.get('phone_number_id','')))
    biz_id = biz_cur.lastrowid
    for p in data.get('products', []):
        db.execute('INSERT INTO products (business_id, name, price, category, description, photo_url) VALUES (?,?,?,?,?,?)',
                   (biz_id, p.get('name',''), p.get('price',''), p.get('category',''), p.get('description',''), p.get('photo_url','')))
    for f in data.get('faqs', []):
        db.execute('INSERT INTO faqs (business_id, content) VALUES (?,?)', (biz_id, f))
    db.commit()
    db.close()
    return jsonify({'message': 'Business created', 'id': biz_id}), 201

@app.route('/api/admin/businesses/<int:biz_id>', methods=['PUT'])
@require_auth(role='admin')
def update_business(biz_id):
    data = request.json or {}
    db = get_db()
    db.execute("""
        UPDATE businesses SET name=?, type=?, location=?, hours=?, phone=?,
        owner_number=?, whatsapp_token=?, phone_number_id=?, active=?, bot_enabled=?,
        paybill=?, till_number=?, send_money=?, pochi_number=?,
        subscription_status=?, trial_expires_at=?, subscription_note=?
        WHERE id=?
    """, (data.get('name'), data.get('type'), data.get('location'), data.get('hours'),
          data.get('phone'), data.get('owner_number'), data.get('whatsapp_token'),
          data.get('phone_number_id'), data.get('active', 1), data.get('bot_enabled', 1),
          data.get('paybill',''), data.get('till_number',''),
          data.get('send_money',''), data.get('pochi_number',''),
          data.get('subscription_status','trial'),
          data.get('trial_expires_at') or None,
          data.get('subscription_note',''), biz_id))
    if 'products' in data:
        db.execute('DELETE FROM products WHERE business_id=?', (biz_id,))
        for p in data['products'][:50]:  # hard cap at 50
            db.execute('INSERT INTO products (business_id, name, price) VALUES (?,?,?)',
                       (biz_id, p.get('name',''), p.get('price','')))
    if 'faqs' in data:
        db.execute('DELETE FROM faqs WHERE business_id=?', (biz_id,))
        for f in data['faqs']:
            db.execute('INSERT INTO faqs (business_id, content) VALUES (?,?)', (biz_id, f))
    db.commit()
    db.close()
    return jsonify({'message': 'Updated'})

@app.route('/api/admin/businesses/<int:biz_id>', methods=['DELETE'])
@require_auth(role='admin')
def delete_business(biz_id):
    db = get_db()
    db.execute('UPDATE businesses SET active=0 WHERE id=?', (biz_id,))
    db.commit()
    db.close()
    return jsonify({'message': 'Deactivated'})

@app.route('/api/admin/conversations', methods=['GET'])
@require_auth(role='admin')
def admin_conversations():
    db = get_db()
    rows = db.execute("""
        SELECT c.*, b.name as business_name,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) as msg_count,
            (SELECT content FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
        FROM conversations c JOIN businesses b ON b.id=c.business_id
        ORDER BY c.updated_at DESC LIMIT 100
    """).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

# ── Business: Stats ──────────────────────────────────────────
@app.route('/api/business/stats', methods=['GET'])
@require_auth()
def business_stats():
    from services.dashboard.business import get_business_for_user
    from services.dashboard.stats import business_stats as _business_stats
    biz = get_business_for_user(request.user_id)
    if not biz:
        return jsonify({'error': 'Business not found'}), 404
    return jsonify(_business_stats(biz['id']))

# ── Business: Profile ────────────────────────────────────────
@app.route('/api/business/profile', methods=['GET'])
@require_auth()
def get_profile():
    db = get_db()
    biz = db.execute('SELECT * FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    products = db.execute('SELECT * FROM products WHERE business_id=?', (biz['id'],)).fetchall()
    faqs     = db.execute('SELECT * FROM faqs WHERE business_id=?', (biz['id'],)).fetchall()
    db.close()
    result = dict(biz)
    result['products'] = [dict(p) for p in products]
    result['faqs']     = [dict(f) for f in faqs]
    return jsonify(result)

@app.route('/api/business/profile', methods=['PUT'])
@require_auth()
def update_profile():
    data = request.json or {}
    db = get_db()
    biz = db.execute('SELECT id FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    biz_id = biz['id']
    db.execute("""
        UPDATE businesses SET name=?, type=?, location=?, hours=?, phone=?, owner_number=?,
        whatsapp_token=?, phone_number_id=?, paybill=?, paybill_account=?, till_number=?,
        send_money=?, pochi_number=?, pay_on_delivery=? WHERE id=?
    """, (data.get('name'), data.get('type'), data.get('location'), data.get('hours'),
          data.get('phone'), data.get('owner_number'), data.get('whatsapp_token'),
          data.get('phone_number_id'), data.get('paybill',''), data.get('paybill_account',''),
          data.get('till_number',''), data.get('send_money',''), data.get('pochi_number',''),
          int(data.get('pay_on_delivery', 0) or 0), biz_id))
    if 'products' in data:
        db.execute('DELETE FROM products WHERE business_id=?', (biz_id,))
        for p in data['products'][:50]:  # hard cap at 50
            db.execute(
                'INSERT INTO products (business_id, name, price, category, description, photo_url, stock_qty) VALUES (?,?,?,?,?,?,?)',
                (biz_id, p.get('name',''), p.get('price',''), p.get('category',''),
                 p.get('description',''), p.get('photo_url',''), int(p.get('stock_qty', -1) or -1)))
    if 'faqs' in data:
        db.execute('DELETE FROM faqs WHERE business_id=?', (biz_id,))
        for f in data['faqs']:
            db.execute('INSERT INTO faqs (business_id, content) VALUES (?,?)', (biz_id, f))
    db.commit()
    db.close()
    return jsonify({'message': 'Profile updated'})

@app.route('/api/business/upload-image', methods=['POST'])
@require_auth()
def upload_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file.filename or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Use PNG, JPG, GIF or WEBP.'}), 400
    raw = file.read(5 * 1024 * 1024 + 1)
    if len(raw) > 5 * 1024 * 1024:
        return jsonify({'error': 'Image must be under 5MB.'}), 400
    try:
        from PIL import Image
        import io as _io
        probe = Image.open(_io.BytesIO(raw))
        probe.verify()
    except Exception:
        return jsonify({'error': 'File is not a valid image.'}), 400
    ext = file.filename.rsplit('.', 1)[1].lower()
    if ext == 'jpg':
        ext = 'jpeg'
    filename = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(UPLOAD_FOLDER, filename), 'wb') as fh:
        fh.write(raw)
    base_url = request.host_url.rstrip('/')
    return jsonify({'url': f"{base_url}/static/uploads/{filename}"})

@app.route('/static/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/api/business/credentials', methods=['PUT'])
@require_auth()
def update_credentials():
    data        = request.json or {}
    current_pw  = data.get('current_password', '')
    new_email   = data.get('email', '').strip().lower()
    new_pw      = data.get('new_password', '')

    db   = get_db()
    user = db.execute('SELECT * FROM users WHERE id=?', (request.user_id,)).fetchone()

    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404

    # Verify current password
    if not bcrypt.checkpw(current_pw.encode(), user['password_hash'].encode()):
        db.close()
        return jsonify({'error': 'Current password is incorrect'}), 401

    # Email change
    if new_email and new_email != user['email']:
        existing = db.execute('SELECT id FROM users WHERE email=? AND id!=?', (new_email, user['id'])).fetchone()
        if existing:
            db.close()
            return jsonify({'error': 'Email already in use by another account'}), 409
        db.execute('UPDATE users SET email=? WHERE id=?', (new_email, user['id']))

    # Password change
    if new_pw:
        if len(new_pw) < 8:
            db.close()
            return jsonify({'error': 'New password must be at least 8 characters'}), 400
        pw_hash = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode()
        db.execute('UPDATE users SET password_hash=? WHERE id=?', (pw_hash, user['id']))

    db.commit()
    db.close()
    return jsonify({'message': 'Credentials updated successfully'})

@app.route('/api/business/bot/toggle', methods=['PUT'])
@require_auth()
def toggle_bot():
    db = get_db()
    biz = db.execute('SELECT id, bot_enabled FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    new_state = 0 if biz['bot_enabled'] else 1
    db.execute('UPDATE businesses SET bot_enabled=? WHERE id=?', (new_state, biz['id']))
    db.commit()
    db.close()
    return jsonify({'bot_enabled': bool(new_state)})

# ── Business: Conversations ──────────────────────────────────
@app.route('/api/business/conversations', methods=['GET'])
@require_auth()
def business_conversations():
    db = get_db()
    biz = db.execute('SELECT id FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify([])
    rows = db.execute("""
        SELECT c.*,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) as msg_count,
            (SELECT content FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
        FROM conversations c WHERE c.business_id=?
        ORDER BY c.updated_at DESC LIMIT 50
    """, (biz['id'],)).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/business/conversations/<int:conv_id>/messages', methods=['GET'])
@require_auth()
def conversation_messages(conv_id):
    db = get_db()
    biz = db.execute('SELECT id FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    conv = db.execute('SELECT * FROM conversations WHERE id=? AND business_id=?',
                      (conv_id, biz['id'])).fetchone()
    if not conv:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    msgs = db.execute('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at',
                      (conv_id,)).fetchall()
    db.close()
    return jsonify([dict(m) for m in msgs])

# ── Orders ───────────────────────────────────────────────────
@app.route('/api/business/orders', methods=['GET'])
@require_auth()
def business_orders():
    db = get_db()
    biz = db.execute('SELECT id FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify([])
    rows = db.execute('''
        SELECT * FROM orders WHERE business_id=? ORDER BY created_at DESC LIMIT 100
    ''', (biz['id'],)).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/business/orders/<int:order_id>', methods=['PUT'])
@require_auth()
def update_order(order_id):
    data = request.json or {}
    new_status = data.get('status')
    if new_status not in ('pending', 'confirmed', 'preparing', 'ready',
                          'delivered', 'cancelled', 'paid', 'out for delivery'):
        return jsonify({'error': 'Invalid status'}), 400
    db = get_db()
    biz = db.execute('SELECT * FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    db.execute('UPDATE orders SET status=?, notes=?, eta=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?',
               (new_status, data.get('notes',''), data.get('eta',''), order_id, biz['id']))
    db.commit()

    # Customer notify via services/orders/service.py (transport: whatsapp client).
    if new_status in ('confirmed', 'preparing', 'ready', 'delivered', 'cancelled'):
        try:
            order = db.execute('''
                SELECT o.*, p.photo_url
                FROM orders o
                LEFT JOIN products p ON p.business_id = o.business_id
                WHERE o.id = %s
                LIMIT 1
            ''', (order_id,)).fetchone()
            if order:
                from services.orders.service import send_followup, send_status_update
                order_d, biz_d = dict(order), dict(biz)
                send_status_update(biz_d, order_d, new_status)
                if new_status == 'delivered':
                    send_followup(biz_d, order_d)
        except Exception as e:
            print(f'[ORDER] Notification failed: {e}', flush=True)

    db.close()
    return jsonify({'message': 'Updated'})

@app.route('/api/business/orders/<int:order_id>/verify', methods=['PUT'])
@require_auth()
def verify_payment(order_id):
    db = get_db()
    biz = db.execute('SELECT id FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    db.execute(
        'UPDATE orders SET payment_verified=1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?',
        (order_id, biz['id'])
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Payment verified'})

@app.route('/api/admin/orders', methods=['GET'])
@require_auth(role='admin')
def admin_orders():
    db = get_db()
    rows = db.execute('''
        SELECT o.*, b.name as business_name FROM orders o
        JOIN businesses b ON b.id=o.business_id
        ORDER BY o.created_at DESC LIMIT 200
    ''').fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

# ── Customers ────────────────────────────────────────────────
@app.route('/api/business/customers', methods=['GET'])
@require_auth()
def business_customers():
    db = get_db()
    biz = db.execute('SELECT id FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify([])
    rows = db.execute('''
        SELECT c.*, COUNT(DISTINCT conv.id) as conv_count
        FROM customers c
        LEFT JOIN conversations conv ON conv.customer_id=c.id
        WHERE c.business_id=?
        GROUP BY c.id ORDER BY c.last_seen DESC
    ''', (biz['id'],)).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/business/customers/<int:cust_id>', methods=['PUT'])
@require_auth()
def update_customer(cust_id):
    data = request.json or {}
    db = get_db()
    biz = db.execute('SELECT id FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    db.execute('UPDATE customers SET name=? WHERE id=? AND business_id=?',
               (data.get('name',''), cust_id, biz['id']))
    db.commit()
    db.close()
    return jsonify({'message': 'Updated'})

# ── Escalations ──────────────────────────────────────────────
@app.route('/api/business/escalations', methods=['GET'])
@require_auth()
def business_escalations():
    db = get_db()
    biz = db.execute('SELECT id FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify([])
    rows = db.execute('''
        SELECT * FROM escalations WHERE business_id=? ORDER BY created_at DESC LIMIT 50
    ''', (biz['id'],)).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/business/escalations/<int:esc_id>/resolve', methods=['PUT'])
@require_auth()
def resolve_escalation(esc_id):
    db = get_db()
    biz = db.execute('SELECT id FROM businesses WHERE user_id=?', (request.user_id,)).fetchone()
    if not biz:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    db.execute('UPDATE escalations SET resolved=1 WHERE id=? AND business_id=?', (esc_id, biz['id']))
    db.commit()
    db.close()
    return jsonify({'message': 'Resolved'})

# ── Business: Marketing broadcast ───────────────────────────
@app.route('/api/business/marketing/broadcast', methods=['POST'])
@require_auth()
def marketing_broadcast():
    data    = request.json or {}
    message = (data.get('message') or '').strip()[:1000]
    segment = data.get('segment', 'all')   # all | recent | repeat
    if not message:
        return jsonify({'error': 'Message is required'}), 400
    if segment not in ('all', 'recent', 'repeat'):
        segment = 'all'
    if rate_limited(f'broadcast:{request.user_id}', limit=5, window=60):
        return jsonify({'error': 'Too many broadcasts. Please wait a minute.'}), 429

    from services.marketing.service import broadcast, get_business_for_user
    biz = get_business_for_user(request.user_id)
    if not biz or not biz.get('whatsapp_token') or not biz.get('phone_number_id'):
        return jsonify({'error': 'WhatsApp not configured'}), 400

    return jsonify(broadcast(dict(biz), message, segment))


# ── Admin: Enhanced stats ────────────────────────────────────
@app.route('/api/admin/escalations', methods=['GET'])
@require_auth(role='admin')
def admin_escalations():
    db = get_db()
    rows = db.execute('''
        SELECT e.*, b.name as business_name FROM escalations e
        JOIN businesses b ON b.id=e.business_id
        ORDER BY e.created_at DESC LIMIT 100
    ''').fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

# ── Website FAQ Chatbot ──────────────────────────────────────
# System prompt lives in services/ai/prompts.py (single source of truth).

@app.route('/api/webchat', methods=['POST'])
def webchat():
    data    = request.json or {}
    message = (data.get('message') or '').strip()[:1000]
    history = data.get('history', [])
    if not message:
        return jsonify({'error': 'Message required'}), 400
    if rate_limited(f'webchat:{client_ip()}', limit=20, window=60):
        return jsonify({'error': 'Too many requests. Please wait a minute.'}), 429

    from services.ai.prompts import WEBCHAT_FALLBACK, build_webchat_system
    from services.ai.provider import get_default_provider
    messages = [{'role': 'system', 'content': build_webchat_system()}]
    for h in history[-6:]:
        if h.get('role') in ('user', 'assistant') and h.get('text'):
            messages.append({'role': h['role'], 'content': h['text']})
    messages.append({'role': 'user', 'content': message})

    reply = get_default_provider().complete(messages, max_tokens=300)
    if not reply:
        reply = WEBCHAT_FALLBACK

    return jsonify({'reply': reply})


if __name__ == '__main__':
    init_db()
    print(f"Admin login: {os.environ.get('ADMIN_EMAIL', 'admin@example.com')} / admin123")
    app.run(host='0.0.0.0', port=5002, debug=True, use_reloader=False)
