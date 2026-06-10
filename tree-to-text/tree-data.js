/**
 * tree-data.js — 树数据结构定义（TreeNode + Tree）
 * 纯数据层，不涉及任何 DOM 操作
 */

let nextId = 1;

export class TreeNode {
  /**
   * @param {string} label 节点显示文字
   * @param {TreeNode|null} parent 父节点
   */
  constructor(label, parent = null) {
    this.id = `n${nextId++}`;
    this.label = label || '新节点';
    this.parent = parent;
    this.children = [];
    this.collapsed = false;
  }

  /** 添加子节点 */
  addChild(label) {
    const child = new TreeNode(label, this);
    this.children.push(child);
    return child;
  }

  /** 从父节点移除自身（连带所有子孙） */
  remove() {
    if (!this.parent) return false;
    const idx = this.parent.children.indexOf(this);
    if (idx === -1) return false;
    this.parent.children.splice(idx, 1);
    return true;
  }

  /** 向上移动一位（与上一个兄弟交换） */
  moveUp() {
    if (!this.parent) return false;
    const siblings = this.parent.children;
    const idx = siblings.indexOf(this);
    if (idx <= 0) return false;
    [siblings[idx - 1], siblings[idx]] = [siblings[idx], siblings[idx - 1]];
    return true;
  }

  /** 向下移动一位（与下一个兄弟交换） */
  moveDown() {
    if (!this.parent) return false;
    const siblings = this.parent.children;
    const idx = siblings.indexOf(this);
    if (idx === -1 || idx >= siblings.length - 1) return false;
    [siblings[idx], siblings[idx + 1]] = [siblings[idx + 1], siblings[idx]];
    return true;
  }

  /** 节点深度（根节点为 0） */
  get depth() {
    let d = 0;
    let p = this.parent;
    while (p) { d++; p = p.parent; }
    return d;
  }

  /** 是否为父节点的最后一个子节点 */
  get isLast() {
    if (!this.parent) return true;
    return this.parent.children.indexOf(this) === this.parent.children.length - 1;
  }

  /** 是否为叶子节点 */
  get isLeaf() {
    return this.children.length === 0;
  }

  /** 根节点 */
  get root() {
    let node = this;
    while (node.parent) node = node.parent;
    return node;
  }

  /** 深度优先遍历，返回扁平数组 */
  flatten() {
    const result = [];
    const walk = (n) => { result.push(n); n.children.forEach(walk); };
    walk(this);
    return result;
  }

  /** 克隆子树（不含 parent 引用） */
  clone() {
    const c = new TreeNode(this.label);
    c.id = this.id;
    c.collapsed = this.collapsed;
    c.children = this.children.map(ch => {
      const cloned = ch.clone();
      cloned.parent = c;
      return cloned;
    });
    return c;
  }
}

export class Tree {
  /**
   * @param {string} rootLabel
   */
  constructor(rootLabel) {
    this.root = new TreeNode(rootLabel || 'Root');
  }

  /** 按 id 查找节点 */
  find(id) {
    const walk = (node) => {
      if (node.id === id) return node;
      for (const ch of node.children) {
        const found = walk(ch);
        if (found) return found;
      }
      return null;
    };
    return walk(this.root);
  }

  /** 在指定节点下添加子节点 */
  addChild(parentId, label) {
    const parent = this.find(parentId);
    if (!parent) return null;
    return parent.addChild(label);
  }

  /** 删除节点 */
  remove(id) {
    const node = this.find(id);
    if (!node || node === this.root) return false;
    return node.remove();
  }

  /** 重命名节点 */
  rename(id, label) {
    const node = this.find(id);
    if (!node) return false;
    node.label = label;
    return true;
  }

  /** 将树序列化为可 JSON 化的普通对象 */
  toJSON() {
    const serialize = (node) => ({
      label: node.label,
      collapsed: node.collapsed,
      children: node.children.map(serialize),
    });
    return serialize(this.root);
  }

  /** 从普通对象反序列化为 Tree */
  static fromJSON(obj) {
    const t = new Tree('');
    const deserialize = (o, parent) => {
      const node = new TreeNode(o.label, parent);
      node.collapsed = !!o.collapsed;
      node.children = (o.children || []).map(ch => deserialize(ch, node));
      return node;
    };
    t.root = deserialize(obj, null);
    return t;
  }

  /** 统计节点数 */
  get size() {
    return this.root.flatten().length;
  }
}
