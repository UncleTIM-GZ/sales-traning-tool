"""
开发：Excellent（11964948@qq.com）
功能：支付系统Pydantic模型
作用：定义支付配置、支付请求/响应模型
创建时间：2025-12-24
最后修改：2025-12-24
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ========== 支付配置（后台管理） ==========

class WechatPayConfigRequest(BaseModel):
    """微信支付配置请求"""
    enabled: bool = Field(False, description="是否启用")
    mch_id: str = Field("", description="商户号")
    api_key: str = Field("", description="API密钥")
    api_v3_key: str = Field("", description="APIv3密钥")
    serial_no: str = Field("", description="证书序列号")
    private_key: str = Field("", description="商户私钥（PEM格式）")
    notify_url: str = Field("", description="支付回调地址")


class WechatPayConfigResponse(BaseModel):
    """微信支付配置响应（隐藏敏感信息）"""
    enabled: bool = False
    mch_id: str = ""
    api_key_set: bool = False
    api_v3_key_set: bool = False
    serial_no: str = ""
    private_key_set: bool = False
    notify_url: str = ""


class AlipayConfigRequest(BaseModel):
    """支付宝配置请求"""
    enabled: bool = Field(False, description="是否启用")
    app_id: str = Field("", description="应用ID")
    private_key: str = Field("", description="应用私钥（PEM格式）")
    alipay_public_key: str = Field("", description="支付宝公钥（PEM格式）")
    notify_url: str = Field("", description="支付回调地址")
    return_url: str = Field("", description="支付成功跳转地址")


class AlipayConfigResponse(BaseModel):
    """支付宝配置响应（隐藏敏感信息）"""
    enabled: bool = False
    app_id: str = ""
    private_key_set: bool = False
    alipay_public_key_set: bool = False
    notify_url: str = ""
    return_url: str = ""


class WechatLoginConfigRequest(BaseModel):
    """微信登录配置请求"""
    enabled: bool = Field(False, description="是否启用微信登录")
    app_id: str = Field("", description="微信开放平台AppID")
    app_secret: str = Field("", description="微信开放平台AppSecret")
    redirect_uri: str = Field("", description="授权回调地址")
    # 微信公众号配置（用于微信内网页授权）
    mp_enabled: bool = Field(False, description="是否启用公众号登录")
    mp_app_id: str = Field("", description="公众号AppID")
    mp_app_secret: str = Field("", description="公众号AppSecret")


class WechatLoginConfigResponse(BaseModel):
    """微信登录配置响应（隐藏敏感信息）"""
    enabled: bool = False
    app_id: str = ""
    app_secret_set: bool = False
    redirect_uri: str = ""
    mp_enabled: bool = False
    mp_app_id: str = ""
    mp_app_secret_set: bool = False


class PaymentConfigResponse(BaseModel):
    """支付配置汇总响应"""
    wechat_pay: WechatPayConfigResponse
    alipay: AlipayConfigResponse
    wechat_login: WechatLoginConfigResponse


# ========== 支付请求/响应 ==========

class PaymentCreateRequest(BaseModel):
    """创建支付请求"""
    order_id: str = Field(..., description="订单ID")
    payment_method: str = Field(..., description="支付方式: wechat, alipay")
    payment_channel: str = Field(..., description="支付渠道: wechat_native, wechat_jsapi, wechat_h5, alipay_pc, alipay_wap")


class PaymentCreateResponse(BaseModel):
    """创建支付响应"""
    order_id: str
    order_no: str
    payment_method: str
    payment_channel: str
    # 微信支付
    code_url: str | None = Field(None, description="微信Native支付二维码链接")
    prepay_id: str | None = Field(None, description="微信JSAPI预支付ID")
    h5_url: str | None = Field(None, description="微信H5支付跳转链接")
    # 支付宝
    pay_url: str | None = Field(None, description="支付宝支付跳转链接")
    form_html: str | None = Field(None, description="支付宝表单HTML")


class PaymentQueryRequest(BaseModel):
    """查询支付状态请求"""
    order_id: str


class PaymentQueryResponse(BaseModel):
    """查询支付状态响应"""
    order_id: str
    order_no: str
    status: str
    payment_method: str | None = None
    transaction_id: str | None = None
    paid_at: datetime | None = None


class PaymentNotifyResponse(BaseModel):
    """支付回调响应"""
    success: bool
    message: str | None = None


# ========== 退款 ==========

class RefundRequest(BaseModel):
    """退款请求"""
    order_id: str = Field(..., description="订单ID")
    reason: str = Field(..., min_length=1, max_length=500, description="退款原因")


class RefundResponse(BaseModel):
    """退款响应"""
    refund_id: str
    refund_no: str
    order_id: str
    amount: int
    status: str
    message: str | None = None
