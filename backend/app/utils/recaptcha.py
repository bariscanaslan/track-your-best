# /utils/recaptcha.py

import httpx
import os

RECAPTCHA_SECRET = os.getenv("RECAPTCHA_SECRET")

async def verify_recaptcha(token: str) -> bool:
    if not token:
        return False

    url = "https://www.google.com/recaptcha/api/siteverify"
    payload = {
        "secret": RECAPTCHA_SECRET,
        "response": token,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, data=payload)
        result = resp.json()

    return result.get("success", False)
