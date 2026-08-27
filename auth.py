from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

SECRET_KEY = "nightingale_super_secret_key_change_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

MOCK_USERS_DB = {
    "dr_smith": {
        "username": "dr_smith",
        "full_name": "Dr. John Smith",
        "role": "clinician",
        "clinic_id": "clinic_A"
    },
    "nurse_joy": {
        "username": "nurse_joy",
        "full_name": "Nurse Joy",
        "role": "staff",
        "clinic_id": "clinic_A"
    },
    "patient_123": {
        "username": "patient_123",
        "full_name": "Lim Ah Beng",
        "role": "patient",
        "clinic_id": "clinic_A"
    },
    "admin_alice": {
        "username": "admin_alice",
        "full_name": "Alice (Clinic Manager)",
        "role": "admin",
        "clinic_id": "clinic_A"
    },
    "dr_jones": {
        "username": "dr_jones",
        "full_name": "Dr. Jones",
        "role": "clinician",
        "clinic_id": "clinic_B"
    }
}


class TokenData(BaseModel):
    username: str
    role: str
    clinic_id: str


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        clinic_id: str = payload.get("clinic_id")

        if username is None or role is None:
            raise credentials_exception

        token_data = TokenData(username=username, role=role, clinic_id=clinic_id)
    except JWTError:
        raise credentials_exception

    return token_data