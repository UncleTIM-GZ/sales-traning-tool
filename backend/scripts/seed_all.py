"""
种子数据：课程、社区、挑战
运行：python scripts/seed_all.py
"""

import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select

from app.db.session import async_session_factory
from app.models import (
    Instructor,
    Course,
    Chapter,
    Lesson,
    Challenge,
    Post,
    Leaderboard,
    User,
)


async def seed_instructors(db):
    """创建讲师数据"""
    instructors_data = [
        {
            "name": "张明辉",
            "title": "资深销售培训导师 · 20年行业经验",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=instructor1",
            "bio": "曾任世界500强销售总监，培训学员超过10万人",
        },
        {
            "name": "李婷婷",
            "title": "谈判专家 · 前500强销售总监",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=instructor2",
            "bio": "专注商务谈判15年，出版《谈判心理学》等畅销书",
        },
        {
            "name": "王小明",
            "title": "社交心理专家 · 知名演讲教练",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=instructor3",
            "bio": "帮助超过5万人克服社交焦虑，重塑社交自信",
        },
        {
            "name": "陈晓峰",
            "title": "情绪管理专家 · 企业高管教练",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=instructor4",
            "bio": "专注职场情绪管理10年，服务过百家企业",
        },
    ]
    
    instructors = []
    for data in instructors_data:
        instructor = Instructor(**data)
        db.add(instructor)
        await db.flush()
        await db.refresh(instructor)
        instructors.append(instructor)
    
    return instructors


async def seed_courses(db, instructors):
    """创建课程数据"""
    courses_data = [
        {
            "title": "销售基础：从0到1掌握销售思维",
            "description": "系统学习销售的核心思维模式，理解客户心理，建立正确的销售观念。",
            "full_description": "本课程专为销售新人设计，通过系统化的学习路径，帮助你建立正确的销售观念和思维模式。从理解客户心理到掌握沟通技巧，从产品价值呈现到异议处理，全方位提升你的销售基础能力。",
            "category": "sales",
            "level": "beginner",
            "duration_minutes": 180,
            "cover_image": "https://images.unsplash.com/photo-1552581234-26160f608093?w=800",
            "instructor_id": instructors[0].id,
            "price": 0,
            "is_pro": False,
            "is_new": False,
            "rating": 4.8,
            "enrolled_count": 12580,
            "objectives": [
                "理解销售的本质和核心价值",
                "掌握客户心理分析的基础方法",
                "学会建立信任关系的技巧",
                "掌握产品价值呈现的框架",
            ],
            "requirements": [
                "无需销售经验，从零开始",
                "保持开放的学习心态",
                "每天投入20-30分钟学习",
            ],
            "sort_order": 1,
            "chapters": [
                {
                    "title": "销售思维基础",
                    "description": "建立正确的销售观念和思维模式",
                    "lessons": [
                        {"title": "什么是销售？重新定义销售的价值", "type": "video", "duration": 15},
                        {"title": "销售高手的核心思维模式", "type": "video", "duration": 12},
                        {"title": "章节测验：销售思维自测", "type": "quiz", "duration": 5},
                    ],
                },
                {
                    "title": "客户心理洞察",
                    "description": "学会理解和分析客户的真实需求",
                    "lessons": [
                        {"title": "客户购买决策的心理过程", "type": "video", "duration": 18},
                        {"title": "如何识别客户的真实需求", "type": "video", "duration": 15},
                        {"title": "客户类型分析与应对策略", "type": "video", "duration": 20},
                        {"title": "实战练习：需求挖掘对话模拟", "type": "practice", "duration": 10},
                    ],
                },
                {
                    "title": "建立信任关系",
                    "description": "快速建立客户信任的方法和技巧",
                    "lessons": [
                        {"title": "信任建立的黄金30秒", "type": "video", "duration": 12},
                        {"title": "倾听的艺术与技巧", "type": "video", "duration": 14},
                        {"title": "如何让客户主动打开话匣子", "type": "article", "duration": 10},
                    ],
                },
                {
                    "title": "价值呈现与成交",
                    "description": "产品价值呈现与促成成交的技巧",
                    "lessons": [
                        {"title": "FABE价值呈现法", "type": "video", "duration": 18},
                        {"title": "成交信号识别与临门一脚", "type": "video", "duration": 15},
                    ],
                },
            ],
        },
        {
            "title": "高压谈判：价格异议处理技巧",
            "description": "深度解析客户价格异议的心理根源，学习10种高效的异议处理话术。",
            "full_description": "价格异议是销售过程中最常见也是最难处理的挑战。本课程深入分析客户提出价格异议背后的真实动机，教你10种经过验证的高效处理话术，让你在价格谈判中游刃有余。",
            "category": "sales",
            "level": "intermediate",
            "duration_minutes": 270,
            "cover_image": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800",
            "instructor_id": instructors[1].id,
            "price": 199,
            "is_pro": True,
            "is_new": False,
            "rating": 4.9,
            "enrolled_count": 8920,
            "objectives": [
                "理解价格异议背后的心理动机",
                "掌握10种高效异议处理话术",
                "学会价格谈判的节奏控制",
                "建立价值导向的谈判思维",
            ],
            "requirements": [
                "有基础销售经验",
                "遇到过价格异议的困扰",
                "愿意反复练习和复盘",
            ],
            "sort_order": 2,
            "chapters": [
                {
                    "title": "价格异议的本质",
                    "description": "理解客户提出价格异议的真实原因",
                    "lessons": [
                        {"title": "价格异议的5种类型", "type": "video", "duration": 12},
                        {"title": "真假异议的识别方法", "type": "video", "duration": 15},
                        {"title": "案例分析：典型价格异议场景", "type": "video", "duration": 18},
                    ],
                },
                {
                    "title": "异议处理核心话术",
                    "description": "10种经过验证的高效话术",
                    "lessons": [
                        {"title": "话术1-3：价值重构法", "type": "video", "duration": 20},
                        {"title": "话术4-6：比较分析法", "type": "video", "duration": 18},
                        {"title": "话术7-10：条件交换法", "type": "video", "duration": 22},
                        {"title": "实战模拟：异议处理对练", "type": "practice", "duration": 15},
                    ],
                },
                {
                    "title": "高阶谈判技巧",
                    "description": "进阶谈判策略和心理战术",
                    "lessons": [
                        {"title": "谈判节奏的控制", "type": "video", "duration": 16},
                        {"title": "沉默的力量", "type": "video", "duration": 12},
                        {"title": "如何让步而不失势", "type": "video", "duration": 18},
                    ],
                },
            ],
        },
        {
            "title": "社交破冰：告别尴尬开场白",
            "description": "学习自然不做作的破冰技巧，轻松开启任何对话。",
            "full_description": "社交场合的开场白往往是最让人紧张的时刻。本课程教你如何用自然、轻松的方式打破沉默，开启愉快的对话，让社交变得不再尴尬。",
            "category": "social",
            "level": "beginner",
            "duration_minutes": 120,
            "cover_image": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800",
            "instructor_id": instructors[2].id,
            "price": 0,
            "is_pro": False,
            "is_new": False,
            "rating": 4.7,
            "enrolled_count": 15230,
            "objectives": [
                "克服开场的心理障碍",
                "掌握多种破冰话术",
                "学会延续对话的技巧",
                "建立社交自信",
            ],
            "requirements": [
                "希望提升社交能力",
                "愿意走出舒适区",
            ],
            "sort_order": 3,
            "chapters": [
                {
                    "title": "破冰心理准备",
                    "description": "建立正确的社交心态",
                    "lessons": [
                        {"title": "为什么我们害怕开口", "type": "video", "duration": 10},
                        {"title": "重新定义「尴尬」", "type": "video", "duration": 12},
                    ],
                },
                {
                    "title": "实用破冰技巧",
                    "description": "多场景适用的破冰方法",
                    "lessons": [
                        {"title": "环境观察法", "type": "video", "duration": 15},
                        {"title": "共同话题法", "type": "video", "duration": 12},
                        {"title": "请教式开场", "type": "video", "duration": 10},
                        {"title": "赞美式破冰", "type": "video", "duration": 12},
                    ],
                },
                {
                    "title": "延续对话",
                    "description": "让对话自然流畅地进行",
                    "lessons": [
                        {"title": "追问的艺术", "type": "video", "duration": 14},
                        {"title": "优雅收尾", "type": "video", "duration": 10},
                    ],
                },
            ],
        },
        {
            "title": "商务演讲：公开表达自信力",
            "description": "克服演讲恐惧，掌握商务演讲的核心技巧，成为会议焦点。",
            "full_description": "无论是汇报工作、客户演示还是公开演讲，表达能力都是职场成功的关键。本课程将帮助你从心理和技巧两个层面提升公开表达的自信。",
            "category": "social",
            "level": "intermediate",
            "duration_minutes": 300,
            "cover_image": "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800",
            "instructor_id": instructors[2].id,
            "price": 299,
            "is_pro": True,
            "is_new": True,
            "rating": 4.9,
            "enrolled_count": 6780,
            "objectives": [
                "克服演讲恐惧心理",
                "掌握演讲结构设计",
                "学会控场和互动技巧",
                "提升个人表达魅力",
            ],
            "requirements": [
                "有公开表达的需求",
                "愿意反复练习",
            ],
            "sort_order": 4,
            "chapters": [
                {
                    "title": "演讲心理突破",
                    "description": "战胜内心的恐惧",
                    "lessons": [
                        {"title": "演讲焦虑的本质", "type": "video", "duration": 15},
                        {"title": "紧张转化为能量", "type": "video", "duration": 12},
                        {"title": "心理调节技巧", "type": "video", "duration": 18},
                    ],
                },
                {
                    "title": "演讲结构设计",
                    "description": "打造有说服力的演讲",
                    "lessons": [
                        {"title": "黄金圈法则", "type": "video", "duration": 20},
                        {"title": "SCQA故事框架", "type": "video", "duration": 18},
                        {"title": "开场与收尾设计", "type": "video", "duration": 15},
                    ],
                },
                {
                    "title": "现场表现力",
                    "description": "掌控舞台的技巧",
                    "lessons": [
                        {"title": "声音的力量", "type": "video", "duration": 16},
                        {"title": "肢体语言密码", "type": "video", "duration": 18},
                        {"title": "眼神交流技巧", "type": "video", "duration": 12},
                        {"title": "实战演练：3分钟演讲", "type": "practice", "duration": 20},
                    ],
                },
            ],
        },
        {
            "title": "顶级销冠：成交密码全解析",
            "description": "揭秘顶级销冠的成交秘诀，学习构建客户信任的高级策略。",
            "full_description": "本课程汇集了10位顶级销冠的实战经验，深入解析从首次接触到最终成交的完整策略，帮助你实现销售业绩的质的飞跃。",
            "category": "advanced",
            "level": "advanced",
            "duration_minutes": 480,
            "cover_image": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
            "instructor_id": instructors[0].id,
            "price": 499,
            "is_pro": True,
            "is_new": False,
            "rating": 5.0,
            "enrolled_count": 3420,
            "objectives": [
                "掌握顶级销冠的思维模式",
                "学会高客单价产品销售策略",
                "建立系统化的销售流程",
                "提升谈判和成交能力",
            ],
            "requirements": [
                "有2年以上销售经验",
                "追求更高业绩目标",
                "愿意深度学习和实践",
            ],
            "sort_order": 5,
            "chapters": [
                {
                    "title": "销冠思维体系",
                    "description": "理解顶级销冠的思考方式",
                    "lessons": [
                        {"title": "销冠的时间管理", "type": "video", "duration": 20},
                        {"title": "客户资源的经营", "type": "video", "duration": 25},
                        {"title": "持续学习的方法", "type": "video", "duration": 15},
                    ],
                },
                {
                    "title": "高端客户开发",
                    "description": "如何接触和维护高端客户",
                    "lessons": [
                        {"title": "高端客户画像分析", "type": "video", "duration": 22},
                        {"title": "圈层社交技巧", "type": "video", "duration": 20},
                        {"title": "转介绍系统搭建", "type": "video", "duration": 25},
                    ],
                },
                {
                    "title": "大单成交策略",
                    "description": "高客单价产品的成交方法",
                    "lessons": [
                        {"title": "价值包装的艺术", "type": "video", "duration": 22},
                        {"title": "决策链分析", "type": "video", "duration": 20},
                        {"title": "临门一脚的时机", "type": "video", "duration": 18},
                        {"title": "实战案例：百万大单复盘", "type": "video", "duration": 30},
                    ],
                },
            ],
        },
        {
            "title": "情绪管理：压力下保持冷静",
            "description": "学习情绪调节技巧，在高压场景中保持专业和冷静。",
            "full_description": "无论是面对客户的刁难、同事的冲突还是工作的压力，情绪管理能力都至关重要。本课程教你如何在高压环境下保持冷静，做出理性决策。",
            "category": "advanced",
            "level": "intermediate",
            "duration_minutes": 210,
            "cover_image": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800",
            "instructor_id": instructors[3].id,
            "price": 99,
            "is_pro": False,
            "is_new": False,
            "rating": 4.8,
            "enrolled_count": 9870,
            "objectives": [
                "理解情绪产生的机制",
                "掌握即时情绪调节技巧",
                "建立长期情绪管理习惯",
                "在压力中保持高效表现",
            ],
            "requirements": [
                "工作中有压力管理需求",
                "愿意进行自我觉察",
            ],
            "sort_order": 6,
            "chapters": [
                {
                    "title": "认识情绪",
                    "description": "理解情绪的本质和作用",
                    "lessons": [
                        {"title": "情绪的科学解读", "type": "video", "duration": 15},
                        {"title": "压力与表现的关系", "type": "video", "duration": 12},
                        {"title": "自我情绪觉察", "type": "video", "duration": 18},
                    ],
                },
                {
                    "title": "即时情绪调节",
                    "description": "当下调节情绪的技巧",
                    "lessons": [
                        {"title": "呼吸调节法", "type": "video", "duration": 10},
                        {"title": "认知重构技术", "type": "video", "duration": 18},
                        {"title": "身体放松技巧", "type": "video", "duration": 12},
                        {"title": "场景练习：客户投诉应对", "type": "practice", "duration": 15},
                    ],
                },
                {
                    "title": "长期情绪管理",
                    "description": "建立健康的情绪习惯",
                    "lessons": [
                        {"title": "情绪日记的力量", "type": "article", "duration": 10},
                        {"title": "建立支持系统", "type": "video", "duration": 15},
                        {"title": "正念冥想入门", "type": "video", "duration": 20},
                    ],
                },
            ],
        },
    ]
    
    courses = []
    for course_data in courses_data:
        chapters_data = course_data.pop("chapters")
        course = Course(**course_data)
        db.add(course)
        await db.flush()
        
        for ch_order, ch_data in enumerate(chapters_data):
            lessons_data = ch_data.pop("lessons")
            chapter = Chapter(
                course_id=course.id,
                title=ch_data["title"],
                description=ch_data.get("description"),
                order=ch_order,
            )
            db.add(chapter)
            await db.flush()
            
            for ls_order, ls_data in enumerate(lessons_data):
                lesson = Lesson(
                    chapter_id=chapter.id,
                    title=ls_data["title"],
                    type=ls_data["type"],
                    duration_minutes=ls_data["duration"],
                    order=ls_order,
                    is_free=ls_order == 0,  # 第一节课免费试看
                )
                db.add(lesson)
        
        courses.append(course)
    
    await db.flush()
    return courses


async def seed_challenges(db):
    """创建挑战赛数据"""
    now = datetime.utcnow()
    
    challenges_data = [
        {
            "title": "周度谈判王者挑战",
            "description": "完成5场高压谈判场景，争夺周榜前10",
            "start_time": now.isoformat(),
            "end_time": (now + timedelta(days=7)).isoformat(),
            "reward": "500积分 + 专属徽章",
            "rules": {
                "target_sessions": 5,
                "scenario_type": "高压谈判",
                "min_score": 70,
            },
            "participant_count": 1280,
            "is_active": True,
        },
        {
            "title": "社交突破21天计划",
            "description": "连续21天完成社交场景训练，突破社交障碍",
            "start_time": now.isoformat(),
            "end_time": (now + timedelta(days=21)).isoformat(),
            "reward": "勇气徽章 + 1个月会员",
            "rules": {
                "consecutive_days": 21,
                "scenario_type": "社交场景",
                "min_sessions_per_day": 1,
            },
            "participant_count": 856,
            "is_active": True,
        },
        {
            "title": "新人冲刺赛",
            "description": "新用户专属，7天内完成10场训练获得新人礼包",
            "start_time": now.isoformat(),
            "end_time": (now + timedelta(days=30)).isoformat(),
            "reward": "新人礼包 + 200积分",
            "rules": {
                "target_sessions": 10,
                "time_limit_days": 7,
                "new_user_only": True,
            },
            "participant_count": 2340,
            "is_active": True,
        },
    ]
    
    challenges = []
    for data in challenges_data:
        challenge = Challenge(**data)
        db.add(challenge)
        challenges.append(challenge)
    
    await db.flush()
    return challenges


async def seed_leaderboard(db):
    """创建排行榜数据（基于真实用户）"""
    # 获取所有用户
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    
    if not users:
        print("  - No users found, skipping leaderboard")
        return []
    
    # 为每个用户创建排行榜条目
    leaderboards = []
    for i, user in enumerate(users[:20]):  # 最多20人
        # 周榜
        lb_weekly = Leaderboard(
            user_id=user.id,
            score=max(0, 10000 - i * 300 + (i % 3) * 100),  # 模拟分数
            rank=i + 1,
            period="weekly",
            rank_change=(i % 5) - 2,  # 随机排名变化
        )
        db.add(lb_weekly)
        leaderboards.append(lb_weekly)
        
        # 月榜
        lb_monthly = Leaderboard(
            user_id=user.id,
            score=max(0, 30000 - i * 800 + (i % 4) * 200),
            rank=i + 1,
            period="monthly",
            rank_change=(i % 4) - 1,
        )
        db.add(lb_monthly)
        leaderboards.append(lb_monthly)
    
    await db.flush()
    return leaderboards


async def seed_sample_posts(db):
    """创建示例动态"""
    # 获取第一个用户
    result = await db.execute(select(User).limit(5))
    users = result.scalars().all()
    
    if not users:
        print("  - No users found, skipping posts")
        return []
    
    posts_data = [
        {
            "content": "今天完成了「高压谈判」场景的挑战，终于拿到了满分！分享一个技巧：当客户抛出价格异议时，不要急于解释，先认同对方的顾虑，再用「价值锚定」策略引导话题。这个方法真的很有效！",
            "is_pinned": True,
        },
        {
            "content": "从重度社恐到能自信地在会议上发言，花了3个月时间。感谢平台的循序渐进式训练，特别是「破冰对话」模块，让我学会了如何自然地开启对话。推荐给所有和我一样有社交焦虑的朋友！",
        },
        {
            "content": "今天的挑战赛太激烈了！虽然最后惜败，但学到了很多新的话术技巧。期待下次再战！💪",
        },
        {
            "content": "坚持训练第30天打卡！从一开始紧张到说不出话，到现在能够流畅应对各种场景，进步真的很大。数据显示我的综合评分提升了35%！",
        },
        {
            "content": "刚完成「商务演讲」课程，课程质量真的很高！特别是SCQA框架讲得很透彻，下周的季度汇报终于有信心了。",
        },
    ]
    
    posts = []
    for i, data in enumerate(posts_data):
        user = users[i % len(users)]
        post = Post(
            user_id=user.id,
            content=data["content"],
            images=[],
            likes_count=50 + i * 30,
            comments_count=10 + i * 5,
            is_pinned=data.get("is_pinned", False),
        )
        db.add(post)
        posts.append(post)
    
    await db.flush()
    return posts


async def main():
    print("🌱 开始种子数据初始化...")
    
    async with async_session_factory() as db:
        try:
            # 检查是否已有课程数据
            result = await db.execute(select(Course).limit(1))
            if result.scalar():
                print("  ⚠️ 课程数据已存在，跳过")
            else:
                print("  📚 创建讲师数据...")
                instructors = await seed_instructors(db)
                print(f"     创建了 {len(instructors)} 位讲师")
                
                print("  📖 创建课程数据...")
                courses = await seed_courses(db, instructors)
                print(f"     创建了 {len(courses)} 门课程")
            
            # 检查挑战数据
            result = await db.execute(select(Challenge).limit(1))
            if result.scalar():
                print("  ⚠️ 挑战数据已存在，跳过")
            else:
                print("  🏆 创建挑战赛数据...")
                challenges = await seed_challenges(db)
                print(f"     创建了 {len(challenges)} 个挑战赛")
            
            # 检查排行榜数据
            result = await db.execute(select(Leaderboard).limit(1))
            if result.scalar():
                print("  ⚠️ 排行榜数据已存在，跳过")
            else:
                print("  🏅 创建排行榜数据...")
                leaderboards = await seed_leaderboard(db)
                print(f"     创建了 {len(leaderboards)} 条排行记录")
            
            # 检查动态数据
            result = await db.execute(select(Post).limit(1))
            if result.scalar():
                print("  ⚠️ 动态数据已存在，跳过")
            else:
                print("  💬 创建示例动态...")
                posts = await seed_sample_posts(db)
                print(f"     创建了 {len(posts)} 条动态")
            
            await db.commit()
            print("\n✅ 种子数据初始化完成!")
            
        except Exception as e:
            await db.rollback()
            print(f"\n❌ 错误: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())
