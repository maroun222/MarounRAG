from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

from src.auth.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from src.database.mongodb import mongodb


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


class RegisterRequest(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=100,
    )
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    request_body: RegisterRequest,
) -> dict:
    email = request_body.email.lower().strip()

    existing_user = mongodb.users.find_one(
        {"email": email}
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    user_document = {
        "name": request_body.name.strip(),
        "email": email,
        "password_hash": hash_password(
            request_body.password
        ),
        "created_at": datetime.now(timezone.utc),
    }

    try:
        result = mongodb.users.insert_one(
            user_document
        )

    except DuplicateKeyError as error:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        ) from error

    user_id = str(result.inserted_id)

    token = create_access_token(
        subject=user_id,
        extra_data={
            "email": email,
        },
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": user_document["name"],
            "email": email,
        },
    }


@router.post(
    "/login",
    response_model=AuthResponse,
)
def login(
    request_body: LoginRequest,
) -> dict:
    email = request_body.email.lower().strip()

    user = mongodb.users.find_one(
        {"email": email}
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    if not verify_password(
        request_body.password,
        user["password_hash"],
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    user_id = str(user["_id"])

    token = create_access_token(
        subject=user_id,
        extra_data={
            "email": user["email"],
        },
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": user["name"],
            "email": user["email"],
        },
    }