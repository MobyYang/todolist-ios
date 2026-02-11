const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8890;

// 数据库路径
const DB_PATH = path.join(__dirname, 'todos.db');
const db = new Database(DB_PATH);

// 初始化数据库
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#007AFF',
    icon TEXT DEFAULT '📋',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT,
    category_id INTEGER,
    due_date DATE,
    due_time TIME,
    reminder_at DATETIME,
    reminder_sent INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  -- 笔记表
  CREATE TABLE IF NOT EXISTS memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    images TEXT,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 默认分类
  INSERT OR IGNORE INTO categories (id, name, color, icon) VALUES 
    (1, '今天', '#FF9500', '📅'),
    (2, '工作', '#007AFF', '💼'),
    (3, '个人', '#34C759', '👤'),
    (4, '购物', '#FF2D55', '🛒'),
    (5, '学习', '#AF52DE', '📚');
`);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==================== 分类 API ====================

// 获取所有分类（带待办计数）
app.get('/api/categories', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, 
           COUNT(CASE WHEN t.completed = 0 THEN 1 END) as pending_count,
           COUNT(t.id) as total_count
    FROM categories c
    LEFT JOIN todos t ON t.category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order, c.id
  `).all();
  res.json(categories);
});

// 创建分类
app.post('/api/categories', (req, res) => {
  const { name, color, icon } = req.body;
  const result = db.prepare(
    'INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)'
  ).run(name, color || '#007AFF', icon || '📋');
  res.json({ id: result.lastInsertRowid, name, color, icon });
});

// 更新分类
app.put('/api/categories/:id', (req, res) => {
  const { name, color, icon } = req.body;
  db.prepare(
    'UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?'
  ).run(name, color, icon, req.params.id);
  res.json({ success: true });
});

// 删除分类
app.delete('/api/categories/:id', (req, res) => {
  // 将该分类下的待办移到未分类
  db.prepare('UPDATE todos SET category_id = NULL WHERE category_id = ?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== 待办 API ====================

// 获取待办列表
app.get('/api/todos', (req, res) => {
  const { category_id, completed, search } = req.query;
  
  let sql = `
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (category_id) {
    sql += ' AND t.category_id = ?';
    params.push(category_id);
  }
  if (completed !== undefined) {
    sql += ' AND t.completed = ?';
    params.push(completed === 'true' ? 1 : 0);
  }
  if (search) {
    sql += ' AND (t.title LIKE ? OR t.notes LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY t.completed ASC, t.due_date ASC NULLS LAST, t.created_at DESC';

  const todos = db.prepare(sql).all(...params);
  res.json(todos);
});

// 获取单个待办
app.get('/api/todos/:id', (req, res) => {
  const todo = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `).get(req.params.id);
  res.json(todo);
});

// 创建待办
app.post('/api/todos', (req, res) => {
  const { title, notes, category_id, due_date, due_time, reminder_at } = req.body;
  const result = db.prepare(`
    INSERT INTO todos (title, notes, category_id, due_date, due_time, reminder_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, notes || null, category_id || null, due_date || null, due_time || null, reminder_at || null);
  
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
  res.json(todo);
});

// 更新待办
app.put('/api/todos/:id', (req, res) => {
  const { title, notes, category_id, due_date, due_time, reminder_at, completed } = req.body;
  
  let completedAt = null;
  if (completed === 1 || completed === true) {
    const existing = db.prepare('SELECT completed_at FROM todos WHERE id = ?').get(req.params.id);
    completedAt = existing?.completed_at || new Date().toISOString();
  }

  db.prepare(`
    UPDATE todos SET 
      title = COALESCE(?, title),
      notes = ?,
      category_id = ?,
      due_date = ?,
      due_time = ?,
      reminder_at = ?,
      completed = COALESCE(?, completed),
      completed_at = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, notes, category_id, due_date, due_time, reminder_at, completed ? 1 : 0, completedAt, req.params.id);

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  res.json(todo);
});

// 切换完成状态
app.patch('/api/todos/:id/toggle', (req, res) => {
  const todo = db.prepare('SELECT completed FROM todos WHERE id = ?').get(req.params.id);
  const newCompleted = todo.completed ? 0 : 1;
  const completedAt = newCompleted ? new Date().toISOString() : null;
  
  db.prepare(`
    UPDATE todos SET completed = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(newCompleted, completedAt, req.params.id);

  const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// 删除待办
app.delete('/api/todos/:id', (req, res) => {
  db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== 笔记 API ====================

// 获取笔记列表
app.get('/api/memos', (req, res) => {
  const { tag, search } = req.query;
  
  let sql = 'SELECT * FROM memos WHERE 1=1';
  const params = [];
  
  if (tag) {
    sql += ' AND tags LIKE ?';
    params.push(`%${tag}%`);
  }
  if (search) {
    sql += ' AND content LIKE ?';
    params.push(`%${search}%`);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const memos = db.prepare(sql).all(...params);
  
  // 解析 JSON 字段
  const result = memos.map(m => ({
    ...m,
    images: m.images ? JSON.parse(m.images) : [],
    tags: m.tags ? JSON.parse(m.tags) : []
  }));
  
  res.json(result);
});

// 获取所有标签
app.get('/api/memos/tags', (req, res) => {
  const memos = db.prepare('SELECT tags FROM memos WHERE tags IS NOT NULL').all();
  const tagCounts = {};
  
  memos.forEach(m => {
    const tags = JSON.parse(m.tags || '[]');
    tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  const result = Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  
  res.json(result);
});

// 创建笔记
app.post('/api/memos', (req, res) => {
  const { content, images, tags } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '内容不能为空' });
  }
  
  const result = db.prepare(`
    INSERT INTO memos (content, images, tags)
    VALUES (?, ?, ?)
  `).run(
    content.trim(),
    images ? JSON.stringify(images) : null,
    tags && tags.length > 0 ? JSON.stringify(tags) : null
  );
  
  const memo = db.prepare('SELECT * FROM memos WHERE id = ?').get(result.lastInsertRowid);
  res.json({
    ...memo,
    images: memo.images ? JSON.parse(memo.images) : [],
    tags: memo.tags ? JSON.parse(memo.tags) : []
  });
});

// 更新笔记
app.put('/api/memos/:id', (req, res) => {
  const { content, images, tags } = req.body;
  
  db.prepare(`
    UPDATE memos SET 
      content = ?,
      images = ?,
      tags = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    content,
    images ? JSON.stringify(images) : null,
    tags && tags.length > 0 ? JSON.stringify(tags) : null,
    req.params.id
  );
  
  const memo = db.prepare('SELECT * FROM memos WHERE id = ?').get(req.params.id);
  res.json({
    ...memo,
    images: memo.images ? JSON.parse(memo.images) : [],
    tags: memo.tags ? JSON.parse(memo.tags) : []
  });
});

// 删除笔记
app.delete('/api/memos/:id', (req, res) => {
  db.prepare('DELETE FROM memos WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 上传图片
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!require('fs').existsSync(uploadDir)) {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'));
    }
  }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

// 静态文件服务 - 上传的图片
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== 提醒 API ====================

// 获取待发送的提醒
app.get('/api/reminders/pending', (req, res) => {
  const now = new Date().toISOString();
  const reminders = db.prepare(`
    SELECT t.*, c.name as category_name
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.reminder_at IS NOT NULL 
      AND t.reminder_at <= ?
      AND t.reminder_sent = 0
      AND t.completed = 0
    ORDER BY t.reminder_at ASC
  `).all(now);
  res.json(reminders);
});

// 标记提醒已发送
app.patch('/api/reminders/:id/sent', (req, res) => {
  db.prepare('UPDATE todos SET reminder_sent = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 调度提醒 - 写入文件通知 AI 助手
const fs = require('fs');
app.post('/api/reminders/schedule', (req, res) => {
  const { todo_id, title, notes, reminder_at, category_name } = req.body;
  
  if (!reminder_at) {
    return res.json({ success: false, error: 'No reminder time' });
  }
  
  // 写入待处理提醒文件
  const reminderFile = path.join(__dirname, 'pending_reminders.json');
  let reminders = [];
  
  try {
    if (fs.existsSync(reminderFile)) {
      reminders = JSON.parse(fs.readFileSync(reminderFile, 'utf8'));
    }
  } catch (e) {
    reminders = [];
  }
  
  // 移除该待办的旧提醒
  reminders = reminders.filter(r => r.todo_id !== todo_id);
  
  // 添加新提醒
  reminders.push({
    todo_id,
    title,
    notes,
    reminder_at,
    category_name,
    created_at: new Date().toISOString()
  });
  
  fs.writeFileSync(reminderFile, JSON.stringify(reminders, null, 2));
  
  console.log(`🔔 新提醒已记录: "${title}" @ ${reminder_at}`);
  
  res.json({ success: true, message: '提醒已记录，AI 助手将在指定时间提醒你' });
});

// ==================== 统计 API（供 OpenViking 同步）====================

// 获取所有数据（供同步）
app.get('/api/export', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  const todos = db.prepare(`
    SELECT t.*, c.name as category_name 
    FROM todos t 
    LEFT JOIN categories c ON t.category_id = c.id
    ORDER BY t.created_at DESC
  `).all();
  
  const stats = {
    total: todos.length,
    pending: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length,
    categories: categories.length
  };

  res.json({ categories, todos, stats, exported_at: new Date().toISOString() });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`✅ TodoList 服务运行在 http://localhost:${PORT}`);
});
