"""
开发：Excellent（11964948@qq.com）
功能：统一支付服务
作用：封装微信支付和支付宝支付接口
创建时间：2025-12-24
最后修改：2025-12-24
"""

import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, PaymentMethod, PaymentChannel
from app.services.system_config_service import SystemConfigService
from app.services.order_service import OrderService


class PaymentService:
    """统一支付服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.config_service = SystemConfigService(db)
        self.order_service = OrderService(db)

    # ========== 支付可用性检查 ==========

    async def get_available_methods(self) -> list[dict[str, Any]]:
        """获取可用的支付方式"""
        methods = []

        if await self.config_service.is_wechat_pay_enabled():
            methods.append({
                "method": PaymentMethod.WECHAT.value,
                "name": "微信支付",
                "channels": [
                    {"channel": PaymentChannel.WECHAT_NATIVE.value, "name": "扫码支付"},
                    {"channel": PaymentChannel.WECHAT_H5.value, "name": "H5支付"},
                ],
            })

        if await self.config_service.is_alipay_enabled():
            methods.append({
                "method": PaymentMethod.ALIPAY.value,
                "name": "支付宝",
                "channels": [
                    {"channel": PaymentChannel.ALIPAY_PC.value, "name": "电脑支付"},
                    {"channel": PaymentChannel.ALIPAY_WAP.value, "name": "手机支付"},
                ],
            })

        return methods

    # ========== 创建支付 ==========

    async def create_payment(
        self,
        order_id: str,
        payment_method: str,
        payment_channel: str,
        client_ip: str = "127.0.0.1",
    ) -> dict[str, Any]:
        """创建支付"""
        order = await self.order_service.get_order_by_id(order_id)
        if not order:
            return {"success": False, "error": "订单不存在"}

        if not order.can_pay:
            return {"success": False, "error": "订单状态不允许支付"}

        # 更新订单支付状态
        await self.order_service.update_order_paying(
            order_id, payment_method, payment_channel
        )

        # 根据支付方式调用不同的支付接口
        if payment_method == PaymentMethod.WECHAT.value:
            return await self._create_wechat_payment(order, payment_channel, client_ip)
        elif payment_method == PaymentMethod.ALIPAY.value:
            return await self._create_alipay_payment(order, payment_channel)
        else:
            return {"success": False, "error": "不支持的支付方式"}

    async def _create_wechat_payment(
        self, order: Order, channel: str, client_ip: str
    ) -> dict[str, Any]:
        """创建微信支付"""
        config = await self.config_service.get_wechat_pay_config()
        if not config.get("enabled"):
            return {"success": False, "error": "微信支付未启用"}

        # 这里是微信支付的核心逻辑
        # 实际项目中需要使用 wechatpayv3 SDK
        # 以下是示例返回结构

        result = {
            "success": True,
            "order_id": order.id,
            "order_no": order.order_no,
            "payment_method": PaymentMethod.WECHAT.value,
            "payment_channel": channel,
        }

        if channel == PaymentChannel.WECHAT_NATIVE.value:
            # Native支付返回二维码链接
            # 实际需要调用微信API获取
            result["code_url"] = f"weixin://wxpay/bizpayurl?pr={order.order_no}"
        elif channel == PaymentChannel.WECHAT_H5.value:
            # H5支付返回跳转链接
            result["h5_url"] = f"https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id={order.order_no}"
        elif channel == PaymentChannel.WECHAT_JSAPI.value:
            # JSAPI支付返回预支付ID
            result["prepay_id"] = f"wx{int(time.time())}{order.order_no[:10]}"

        return result

    async def _create_alipay_payment(
        self, order: Order, channel: str
    ) -> dict[str, Any]:
        """创建支付宝支付"""
        config = await self.config_service.get_alipay_config()
        if not config.get("enabled"):
            return {"success": False, "error": "支付宝支付未启用"}

        # 这里是支付宝支付的核心逻辑
        # 实际项目中需要使用 alipay-sdk-python
        # 以下是示例返回结构

        result = {
            "success": True,
            "order_id": order.id,
            "order_no": order.order_no,
            "payment_method": PaymentMethod.ALIPAY.value,
            "payment_channel": channel,
        }

        return_url = config.get("return_url", "")
        
        if channel == PaymentChannel.ALIPAY_PC.value:
            # PC支付返回跳转链接
            result["pay_url"] = f"https://openapi.alipay.com/gateway.do?out_trade_no={order.order_no}"
        elif channel == PaymentChannel.ALIPAY_WAP.value:
            # WAP支付返回表单HTML
            result["form_html"] = f'<form action="https://openapi.alipay.com/gateway.do" method="POST"><input type="hidden" name="out_trade_no" value="{order.order_no}"/></form>'

        return result

    # ========== 支付回调处理 ==========

    async def handle_wechat_notify(
        self, body: bytes, headers: dict[str, str]
    ) -> tuple[bool, str]:
        """处理微信支付回调
        
        Returns:
            (success, message)
        """
        config = await self.config_service.get_wechat_pay_config()
        if not config.get("enabled"):
            return False, "微信支付未启用"

        # 1. 验证签名
        # 实际需要使用微信支付SDK验证签名
        # signature = headers.get("Wechatpay-Signature", "")
        # if not self._verify_wechat_signature(body, signature, config):
        #     return False, "签名验证失败"

        # 2. 解析回调数据
        try:
            data = json.loads(body)
            # 实际需要解密数据
            # resource = data.get("resource", {})
            # decrypted = self._decrypt_wechat_resource(resource, config)
            
            # 模拟解析
            out_trade_no = data.get("out_trade_no", "")
            transaction_id = data.get("transaction_id", "")
            trade_state = data.get("trade_state", "")
        except Exception as e:
            return False, f"解析回调数据失败: {str(e)}"

        # 3. 处理支付结果
        if trade_state == "SUCCESS":
            order = await self.order_service.get_order_by_no(out_trade_no)
            if order:
                # 幂等性检查
                if order.status == "paid":
                    return True, "订单已处理"
                
                await self.order_service.update_order_paid(order.id, transaction_id)
                return True, "支付成功"
            return False, "订单不存在"

        return False, f"支付状态异常: {trade_state}"

    async def handle_alipay_notify(
        self, params: dict[str, str]
    ) -> tuple[bool, str]:
        """处理支付宝回调
        
        Returns:
            (success, message)
        """
        config = await self.config_service.get_alipay_config()
        if not config.get("enabled"):
            return False, "支付宝支付未启用"

        # 1. 验证签名
        # 实际需要使用支付宝SDK验证签名
        # sign = params.pop("sign", "")
        # if not self._verify_alipay_signature(params, sign, config):
        #     return False, "签名验证失败"

        # 2. 解析回调数据
        out_trade_no = params.get("out_trade_no", "")
        trade_no = params.get("trade_no", "")
        trade_status = params.get("trade_status", "")

        # 3. 处理支付结果
        if trade_status in ["TRADE_SUCCESS", "TRADE_FINISHED"]:
            order = await self.order_service.get_order_by_no(out_trade_no)
            if order:
                # 幂等性检查
                if order.status == "paid":
                    return True, "订单已处理"
                
                await self.order_service.update_order_paid(order.id, trade_no)
                return True, "支付成功"
            return False, "订单不存在"

        return False, f"支付状态异常: {trade_status}"

    # ========== 查询支付状态 ==========

    async def query_payment_status(self, order_id: str) -> dict[str, Any]:
        """查询支付状态"""
        order = await self.order_service.get_order_by_id(order_id)
        if not order:
            return {"success": False, "error": "订单不存在"}

        return {
            "success": True,
            "order_id": order.id,
            "order_no": order.order_no,
            "status": order.status,
            "payment_method": order.payment_method,
            "transaction_id": order.transaction_id,
            "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        }

    # ========== 退款 ==========

    async def create_refund(
        self, order_id: str, user_id: str, reason: str
    ) -> dict[str, Any]:
        """创建退款"""
        refund = await self.order_service.create_refund(order_id, user_id, reason)
        if not refund:
            return {"success": False, "error": "无法创建退款"}

        order = await self.order_service.get_order_by_id(order_id)
        if not order:
            return {"success": False, "error": "订单不存在"}

        # 根据支付方式调用退款接口
        if order.payment_method == PaymentMethod.WECHAT.value:
            result = await self._process_wechat_refund(order, refund)
        elif order.payment_method == PaymentMethod.ALIPAY.value:
            result = await self._process_alipay_refund(order, refund)
        else:
            result = {"success": False, "error": "不支持的支付方式"}

        return result

    async def _process_wechat_refund(
        self, order: Order, refund: Any
    ) -> dict[str, Any]:
        """处理微信退款"""
        # 实际需要调用微信退款API
        # 这里模拟成功
        await self.order_service.update_refund_success(
            refund.id, f"wx_refund_{int(time.time())}"
        )
        return {
            "success": True,
            "refund_id": refund.id,
            "refund_no": refund.refund_no,
            "message": "退款申请已提交",
        }

    async def _process_alipay_refund(
        self, order: Order, refund: Any
    ) -> dict[str, Any]:
        """处理支付宝退款"""
        # 实际需要调用支付宝退款API
        # 这里模拟成功
        await self.order_service.update_refund_success(
            refund.id, f"alipay_refund_{int(time.time())}"
        )
        return {
            "success": True,
            "refund_id": refund.id,
            "refund_no": refund.refund_no,
            "message": "退款申请已提交",
        }
