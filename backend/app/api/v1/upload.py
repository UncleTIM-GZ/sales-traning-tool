"""文件上传 API"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from app.api.deps import CurrentUserId
from app.services.upload_service import UploadService


router = APIRouter()


class UploadResponse(BaseModel):
    """上传响应"""
    success: bool
    url: str
    message: str = "上传成功"


@router.post("/avatar", response_model=UploadResponse)
async def upload_avatar(
    user_id: CurrentUserId,
    file: UploadFile = File(..., description="头像图片文件"),
):
    """上传头像"""
    if not file:
        raise HTTPException(status_code=400, detail="请选择要上传的文件")
    
    service = UploadService()
    url = await service.upload_avatar(user_id, file)
    
    return UploadResponse(
        success=True,
        url=url,
        message="头像上传成功",
    )


@router.post("/audio", response_model=UploadResponse)
async def upload_audio(
    user_id: CurrentUserId,
    session_id: str,
    file: UploadFile = File(..., description="音频文件"),
):
    """上传音频"""
    if not file:
        raise HTTPException(status_code=400, detail="请选择要上传的文件")
    
    service = UploadService()
    url = await service.upload_audio(user_id, session_id, file)
    
    return UploadResponse(
        success=True,
        url=url,
        message="音频上传成功",
    )


@router.delete("")
async def delete_file(
    user_id: CurrentUserId,
    file_url: str,
):
    """删除文件"""
    service = UploadService()
    success = service.delete_file(file_url)
    
    return {"success": success}
