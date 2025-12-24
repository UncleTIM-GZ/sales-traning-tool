#!/usr/bin/env python3
"""完整场景数据种子 - 销冠培养 & 社恐培养"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete
from app.db.session import async_session_factory
from app.models.scenario import Scenario

# ============================================================
# 销冠培养场景 (Sales Track)
# ============================================================
SALES_SCENARIOS = [
    # === 初级场景 (难度 1-2) ===
    {
        "name": "电话陌拜开场",
        "track": "sales",
        "mode": "train",
        "difficulty": 1,
        "description": "练习电话销售的开场白，如何在30秒内吸引客户注意力",
        "config": {
            "persona": "普通上班族",
            "channel": "电话",
            "tags": ["陌拜", "开场白", "初级"],
            "duration_minutes": 3,
            "objective": "成功引起客户兴趣，获得继续对话的机会"
        }
    },
    {
        "name": "产品介绍基础",
        "track": "sales",
        "mode": "train",
        "difficulty": 1,
        "description": "向客户清晰介绍产品核心卖点和价值主张",
        "config": {
            "persona": "有需求的客户",
            "channel": "电话",
            "tags": ["产品介绍", "价值主张", "初级"],
            "duration_minutes": 5,
            "objective": "让客户理解产品价值并产生兴趣"
        }
    },
    {
        "name": "需求挖掘入门",
        "track": "sales",
        "mode": "train",
        "difficulty": 2,
        "description": "通过提问了解客户真实需求和痛点",
        "config": {
            "persona": "中小企业老板",
            "channel": "电话",
            "tags": ["需求挖掘", "提问技巧", "初级"],
            "duration_minutes": 5,
            "objective": "成功挖掘出客户的3个核心需求"
        }
    },
    {
        "name": "基础异议处理",
        "track": "sales",
        "mode": "train",
        "difficulty": 2,
        "description": "处理常见的价格异议和'再考虑'推脱",
        "config": {
            "persona": "犹豫的客户",
            "channel": "电话",
            "tags": ["异议处理", "价格谈判", "初级"],
            "duration_minutes": 5,
            "objective": "化解异议并推进到下一步"
        }
    },
    
    # === 中级场景 (难度 3) ===
    {
        "name": "客户投诉化解",
        "track": "sales",
        "mode": "train",
        "difficulty": 3,
        "description": "安抚愤怒客户情绪，化解投诉并挽回客户",
        "config": {
            "persona": "愤怒的投诉客户",
            "channel": "电话",
            "tags": ["投诉处理", "情绪管理", "中级"],
            "duration_minutes": 8,
            "objective": "平息客户情绪并达成解决方案"
        }
    },
    {
        "name": "竞品对比话术",
        "track": "sales",
        "mode": "train",
        "difficulty": 3,
        "description": "客户提到竞争对手产品时的应对策略",
        "config": {
            "persona": "正在对比的客户",
            "channel": "电话",
            "tags": ["竞品分析", "差异化", "中级"],
            "duration_minutes": 6,
            "objective": "突出自身优势，弱化竞品影响"
        }
    },
    {
        "name": "大客户首次拜访",
        "track": "sales",
        "mode": "train",
        "difficulty": 3,
        "description": "首次拜访企业采购负责人，建立信任关系",
        "config": {
            "persona": "企业采购经理",
            "channel": "面对面",
            "tags": ["大客户", "首访", "建立信任"],
            "duration_minutes": 10,
            "objective": "获得客户信任并约定下次会面"
        }
    },
    {
        "name": "沉默客户激活",
        "track": "sales",
        "mode": "train",
        "difficulty": 3,
        "description": "重新激活长期未联系的老客户",
        "config": {
            "persona": "3个月未联系的老客户",
            "channel": "电话",
            "tags": ["客户激活", "复购", "中级"],
            "duration_minutes": 5,
            "objective": "了解客户现状并重建联系"
        }
    },
    
    # === 高级场景 (难度 4) ===
    {
        "name": "高层决策者沟通",
        "track": "sales",
        "mode": "train",
        "difficulty": 4,
        "description": "与CEO/VP级别决策者的商务会谈",
        "config": {
            "persona": "集团副总裁",
            "channel": "面对面",
            "tags": ["高层沟通", "战略合作", "高级"],
            "duration_minutes": 10,
            "objective": "获得高层认可并推进项目"
        }
    },
    {
        "name": "价格谈判攻防",
        "track": "sales",
        "mode": "train",
        "difficulty": 4,
        "description": "客户强势压价时的谈判策略",
        "config": {
            "persona": "精明的采购总监",
            "channel": "面对面",
            "tags": ["价格谈判", "底线守护", "高级"],
            "duration_minutes": 10,
            "objective": "在守住底价的同时成交"
        }
    },
    {
        "name": "季度业绩述职",
        "track": "sales",
        "mode": "train",
        "difficulty": 4,
        "description": "向销售总监汇报季度业绩和下季度计划",
        "config": {
            "persona": "严厉的销售总监",
            "channel": "面对面",
            "tags": ["述职汇报", "目标制定", "高级"],
            "duration_minutes": 8,
            "objective": "获得认可并争取更多资源支持"
        }
    },
    {
        "name": "复杂方案呈现",
        "track": "sales",
        "mode": "train",
        "difficulty": 4,
        "description": "向客户团队呈现定制化解决方案",
        "config": {
            "persona": "技术总监+业务负责人",
            "channel": "视频会议",
            "tags": ["方案呈现", "技术沟通", "高级"],
            "duration_minutes": 15,
            "objective": "获得技术和业务双方认可"
        }
    },
    
    # === 专家场景 (难度 5) ===
    {
        "name": "危机公关应对",
        "track": "sales",
        "mode": "train",
        "difficulty": 5,
        "description": "产品出现重大问题时面对客户的危机处理",
        "config": {
            "persona": "准备终止合作的大客户",
            "channel": "面对面",
            "tags": ["危机公关", "大客户挽留", "专家"],
            "duration_minutes": 15,
            "objective": "稳住客户并制定补救方案"
        }
    },
    {
        "name": "多方利益协调",
        "track": "sales",
        "mode": "train",
        "difficulty": 5,
        "description": "协调客户内部多个部门的不同诉求",
        "config": {
            "persona": "采购部+技术部+财务部联席",
            "channel": "面对面",
            "tags": ["多方协调", "利益平衡", "专家"],
            "duration_minutes": 15,
            "objective": "满足各方诉求达成共识"
        }
    },
    {
        "name": "战略合作谈判",
        "track": "sales",
        "mode": "train",
        "difficulty": 5,
        "description": "与大客户谈判年度战略合作框架",
        "config": {
            "persona": "客户CEO",
            "channel": "面对面",
            "tags": ["战略谈判", "年度合作", "专家"],
            "duration_minutes": 20,
            "objective": "签订年度战略合作协议"
        }
    },
]

# ============================================================
# 社恐培养场景 (Social Track)
# ============================================================
SOCIAL_SCENARIOS = [
    # === 初级场景 (难度 1-2) ===
    {
        "name": "咖啡店点单",
        "track": "social",
        "mode": "train",
        "difficulty": 1,
        "description": "练习在咖啡店自信地点单和与店员互动",
        "config": {
            "persona": "热情的咖啡店店员",
            "channel": "面对面",
            "tags": ["日常对话", "点单", "入门"],
            "duration_minutes": 2,
            "objective": "流畅完成点单过程"
        }
    },
    {
        "name": "问路与指路",
        "track": "social",
        "mode": "train",
        "difficulty": 1,
        "description": "向陌生人问路或帮别人指路",
        "config": {
            "persona": "路人",
            "channel": "面对面",
            "tags": ["日常对话", "陌生人交流", "入门"],
            "duration_minutes": 2,
            "objective": "自然地完成问路/指路对话"
        }
    },
    {
        "name": "电梯闲聊",
        "track": "social",
        "mode": "train",
        "difficulty": 2,
        "description": "与同事在电梯里的短暂闲聊",
        "config": {
            "persona": "同公司的陌生同事",
            "channel": "面对面",
            "tags": ["职场社交", "闲聊", "初级"],
            "duration_minutes": 2,
            "objective": "自然地聊几句不尴尬"
        }
    },
    {
        "name": "新同事自我介绍",
        "track": "social",
        "mode": "train",
        "difficulty": 2,
        "description": "入职第一天向团队做自我介绍",
        "config": {
            "persona": "友好的新团队成员",
            "channel": "面对面",
            "tags": ["职场社交", "自我介绍", "初级"],
            "duration_minutes": 3,
            "objective": "给团队留下良好第一印象"
        }
    },
    
    # === 中级场景 (难度 3) ===
    {
        "name": "同学聚会社交",
        "track": "social",
        "mode": "train",
        "difficulty": 3,
        "description": "多年未见的同学聚会如何自然交流",
        "config": {
            "persona": "多年未见的老同学",
            "channel": "面对面",
            "tags": ["朋友社交", "聚会", "中级"],
            "duration_minutes": 8,
            "objective": "重建联系并愉快交流"
        }
    },
    {
        "name": "部门会议发言",
        "track": "social",
        "mode": "train",
        "difficulty": 3,
        "description": "在部门周会上汇报工作进展",
        "config": {
            "persona": "部门经理和同事们",
            "channel": "面对面",
            "tags": ["职场表达", "会议发言", "中级"],
            "duration_minutes": 5,
            "objective": "清晰自信地完成汇报"
        }
    },
    {
        "name": "行业沙龙networking",
        "track": "social",
        "mode": "train",
        "difficulty": 3,
        "description": "在行业活动中主动与陌生人建立联系",
        "config": {
            "persona": "行业从业者",
            "channel": "面对面",
            "tags": ["职业社交", "Networking", "中级"],
            "duration_minutes": 8,
            "objective": "成功交换联系方式"
        }
    },
    {
        "name": "朋友生日派对",
        "track": "social",
        "mode": "train",
        "difficulty": 3,
        "description": "参加朋友生日派对与不认识的人社交",
        "config": {
            "persona": "朋友的朋友",
            "channel": "面对面",
            "tags": ["朋友社交", "派对", "中级"],
            "duration_minutes": 8,
            "objective": "自然融入并认识新朋友"
        }
    },
    
    # === 高级场景 (难度 4) ===
    {
        "name": "相亲对话",
        "track": "social",
        "mode": "train",
        "difficulty": 4,
        "description": "第一次相亲如何展现自己并了解对方",
        "config": {
            "persona": "相亲对象",
            "channel": "面对面",
            "tags": ["恋爱社交", "相亲", "高级"],
            "duration_minutes": 15,
            "objective": "给对方留下好印象"
        }
    },
    {
        "name": "公开演讲Q&A",
        "track": "social",
        "mode": "train",
        "difficulty": 4,
        "description": "演讲后应对观众提问环节",
        "config": {
            "persona": "犀利的观众",
            "channel": "面对面",
            "tags": ["公开演讲", "应对提问", "高级"],
            "duration_minutes": 10,
            "objective": "从容回答各类问题"
        }
    },
    {
        "name": "高端酒会社交",
        "track": "social",
        "mode": "train",
        "difficulty": 4,
        "description": "在高端商务酒会中与陌生人建立联系",
        "config": {
            "persona": "企业高管",
            "channel": "面对面",
            "tags": ["高端社交", "酒会", "高级"],
            "duration_minutes": 10,
            "objective": "建立有价值的人脉联系"
        }
    },
    {
        "name": "拒绝不合理请求",
        "track": "social",
        "mode": "train",
        "difficulty": 4,
        "description": "学会优雅地拒绝别人的不合理请求",
        "config": {
            "persona": "提出过分请求的朋友",
            "channel": "面对面",
            "tags": ["边界设立", "拒绝技巧", "高级"],
            "duration_minutes": 5,
            "objective": "坚定而不伤感情地拒绝"
        }
    },
    
    # === 专家场景 (难度 5) ===
    {
        "name": "化解尴尬局面",
        "track": "social",
        "mode": "train",
        "difficulty": 5,
        "description": "社交场合遇到尴尬情况如何化解",
        "config": {
            "persona": "制造尴尬的人",
            "channel": "面对面",
            "tags": ["危机处理", "尴尬化解", "专家"],
            "duration_minutes": 5,
            "objective": "巧妙化解尴尬保全各方面子"
        }
    },
    {
        "name": "处理冲突对话",
        "track": "social",
        "mode": "train",
        "difficulty": 5,
        "description": "与产生冲突的朋友或同事进行修复对话",
        "config": {
            "persona": "与你产生矛盾的人",
            "channel": "面对面",
            "tags": ["冲突处理", "关系修复", "专家"],
            "duration_minutes": 10,
            "objective": "化解矛盾修复关系"
        }
    },
    {
        "name": "高压面试应对",
        "track": "social",
        "mode": "train",
        "difficulty": 5,
        "description": "应对压力面试中的刁钻问题",
        "config": {
            "persona": "严厉的HR总监",
            "channel": "面对面",
            "tags": ["面试", "压力应对", "专家"],
            "duration_minutes": 15,
            "objective": "保持冷静并出色回答"
        }
    },
]


async def seed_scenarios():
    """种子完整场景数据"""
    print("=" * 60)
    print("场景数据种子 - 销冠培养 & 社恐培养")
    print("=" * 60)
    
    async with async_session_factory() as db:
        # 清空现有官方场景 (created_by IS NULL)
        await db.execute(delete(Scenario).where(Scenario.created_by == None))
        await db.commit()
        print("\n[1] 已清空现有场景")
        
        # 插入销售场景
        print(f"\n[2] 插入销售培养场景 ({len(SALES_SCENARIOS)} 个)")
        for s in SALES_SCENARIOS:
            scenario = Scenario(
                name=s["name"],
                track=s["track"],
                mode=s["mode"],
                difficulty=s["difficulty"],
                description=s["description"],
                config=s["config"],
                rubric_version="1.0",
                status="published",
                visibility="public",
                is_official=True,
            )
            db.add(scenario)
            print(f"    + [{s['difficulty']}星] {s['name']}")
        
        # 插入社交场景
        print(f"\n[3] 插入社恐培养场景 ({len(SOCIAL_SCENARIOS)} 个)")
        for s in SOCIAL_SCENARIOS:
            scenario = Scenario(
                name=s["name"],
                track=s["track"],
                mode=s["mode"],
                difficulty=s["difficulty"],
                description=s["description"],
                config=s["config"],
                rubric_version="1.0",
                status="published",
                visibility="public",
                is_official=True,
            )
            db.add(scenario)
            print(f"    + [{s['difficulty']}星] {s['name']}")
        
        await db.commit()
        
        print("\n" + "=" * 60)
        print(f"✅ 完成! 共插入 {len(SALES_SCENARIOS) + len(SOCIAL_SCENARIOS)} 个场景")
        print(f"   - 销售场景: {len(SALES_SCENARIOS)} 个")
        print(f"   - 社交场景: {len(SOCIAL_SCENARIOS)} 个")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_scenarios())
