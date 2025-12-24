"""初始化场景数据"""

import asyncio
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import async_session_factory
from app.models.scenario import Scenario, ScenarioPack


# 场景数据
SCENARIOS = [
    {
        "name": "高压销售谈判",
        "track": "sales",
        "mode": "train",
        "difficulty": 3,
        "description": "模拟面对挑剔客户的价格谈判场景，重点训练在极度施压下的抗压能力与异议处理技巧。",
        "visibility": "public",
        "is_official": True,
        "status": "published",
        "config": {
            "channel": "phone",
            "persona": "demanding_buyer",
            "time_limit_sec": 600,
            "tags": ["销冠培养", "抗压能力"],
            "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBapHIk3cO4iFZETQQ7pzUUcr9KBsBDbSSGAf2vBBNLPFFFgiPVdUFixoVB2kiPMxHHytkIykNGCOpmM-2P-eSpIaMnprcacOcApDXM9n93LjchLxs4z2rfghu8B1u6SkdxjmEmAgL7RtJWPkAPHmU1Tcm4taFykF9fIGGI6hYrOUuREEU2mNSH1Kz9vCcZJoQSgXIZsW_04DQVdYf92tGQl998I6o8Tx4ReqhF87fQaQ55nL1RX33ElJUPNH4UmG57eCxrA9VuPq8",
            "rating": 4.8,
            "practice_count": 2100,
        },
        "rubric_version": "sales_mvp_v1",
        "status": "published",
    },
    {
        "name": "初次社交破冰",
        "track": "social",
        "mode": "train",
        "difficulty": 2,
        "description": "在非正式场合与陌生人开启对话，学习如何寻找共同话题并建立初步联系。",
        "visibility": "public",
        "is_official": True,
        "status": "published",
        "config": {
            "channel": "face_to_face",
            "persona": "stranger_at_event",
            "time_limit_sec": 300,
            "tags": ["社恐培养", "破冰技巧"],
            "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuCge0fLTWfZSrbFgDJa1ibqoCWXPi9RHI4vPIqndyOQW882-sy4bJ5lazx4WFSVho0QiM9ZJfqjqf1Y2zhAmEZBu-nHZiJnb7JUYJIwZDldaaIp-JKvsN4ayW4PeaNR0jbPFjlhG8M7ssu_mwc76pTvRQqR36S6SzCsFETgz3vdhYRFYzqY4z9mOj7ZirgOyyvakm4V77Tnoh53fYPdkjUP47cZyu-ZeYYTh5YhtgjOG4m42v03zMYwku9K-hhWp6aWQzAvCWQ2o7E",
            "rating": 4.5,
            "practice_count": 850,
        },
        "rubric_version": "social_mvp_v1",
        "status": "published",
    },
    {
        "name": "季度业绩汇报",
        "track": "sales",
        "mode": "train",
        "difficulty": 4,
        "description": "面向高层管理者的正式汇报，训练逻辑表达、数据呈现及临场问答能力。",
        "visibility": "public",
        "is_official": True,
        "status": "published",
        "config": {
            "channel": "meeting",
            "persona": "senior_executive",
            "time_limit_sec": 900,
            "tags": ["职场进阶", "公众演讲"],
            "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuCpv3QhcqcP9qi0uuQetMGR0j-_MQM6GzivBkufOTctAGUaoyPpaaXPpr0-FsOlyFUhnkT3upb2jKgjLRRm0e4fe0_LPG3qD9b3HdfEfffaS3Eo93YBYOKImgxhx2VBBHcBhn98u4xMyxqBsbDcwb4IN5pX2gbrjLYBDlWsdsAyfiPfi2X_X-ihFTTGf4ATh7XpiAf-XGigk4I2-2AoJUaX_sO0zL06ulad4g4HPyyDs5r38s5-bpMMnuuUdrUra7rpOA0ewrmE0Ys",
            "rating": 4.9,
            "practice_count": 1500,
        },
        "rubric_version": "sales_mvp_v1",
        "status": "published",
    },
    {
        "name": "客户投诉处理",
        "track": "sales",
        "mode": "train",
        "difficulty": 5,
        "description": "处理情绪激动的客户投诉，通过共情与解决方案挽回客户信任。",
        "visibility": "public",
        "is_official": True,
        "status": "published",
        "config": {
            "channel": "phone",
            "persona": "angry_customer",
            "time_limit_sec": 600,
            "tags": ["危机公关", "情绪安抚"],
            "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBFy2CBue-UrLlmf6BxZ6msZ2TeM2uCXBYpvBtf75ZcOvcXM3rxpcn_mGTT3kK3qwPwXjY8eOyS2KL7IDFRG1cZrasScJJA7YRB_j0imWWmuoY3lAt0nOs4Xo7dAUUdhzuHpnkDN3o7K94iKCy0oIWMe2Jtuhme3xkjWYNgzDNfsMZy1XATZsC80Gd32180WlJJjwfEiF_nYmMu3u7nrFvw1nxAvHhwysi_zbWdb5pfvT4BZ_U27g3py3TxkYB0VZUoUhrpl1WJJM4",
            "rating": 4.7,
            "practice_count": 3200,
        },
        "rubric_version": "sales_mvp_v1",
        "status": "published",
    },
    {
        "name": "行业酒会社交",
        "track": "social",
        "mode": "train",
        "difficulty": 3,
        "description": "在高端酒会中拓展人脉，优雅地介入对话并交换名片。",
        "visibility": "public",
        "is_official": True,
        "status": "published",
        "config": {
            "channel": "face_to_face",
            "persona": "industry_professional",
            "time_limit_sec": 480,
            "tags": ["人脉拓展", "商务礼仪"],
            "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuA27eUrWKaQRPO6uhD8M05pnFHkWo7oOPVBeVhiQZhoaoRspRZngRtbUY5BEa80V8AfJz8zmevZ_Czra9ScOSIf1Cgjc2sR3Z5GZeKzt8xfX5ddzl6qkYOHD3aGwfA42_oYzJxsYm4cbwOLM_sr5HhTgPPYcKbLKwX9nbPx02YxJP2EnQniOSzdX0GB0MiUGUv_Y5TBKl28UWf00rI4mEud8aL8Ta-0n5mcW2c0VrN_ofCRnvjsnOmNK0tXl2lehaMaoqDrOM72QbU",
            "rating": 4.6,
            "practice_count": 540,
        },
        "rubric_version": "social_mvp_v1",
        "status": "published",
    },
    {
        "name": "结构化面试模拟",
        "track": "sales",
        "mode": "train",
        "difficulty": 2,
        "description": "针对常见HR面试问题的回答训练，包括自我介绍、优缺点分析等。",
        "visibility": "public",
        "is_official": True,
        "status": "published",
        "config": {
            "channel": "face_to_face",
            "persona": "hr_interviewer",
            "time_limit_sec": 1200,
            "tags": ["求职面试", "逻辑思维"],
            "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBG-OgNwVIz5KWvU14jAbSiX9FQiWtUl8WLhIbxjyaGsSwWubbOBSyDUVrOAhvhMBIRb7RUmiHNVgL3h2suxlGEsNVxNLNFMjEiBnpLV-LmeaOIol8W7IcHk9Thxn_yPxtLwqaiAnYAIOvnXCKrx4lfNnp0GKnMhfk8XpC-zyJoiHUPyz70Lnl-VONQC6q0ypDTMhGoc-bBzBUBtaYL7qkaC8HfqTU_WNDVIpHxlQTNsIV1uxpVgkcxHWbi4YI1Lq_LhOv1L9psSy8",
            "rating": 4.8,
            "practice_count": 4800,
        },
        "rubric_version": "sales_mvp_v1",
        "status": "published",
    },
]


async def seed_scenarios():
    """创建场景种子数据"""
    async with async_session_factory() as session:
        # 检查是否已有场景
        from sqlalchemy import select, func
        result = await session.execute(select(func.count()).select_from(Scenario))
        count = result.scalar() or 0

        if count > 0:
            print(f"✓ 场景数据已存在 ({count} 个场景)")
            return

        # 逐个创建场景
        for scenario_data in SCENARIOS:
            scenario = Scenario(**scenario_data)
            session.add(scenario)
            await session.flush()  # 每个场景单独 flush

        await session.commit()
        print(f"✓ 成功创建 {len(SCENARIOS)} 个场景")


async def main():
    print("=" * 50)
    print("初始化场景数据")
    print("=" * 50)

    try:
        await seed_scenarios()
        print("=" * 50)
        print("初始化完成!")
    except Exception as e:
        print(f"✗ 初始化失败: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
