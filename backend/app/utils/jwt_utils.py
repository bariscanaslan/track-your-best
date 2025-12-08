# /utils/jwt_utils.py

import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, Request, status
from jose import jwt, JWTError
from app.models import UserPublic
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Token bulunamadı, lütfen giriş yapın.")
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("uid")
        
        if username is None or user_id is None:
            raise HTTPException(status_code=401, detail="Token geçersiz")
            
        return UserPublic(id=user_id, username=username)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token süresi dolmuş veya geçersiz")