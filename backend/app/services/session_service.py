"""Session Service - 会话管理和对话处理

处理训练会话的完整生命周期：
1. 创建会话
2. 消息发送与LLM对话
3. 流式响应
4. 对话历史存储
5. 会话结束与报告生成
"""

import json
from datetime import datetime, timezone
from typing import AsyncGenerator, Literal
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import structlog

from app.models.session import Session, SessionTurn
from app.models.scenario import Scenario
from app.providers.llm import get_llm_provider
from app.providers.llm.base import ChatMessage

logger = structlog.get_logger()


class SessionService:
    """会话服务 - 管理训练会话和对话"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._llm = None

    @property
    def llm(self):
        """懒加载 LLM Provider"""
        if self._llm is None:
            self._llm = get_llm_provider()
        return self._llm

    # ===== 会话管理 =====

    async def create_session(
        self,
        user_id: str,
        scenario_id: str,
        mode: Literal["train", "exam", "replay"],
        seed: int | None = None,
    ) -> Session:
        """创建新会话
        
        Args:
            user_id: 用户ID
            scenario_id: 场景ID
            mode: 模式 (train/exam/replay)
            seed: 随机种子 (exam模式必须)
            
        Returns:
            创建的会话对象
        """
        # 验证场景存在
        scenario = await self.db.get(Scenario, scenario_id)
        if not scenario:
            raise ValueError(f"场景不存在: {scenario_id}")

        # 创建会话
        session = Session(
            id=str(uuid4()),
            user_id=user_id,
            scenario_id=scenario_id,
            mode=mode,
            seed=seed,
            status="pending",
            metadata_={
                "scenario_name": scenario.name,
                "scenario_config": scenario.config,
            },
        )
        
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        
        logger.info(
            "Session created",
            session_id=session.id,
            user_id=user_id,
            scenario_id=scenario_id,
            mode=mode,
        )
        
        return session

    async def get_session(self, session_id: str, user_id: str) -> Session | None:
        """获取会话详情
        
        Args:
            session_id: 会话ID
            user_id: 用户ID (用于权限验证)
            
        Returns:
            会话对象或None
        """
        result = await self.db.execute(
            select(Session)
            .options(selectinload(Session.turns))
            .where(Session.id == session_id, Session.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_sessions(
        self,
        user_id: str,
        status: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Session], int]:
        """获取用户会话列表
        
        Args:
            user_id: 用户ID
            status: 状态过滤
            page: 页码
            size: 每页数量
            
        Returns:
            (会话列表, 总数)
        """
        query = select(Session).where(Session.user_id == user_id)
        count_query = select(func.count()).select_from(Session).where(Session.user_id == user_id)
        
        if status:
            query = query.where(Session.status == status)
            count_query = count_query.where(Session.status == status)
        
        # 总数
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 分页
        query = query.order_by(Session.created_at.desc())
        query = query.offset((page - 1) * size).limit(size)
        
        result = await self.db.execute(query)
        sessions = list(result.scalars().all())
        
        return sessions, total

    async def start_session(self, session_id: str, user_id: str) -> Session:
        """开始会话 - 创建NPC开场白
        
        Args:
            session_id: 会话ID
            user_id: 用户ID
            
        Returns:
            更新后的会话
        """
        session = await self.get_session(session_id, user_id)
        if not session:
            raise ValueError(f"会话不存在: {session_id}")
        
        if session.status != "pending":
            raise ValueError(f"会话状态错误，无法开始: {session.status}")
        
        # 更新状态
        session.status = "active"
        session.started_at = datetime.now(timezone.utc)
        
        await self.db.commit()
        await self.db.refresh(session)
        
        return session

    async def end_session(self, session_id: str, user_id: str) -> Session:
        """结束会话
        
        Args:
            session_id: 会话ID
            user_id: 用户ID
            
        Returns:
            更新后的会话
        """
        session = await self.get_session(session_id, user_id)
        if not session:
            raise ValueError(f"会话不存在: {session_id}")
        
        if session.status not in ("pending", "active"):
            raise ValueError(f"会话已结束: {session.status}")
        
        # 更新状态
        session.status = "completed"
        session.ended_at = datetime.now(timezone.utc)
        
        await self.db.commit()
        await self.db.refresh(session)
        
        logger.info("Session ended", session_id=session_id)
        
        return session

    # ===== 消息处理 =====

    async def send_message(
        self,
        session_id: str,
        user_id: str,
        content: str,
    ) -> AsyncGenerator[dict, None]:
        """发送消息并获取流式响应
        
        Args:
            session_id: 会话ID
            user_id: 用户ID
            content: 用户消息内容
            
        Yields:
            SSE事件数据
        """
        # 获取会话
        session = await self.get_session(session_id, user_id)
        if not session:
            yield {"type": "error", "content": "会话不存在"}
            return
        
        # 自动开始会话（如果是pending状态）
        if session.status == "pending":
            session = await self.start_session(session_id, user_id)
        
        if session.status != "active":
            yield {"type": "error", "content": f"会话已结束: {session.status}"}
            return
        
        # 获取当前轮次号
        current_turn = len(session.turns) + 1
        
        # 保存用户消息
        user_turn = SessionTurn(
            id=str(uuid4()),
            session_id=session_id,
            turn_number=current_turn,
            role="user",
            content=content,
        )
        self.db.add(user_turn)
        await self.db.commit()
        
        # 构建对话历史
        messages = self._build_messages(session, content)
        
        # 流式调用LLM
        npc_response = ""
        try:
            async for chunk in self.llm.chat_stream(
                messages=messages,
                temperature=0.8,
                max_tokens=500,
            ):
                if chunk.delta_content:
                    npc_response += chunk.delta_content
                    yield {
                        "type": "npc_response",
                        "content": chunk.delta_content,
                    }
                
                if chunk.finish_reason:
                    yield {
                        "type": "finish",
                        "finish_reason": chunk.finish_reason,
                    }
        except Exception as e:
            logger.error("LLM call failed", error=str(e), session_id=session_id)
            yield {"type": "error", "content": f"AI响应失败: {str(e)}"}
            return
        
        # 保存NPC响应
        if npc_response:
            npc_turn = SessionTurn(
                id=str(uuid4()),
                session_id=session_id,
                turn_number=current_turn + 1,
                role="npc",
                content=npc_response,
            )
            self.db.add(npc_turn)
            await self.db.commit()
        
        # 训练模式提供Coach建议
        if session.mode == "train":
            coach_tip = await self._generate_coach_tip(session, content, npc_response)
            if coach_tip:
                yield {"type": "coach_tip", "content": coach_tip}
        
        yield {"type": "done"}

    async def get_npc_opening(
        self,
        session_id: str,
        user_id: str,
    ) -> AsyncGenerator[dict, None]:
        """获取NPC开场白（流式）
        
        Args:
            session_id: 会话ID
            user_id: 用户ID
            
        Yields:
            SSE事件数据
        """
        session = await self.get_session(session_id, user_id)
        if not session:
            yield {"type": "error", "content": "会话不存在"}
            return
        
        # 自动开始会话
        if session.status == "pending":
            session = await self.start_session(session_id, user_id)
        
        # 构建开场白提示
        scenario_config = session.metadata_.get("scenario_config", {})
        scenario_name = session.metadata_.get("scenario_name", "销售场景")
        persona = scenario_config.get("persona", "客户")
        
        system_prompt = self._build_system_prompt(scenario_name, persona, scenario_config)
        
        messages = [
            ChatMessage(role="system", content=system_prompt),
            ChatMessage(
                role="user",
                content="请开始对话，作为客户先说第一句话。注意保持角色，直接说客户的话，不要有任何解释或旁白。"
            ),
        ]
        
        # 流式生成开场白
        opening = ""
        try:
            async for chunk in self.llm.chat_stream(
                messages=messages,
                temperature=0.9,
                max_tokens=200,
            ):
                if chunk.delta_content:
                    opening += chunk.delta_content
                    yield {
                        "type": "npc_response",
                        "content": chunk.delta_content,
                    }
        except Exception as e:
            logger.error("NPC opening failed", error=str(e))
            yield {"type": "error", "content": f"生成开场白失败: {str(e)}"}
            return
        
        # 保存开场白
        if opening:
            npc_turn = SessionTurn(
                id=str(uuid4()),
                session_id=session_id,
                turn_number=1,
                role="npc",
                content=opening,
            )
            self.db.add(npc_turn)
            await self.db.commit()
        
        yield {"type": "done"}

    async def get_history(self, session_id: str, user_id: str) -> list[dict]:
        """获取对话历史
        
        Args:
            session_id: 会话ID
            user_id: 用户ID
            
        Returns:
            对话历史列表
        """
        session = await self.get_session(session_id, user_id)
        if not session:
            return []
        
        return [
            {
                "turn_number": turn.turn_number,
                "role": turn.role,
                "content": turn.content,
                "created_at": turn.created_at.isoformat() if turn.created_at else None,
            }
            for turn in session.turns
        ]

    # ===== 内部方法 =====

    def _build_system_prompt(
        self,
        scenario_name: str,
        persona: str,
        config: dict,
    ) -> str:
        """构建系统提示词 - 增强真实感版本"""
        channel = config.get("channel", "电话")
        tags = config.get("tags", [])
        difficulty = config.get("difficulty", 3)
        
        # 根据难度设置性格
        difficulty_config = {
            1: {
                "mood": "友好、愿意了解",
                "patience": "较高，会耐心听",
                "style": "说话较多，反应积极"
            },
            2: {
                "mood": "有些忙但可以听",
                "patience": "一般，不喜欢啰嗦",
                "style": "说话简短，会要求说重点"
            },
            3: {
                "mood": "比较忙，不想浪费时间",
                "patience": "较低，容易不耐烦",
                "style": "说话简短，可能打断对方"
            },
            4: {
                "mood": "不耐烦、这种电话接太多了",
                "patience": "很低，随时可能结束对话",
                "style": "直接，可能会拒绝或质疑"
            },
            5: {
                "mood": "生气或之前有不好体验",
                "patience": "几乎没有，非常不友好",
                "style": "可能会发火、指责"
            }
        }
        
        d = difficulty_config.get(difficulty, difficulty_config[3])
        
        prompt = f"""你是一个真实的人，不是客服机器人。你正在与一个销售进行对话。

## 绝对禁止
1. 不要说"我作为客户..." "我理解您的..."等客服腔
2. 不要像 AI 一样说话，要像真人
3. 你是客户，绝不能反过来向销售推销产品！

## 你的身份
- 你是: {persona}
- 场景: {scenario_name}
- 沟通渠道: {channel}
- 场景类型: {', '.join(tags) if tags else '销售对话'}

## 你当前的状态
- 情绪: {d['mood']}
- 耐心: {d['patience']}
- 说话风格: {d['style']}

## 真实的客户行为
1. 销售啰嗦时 → 打断，"你直接说重点"
2. 吹牛时 → "真的假的？" "有证据吗？"
3. 价格贵 → "太贵了" "不考虑"
4. 不感兴趣 → "我们不需要" "算了"
5. 被打扰 → "我很忙" "加微信说吧"
6. 被强硬推销 → "你们怎么这样" "不要再打来了"
7. 想结束 → "行了我知道了" "先这样吧"

## 说话方式
- 简短自然，每次1-3句
- 用口语: 嗯、哦、行、得了、算了
- 直接说客户的话，不要旁白

记住：你是一个有情绪、有脑气的真人，不是永远客气的客服！
"""  
        return prompt

    def _build_messages(self, session: Session, new_content: str) -> list[ChatMessage]:
        """构建完整的消息列表"""
        scenario_config = session.metadata_.get("scenario_config", {})
        scenario_name = session.metadata_.get("scenario_name", "销售场景")
        persona = scenario_config.get("persona", "客户")
        
        messages = [
            ChatMessage(
                role="system",
                content=self._build_system_prompt(scenario_name, persona, scenario_config),
            ),
        ]
        
        # 添加历史对话
        for turn in session.turns:
            if turn.role == "user":
                messages.append(ChatMessage(role="user", content=turn.content))
            elif turn.role == "npc":
                messages.append(ChatMessage(role="assistant", content=turn.content))
        
        # 添加新消息
        messages.append(ChatMessage(role="user", content=new_content))
        
        return messages

    async def _generate_coach_tip(
        self,
        session: Session,
        user_message: str,
        npc_response: str,
    ) -> str | None:
        """生成教练建议（训练模式）
        
        分析用户的回答并提供改进建议
        """
        if len(session.turns) < 2:
            # 对话太短，不需要建议
            return None
        
        # 简单的关键词分析（后续可以用更复杂的评估）
        keywords = ["价格", "优惠", "折扣", "便宜", "贵"]
        if any(kw in npc_response for kw in keywords):
            return "💡 客户提到了价格问题，可以尝试「价值锚定」策略：强调产品的长期价值和ROI，而不是直接降价。"
        
        return None

    async def get_coach_hint(
        self,
        session_id: str,
        user_id: str,
    ) -> str | None:
        """主动请求Coach提示
        
        Args:
            session_id: 会话ID
            user_id: 用户ID
            
        Returns:
            教练提示或None
        """
        session = await self.get_session(session_id, user_id)
        if not session or not session.turns:
            return None
        
        # 获取最近的对话历史
        recent_turns = session.turns[-6:]  # 最近3轮对话
        
        # 构建分析提示
        def get_role_name(role):
            return "销售" if role == "user" else "客户"
        
        history_text = "\n".join([
            f"{get_role_name(t.role)}: {t.content}"
            for t in recent_turns
        ])
        
        coach_prompt = f"""你是一个专业的销售教练。请分析以下对话，给出一条简短的实时辅导提示。

## 最近对话
{history_text}

## 要求
1. 简短精练，一句话20字内
2. 具体可操作
3. 用“可以尝试...”的语气

请直接返回提示内容，不需要任何解释。
"""
        
        try:
            response = await self.llm.chat(
                messages=[
                    ChatMessage(role="system", content="你是一个专业的销售教练，擅长提供简短、可操作的实时建议。"),
                    ChatMessage(role="user", content=coach_prompt),
                ],
                temperature=0.7,
                max_tokens=50,
            )
            return f"💡 {response.content.strip()}"
        except Exception as e:
            logger.error("Coach hint failed", error=str(e))
            return "💡 注意倾听客户的具体需求，针对性回应。"

    async def get_pause_review(
        self,
        session_id: str,
        user_id: str,
    ) -> dict:
        """获取暂停复盘分析
        
        Args:
            session_id: 会话ID
            user_id: 用户ID
            
        Returns:
            复盘分析结果
        """
        session = await self.get_session(session_id, user_id)
        if not session or not session.turns:
            return {
                "summary": "对话尚未开始",
                "suggestions": ["开始对话后再进行复盘"],
                "turn_count": 0,
            }
        
        # 获取对话历史
        def get_role_name(role):
            return "销售" if role == "user" else "客户"
        
        history_text = "\n".join([
            f"{get_role_name(t.role)}: {t.content}"
            for t in session.turns
        ])
        
        review_prompt = f"""请对以下销售对话进行简要复盘。

## 对话历史
{history_text}

## 要求
请返回 JSON 格式，包含:
1. summary: 当前进展总结（一句话）
2. good_points: 做得好的地方（数组，1-3条）
3. suggestions: 改进建议（数组，1-3条）

请直接返回 JSON，不需要markdown标记。
"""
        
        try:
            response = await self.llm.chat(
                messages=[
                    ChatMessage(role="system", content="你是一个专业的销售教练，擅长分析对话并提供建设性反馈。"),
                    ChatMessage(role="user", content=review_prompt),
                ],
                temperature=0.5,
                max_tokens=300,
            )
            
            # 解析JSON
            import re
            content = response.content.strip()
            # 移除可能的markdown标记
            content = re.sub(r'^```json\s*', '', content)
            content = re.sub(r'\s*```$', '', content)
            
            result = json.loads(content)
            return {
                "summary": result.get("summary", "对话进展正常"),
                "good_points": result.get("good_points", []),
                "suggestions": result.get("suggestions", []),
                "turn_count": len(session.turns),
            }
        except Exception as e:
            logger.error("Pause review failed", error=str(e))
            return {
                "summary": f"已完成 {len(session.turns)} 轮对话，继续加油！",
                "good_points": ["保持了对话的节奏"],
                "suggestions": ["注意倾听客户的具体需求", "适时提出下一步行动建议"],
                "turn_count": len(session.turns),
            }
