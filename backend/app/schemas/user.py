"""
开发：Excellent（11964948@qq.com）
功能：用户相关 Schema
作用：请求/响应数据验证
创建时间：2024-12-23
最后修改：2024-12-24
"""

import re
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ===== 手机号验证器 =====
def validate_phone(phone: str) -> str:
    """验证中国大陆手机号"""
    if not re.match(r"^1[3-9]\d{9}$", phone):
        raise ValueError("请输入正确的手机号")
    return phone


def validate_password_strength(password: str) -> str:
    """
    验证密码强度
    
    要求：
    - 长度：8-128位
    - 必须包含：英文字母和数字
    """
    if len(password) < 8:
        raise ValueError("密码长度至少8位")
    if len(password) > 128:
        raise ValueError("密码长度不能超过128位")
    
    if not re.search(r'[a-zA-Z]', password):
        raise ValueError("密码必须包含英文字母")
    if not re.search(r'\d', password):
        raise ValueError("密码必须包含数字")
    
    return password


# ===== Token =====
class Token(BaseModel):
    """访问Token"""
    access_token: str
    token_type: str = "bearer"


class TokenWithUser(Token):
    """带用户信息的Token"""
    user: "UserResponse"


# ===== User =====
class UserCreate(BaseModel):
    """用户注册"""
    phone: str = Field(..., description="手机号")
    password: str = Field(..., min_length=8, max_length=128, description="密码(8-128位，需包含字母和数字)")
    nickname: str = Field(..., min_length=2, max_length=16, description="昵称(2-16字符)")
    track: Literal["sales", "social"] = Field(default="sales", description="赛道")

    @field_validator("phone")
    @classmethod
    def validate_phone_field(cls, v: str) -> str:
        return validate_phone(v)
    
    @field_validator("password")
    @classmethod
    def validate_password_field(cls, v: str) -> str:
        return validate_password_strength(v)


class UserLogin(BaseModel):
    """用户登录"""
    phone: str = Field(..., description="手机号")
    password: str = Field(..., description="密码")

    @field_validator("phone")
    @classmethod
    def validate_phone_field(cls, v: str) -> str:
        return validate_phone(v)


class UserResponse(BaseModel):
    """用户信息响应"""
    id: str
    phone: str
    nickname: str
    avatar: str | None = None
    track: Literal["sales", "social"]
    role: Literal["user", "admin"]
    level: str = "新手学员"

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """更新用户信息"""
    nickname: str | None = Field(None, min_length=2, max_length=16)
    avatar: str | None = None
    track: Literal["sales", "social"] | None = None


# ===== 忘记密码 =====
class SendCodeRequest(BaseModel):
    """发送验证码请求"""
    phone: str = Field(..., description="手机号")
    purpose: Literal["register", "reset_password", "login"] = Field(
        default="reset_password", description="验证码用途"
    )

    @field_validator("phone")
    @classmethod
    def validate_phone_field(cls, v: str) -> str:
        return validate_phone(v)


class VerifyCodeRequest(BaseModel):
    """验证验证码请求"""
    phone: str = Field(..., description="手机号")
    code: str = Field(..., min_length=6, max_length=6, description="6位验证码")

    @field_validator("phone")
    @classmethod
    def validate_phone_field(cls, v: str) -> str:
        return validate_phone(v)


class ResetPasswordRequest(BaseModel):
    """重置密码请求"""
    phone: str = Field(..., description="手机号")
    code: str = Field(..., min_length=6, max_length=6, description="6位验证码")
    new_password: str = Field(..., min_length=8, max_length=128, description="新密码(8-128位，需包含字母和数字)")

    @field_validator("phone")
    @classmethod
    def validate_phone_field(cls, v: str) -> str:
        return validate_phone(v)
    
    @field_validator("new_password")
    @classmethod
    def validate_password_field(cls, v: str) -> str:
        return validate_password_strength(v)


# ===== Profile =====
class ProfileResponse(BaseModel):
    """用户画像响应"""
    id: str
    user_id: str
    baseline_score: float | None = None
    weak_dimensions: list[str] = []
    preferences: dict[str, Any] = {}
    onboarding_completed: bool = False
    goal: str | None = None
    experience_level: str | None = None
    daily_commitment_min: int = 30
    baseline_completed: bool = False

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    """更新用户画像"""
    preferences: dict[str, Any] | None = None


# ===== Onboarding =====
class OnboardingData(BaseModel):
    """引导流程数据"""
    track: Literal["sales", "social"] = Field(..., description="赛道")
    goal: str = Field(..., description="目标: telesales/field_sales/negotiation 或 daily_social/workplace/public_speaking")
    experience_level: Literal["beginner", "intermediate", "advanced"] = Field(..., description="经验等级")
    daily_commitment_min: int = Field(default=30, ge=15, le=120, description="每日投入时间(分钟)")


class OnboardingStatus(BaseModel):
    """引导状态"""
    onboarding_completed: bool
    baseline_completed: bool
    track: Literal["sales", "social"]
    goal: str | None = None
    experience_level: str | None = None
    daily_commitment_min: int = 30


# 更新前向引用
TokenWithUser.model_rebuild()
