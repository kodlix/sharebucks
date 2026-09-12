from __future__ import annotations

import hashlib
import hmac
import secrets

HASH_NAME = "pbkdf2_sha256"
ITERATIONS = 200_000
SALT_BYTES = 16


def hash_password(password: str) -> str:
    salt = secrets.token_hex(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        ITERATIONS,
    )
    return f"{HASH_NAME}${ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash or not password_hash.startswith(f"{HASH_NAME}$"):
        return False

    try:
        algorithm, iteration_text, salt, digest_hex = password_hash.split("$", 3)
        iterations = int(iteration_text)
    except (ValueError, TypeError):
        return False

    if algorithm != HASH_NAME:
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()

    return hmac.compare_digest(candidate, digest_hex)
