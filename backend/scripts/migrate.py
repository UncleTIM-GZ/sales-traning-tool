#!/usr/bin/env python3
"""
数据库迁移管理工具

用法:
    python scripts/migrate.py init          # 创建初始迁移
    python scripts/migrate.py make "描述"   # 创建新迁移
    python scripts/migrate.py up            # 应用所有迁移
    python scripts/migrate.py down          # 回滚一个版本
    python scripts/migrate.py current       # 显示当前版本
    python scripts/migrate.py history       # 显示迁移历史
    python scripts/migrate.py heads         # 显示最新版本
"""

import os
import sys
import subprocess
from pathlib import Path

# 设置项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
os.chdir(PROJECT_ROOT)

# 添加项目路径
sys.path.insert(0, str(PROJECT_ROOT))


def run_alembic(*args):
    """执行 alembic 命令"""
    cmd = ["alembic"] + list(args)
    print(f"执行: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=PROJECT_ROOT)
    return result.returncode


def cmd_init():
    """创建初始迁移（基于当前模型）"""
    print("=" * 50)
    print("创建初始迁移")
    print("=" * 50)
    return run_alembic("revision", "--autogenerate", "-m", "initial_migration")


def cmd_make(message: str):
    """创建新迁移"""
    if not message:
        print("错误: 请提供迁移描述")
        print("用法: python scripts/migrate.py make \"添加用户表\"")
        return 1
    
    print("=" * 50)
    print(f"创建迁移: {message}")
    print("=" * 50)
    return run_alembic("revision", "--autogenerate", "-m", message)


def cmd_up():
    """应用所有迁移"""
    print("=" * 50)
    print("应用迁移到最新版本")
    print("=" * 50)
    return run_alembic("upgrade", "head")


def cmd_down():
    """回滚一个版本"""
    print("=" * 50)
    print("回滚一个版本")
    print("=" * 50)
    return run_alembic("downgrade", "-1")


def cmd_current():
    """显示当前版本"""
    return run_alembic("current")


def cmd_history():
    """显示迁移历史"""
    return run_alembic("history", "--verbose")


def cmd_heads():
    """显示最新版本"""
    return run_alembic("heads")


def cmd_help():
    """显示帮助"""
    print(__doc__)
    return 0


def main():
    if len(sys.argv) < 2:
        cmd_help()
        return 1
    
    command = sys.argv[1].lower()
    
    commands = {
        "init": cmd_init,
        "make": lambda: cmd_make(sys.argv[2] if len(sys.argv) > 2 else ""),
        "up": cmd_up,
        "upgrade": cmd_up,
        "down": cmd_down,
        "downgrade": cmd_down,
        "current": cmd_current,
        "history": cmd_history,
        "heads": cmd_heads,
        "help": cmd_help,
        "-h": cmd_help,
        "--help": cmd_help,
    }
    
    if command not in commands:
        print(f"未知命令: {command}")
        cmd_help()
        return 1
    
    return commands[command]()


if __name__ == "__main__":
    sys.exit(main() or 0)
