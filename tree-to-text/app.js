/**
 * app.js — 应用入口
 * 负责初始化、连接 Tree ↔ UI ↔ Unicode 输出
 */
import { Tree } from './tree-data.js';
import { renderTree } from './tree-to-text.js';
import { TreeUI } from './tree-ui.js';

// ===== DOM 引用 =====
const treeContainer = document.getElementById('treeContainer');
const unicodeOutput = document.getElementById('unicodeOutput');
const outputStats = document.getElementById('outputStats');
const addRootBtn = document.getElementById('addRootBtn');
const expandAllBtn = document.getElementById('expandAllBtn');
const collapseAllBtn = document.getElementById('collapseAllBtn');
const resetBtn = document.getElementById('resetBtn');
const copyBtn = document.getElementById('copyBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFileInput = document.getElementById('importFileInput');

// ===== 初始数据 =====
function createInitialTree() {
  return new Tree('根节点');
}

// ===== 状态 =====
let tree = createInitialTree();

// ===== 更新 Unicode 输出 =====
function updateOutput() {
  const text = renderTree(tree);
  unicodeOutput.textContent = text;
  const count = tree.size;
  outputStats.textContent = `共 ${count} 个节点 · ${count > 0 ? (text.match(/\n/g) || []).length + 1 : 0} 行`;
}

// ===== 初始化 TreeUI =====
let ui = new TreeUI(tree, treeContainer, () => {
  updateOutput();
});

// ===== 渲染 =====
function renderAll() {
  ui.render();
  updateOutput();
}

// ===== 工具栏动作 =====

// 添加根节点（创建新树）
addRootBtn.addEventListener('click', () => {
  const label = prompt('请输入根节点名称：', '根节点');
  if (!label) return;
  tree = new Tree(label);
  ui = new TreeUI(tree, treeContainer, () => updateOutput());
  renderAll();
});

// 全部展开
expandAllBtn.addEventListener('click', () => {
  tree.root.flatten().forEach(n => { n.collapsed = false; });
  renderAll();
});

// 全部折叠
collapseAllBtn.addEventListener('click', () => {
  tree.root.flatten().forEach(n => { if (n !== tree.root) n.collapsed = true; });
  renderAll();
});

// 重置
resetBtn.addEventListener('click', () => {
  tree = createInitialTree();
  ui = new TreeUI(tree, treeContainer, () => updateOutput());
  renderAll();
  showToast('已重置');
});

// 复制 Unicode 文本
copyBtn.addEventListener('click', async () => {
  const text = unicodeOutput.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('已复制到剪贴板', 'success');
  }
});

// 导出 JSON
exportBtn.addEventListener('click', () => {
  const json = JSON.stringify(tree.toJSON(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tree-data.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON 已导出', 'success');
});

// 导入 JSON
importBtn.addEventListener('click', () => {
  importFileInput.click();
});
importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const obj = JSON.parse(ev.target.result);
      // 校验格式
      if (!obj.label) throw new Error('缺少 label 字段');
      tree = Tree.fromJSON(obj);
      ui = new TreeUI(tree, treeContainer, () => updateOutput());
      renderAll();
      showToast('JSON 已导入', 'success');
    } catch (err) {
      showToast('导入失败：' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  // 重置 input 以便重复导入同一文件
  importFileInput.value = '';
});

// ===== Toast 组件 =====
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 2600);
}

// ===== 启动 =====
renderAll();
