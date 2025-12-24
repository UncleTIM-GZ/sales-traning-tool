"""文件上传服务"""

import os
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile, HTTPException

from app.config import settings


class UploadService:
    """文件上传服务（本地存储版，可扩展为 OSS）"""

    # 允许的图片类型
    ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    # 允许的音频类型
    ALLOWED_AUDIO_TYPES = {"audio/mp3", "audio/mpeg", "audio/wav", "audio/webm", "audio/ogg"}
    
    # 文件大小限制（字节）
    MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
    MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50MB

    def __init__(self):
        # 上传目录
        self.upload_dir = Path(settings.UPLOAD_DIR if hasattr(settings, 'UPLOAD_DIR') else "uploads")
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        
        # 子目录
        self.avatar_dir = self.upload_dir / "avatars"
        self.audio_dir = self.upload_dir / "audio"
        self.avatar_dir.mkdir(exist_ok=True)
        self.audio_dir.mkdir(exist_ok=True)

    async def upload_avatar(self, user_id: str, file: UploadFile) -> str:
        """上传头像"""
        # 验证文件类型
        if file.content_type not in self.ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的图片格式。支持: JPG, PNG, GIF, WebP",
            )
        
        # 验证文件大小
        content = await file.read()
        if len(content) > self.MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"图片文件过大，最大支持 {self.MAX_IMAGE_SIZE // 1024 // 1024}MB",
            )
        
        # 生成文件名
        ext = self._get_extension(file.filename or "image.jpg")
        filename = f"{user_id}_{uuid.uuid4().hex[:8]}{ext}"
        filepath = self.avatar_dir / filename
        
        # 保存文件
        with open(filepath, "wb") as f:
            f.write(content)
        
        # 返回访问URL（相对路径）
        return f"/uploads/avatars/{filename}"

    async def upload_audio(self, user_id: str, session_id: str, file: UploadFile) -> str:
        """上传音频文件"""
        # 验证文件类型
        if file.content_type not in self.ALLOWED_AUDIO_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的音频格式。支持: MP3, WAV, WebM, OGG",
            )
        
        # 验证文件大小
        content = await file.read()
        if len(content) > self.MAX_AUDIO_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"音频文件过大，最大支持 {self.MAX_AUDIO_SIZE // 1024 // 1024}MB",
            )
        
        # 生成文件名
        ext = self._get_extension(file.filename or "audio.mp3")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{session_id}_{timestamp}{ext}"
        
        # 按用户分目录
        user_audio_dir = self.audio_dir / user_id
        user_audio_dir.mkdir(exist_ok=True)
        filepath = user_audio_dir / filename
        
        # 保存文件
        with open(filepath, "wb") as f:
            f.write(content)
        
        # 返回访问URL
        return f"/uploads/audio/{user_id}/{filename}"

    def delete_file(self, file_url: str) -> bool:
        """删除文件"""
        if not file_url or not file_url.startswith("/uploads/"):
            return False
        
        # 转换为本地路径
        relative_path = file_url.replace("/uploads/", "")
        filepath = self.upload_dir / relative_path
        
        if filepath.exists():
            filepath.unlink()
            return True
        return False

    def _get_extension(self, filename: str) -> str:
        """获取文件扩展名"""
        if "." in filename:
            return "." + filename.rsplit(".", 1)[1].lower()
        return ".jpg"
