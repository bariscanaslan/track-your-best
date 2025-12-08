# /routers/api_auth.py

from fastapi import APIRouter, HTTPException, Response, Request
from app.models import UserCreate, LoginRequest
from app.database_user import user_db
from app.utils.jwt_utils import create_access_token, SECRET_KEY, ALGORITHM
from jose import jwt

from app.utils.recaptcha import verify_recaptcha

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register")
async def register(user: UserCreate):
    success = user_db.create_user(
        username=user.username,
        password=user.password,
        full_name=user.full_name
    )
    if not success:
        raise HTTPException(
            400, 
            "Kullanıcı oluşturulamadı. Username kullanılıyor olabilir."
        )

    return {"status": "success", "message": "Kullanıcı oluşturuldu."}

@router.post("/login")
async def login(data: LoginRequest, response: Response):

    is_valid = await verify_recaptcha(data.recaptcha_token)
    if not is_valid:
        raise HTTPException(400, "Robot doğrulaması başarısız.")

    user = user_db.authenticate_user(data.username, data.password)
    if not user:
        raise HTTPException(401, "Hatalı kullanıcı adı veya şifre")

    token = create_access_token({
        "sub": user.username,
        "uid": user.id,
        "full_name": user.full_name
    })

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60  
    )

    return {
        "status": "success",
        "user": {
            "id": user.id,
            "username": user.username
        }
    }

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=False,
        samesite="lax"
    )
    return {"status": "success", "message": "Çıkış yapıldı"}

@router.get("/me")
async def me(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Giriş yapılmamış")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {
            "id": payload.get("uid"),
            "username": payload.get("sub"),
            "full_name": payload.get("full_name")
        }
    except:
        raise HTTPException(401, "Token geçersiz")
