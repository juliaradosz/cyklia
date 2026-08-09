import os
import hashlib
import functools
import jwt
import database as db
from flask import jsonify, request

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


def hash_password(password):
    return hashlib.sha256(("cyklia::" + password).encode("utf-8")).hexdigest()


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
        if uid is None:
            return jsonify({"error": "Sesja wygasła, zaloguj się ponownie"}), 401
        return fn(*args, user_id=uid, **kwargs)

    return wrapper
