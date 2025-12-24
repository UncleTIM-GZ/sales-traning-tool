"""仪表盘指标缓存模型"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base


class DashboardMetric(Base):
    """仪表盘指标缓存表
    
    用于缓存聚合计算结果，提升看板加载速度
    """
    __tablename__ = "dashboard_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    metric_key = Column(String(100), nullable=False, index=True, comment="指标键名")
    metric_value = Column(JSON, nullable=False, comment="指标值（JSON格式）")
    time_bucket = Column(DateTime, nullable=False, index=True, comment="时间桶（小时/天）")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<DashboardMetric(key={self.metric_key}, bucket={self.time_bucket})>"
