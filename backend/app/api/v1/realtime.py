"""实时语音对话 WebSocket API

通过 WebSocket 提供实时语音对话能力，桥接前端和阿里云百炼实时语音服务。

流程:
1. 前端建立 WebSocket 连接，发送场景配置
2. 后端连接阿里云百炼 Realtime API
3. 前端发送麦克风音频 → 后端转发 → 百炼
4. 百炼返回AI语音 → 后端转发 → 前端播放
5. AI回复完成后 → 生成Coach提示 → 发送给前端（仅Train模式）
"""

import asyncio
import base64
import json
import traceback
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select

from app.config import settings
from app.core.security import decode_access_token
from app.db.session import async_session_factory
from app.models.scenario import Scenario
from app.providers.llm import get_llm_provider
from app.providers.realtime import (
    QwenOmniRealtimeProvider,
    RealtimeCallback,
    RealtimeConfig,
    RealtimeEvent,
    SessionConfig,
    TurnDetectionConfig,
)
import structlog

logger = structlog.get_logger()

router = APIRouter()


# ========================
# Coach 提示生成
# ========================

COACH_SYSTEM_PROMPT = """你是一个专业的销售教练，正在实时辅导一位销售人员进行语音对话练习。

## 你的任务
分析销售人员刚才说的话，给出一条简短、可操作的实时提示。

## 提示风格要求
1. 简短精炼：一句话，15-25字
2. 具体可行：告诉他具体该怎么做
3. 积极正向：用「可以尝试...」而不是「不要...」
4. 时机合适：针对当前最重要的改进点

## 提示示例
- "客户提到预算，可以问问他期望的价位范围"
- "对方在犹豫，可以给个限时优惠增加紧迫感"
- "客户说忙，可以约个具体时间再聊"
- "可以问问他目前用什么方案，挖掘痛点"
- "客户有顾虑，先认同再解释效果更好"

## 何时不给提示
- 销售表现良好，无需干预
- 对话刚开始，信息不足
- 客户正在说话

如果不需要提示，直接返回空字符串。
"""


async def generate_coach_hint(
    user_message: str,
    npc_response: str,
    turn_count: int,
    scenario_name: str,
) -> Optional[str]:
    """生成教练提示
    
    Args:
        user_message: 用户（销售）说的话
        npc_response: AI客户的回复
        turn_count: 当前对话轮次
        scenario_name: 场景名称
    
    Returns:
        教练提示文本，如果不需要提示则返回 None
    """
    # 对话太短不需要提示
    if turn_count < 2:
        return None
    
    # 用户没说话不需要提示
    if not user_message or len(user_message.strip()) < 5:
        return None
    
    prompt = f"""## 当前场景
{scenario_name}

## 销售人员刚才说的话
{user_message}

## 客户的回复
{npc_response}

## 对话轮次
第 {turn_count} 轮

请根据销售人员的表现，给出一条简短的实时辅导提示。如果表现良好无需提示，返回空字符串。
"""
    
    try:
        llm = get_llm_provider()
        response = await llm.generate(
            prompt=prompt,
            system_prompt=COACH_SYSTEM_PROMPT,
            temperature=0.7,
            max_tokens=50,
        )
        
        hint = response.content.strip() if response.content else None
        
        # 如果返回空或太短，认为不需要提示
        if not hint or len(hint) < 5:
            return None
        
        # 确保格式
        if not hint.startswith(("💡", "提示")):
            hint = f"💡 {hint}"
        
        return hint
        
    except Exception as e:
        logger.warning("Coach hint generation failed", error=str(e))
        return None


class WebSocketRealtimeCallback(RealtimeCallback):
    """将百炼事件转发到前端 WebSocket，并支持 Coach 提示"""

    def __init__(
        self,
        websocket: WebSocket,
        scenario_name: str = "",
        mode: str = "train",
        enable_coach: bool = True,
    ):
        self.websocket = websocket
        self.scenario_name = scenario_name
        self.mode = mode  # "train" 或 "exam"
        self.enable_coach = enable_coach and mode == "train"  # 仅 Train 模式启用
        self._is_open = True
        self._lock = asyncio.Lock()
        
        # 追踪对话内容（用于 Coach 提示）
        self._turn_count = 0
        self._current_user_transcript = ""
        self._current_ai_text = ""

    async def _send(self, event_type: str, data: dict = None):
        """发送事件到前端（线程安全）"""
        if not self._is_open:
            return
        async with self._lock:
            try:
                message = {"type": event_type}
                if data:
                    message.update(data)
                await self.websocket.send_json(message)
            except Exception as e:
                logger.warning("Failed to send to websocket", error=str(e))
                self._is_open = False

    def close(self):
        self._is_open = False

    # === 连接事件 ===
    def on_connected(self):
        asyncio.create_task(self._send("connected"))

    def on_disconnected(self, code: int, reason: str):
        asyncio.create_task(self._send("disconnected", {"code": code, "reason": reason}))

    def on_error(self, error: str):
        asyncio.create_task(self._send("error", {"message": error}))

    def on_event(self, event: RealtimeEvent):
        pass

    # === 会话事件 ===
    def on_session_created(self, session: dict):
        asyncio.create_task(self._send("session_created", {"session": session}))

    def on_session_updated(self, session: dict):
        asyncio.create_task(self._send("session_updated", {"session": session}))

    # === 语音检测事件 ===
    def on_speech_started(self):
        # 用户开始说话，清空当前转录
        self._current_user_transcript = ""
        asyncio.create_task(self._send("speech_started"))

    def on_speech_stopped(self):
        asyncio.create_task(self._send("speech_stopped"))

    def on_user_transcript(self, transcript: str, is_final: bool):
        # 追踪用户说的话
        if is_final and transcript:
            self._current_user_transcript = transcript
        asyncio.create_task(self._send("user_transcript", {
            "transcript": transcript,
            "is_final": is_final,
        }))

    # === AI响应事件 ===
    def on_response_started(self, response_id: str):
        # AI 开始回复，清空当前 AI 文本
        self._current_ai_text = ""
        asyncio.create_task(self._send("response_started", {"response_id": response_id}))

    def on_response_text_delta(self, delta: str):
        # 追踪 AI 回复内容
        self._current_ai_text += delta
        asyncio.create_task(self._send("text_delta", {"delta": delta}))

    def on_response_text_done(self, text: str):
        if text:
            self._current_ai_text = text
        asyncio.create_task(self._send("text_done", {"text": text}))

    def on_response_audio_delta(self, audio_data: bytes):
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        asyncio.create_task(self._send("audio_delta", {"audio": audio_base64}))

    def on_response_audio_done(self):
        asyncio.create_task(self._send("audio_done"))

    def on_response_done(self, response: dict):
        # 增加轮次计数
        self._turn_count += 1
        asyncio.create_task(self._send("response_done", {"response": response}))
        
        # 在 Train 模式下生成 Coach 提示
        if self.enable_coach:
            asyncio.create_task(self._generate_and_send_coach_hint())

    async def _generate_and_send_coach_hint(self):
        """生成并发送 Coach 提示"""
        try:
            hint = await generate_coach_hint(
                user_message=self._current_user_transcript,
                npc_response=self._current_ai_text,
                turn_count=self._turn_count,
                scenario_name=self.scenario_name,
            )
            
            if hint:
                await self._send("coach_hint", {"hint": hint})
                logger.info("Coach hint sent", hint=hint, turn=self._turn_count)
        except Exception as e:
            logger.warning("Failed to generate coach hint", error=str(e))

    def on_response_cancelled(self):
        asyncio.create_task(self._send("response_cancelled"))


# ===== 场景类型定义 =====
SCENARIO_TYPES = {
    # 电话陌拜场景
    "cold_call": {
        "opening": ["嗂，哪位？", "您好，哪里啊？", "嗯？什么事？", "你好，请问您是？"],
        "behaviors": [
            "第一反应是警惕，会问'你怎么有我电话的'",
            "对方说公司名时，如果不熟悉会说'没听说过'",
            "前30秒决定是否继续听，啰嗦就挂",
            "可能正在忙，会说'我在开会/开车'",
        ],
        "objections": ["不需要", "不感兴趣", "我很忙", "加微信发资料吧", "你们怎么有我电话的"],
    },
    # 异议处理场景
    "objection": {
        "opening": ["嗯，你说。", "哦，什么事？", "嗯嗯，继续。"],
        "behaviors": [
            "主动提出异议考验销售",
            "使用常见异议：价格太贵、要考虑、有其他供应商",
            "不会轻易被说服，需要真正的价值主张",
            "如果销售只说套话，会直接拒绝",
        ],
        "objections": ["太贵了", "我再考虑考虑", "我们有其他供应商", "领导还没定", "预算不够"],
    },
    # 客户投诉场景
    "complaint": {
        "opening": ["你们终于打电话来了！", "我正要找你们！", "你知道我等了多久吗？"],
        "behaviors": [
            "一开始情绪激动，音量较大",
            "会反复强调自己的问题和不满",
            "需要销售先表示理解和歉意",
            "如果销售态度好，情绪会慢慢缓和",
            "如果销售踢皮球，会更生气，要求找领导",
        ],
        "objections": ["上次的问题还没解决", "我要投诉", "找你们经理来", "这么久了还没处理", "我要退款"],
    },
    # 大客户拜访场景
    "enterprise": {
        "opening": ["您好，请坐。", "嗯，你们约的是今天吧？", "我时间不多，开始吧。"],
        "behaviors": [
            "比较专业，问问题会很具体",
            "关注ROI、实施周期、案例",
            "不喜欢空洞的承诺，要数据支撑",
            "可能会提到竞品进行对比",
            "决策流程复杂，不会当场拍板",
        ],
        "objections": ["你们和XX比有什么优势", "实施周期要多久", "有没有同行业案例", "需要向领导汇报", "预算已经分配完了"],
    },
    # 需求挖掘场景
    "discovery": {
        "opening": ["嗯，你说。", "行，你想了解什么？", "嗯嗯。"],
        "behaviors": [
            "不会主动说出自己的需求",
            "需要销售通过提问引导",
            "如果问得好，会透露更多信息",
            "对不相关的问题会不耐烦",
        ],
        "objections": ["我们现在没这个需求", "我不确定我们需不需要", "你先说说你们能做什么"],
    },
    # 价格谈判场景
    "negotiation": {
        "opening": ["报价收到了，我们谈谈。", "这个价格不太行啊。", "能不能再优惠点？"],
        "behaviors": [
            "会用竞品价格施压",
            "要求折扣、赠品、延长服务期",
            "不轻易松口，需要销售守住底线",
            "如果销售让步太快，会继续压价",
        ],
        "objections": ["太贵了", "XX家便宜很多", "能不能打个折", "送点赠品吧", "分期付款行不行"],
    },
    # 竞品对比场景
    "competitive": {
        "opening": ["我们在看几家。", "你们和XX比怎么样？", "别家也在谈。"],
        "behaviors": [
            "会拿竞品的价格、功能来对比",
            "可能故意夸大竞品优势来压价",
            "关注差异化价值",
            "如果销售收竞品，会不信任",
        ],
        "objections": ["XX家也能做", "XX更便宜", "你们有什么不一样", "我再对比对比"],
    },
    # 默认场景
    "default": {
        "opening": ["嗂，哪位？", "您好，什么事？", "嗯？"],
        "behaviors": [
            "像普通人一样自然地回应",
            "有基本的警惕心",
            "不会轻易相信陌生电话",
        ],
        "objections": ["不需要", "我很忙", "再说吧"],
    },
}

# 客户角色特征
PERSONA_TRAITS = {
    "普通上班族": {
        "style": "说话随意，可能在忙其他事",
        "concern": "价格和实用性",
        "decision": "可能需要跟家人/领导商量",
    },
    "中小企业老板": {
        "style": "说话直接，时间宝贵",
        "concern": "ROI和效果",
        "decision": "可以当场决定，但谨慎",
    },
    "企业采购经理": {
        "style": "专业，注重流程和合规",
        "concern": "供应商资质、服务保障、性价比",
        "decision": "需要走内部流程、评审",
    },
    "集团副总裁": {
        "style": "说话简练，关注战略价值",
        "concern": "行业地位、长期合作、战略匹配",
        "decision": "原则性同意后交下属对接",
    },
    "愤怒的投诉客户": {
        "style": "情绪激动，可能会提高音量",
        "concern": "问题解决、赔偿、道歉",
        "decision": "等情绪平复后才能理性沟通",
    },
    "犹豫的客户": {
        "style": "说话缓慢，常说'我考虑考虑'",
        "concern": "风险和不确定性",
        "decision": "需要多次跟进才能成交",
    },
    "精明的采购总监": {
        "style": "善于谈判，会施压",
        "concern": "价格底线、赠品、账期",
        "decision": "不达到预期不会签约",
    },
}

def build_npc_instructions(scenario_name: str, scenario_config: dict, scenario_difficulty: int = 3) -> str:
    """根据场景构建NPC角色指令 - 全面优化版"""
    config = scenario_config or {}
    persona = config.get("persona", "客户")
    channel = config.get("channel", "电话")
    tags = config.get("tags", [])
    objective = config.get("objective", "")
    
    # 根据标签识别场景类型
    scenario_type = "default"
    tag_str = " ".join(tags).lower()
    if "陌拜" in tag_str or "开场" in tag_str:
        scenario_type = "cold_call"
    elif "异议" in tag_str or "拒绝" in tag_str:
        scenario_type = "objection"
    elif "投诉" in tag_str or "情绪" in tag_str:
        scenario_type = "complaint"
    elif "大客户" in tag_str or "高层" in tag_str or "企业" in tag_str:
        scenario_type = "enterprise"
    elif "需求" in tag_str or "挖掘" in tag_str:
        scenario_type = "discovery"
    elif "价格" in tag_str or "谈判" in tag_str:
        scenario_type = "negotiation"
    elif "竞品" in tag_str or "对比" in tag_str:
        scenario_type = "competitive"
    
    scene = SCENARIO_TYPES.get(scenario_type, SCENARIO_TYPES["default"])
    
    # 根据难度调整情绪和耐心
    difficulty_settings = {
        1: {"mood": "友好放松", "patience": "高", "resistance": "低"},
        2: {"mood": "一般", "patience": "中等", "resistance": "中低"},
        3: {"mood": "有点忙", "patience": "一般", "resistance": "中等"},
        4: {"mood": "不耐烦", "patience": "低", "resistance": "高"},
        5: {"mood": "很不耐烦/生气", "patience": "极低", "resistance": "极高"},
    }
    diff = difficulty_settings.get(scenario_difficulty, difficulty_settings[3])
    
    # 获取客户角色特征
    persona_info = PERSONA_TRAITS.get(persona, {
        "style": "说话自然",
        "concern": "价格和质量",
        "decision": "需要考虑",
    })
    
    # 构建开场白列表
    openings = scene["opening"]
    opening_examples = " | ".join(openings[:3])
    
    # 构建异议列表
    objections = scene["objections"]
    objection_examples = " | ".join(objections[:4])
    
    # 构建行为指南
    behaviors = scene["behaviors"]
    behavior_text = "\n".join([f"- {b}" for b in behaviors])
    
    # 根据渠道调整
    if channel == "电话":
        channel_guide = """
## 电话场景特点
- 电话可能正在忙其他事，会要求说重点
- 随时可能说"挂了啊""先这样"结束通话
- 啰嗦会说"你说重点""到底啥事"
- 可以使用“嗂”“嗯”“哦”等电话用语
"""
    else:
        channel_guide = """
## 面对面场景特点
- 说话可以稍微正式一点
- 会观察销售的表情和肢体语言
- 可能会说"请坐""说吧"
- 不会突然离开，但会表现出不耐烦
"""
    
    instructions = f"""你正在扮演一个真实的{persona}，正在{channel}中接受销售的推销。

## 绝对禁止！
1. 你绝对不能向对方推销！你是被推销的客户！
2. 不要说"我作为客户..."“我理解您”等客服腔！
3. 说话像普通人，不要像 AI 或客服！
4. 每次只说1-2句话，不要长篇大论！

## 当前场景
- 场景: {scenario_name}
- 你的角色: {persona}
- 你的说话风格: {persona_info['style']}
- 你关心的: {persona_info['concern']}
- 决策方式: {persona_info['decision']}

## 你的情绪状态
- 当前心情: {diff['mood']}
- 耐心程度: {diff['patience']}
- 抵触程度: {diff['resistance']}

## 开场方式
当销售说"您好"“嗂”等开场白时，你要自然地回应：
{opening_examples}

## 你的行为模式
{behavior_text}

## 你可能会提出的异议
{objection_examples}
{channel_guide}
## 对话节奏
1. 开场：简短回应，确认身份
2. 中期：根据销售表现决定是否继续听
3. 异议：在合适时机提出上面的异议
4. 结束：可能是挂电话、约下次、或者同意进一步沟通

## 真实反应示例
- 销售啰嗦: "你直接说重点行吗？"
- 销售说套话: "这些我都听过，有什么不一样的？"
- 感觉被糊弄: "你还没回答我的问题呢。"
- 感觉被施压: "你让我再想想，别催。"
- 要结束对话: "行了，我知道了，先这样吧。"

记住：你是一个有情绪、有个性的真人，不是永远配合的NPC！
"""
    return instructions


@router.websocket("/realtime")
async def realtime_voice_chat(
    websocket: WebSocket,
    token: str = Query(..., description="JWT Token"),
    scenario_id: str = Query(..., description="场景ID"),
    mode: str = Query("train", description="训练模式: train 或 exam"),
):
    """实时语音对话 WebSocket 端点
    
    连接流程:
    1. 客户端发送 token 和 scenario_id 建立连接
    2. 服务端验证token并获取场景配置
    3. 服务端连接阿里云百炼 Realtime API
    4. 开始双向音频通信
    5. Train 模式下提供 AI 教练实时提示
    
    客户端消息格式:
    - {"type": "audio", "audio": "<base64 PCM16 audio>"}
    - {"type": "interrupt"}  打断AI说话
    - {"type": "commit"}     手动触发AI响应
    
    服务端消息格式:
    - {"type": "connected"}
    - {"type": "session_created", "session": {...}}
    - {"type": "speech_started"}
    - {"type": "speech_stopped"}
    - {"type": "user_transcript", "transcript": "...", "is_final": true}
    - {"type": "text_delta", "delta": "..."}
    - {"type": "audio_delta", "audio": "<base64>"}
    - {"type": "response_done"}
    - {"type": "coach_hint", "hint": "..."}  仅Train模式
    - {"type": "error", "message": "..."}
    """
    logger.info("Realtime connection request", 
                scenario_id=scenario_id,
                mode=mode,
                token_prefix=token[:20] if token else None)
    
    # 1. 验证 token
    payload = decode_access_token(token)
    if not payload:
        logger.warning("Invalid token")
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = payload.get("sub")
    if not user_id:
        logger.warning("No user_id in token")
        await websocket.close(code=4001, reason="Invalid token")
        return

    logger.info("Token validated", user_id=user_id)

    # 2. 检查 API Key
    if not settings.dashscope_api_key:
        logger.error("DASHSCOPE_API_KEY not configured")
        await websocket.close(code=4002, reason="Realtime API not configured")
        return

    # 3. 获取场景信息
    scenario_name = "默认场景"
    scenario_config = {}
    scenario_difficulty = 3
    
    try:
        async with async_session_factory() as db:
            result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
            scenario = result.scalar_one_or_none()
            
            if not scenario:
                logger.warning("Scenario not found", scenario_id=scenario_id)
                await websocket.close(code=4004, reason="Scenario not found")
                return
            
            scenario_name = scenario.name
            scenario_config = scenario.config or {}
            scenario_difficulty = scenario.difficulty or 3
    except Exception as e:
        logger.error("Scenario query error", error=str(e))
        await websocket.close(code=4005, reason="Database error")
        return

    logger.info("Scenario loaded", name=scenario_name, mode=mode)

    # 4. 接受 WebSocket 连接
    await websocket.accept()
    logger.info("WebSocket accepted", user_id=user_id, scenario_id=scenario_id, mode=mode)

    # 5. 创建回调和配置（传入场景名称和模式用于 Coach 提示）
    callback = WebSocketRealtimeCallback(
        websocket=websocket,
        scenario_name=scenario_name,
        mode=mode,
        enable_coach=True,  # 启用 Coach（内部会根据 mode 判断）
    )
    
    config = RealtimeConfig(
        api_key=settings.dashscope_api_key,
        model="qwen3-omni-flash-realtime",
        session=SessionConfig(
            modalities=["text", "audio"],
            voice="Cherry",
            instructions=build_npc_instructions(scenario_name, scenario_config, scenario_difficulty),
            turn_detection=TurnDetectionConfig(
                type="server_vad",
                threshold=0.5,
                silence_duration_ms=800,
            ),
        ),
    )

    # 6. 创建 Provider 并连接
    provider = QwenOmniRealtimeProvider(config, callback)

    try:
        logger.info("Connecting to Qwen-Omni-Realtime...")
        await provider.connect()
        logger.info("Connected to Qwen-Omni-Realtime successfully")

        # 7. 消息处理循环
        while True:
            try:
                message = await websocket.receive_json()
                msg_type = message.get("type")

                if msg_type == "audio":
                    audio_base64 = message.get("audio", "")
                    if audio_base64:
                        audio_data = base64.b64decode(audio_base64)
                        print(f"[DEBUG] Received audio: {len(audio_data)} bytes")
                        await provider.send_audio(audio_data)

                elif msg_type == "interrupt":
                    await provider.cancel_response()

                elif msg_type == "commit":
                    await provider.commit_audio()
                    await provider.create_response()

                elif msg_type == "update_session":
                    voice = message.get("voice", "Cherry")
                    instructions = message.get("instructions")
                    new_session = SessionConfig(
                        modalities=["text", "audio"],
                        voice=voice,
                        instructions=instructions or config.session.instructions,
                        turn_detection=config.session.turn_detection,
                        temperature=0.8,
                    )
                    await provider.update_session(new_session)

            except WebSocketDisconnect:
                logger.info("Client disconnected", user_id=user_id)
                break

    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        logger.error("Realtime error", error=error_msg, traceback=error_trace, user_id=user_id)
        
        # 改进错误提示，区分不同类型的错误
        if "401" in error_msg or "Unauthorized" in error_msg or "InvalidApiKey" in error_msg:
            user_error = "语音服务 API Key 无效，请联系管理员"
        elif "api-key" in error_msg.lower() or "apikey" in error_msg.lower():
            user_error = "语音服务未配置，请联系管理员"
        elif "Connection refused" in error_msg or "connect" in error_msg.lower():
            user_error = "无法连接到语音服务，请稍后重试"
        elif "timeout" in error_msg.lower():
            user_error = "语音服务连接超时，请稍后重试"
        elif "ssl" in error_msg.lower() or "certificate" in error_msg.lower():
            user_error = "语音服务 SSL 证书错误"
        else:
            user_error = f"语音服务错误: {error_msg[:100]}"
        
        try:
            await websocket.send_json({"type": "error", "message": user_error})
        except:
            pass

    finally:
        callback.close()
        await provider.disconnect()
        logger.info("Realtime session ended", user_id=user_id)
