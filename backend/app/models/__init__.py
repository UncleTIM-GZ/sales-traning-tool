"""数据库模型"""

from app.models.user import User, Profile, VerificationCode
from app.models.scenario import Scenario, ScenarioPack, Rubric
from app.models.session import Session, SessionTurn
from app.models.report import Report
from app.models.training_plan import TrainingPlan, PlanTask
from app.models.course import (
    Instructor,
    Course,
    Chapter,
    Lesson,
    CourseEnrollment,
    LessonCompletion,
)
from app.models.community import (
    Post,
    PostLike,
    PostComment,
    Challenge,
    ChallengeParticipant,
    Leaderboard,
)
from app.models.settings import UserSettings
from app.models.system_config import SystemConfig
from app.models.incentive import UserPoints, PointTransaction, Achievement, UserAchievement
from app.models.notification import Notification, NotificationPreference
from app.models.social import Referral, InviteCode, ShareRecord
from app.models.scenario_social import (
    ScenarioLike,
    ScenarioComment,
    ScenarioCollection,
    ScenarioShare,
    Creator,
    CreatorFollow,
    ScenarioReport,
)
from app.models.plaza import (
    ScenarioTag,
    ScenarioTagRelation,
    CommentLike,
    PlazaUserPoints,
    PlazaPointRecord,
    PlazaAchievement,
    PlazaUserAchievement,
    Collection,
    CollectionScenario,
    SearchHistory,
    HotSearch,
)
from app.models.dashboard import DashboardMetric
from app.models.security import LoginHistory, TwoFactorAuth, AccountBinding
from app.models.friendship import Friendship, FriendRequest

# VIP会员系统
from app.models.membership import (
    MembershipLevel,
    MembershipLevelName,
    Subscription,
    SubscriptionStatus,
    DEFAULT_MEMBERSHIP_LEVELS,
)
from app.models.order import (
    Order,
    Refund,
    OrderStatus,
    PaymentMethod,
    PaymentChannel,
    ProductType,
    RefundStatus,
    generate_order_no,
    generate_refund_no,
)
from app.models.points import (
    PointsAccount,
    PointsTransaction as VIPPointsTransaction,
    PointsLock,
    PointsSource,
    PointsPurpose,
    PointsLockStatus,
    PointsTransactionType,
    POINTS_RULES,
)
from app.models.coupon import (
    Coupon,
    UserCoupon,
    CouponType,
    CouponStatus,
    UserCouponStatus,
    generate_coupon_code,
)
from app.models.redeem_code import (
    RedeemCode,
    RedeemLog,
    RewardType,
    generate_redeem_code,
)

__all__ = [
    # User
    "User",
    "Profile",
    "VerificationCode",
    # Scenario
    "Scenario",
    "ScenarioPack",
    "Rubric",
    # Session
    "Session",
    "SessionTurn",
    # Report
    "Report",
    # Training Plan
    "TrainingPlan",
    "PlanTask",
    # Course
    "Instructor",
    "Course",
    "Chapter",
    "Lesson",
    "CourseEnrollment",
    "LessonCompletion",
    # Community
    "Post",
    "PostLike",
    "PostComment",
    "Challenge",
    "ChallengeParticipant",
    "Leaderboard",
    # Settings
    "UserSettings",
    # System
    "SystemConfig",
    # Incentive
    "UserPoints",
    "PointTransaction",
    "Achievement",
    "UserAchievement",
    # Notification
    "Notification",
    "NotificationPreference",
    # Social
    "Referral",
    "InviteCode",
    "ShareRecord",
    # Scenario Social
    "ScenarioLike",
    "ScenarioComment",
    "ScenarioCollection",
    "ScenarioShare",
    "Creator",
    "CreatorFollow",
    "ScenarioReport",
    # Plaza
    "ScenarioTag",
    "ScenarioTagRelation",
    "CommentLike",
    "PlazaUserPoints",
    "PlazaPointRecord",
    "PlazaAchievement",
    "PlazaUserAchievement",
    "Collection",
    "CollectionScenario",
    "SearchHistory",
    "HotSearch",
    # Security
    "LoginHistory",
    "TwoFactorAuth",
    "AccountBinding",
    # Friendship
    "Friendship",
    "FriendRequest",
    # VIP Membership
    "MembershipLevel",
    "MembershipLevelName",
    "Subscription",
    "SubscriptionStatus",
    "DEFAULT_MEMBERSHIP_LEVELS",
    # Order
    "Order",
    "Refund",
    "OrderStatus",
    "PaymentMethod",
    "PaymentChannel",
    "ProductType",
    "RefundStatus",
    "generate_order_no",
    "generate_refund_no",
    # Points (VIP)
    "PointsAccount",
    "VIPPointsTransaction",
    "PointsLock",
    "PointsSource",
    "PointsPurpose",
    "PointsLockStatus",
    "PointsTransactionType",
    "POINTS_RULES",
    # Coupon
    "Coupon",
    "UserCoupon",
    "CouponType",
    "CouponStatus",
    "UserCouponStatus",
    "generate_coupon_code",
    # Redeem Code
    "RedeemCode",
    "RedeemLog",
    "RewardType",
    "generate_redeem_code",
]
