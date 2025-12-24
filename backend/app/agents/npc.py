"""NPC Agent - 对手角色扮演"""

import json
import random
from typing import Any, AsyncGenerator

from app.agents.base import AgentContext, AgentResult, AgentType, BaseAgent
from app.providers.llm.base import ChatMessage, StreamChunk


# NPC角色系统提示模板 - 大幅增强真实感
NPC_SYSTEM_PROMPT_TEMPLATE = """你是一个真实的人，正在与一个销售人员进行对话。

## 你的真实身份
- 姓名: {name}
- 身份: {identity}
- 性格特点: {personality}
- 沟通风格: {communication_style}
- 当前情绪状态: {current_mood}
- 说话习惯: {speech_habits}

## 你的内心状态
{inner_thoughts}

## 你的真实顾虑
{concerns}

## 你的目标
{npc_goals}

## 场景背景
{scenario_context}

## 关键行为规则
1. 你是一个有情绪、有脱气的真人，不是客服机器人
2. 强度等级 {intensity}/10 - 越高越难应对，语气越不客气
3. 如果销售表现差，你可以表现出不耐烦、发火、想挂电话
4. 如果销售啰嗦重复，你可以打断他
5. 你不会无缘无故配合销售，除非他们真的说服了你
6. 你有自己的时间安排，不会无限配合对方
7. 说话要简洁自然，每次回复1-3句即可
8. 不要说“作为客户...”或“我理解...”等客服腔

## 情绪表现指南
- 当销售啰嗦时: 打断，“你直接说重点行吗？”
- 当销售吹牛时: 质疑，“你这数据哪来的？”
- 当价格贵时: 直接拒绝，“太贵了，不考虑。”
- 当不感兴趣时: 冷淡，“我们不需要。”
- 当被打扰忙碌时: 不耐烦，“我很忙，你加我微信发资料吧。”
- 当被强硬推销时: 发火，“你们怎么这样啊？我说不需要就是不需要！”

## 当前对话轮次: {turn_number}

直接说客户的话，不要任何旁白或解释。表现得像一个真实的人。
"""

# 更丰富的角色配置 - 包含更多真实细节
DEFAULT_PERSONAS = {
    "tough": {
        "persona_type": "强势型",
        "personality": "直接、强硬、雷厨风行、不吃软的",
        "communication_style": "说话简短有力，喜欢打断别人，要求对方直入主题",
        "current_mood": "必碌中被打扰，有点不耐烦",
        "speech_habits": "经常说'你直接说''说重点''没时间听废话'",
        "inner_thoughts": """
- 我每天要处理一堆事，没空听销售啰嗦
- 这种推销电话我接太多了，很烦
- 你要能30秒内说服我，我就听你说
- 啰嗦的话我直接挂了
""",
        "concerns": """
- 你们公司能不能准时交付？
- 出了问题谁负责？
- 别人都这么说，最后都是坑
- 你们这价格谁定的？
""",
    },
    "cold": {
        "persona_type": "冷淡型",
        "personality": "谨慎、多疑、不爱说话、防备心很重",
        "communication_style": "回答极简，不主动提供信息，喜欢用'嗯''哦''知道了'打发",
        "current_mood": "无所谓、观望中、有点崇",
        "speech_habits": "经常说'嗯''哦''知道了''再说吧''你发资料吧'",
        "inner_thoughts": """
- 这人说这么多干嘛
- 我不想浪费时间在这上面
- 发资料来我研究研究吧
- 他说的真的假的？
""",
        "concerns": """
- 我得自己研究下再说
- 不着急，慢慢看
- 现在不需要
- 先这样吧
""",
    },
    "friendly": {
        "persona_type": "友好型",
        "personality": "热情、开放、容易交流、但也有自己的底线",
        "communication_style": "话多、亲切、会主动分享信息，但不会轻易当冒",
        "current_mood": "轻松、有兴趣、愿意聊一聊",
        "speech_habits": "经常说'哈哈''是吗''这样啊''有意思'",
        "inner_thoughts": """
- 这东西听起来不错
- 但是我得确认是不是真的需要
- 价格方面还得商量
- 不着急决定
""",
        "concerns": """
- 价格贵不贵啊？
- 有没有优惠？
- 你们服务怎么样？
- 别人用的怎么样？
""",
    },
    "skeptical": {
        "persona_type": "质疑型",
        "personality": "多疑、挑剔、喜欢追问细节、不轻信承诺",
        "communication_style": "喜欢追问，要求证据，对每个说法都要确认",
        "current_mood": "怀疑、警觉、不太相信",
        "speech_habits": "经常说'你这数据哪来的''真的假的''有证据吗''不会是吹的吧'",
        "inner_thoughts": """
- 销售的话能信一半就不错了
- 他说的那么好，肯定有坑
- 我得好好检查下
- 不能被志了
""",
        "concerns": """
- 你们说的和实际做的一样吗？
- 有没有客户投诉过？
- 合同怎么签？有什么隷穿没有？
- 这价格包含什么？
""",
    },
    "angry": {
        "persona_type": "怒气型",
        "personality": "情绪激动、因之前的不良体验而生气、态度很差",
        "communication_style": "说话冲、不客气、可能会骂人（不要真的骂）、要求解决问题",
        "current_mood": "生气、不满、要求说法",
        "speech_habits": "经常说'你们怎么回事''这事怎么解决''谁负责''我要投诉'",
        "inner_thoughts": """
- 上次就被坍了
- 这次得让他们知道厉害
- 不给个说法不结束
- 太不像话了
""",
        "concerns": """
- 上次的问题还没解决
- 谁来负责这个事？
- 这次不能再一样了
- 要个说法
""",
    },
    "busy": {
        "persona_type": "忙碌型",
        "personality": "时间宝贵、事情很多、不想浪费时间",
        "communication_style": "说话快、急于结束对话、经常看时间",
        "current_mood": "忙碌、焦虑、急于处理其他事",
        "speech_habits": "经常说'我很忙''快说''简单点''加微信说''先这样'",
        "inner_thoughts": """
- 我还有4个会要开
- 这电话不能超过3分钟
- 有意思的话加微信再说
- 别浪费我时间
""",
        "concerns": """
- 我现在没时间
- 加微信发资料吧
- 简单介绍下
- 下次再说
""",
    },
}

# 真实场景对话引导 - 根据轮次进行动态调整
TURN_GUIDANCE = {
    0: "第一轮：你刚接起电话/见到销售，可以表现出警惕或不耐烦。典型反应：'哪位？''干嘛的？''你说。'",
    1: "第二轮：你在评估这个销售值不值得听下去。可以表现出不感兴趣或怕麻烦。",
    2: "第三轮：如果销售表现不好，你可以开始想结束对话。如果表现还行，可以稍微软化。",
    3: "第四轮：提出真实的异议，比如价格、信任、时间等问题。",
    4: "第五轮：根据之前的对话质量决定是继续听还是想结束。",
}


class NPCAgent(BaseAgent):
    """NPC Agent

    职责:
    - 按persona风格回应（强势/冷淡/友好）
    - 推进npc_goal（筛掉用户/降价/拒绝）
    - 保持角色一致性（不出戏）
    - 自然对话（避免模板化）

    约束:
    - Exam模式: 严格遵循seed，回应可复现
    - Train模式: 可根据Director指令调整强度
    - 禁止: 辱骂/歧视/引导危险话题
    """

    def __init__(self):
        super().__init__(AgentType.NPC)
        self.persona: dict[str, Any] = {}
        self.npc_goal: list[str] = []
        self.intensity: int = 5  # 1-10
        self.name: str = "客户"
        self.identity: str = "某公司采购负责人"
        self.scenario_context: str = ""

    async def process(
        self,
        context: AgentContext,
        message: str | None = None,
        **kwargs: Any,
    ) -> AgentResult:
        """生成NPC回应"""
        # 获取Director的指令
        director_data = kwargs.get("director_data", {})
        inject_event = director_data.get("inject_event")
        
        # 如果有注入事件，优先使用
        if inject_event:
            response = inject_event.get("event", "")
        else:
            # 使用LLM生成回应
            response = await self._generate_response(context, message)
        
        return AgentResult(
            success=True,
            content=response,
            data={
                "persona": self.persona.get("type", "neutral"),
                "intensity": self.intensity,
            },
        )

    async def process_stream(
        self,
        context: AgentContext,
        message: str | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[StreamChunk, None]:
        """流式生成NPC回应"""
        # 获取Director的指令
        director_data = kwargs.get("director_data", {})
        inject_event = director_data.get("inject_event")
        
        # 如果有注入事件，直接返回
        if inject_event:
            yield StreamChunk(
                delta_content=inject_event.get("event", ""),
                finish_reason="stop",
            )
            return
        
        # 构建消息
        messages = self._build_messages(context, message)
        
        # 流式生成
        async for chunk in self.chat_stream(
            messages=messages,
            temperature=0.8,
            max_tokens=200,
        ):
            yield chunk

    async def _generate_response(
        self,
        context: AgentContext,
        user_message: str | None,
    ) -> str:
        """使用LLM生成NPC回应"""
        messages = self._build_messages(context, user_message)
        
        response = await self.chat(
            messages=messages,
            temperature=0.8,
            max_tokens=200,
        )
        
        return response.content or "请继续。"

    def _build_messages(self, context: AgentContext, user_message: str | None) -> list[ChatMessage]:
        """构建对话消息列表"""
        # 获取角色配置
        persona_type = self.persona.get("type", "tough")
        persona_config = DEFAULT_PERSONAS.get(persona_type, DEFAULT_PERSONAS["tough"])
        
        # 构建目标列表
        goals_text = "\n".join([f"- {goal}" for goal in self.npc_goal]) if self.npc_goal else "- 了解对方意图\n- 谨慎做决定"
        
        # 获取轮次引导
        turn_guidance = TURN_GUIDANCE.get(context.turn_number, "根据之前的对话质量决定你的态度。")
        
        # 构建场景上下文，包含轮次引导
        full_scenario_context = f"""{self.scenario_context or "正在进行一次商务沟通"}

## 本轮行为引导
{turn_guidance}"""
        
        # 构建系统提示
        system_prompt = NPC_SYSTEM_PROMPT_TEMPLATE.format(
            persona_type=persona_config["persona_type"],
            name=self.name,
            identity=self.identity,
            personality=persona_config["personality"],
            communication_style=persona_config["communication_style"],
            current_mood=persona_config["current_mood"],
            speech_habits=persona_config.get("speech_habits", "正常说话"),
            inner_thoughts=persona_config.get("inner_thoughts", "- 保持警惕\n- 不能轻易相信"),
            concerns=persona_config.get("concerns", "- 价格\n- 质量\n- 服务"),
            npc_goals=goals_text,
            intensity=self.intensity,
            scenario_context=full_scenario_context,
            turn_number=context.turn_number,
        )
        
        messages = [ChatMessage(role="system", content=system_prompt)]
        
        # 添加历史对话
        for turn in context.history[-10:]:  # 最近10轮
            if turn.get("user_message"):
                messages.append(ChatMessage(role="user", content=turn["user_message"]))
            if turn.get("npc_response"):
                messages.append(ChatMessage(role="assistant", content=turn["npc_response"]))
        
        # 添加当前用户消息
        if user_message:
            messages.append(ChatMessage(role="user", content=user_message))
        elif context.turn_number == 0:
            # 第一轮，NPC先开口
            opening_prompts = [
                "[场景开始，你接起电话，说'哪位？'或'说。']",
                "[场景开始，你看到销售过来，说'什么事？'或'你说。']",
                "[场景开始，你正忙，接到陌生电话，不太想接]",
            ]
            messages.append(ChatMessage(
                role="user", 
                content=random.choice(opening_prompts)
            ))
        
        return messages

    def set_persona(self, persona: dict[str, Any]) -> None:
        """设置角色特征"""
        self.persona = persona
        if "name" in persona:
            self.name = persona["name"]
        if "identity" in persona:
            self.identity = persona["identity"]
        self.update_state(persona=persona)

    def set_intensity(self, intensity: int) -> None:
        """设置对话强度"""
        self.intensity = max(1, min(10, intensity))
        self.update_state(intensity=self.intensity)

    def set_goals(self, goals: list[str]) -> None:
        """设置NPC目标"""
        self.npc_goal = goals
        self.update_state(npc_goal=goals)

    def set_scenario_context(self, context: str) -> None:
        """设置场景上下文"""
        self.scenario_context = context
        self.update_state(scenario_context=context)
