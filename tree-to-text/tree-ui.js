/**
 * tree-ui.js — 可视化树编辑器组件
 * 将 Tree 渲染为可交互的 DOM，支持编辑/增删/折叠
 */
import { Tree } from './tree-data.js';

export class TreeUI {
  /**
   * @param {Tree} tree
   * @param {HTMLElement} container
   * @param {Function} onChange 树变化后的回调
   */
  constructor(tree, container, onChange) {
    this.tree = tree;
    this.container = container;
    this.onChange = onChange || (() => {});
    this.selectedId = null;
    this._keyHandler = null;
  }

  /** 全量重新渲染 */
  render() {
    this.container.innerHTML = '';
    this._renderNode(this.tree.root, this.container, 0, true);
    this._attachGlobalKey();
  }

  /** 递归渲染一个节点及其子节点 */
  _renderNode(node, parentEl, depth, isRoot) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'tree-node';
    nodeDiv.dataset.id = node.id;

    // ---- 行 ----
    const row = document.createElement('div');
    row.className = 'tree-node-row';
    if (this.selectedId === node.id) row.classList.add('selected');

    // 缩进（用占位模拟深度）
    const indent = document.createElement('span');
    indent.className = 'tree-indent';
    // 根节点不需要缩进
    // 子节点的缩进由父级的 prefix 决定，这里我们用空格占位
    // 实际的视觉缩进由 children 的 padding 体现
    row.appendChild(indent);

    // 折叠/展开按钮
    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle' + (node.isLeaf ? ' leaf' : '');
    toggle.textContent = node.collapsed ? '▶' : '▼';
    toggle.title = node.collapsed ? '展开' : '折叠';
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      node.collapsed = !node.collapsed;
      this.render();
      this.onChange();
    });
    row.appendChild(toggle);

    // 连接线字符
    if (!isRoot) {
      const conn = document.createElement('span');
      conn.className = 'tree-connector' + (node.isLast ? ' last' : '');
      conn.textContent = node.isLast ? '└── ' : '├── ';
      row.appendChild(conn);
    }

    // 标签
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.label;
    label.contentEditable = false;
    label.addEventListener('click', (e) => {
      // 根节点与普通节点一样，单击直接进入编辑
      e.stopPropagation();
      this._selectNode(node.id);
      this._editLabel(node, label);
    });
    // 回车确认编辑
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        label.blur();
      }
      if (e.key === 'Escape') {
        label.textContent = node.label; // 恢复原值
        label.blur();
      }
    });
    label.addEventListener('blur', () => {
      const newLabel = label.textContent.trim();
      if (newLabel && newLabel !== node.label) {
        node.label = newLabel;
        this.onChange();
      } else {
        label.textContent = node.label;
      }
      row.classList.remove('editing');
      label.contentEditable = false;
    });
    label.addEventListener('focus', () => {
      // 全选文字
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(label);
      sel.removeAllRanges();
      sel.addRange(range);
    });
    row.appendChild(label);

    // 操作按钮
    const actions = document.createElement('span');
    actions.className = 'tree-actions';

    // 上移
    const upBtn = document.createElement('button');
    upBtn.className = 'tree-action-btn';
    upBtn.textContent = '↑';
    upBtn.title = '上移';
    upBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      node.moveUp();
      this.render();
      this.onChange();
    });
    actions.appendChild(upBtn);

    // 下移
    const downBtn = document.createElement('button');
    downBtn.className = 'tree-action-btn';
    downBtn.textContent = '↓';
    downBtn.title = '下移';
    downBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      node.moveDown();
      this.render();
      this.onChange();
    });
    actions.appendChild(downBtn);

    // 添加子节点
    const addBtn = document.createElement('button');
    addBtn.className = 'tree-action-btn';
    addBtn.textContent = '＋';
    addBtn.title = '添加子节点';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const child = node.addChild('新节点');
      if (node.collapsed) node.collapsed = false;
      this.render();
      this.onChange();
      // 自动聚焦新节点
      setTimeout(() => this._focusLabel(child.id), 50);
    });
    actions.appendChild(addBtn);

    // 删除
    if (!isRoot) {
      const delBtn = document.createElement('button');
      delBtn.className = 'tree-action-btn danger';
      delBtn.textContent = '✕';
      delBtn.title = '删除节点';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        node.remove();
        if (this.selectedId === node.id) this.selectedId = null;
        this.render();
        this.onChange();
      });
      actions.appendChild(delBtn);
    }

    row.appendChild(actions);
    nodeDiv.appendChild(row);

    // ---- 子节点容器 ----
    if (!node.isLeaf) {
      const childrenDiv = document.createElement('div');
      childrenDiv.className = 'tree-children' + (node.collapsed ? ' collapsed' : '');
      // 通过 padding 实现缩进
      childrenDiv.style.paddingLeft = '24px';

      for (const child of node.children) {
        this._renderNode(child, childrenDiv, depth + 1, false);
      }
      nodeDiv.appendChild(childrenDiv);
    }

    parentEl.appendChild(nodeDiv);
  }

  /** 选中一个节点（仅更新样式，不触发全量重绘） */
  _selectNode(id) {
    // 移除旧选中样式
    if (this.selectedId) {
      const oldRow = this.container.querySelector(`[data-id="${this.selectedId}"] .tree-node-row`);
      if (oldRow) oldRow.classList.remove('selected');
    }
    this.selectedId = id;
    // 添加新选中样式
    const newRow = this.container.querySelector(`[data-id="${id}"] .tree-node-row`);
    if (newRow) newRow.classList.add('selected');
  }

  /** 进入标签编辑模式 */
  _editLabel(node, labelEl) {
    labelEl.contentEditable = true;
    labelEl.closest('.tree-node-row').classList.add('editing');
    labelEl.focus();
  }

  /** 根据 id 聚焦到标签 */
  _focusLabel(id) {
    const label = this.container.querySelector(`[data-id="${id}"] .tree-label`);
    if (label) {
      const node = this.tree.find(id);
      if (node) {
        this._editLabel(node, label);
      }
    }
  }

  /** 全局键盘快捷键 */
  _attachGlobalKey() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
    this._keyHandler = (e) => {
      // 如果正在编辑输入框中，不处理快捷键
      if (e.target.closest('.tree-label')?.contentEditable === 'true') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedId && this.selectedId !== this.tree.root.id) {
          const node = this.tree.find(this.selectedId);
          if (node) {
            node.remove();
            this.selectedId = null;
            this.render();
            this.onChange();
          }
        }
      }
      if (e.key === 'Tab') {
        // Tab 添加子节点
        e.preventDefault();
        if (this.selectedId) {
          const node = this.tree.find(this.selectedId);
          if (node) {
            const child = node.addChild('新节点');
            if (node.collapsed) node.collapsed = false;
            this.render();
            this.onChange();
            setTimeout(() => this._focusLabel(child.id), 50);
          }
        }
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }
}
