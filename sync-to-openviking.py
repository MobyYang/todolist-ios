#!/usr/bin/env python3
"""
将待办事项数据同步到 OpenViking
供 AI 助手了解用户的待办和习惯

用法: python sync-to-openviking.py
"""

import json
import urllib.request
import sys
import os

# 添加 OpenViking 客户端路径
sys.path.insert(0, os.path.expanduser('~/.openclaw/workspace'))

API_BASE = 'http://localhost:8890'

def fetch_todos():
    """获取所有待办数据"""
    url = f'{API_BASE}/api/export'
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"获取待办数据失败: {e}")
        return None

def format_for_memory(data):
    """格式化为记忆内容"""
    if not data:
        return None
    
    lines = [
        "# 强哥的待办事项",
        f"更新时间: {data['exported_at'][:19].replace('T', ' ')}",
        "",
        f"## 统计",
        f"- 总数: {data['stats']['total']}",
        f"- 待完成: {data['stats']['pending']}",
        f"- 已完成: {data['stats']['completed']}",
        "",
    ]
    
    # 按分类分组
    categories = {c['id']: c for c in data['categories']}
    by_category = {}
    uncategorized = []
    
    for todo in data['todos']:
        if todo['completed']:
            continue  # 只同步未完成的
        
        if todo['category_id']:
            cat_id = todo['category_id']
            if cat_id not in by_category:
                by_category[cat_id] = []
            by_category[cat_id].append(todo)
        else:
            uncategorized.append(todo)
    
    # 输出各分类待办
    for cat_id, todos in by_category.items():
        cat = categories.get(cat_id, {'name': '未知', 'icon': '📋'})
        lines.append(f"## {cat['icon']} {cat['name']}")
        for todo in todos:
            due = f" (📅 {todo['due_date']})" if todo['due_date'] else ""
            reminder = f" 🔔" if todo['reminder_at'] else ""
            lines.append(f"- [ ] {todo['title']}{due}{reminder}")
            if todo['notes']:
                lines.append(f"  - 备注: {todo['notes']}")
        lines.append("")
    
    if uncategorized:
        lines.append("## 📋 未分类")
        for todo in uncategorized:
            due = f" (📅 {todo['due_date']})" if todo['due_date'] else ""
            lines.append(f"- [ ] {todo['title']}{due}")
        lines.append("")
    
    # 最近完成的
    completed = [t for t in data['todos'] if t['completed']][:5]
    if completed:
        lines.append("## ✅ 最近完成")
        for todo in completed:
            lines.append(f"- [x] {todo['title']}")
        lines.append("")
    
    return '\n'.join(lines)

def sync_to_openviking(content):
    """同步到 OpenViking"""
    try:
        from openviking_client import OpenVikingClient
        
        client = OpenVikingClient()
        
        # 存储为记忆
        result = client.store_memory(
            content=content,
            category='todos',
            tags=['待办', '任务', 'todo'],
            metadata={
                'source': 'todolist_app',
                'type': 'todo_sync'
            }
        )
        
        print(f"✅ 已同步到 OpenViking")
        return True
        
    except ImportError:
        print("⚠️ OpenViking 客户端未配置，保存到本地文件")
        # 保存到本地文件作为备选
        output_path = os.path.expanduser('~/.openclaw/workspace/knowledge/todos_sync.md')
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ 已保存到 {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ 同步失败: {e}")
        return False

def main():
    print("🔄 正在同步待办事项...")
    
    data = fetch_todos()
    if not data:
        return
    
    content = format_for_memory(data)
    if not content:
        print("没有数据需要同步")
        return
    
    print(content)
    print("\n" + "="*50 + "\n")
    
    sync_to_openviking(content)

if __name__ == '__main__':
    main()
