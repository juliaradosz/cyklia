import os
import hashlib
import hmac
import functools
import jwt
import database as db
from flask import jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SECRET_FILE = os.path.join(BASE_DIR, "secret.key")

try:
    with open(SECRET_FILE, "r") as f:
        SECRET = f.read().strip()
except OSError:
    SECRET = hashlib.sha256(os.urandom(32)).hexdigest()
    try:
        with open(SECRET_FILE, "w") as f:
            f.write(SECRET)
    except OSError:
        pass

ALGO = "HS256"
TOKEN_TTL = 60 * 60 * 24 * 30  # 30 dni


def _legacy_hash(password):
    return hashlib.sha256(("cyklia::" + password).encode("utf-8")).hexdigest()


def hash_password(password):
    """Bezpieczny skrót hasła (PBKDF2-SHA256 z losową solą)."""
    return generate_password_hash(password, method="pbkdf2:sha256:600000")


def verify_password(password, stored):
    if not stored:
        return False
    if ":" in stored and "$" in stored:
        try:
            return check_password_hash(stored, password)
        except ValueError:
            return False
    # konta założone przed zmianą: stary skrót SHA-256
    return hmac.compare_digest(stored, _legacy_hash(password))


def needs_rehash(stored):
    return not (stored and stored.startswith("pbkdf2:"))


def make_token(user_id):
    import time

    payload = {"uid": user_id, "exp": int(time.time()) + TOKEN_TTL}
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def decode_token(token):
    import time

    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        if payload.get("exp", 0) < time.time():
            return None
        return payload.get("uid")
    except jwt.PyJWTError:
        return None


def auth_required(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Brak autoryzacji"}), 401
        uid = decode_token(auth[7:])
        if uid is None or not db.query_one("SELECT id FROM users WHERE id = ?", (uid,)):
            return jsonify({"error": "Sesja wygasła, zaloguj się ponownie"}), 401
        return fn(*args, user_id=uid, **kwargs)

    return wrapper
