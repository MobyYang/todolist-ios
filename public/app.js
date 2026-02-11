// 效率工具应用 - 待办 + 笔记
const API = '/api';

// ==================== 待办模块 ====================
class TodoApp {
  constructor() {
    this.categories = [];
    this.allTodos = [];
    this.todos = [];
    this.currentFilter = { type: 'all' };
    this.selectedIcon = '📋';
    this.editingCategoryId = null;
  }

  async init() {
    await this.loadCategories();
    await this.loadAllTodos();
    this.filterTodos();
    this.bindEvents();
    this.render();
  }

  async loadCategories() {
    const res = await fetch(`${API}/categories`);
    this.categories = await res.json();
  }

  async loadAllTodos() {
    const res = await fetch(`${API}/todos`);
    this.allTodos = await res.json();
  }

  filterTodos() {
    if (this.currentFilter.type === 'category') {
      this.todos = this.allTodos.filter(t => t.category_id == this.currentFilter.categoryId);
    } else if (this.currentFilter.type === 'completed') {
      this.todos = this.allTodos.filter(t => t.completed);
    } else {
      this.todos = this.allTodos;
    }
  }

  async refreshData() {
    await this.loadCategories();
    await this.loadAllTodos();
    this.filterTodos();
    this.render();
  }

  render() {
    this.renderCategories();
    this.renderTodos();
    this.renderCategorySelect();
    this.updateAddButton();
  }

  renderCategories() {
    const container = document.getElementById('category-list');
    const allPending = this.allTodos.filter(t => !t.completed).length;
    
    const allItem = `
      <div class="category-item ${this.currentFilter.type === 'all' ? 'active' : ''}" data-id="all">
        <div class="category-icon" style="background: rgba(10, 132, 255, 0.2); color: #0A84FF">📋</div>
        <span class="category-name">全部</span>
        <span class="category-count">${allPending}</span>
      </div>
    `;
    
    const categoryItems = this.categories.map(cat => {
      const count = this.allTodos.filter(t => !t.completed && t.category_id == cat.id).length;
      return `
        <div class="category-item ${this.currentFilter.type === 'category' && this.currentFilter.categoryId == cat.id ? 'active' : ''}" data-id="${cat.id}">
          <div class="category-icon" style="background: ${cat.color}20; color: ${cat.color}">${cat.icon}</div>
          <span class="category-name">${cat.name}</span>
          <span class="category-count">${count}</span>
        </div>
      `;
    }).join('');
    
    container.innerHTML = allItem + categoryItems;
  }

  renderTodos() {
    const container = document.getElementById('todo-list');
    const emptyState = document.getElementById('empty-state');
    
    const pending = this.todos.filter(t => !t.completed);
    const completed = this.todos.filter(t => t.completed);
    
    if (this.todos.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    let html = '';
    
    if (pending.length > 0) {
      html += `<div class="todo-group">${pending.map(todo => this.renderTodoItem(todo)).join('')}</div>`;
    }
    
    if (completed.length > 0 && this.currentFilter.type !== 'completed') {
      html += `<div class="todo-group"><div class="todo-group-header">已完成 (${completed.length})</div>${completed.map(todo => this.renderTodoItem(todo)).join('')}</div>`;
    } else if (this.currentFilter.type === 'completed') {
      html += `<div class="todo-group">${completed.map(todo => this.renderTodoItem(todo)).join('')}</div>`;
    }
    
    container.innerHTML = html;
  }

  renderTodoItem(todo) {
    const isOverdue = todo.due_date && !todo.completed && new Date(todo.due_date) < new Date().setHours(0,0,0,0);
    return `
      <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
        <div class="todo-checkbox" data-id="${todo.id}"></div>
        <div class="todo-content" data-id="${todo.id}">
          <div class="todo-title">${this.escapeHtml(todo.title)}</div>
          ${todo.notes ? `<div class="todo-notes">${this.escapeHtml(todo.notes)}</div>` : ''}
          <div class="todo-meta">
            ${todo.due_date ? `<span class="${isOverdue ? 'overdue' : ''}">📅 ${this.formatDate(todo.due_date)}${todo.due_time ? ' ' + todo.due_time : ''}</span>` : ''}
            ${todo.reminder_at ? `<span>🔔 ${this.formatDateTime(todo.reminder_at)}</span>` : ''}
          </div>
          ${todo.category_name ? `<span class="todo-category-tag" style="background: ${todo.category_color}">${todo.category_name}</span>` : ''}
        </div>
      </div>
    `;
  }

  renderCategorySelect() {
    const select = document.getElementById('todo-category');
    select.innerHTML = `<option value="">无分类</option>${this.categories.map(cat => `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`).join('')}`;
  }

  updateAddButton() {
    const addBtn = document.getElementById('add-todo-btn');
    const emptyAddBtn = document.getElementById('empty-add-btn');
    if (this.currentFilter.type === 'completed') {
      addBtn.classList.add('hidden');
      emptyAddBtn?.classList.add('hidden');
    } else {
      addBtn.classList.remove('hidden');
      emptyAddBtn?.classList.remove('hidden');
    }
  }

  bindEvents() {
    document.getElementById('sidebar-toggle').addEventListener('click', () => this.toggleSidebar());

    document.getElementById('category-list').addEventListener('click', (e) => {
      const item = e.target.closest('.category-item');
      if (item) {
        const id = item.dataset.id;
        if (id === 'all') {
          this.currentFilter = { type: 'all' };
          document.getElementById('current-view-title').textContent = '全部';
        } else {
          this.currentFilter = { type: 'category', categoryId: id };
          const cat = this.categories.find(c => c.id == id);
          document.getElementById('current-view-title').textContent = cat ? cat.name : '待办事项';
        }
        this.filterTodos();
        this.render();
        this.closeSidebar();
      }
    });

    let longPressTimer = null;
    document.getElementById('category-list').addEventListener('touchstart', (e) => {
      const item = e.target.closest('.category-item');
      if (item && item.dataset.id !== 'all') {
        longPressTimer = setTimeout(() => this.openCategoryModal(item.dataset.id), 500);
      }
    });
    document.getElementById('category-list').addEventListener('touchend', () => clearTimeout(longPressTimer));
    document.getElementById('category-list').addEventListener('touchmove', () => clearTimeout(longPressTimer));
    document.getElementById('category-list').addEventListener('contextmenu', (e) => {
      const item = e.target.closest('.category-item');
      if (item && item.dataset.id !== 'all') {
        e.preventDefault();
        this.openCategoryModal(item.dataset.id);
      }
    });

    document.getElementById('show-completed-btn').addEventListener('click', () => {
      this.currentFilter = { type: 'completed' };
      document.getElementById('current-view-title').textContent = '已完成';
      this.filterTodos();
      this.render();
      this.closeSidebar();
    });

    document.getElementById('add-todo-btn').addEventListener('click', () => this.openTodoModal());
    document.getElementById('empty-add-btn').addEventListener('click', () => this.openTodoModal());

    document.getElementById('todo-list').addEventListener('click', (e) => {
      const checkbox = e.target.closest('.todo-checkbox');
      if (checkbox) { this.toggleTodo(checkbox.dataset.id); return; }
      const content = e.target.closest('.todo-content');
      if (content) this.openTodoModal(content.dataset.id);
    });

    document.getElementById('modal-cancel').addEventListener('click', () => this.closeTodoModal());
    document.getElementById('modal-save').addEventListener('click', () => this.saveTodo());
    document.getElementById('modal-delete').addEventListener('click', () => this.deleteTodo());

    document.getElementById('add-category-btn').addEventListener('click', () => this.openCategoryModal());
    document.getElementById('category-cancel').addEventListener('click', () => this.closeCategoryModal());
    document.getElementById('category-save').addEventListener('click', () => this.saveCategory());
    document.getElementById('category-delete').addEventListener('click', () => this.deleteCategory());

    document.getElementById('icon-picker').addEventListener('click', (e) => {
      const option = e.target.closest('.icon-option');
      if (option) {
        document.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedIcon = option.dataset.icon;
      }
    });

    document.getElementById('todo-modal').addEventListener('click', (e) => { if (e.target.id === 'todo-modal') this.closeTodoModal(); });
    document.getElementById('category-modal').addEventListener('click', (e) => { if (e.target.id === 'category-modal') this.closeCategoryModal(); });
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('open')) {
      this.closeSidebar();
    } else {
      sidebar.classList.add('open');
      overlay.classList.add('visible');
    }
  }

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('visible');
  }

  openTodoModal(id = null) {
    const modal = document.getElementById('todo-modal');
    const title = document.getElementById('modal-title');
    const deleteBtn = document.getElementById('modal-delete');
    
    document.getElementById('todo-id').value = '';
    document.getElementById('todo-title').value = '';
    document.getElementById('todo-notes').value = '';
    document.getElementById('todo-category').value = this.currentFilter.type === 'category' ? this.currentFilter.categoryId : '';
    document.getElementById('todo-date').value = '';
    document.getElementById('todo-time').value = '';
    document.getElementById('todo-reminder').value = '';
    
    if (id) {
      title.textContent = '编辑待办';
      deleteBtn.classList.remove('hidden');
      const todo = this.todos.find(t => t.id == id);
      if (todo) {
        document.getElementById('todo-id').value = todo.id;
        document.getElementById('todo-title').value = todo.title;
        document.getElementById('todo-notes').value = todo.notes || '';
        document.getElementById('todo-category').value = todo.category_id || '';
        document.getElementById('todo-date').value = todo.due_date || '';
        document.getElementById('todo-time').value = todo.due_time || '';
        if (todo.reminder_at) document.getElementById('todo-reminder').value = todo.reminder_at.slice(0, 16);
      }
    } else {
      title.textContent = '新建待办';
      deleteBtn.classList.add('hidden');
    }
    modal.classList.remove('hidden');
    document.getElementById('todo-title').focus();
  }

  closeTodoModal() { document.getElementById('todo-modal').classList.add('hidden'); }

  async saveTodo() {
    const id = document.getElementById('todo-id').value;
    const data = {
      title: document.getElementById('todo-title').value.trim(),
      notes: document.getElementById('todo-notes').value.trim() || null,
      category_id: document.getElementById('todo-category').value || null,
      due_date: document.getElementById('todo-date').value || null,
      due_time: document.getElementById('todo-time').value || null,
      reminder_at: document.getElementById('todo-reminder').value || null
    };
    if (!data.title) { alert('请输入待办内容'); return; }
    
    let savedTodo;
    if (id) {
      const res = await fetch(`${API}/todos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      savedTodo = await res.json();
    } else {
      const res = await fetch(`${API}/todos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      savedTodo = await res.json();
    }
    
    if (data.reminder_at && savedTodo) {
      await fetch(`${API}/reminders/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todo_id: savedTodo.id, title: data.title, notes: data.notes, reminder_at: data.reminder_at, category_name: this.categories.find(c => c.id == data.category_id)?.name || null }) });
    }
    
    this.closeTodoModal();
    await this.refreshData();
  }

  async toggleTodo(id) {
    await fetch(`${API}/todos/${id}/toggle`, { method: 'PATCH' });
    await this.refreshData();
  }

  async deleteTodo() {
    const id = document.getElementById('todo-id').value;
    if (!id || !confirm('确定删除这个待办吗？')) return;
    await fetch(`${API}/todos/${id}`, { method: 'DELETE' });
    this.closeTodoModal();
    await this.refreshData();
  }

  openCategoryModal(id = null) {
    const modal = document.getElementById('category-modal');
    const title = document.getElementById('category-modal-title');
    const deleteBtn = document.getElementById('category-delete');
    
    document.getElementById('category-id').value = '';
    document.getElementById('category-name').value = '';
    document.getElementById('category-color').value = '#0A84FF';
    document.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
    document.querySelector('.icon-option[data-icon="📋"]').classList.add('selected');
    this.selectedIcon = '📋';
    this.editingCategoryId = null;
    
    if (id) {
      title.textContent = '编辑分类';
      deleteBtn.classList.remove('hidden');
      this.editingCategoryId = id;
      const cat = this.categories.find(c => c.id == id);
      if (cat) {
        document.getElementById('category-id').value = cat.id;
        document.getElementById('category-name').value = cat.name;
        document.getElementById('category-color').value = cat.color;
        this.selectedIcon = cat.icon;
        document.querySelectorAll('.icon-option').forEach(o => o.classList.toggle('selected', o.dataset.icon === cat.icon));
      }
    } else {
      title.textContent = '新建分类';
      deleteBtn.classList.add('hidden');
    }
    modal.classList.remove('hidden');
    document.getElementById('category-name').focus();
  }

  closeCategoryModal() { document.getElementById('category-modal').classList.add('hidden'); this.editingCategoryId = null; }

  async saveCategory() {
    const id = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value.trim();
    const color = document.getElementById('category-color').value;
    if (!name) { alert('请输入分类名称'); return; }
    
    if (id) {
      await fetch(`${API}/categories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color, icon: this.selectedIcon }) });
    } else {
      await fetch(`${API}/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color, icon: this.selectedIcon }) });
    }
    this.closeCategoryModal();
    await this.refreshData();
  }

  async deleteCategory() {
    const id = document.getElementById('category-id').value;
    if (!id) return;
    const cat = this.categories.find(c => c.id == id);
    if (!confirm(`确定删除分类"${cat?.name}"吗？`)) return;
    await fetch(`${API}/categories/${id}`, { method: 'DELETE' });
    this.closeCategoryModal();
    if (this.currentFilter.type === 'category' && this.currentFilter.categoryId == id) {
      this.currentFilter = { type: 'all' };
      document.getElementById('current-view-title').textContent = '全部';
    }
    await this.refreshData();
  }

  escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
  formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return '今天';
    if (date.toDateString() === tomorrow.toDateString()) return '明天';
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  formatDateTime(dtStr) {
    const dt = new Date(dtStr);
    return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours()}:${dt.getMinutes().toString().padStart(2, '0')}`;
  }
}

// ==================== 笔记模块 ====================
class MemoApp {
  constructor() {
    this.memos = [];
    this.tags = [];
    this.currentTag = null;
    this.pendingImages = [];
    this.pendingTags = [];
    this.currentMemoId = null;
  }

  async init() {
    await this.loadMemos();
    await this.loadTags();
    this.bindEvents();
    this.render();
  }

  async loadMemos() {
    let url = `${API}/memos`;
    if (this.currentTag) url += `?tag=${encodeURIComponent(this.currentTag)}`;
    const res = await fetch(url);
    this.memos = await res.json();
  }

  async loadTags() {
    const res = await fetch(`${API}/memos/tags`);
    this.tags = await res.json();
  }

  async refresh() {
    await this.loadMemos();
    await this.loadTags();
    this.render();
  }

  render() {
    this.renderTags();
    this.renderMemos();
  }

  renderTags() {
    const container = document.getElementById('tag-list');
    if (this.tags.length === 0) {
      container.innerHTML = '<div style="padding: 20px; color: var(--label-tertiary); text-align: center;">暂无标签</div>';
      return;
    }
    container.innerHTML = this.tags.map(tag => `
      <div class="tag-item ${this.currentTag === tag.name ? 'active' : ''}" data-tag="${tag.name}">
        <span class="tag-item-name">${tag.name}</span>
        <span class="tag-item-count">${tag.count}</span>
      </div>
    `).join('');
  }

  renderMemos() {
    const container = document.getElementById('memo-list');
    const emptyState = document.getElementById('memo-empty-state');
    
    if (this.memos.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    container.innerHTML = this.memos.map(memo => `
      <div class="memo-card" data-id="${memo.id}">
        <div class="memo-card-content">${this.escapeHtml(memo.content)}</div>
        ${memo.images && memo.images.length > 0 ? `<div class="memo-card-images">${memo.images.map(img => `<img src="${img}" alt="">`).join('')}</div>` : ''}
        ${memo.tags && memo.tags.length > 0 ? `<div class="memo-card-tags">${memo.tags.map(tag => `<span class="memo-card-tag">#${tag}</span>`).join('')}</div>` : ''}
        <div class="memo-card-time">${this.formatTime(memo.created_at)}</div>
      </div>
    `).join('');
  }

  renderPendingImages() {
    const container = document.getElementById('memo-images');
    container.innerHTML = this.pendingImages.map((img, i) => `
      <div class="memo-image-item">
        <img src="${img}" alt="">
        <button class="remove-image" data-index="${i}">×</button>
      </div>
    `).join('');
  }

  renderPendingTags() {
    const container = document.getElementById('memo-tags-input');
    container.innerHTML = this.pendingTags.map((tag, i) => `
      <span class="memo-tag">#${tag}<button class="remove-tag" data-index="${i}">×</button></span>
    `).join('');
  }

  renderRecentTags() {
    const container = document.getElementById('recent-tags');
    const recentTags = this.tags.slice(0, 10);
    container.innerHTML = recentTags.map(tag => `<button class="recent-tag" data-tag="${tag.name}">#${tag.name}</button>`).join('');
  }

  bindEvents() {
    // 侧边栏
    document.getElementById('memo-sidebar-toggle').addEventListener('click', () => this.toggleSidebar());
    
    // 标签点击
    document.getElementById('tag-list').addEventListener('click', (e) => {
      const item = e.target.closest('.tag-item');
      if (item) {
        this.currentTag = item.dataset.tag;
        document.getElementById('memo-view-title').textContent = `#${this.currentTag}`;
        this.loadMemos().then(() => this.render());
        this.closeSidebar();
      }
    });

    document.getElementById('show-all-memos-btn').addEventListener('click', () => {
      this.currentTag = null;
      document.getElementById('memo-view-title').textContent = '笔记';
      this.loadMemos().then(() => this.render());
      this.closeSidebar();
    });

    // 编辑器粘贴图片
    document.getElementById('memo-editor').addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          await this.uploadImage(file);
          break;
        }
      }
    });

    // 添加图片按钮
    document.getElementById('image-input').addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        await this.uploadImage(file);
      }
      e.target.value = '';
    });

    // 移除待上传图片
    document.getElementById('memo-images').addEventListener('click', (e) => {
      const btn = e.target.closest('.remove-image');
      if (btn) {
        this.pendingImages.splice(parseInt(btn.dataset.index), 1);
        this.renderPendingImages();
      }
    });

    // 添加标签
    document.getElementById('add-tag-btn').addEventListener('click', () => this.openTagInput());
    document.getElementById('tag-input-cancel').addEventListener('click', () => this.closeTagInput());
    document.getElementById('tag-input-confirm').addEventListener('click', () => this.confirmTagInput());
    document.getElementById('tag-input-field').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.confirmTagInput(); });
    document.getElementById('recent-tags').addEventListener('click', (e) => {
      const btn = e.target.closest('.recent-tag');
      if (btn) {
        const tag = btn.dataset.tag;
        if (tag && !this.pendingTags.includes(tag)) {
          this.pendingTags.push(tag);
          this.renderPendingTags();
        }
        this.closeTagInput();
      }
    });
    document.getElementById('tag-input-modal').addEventListener('click', (e) => { if (e.target.id === 'tag-input-modal') this.closeTagInput(); });

    // 移除待添加标签
    document.getElementById('memo-tags-input').addEventListener('click', (e) => {
      const btn = e.target.closest('.remove-tag');
      if (btn) {
        this.pendingTags.splice(parseInt(btn.dataset.index), 1);
        this.renderPendingTags();
      }
    });

    // 提交笔记
    document.getElementById('memo-submit-btn').addEventListener('click', () => this.submitMemo());

    // 笔记卡片点击
    document.getElementById('memo-list').addEventListener('click', (e) => {
      const card = e.target.closest('.memo-card');
      if (card) this.openMemoDetail(card.dataset.id);
    });

    // 笔记详情弹窗
    document.getElementById('memo-modal-close').addEventListener('click', () => this.closeMemoDetail());
    document.getElementById('memo-modal-delete').addEventListener('click', () => this.deleteMemo());
    document.getElementById('memo-modal').addEventListener('click', (e) => { if (e.target.id === 'memo-modal') this.closeMemoDetail(); });

    // 图片预览
    document.getElementById('memo-list').addEventListener('click', (e) => {
      if (e.target.tagName === 'IMG' && e.target.closest('.memo-card-images')) {
        e.stopPropagation();
        this.showImagePreview(e.target.src);
      }
    });
    document.getElementById('memo-detail').addEventListener('click', (e) => {
      if (e.target.tagName === 'IMG') {
        this.showImagePreview(e.target.src);
      }
    });
    document.getElementById('memo-images').addEventListener('click', (e) => {
      if (e.target.tagName === 'IMG') {
        this.showImagePreview(e.target.src);
      }
    });
    document.getElementById('image-preview').addEventListener('click', (e) => {
      if (e.target.id === 'image-preview' || e.target.id === 'image-preview-close') {
        this.hideImagePreview();
      }
    });
  }

  showImagePreview(src) {
    document.getElementById('image-preview-img').src = src;
    document.getElementById('image-preview').classList.remove('hidden');
    setTimeout(() => document.getElementById('image-preview').classList.add('visible'), 10);
  }

  hideImagePreview() {
    document.getElementById('image-preview').classList.remove('visible');
    setTimeout(() => {
      document.getElementById('image-preview').classList.add('hidden');
      document.getElementById('image-preview-img').src = '';
    }, 200);
  }

  toggleSidebar() {
    const sidebar = document.getElementById('memo-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('open')) {
      this.closeSidebar();
    } else {
      sidebar.classList.add('open');
      overlay.classList.add('visible');
    }
  }

  closeSidebar() {
    document.getElementById('memo-sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('visible');
  }

  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch(`${API}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        this.pendingImages.push(data.url);
        this.renderPendingImages();
      }
    } catch (e) {
      alert('图片上传失败');
    }
  }

  openTagInput() {
    this.renderRecentTags();
    document.getElementById('tag-input-field').value = '';
    document.getElementById('tag-input-modal').classList.remove('hidden');
    document.getElementById('tag-input-field').focus();
  }

  closeTagInput() {
    document.getElementById('tag-input-modal').classList.add('hidden');
  }

  confirmTagInput() {
    const tag = document.getElementById('tag-input-field').value.trim().replace(/^#/, '');
    if (tag && !this.pendingTags.includes(tag)) {
      this.pendingTags.push(tag);
      this.renderPendingTags();
    }
    this.closeTagInput();
  }

  async submitMemo() {
    const content = document.getElementById('memo-editor').innerText.trim();
    if (!content) { alert('请输入内容'); return; }
    
    await fetch(`${API}/memos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        images: this.pendingImages.length > 0 ? this.pendingImages : null,
        tags: this.pendingTags.length > 0 ? this.pendingTags : null
      })
    });
    
    // 清空输入
    document.getElementById('memo-editor').innerText = '';
    this.pendingImages = [];
    this.pendingTags = [];
    this.renderPendingImages();
    this.renderPendingTags();
    
    await this.refresh();
  }

  openMemoDetail(id) {
    const memo = this.memos.find(m => m.id == id);
    if (!memo) return;
    this.currentMemoId = id;
    
    const container = document.getElementById('memo-detail');
    container.innerHTML = `
      <div class="memo-detail-content">${this.escapeHtml(memo.content)}</div>
      ${memo.images && memo.images.length > 0 ? `<div class="memo-detail-images">${memo.images.map(img => `<img src="${img}" alt="">`).join('')}</div>` : ''}
      ${memo.tags && memo.tags.length > 0 ? `<div class="memo-detail-tags">${memo.tags.map(tag => `<span class="memo-card-tag">#${tag}</span>`).join('')}</div>` : ''}
      <div class="memo-detail-time">${this.formatTime(memo.created_at)}</div>
    `;
    
    document.getElementById('memo-modal').classList.remove('hidden');
  }

  closeMemoDetail() {
    document.getElementById('memo-modal').classList.add('hidden');
    this.currentMemoId = null;
  }

  async deleteMemo() {
    if (!this.currentMemoId || !confirm('确定删除这条笔记吗？')) return;
    await fetch(`${API}/memos/${this.currentMemoId}`, { method: 'DELETE' });
    this.closeMemoDetail();
    await this.refresh();
  }

  escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
  formatTime(timeStr) {
    const d = new Date(timeStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
}

// ==================== 主应用 ====================
class App {
  constructor() {
    this.todoApp = new TodoApp();
    this.memoApp = new MemoApp();
    this.currentPage = 'todo';
  }

  async init() {
    await this.todoApp.init();
    await this.memoApp.init();
    this.bindNavEvents();
  }

  bindNavEvents() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        this.switchPage(page);
      });
    });

    // 统一处理侧边栏遮罩点击 - 直接关闭所有侧边栏
    var overlay = document.getElementById('sidebar-overlay');
    overlay.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('memo-sidebar').classList.remove('open');
      this.classList.remove('visible');
      console.log('Overlay clicked, sidebars closed');
    };
  }

  switchPage(page) {
    this.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}-page`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  }
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
