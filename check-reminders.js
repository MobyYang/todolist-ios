#!/usr/bin/env node
/**
 * 检查待发送的提醒
 * 由 OpenClaw cron 调用，通过 Telegram 发送提醒
 * 
 * 用法：node check-reminders.js
 * 输出：待发送的提醒列表（JSON 或人类可读格式）
 */

const http = require('http');

const API_BASE = 'http://localhost:8890';

async function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function markSent(id) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${API_BASE}/api/reminders/${id}/sent`, {
      method: 'PATCH'
    }, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    const reminders = await fetchJSON('/api/reminders/pending');
    
    if (reminders.length === 0) {
      console.log('没有待发送的提醒');
      process.exit(0);
    }
    
    console.log(`找到 ${reminders.length} 个待发送的提醒:\n`);
    
    for (const todo of reminders) {
      const lines = [
        `🔔 **待办提醒**`,
        ``,
        `📝 ${todo.title}`,
      ];
      
      if (todo.notes) {
        lines.push(`📄 ${todo.notes}`);
      }
      if (todo.category_name) {
        lines.push(`📁 分类: ${todo.category_name}`);
      }
      if (todo.due_date) {
        lines.push(`📅 日期: ${todo.due_date}${todo.due_time ? ' ' + todo.due_time : ''}`);
      }
      
      console.log(lines.join('\n'));
      console.log('---');
      
      // 标记为已发送
      await markSent(todo.id);
    }
    
    // 输出 JSON 供程序解析
    console.log('\n[JSON]');
    console.log(JSON.stringify(reminders, null, 2));
    
  } catch (error) {
    console.error('检查提醒失败:', error.message);
    process.exit(1);
  }
}

main();
