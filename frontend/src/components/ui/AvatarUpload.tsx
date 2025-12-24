"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";

interface AvatarUploadProps {
  currentAvatar?: string;
  nickname?: string;
  onUpload: (url: string) => void;
  token: string;
}

export default function AvatarUpload({
  currentAvatar,
  nickname = "用户",
  onUpload,
  token,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("图片文件不能超过 5MB");
      return;
    }

    // 预览
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // 上传
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/upload/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "上传失败");
      }

      const data = await res.json();
      onUpload(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const displayAvatar = previewUrl || currentAvatar;
  const avatarText = nickname.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        {/* Avatar */}
        {displayAvatar ? (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 rounded-full bg-cover bg-center border-2 border-blue-500/30"
            style={{ backgroundImage: `url(${displayAvatar})` }}
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-[var(--brand-gradient)] flex items-center justify-center text-text-primary text-2xl font-bold">
            {avatarText}
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-blue-500 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <span className="material-symbols-outlined animate-spin text-sm">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined text-sm">photo_camera</span>
          )}
        </button>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div>
        <h3 className="font-medium text-text-primary">更换头像</h3>
        <p className="text-xs text-text-muted mt-1">支持 JPG、PNG 格式，文件不超过 5MB</p>
        {error && (
          <p className="text-xs text-red-400 mt-1">{error}</p>
        )}
      </div>
    </div>
  );
}
