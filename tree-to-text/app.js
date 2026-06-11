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

// ===== JSON 输入 Modal =====
const inputJsonBtn = document.getElementById('inputJsonBtn');
const jsonModal = document.getElementById('jsonModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalImportBtn = document.getElementById('modalImportBtn');
const modalError = document.getElementById('modalError');
const editorContainer = document.getElementById('editorContainer');

let monacoEditor = null;
let monacoReady = false;
let monacoFailed = false;
let monacoPromise = null;

/** 从 CDN 加载 Monaco Editor（AMD 方式），带缓存防止并发加载 */
function ensureMonaco() {
  if (monacoReady) return Promise.resolve();
  if (monacoFailed) return Promise.reject(new Error('Monaco 之前加载失败'));
  if (monacoPromise) return monacoPromise;

  monacoPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      try {
        window.require.config({
          paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
        });
        window.require(['vs/editor/editor.main'], () => {
          monacoReady = true;
          resolve();
        });
      } catch (e) {
        monacoFailed = true;
        monacoPromise = null;
        reject(e);
      }
    };
    script.onerror = () => {
      monacoFailed = true;
      monacoPromise = null;
      reject(new Error('Monaco 加载失败'));
    };
    document.head.appendChild(script);
  });
  return monacoPromise;
}

/**
 * 解析宽松 JSON（支持 key/value 不加引号）
 *
 * 特性：
 *  - 自动给未加引号的 key 补引号（支持 Unicode 属性名）
 *  - 自动给未加引号的 string value 补引号（跳过 true/false/null 关键字）
 *  - 支持 // 和 /* *​/ 注释（仅在字符串外）
 *  - 支持单引号字符串
 *  - 自动去除末尾多余的逗号
 *  - 版本号如 1.0.0 会自动加引号（非合法数字）
 *  - 字符串内的注释符号不会被误处理
 */
function parseLooseJson(text) {
  let out = '';
  let inString = false;
  let strChar = null;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1] || '';

    // === 字符串模式：原样输出 ===
    if (inString) {
      if (c === '\\' && n) { out += c + n; i++; }
      else if (c === strChar) { out += '"'; inString = false; }
      else { out += c; }
      continue;
    }

    // === 字符串外 ===

    // 字符串开始（支持单引号，统一转为双引号）
    if (c === '"' || c === "'") {
      inString = true;
      strChar = c; // c === "'" 时用 "'" 结束匹配，但输出用 '"'
      out += '"';
      continue;
    }

    // 单行注释 //
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    // 多行注释 /* */
    if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // 结构字符
    if ('{}[]:,'.includes(c)) { out += c; continue; }

    // 空白
    if (/\s/.test(c)) { out += c; continue; }

    // 未加引号的标识符（key / value / 数组元素）
    if (/[a-zA-Z_$\p{L}]/u.test(c)) {
      let word = '';
      while (i < text.length && /[\w$\p{L}]/u.test(text[i])) { word += text[i]; i++; }
      i--;
      out += ['true', 'false', 'null'].includes(word) ? word : '"' + word + '"';
      continue;
    }

    // 数字或类数字（如版本号 1.0.0）
    if (/[\d]/.test(c) || (c === '-' && /\d/.test(n)) || (c === '+' && /\d/.test(n)) || (c === '.' && /\d/.test(n))) {
      let num = '';
      let dotCount = 0;
      while (i < text.length && /[\d.eE+\-.]/i.test(text[i])) {
        if (text[i] === '.') dotCount++;
        num += text[i];
        i++;
      }
      i--;
      // 多于一个点、以点开头/结尾、以 e/E/+- 结尾、以 + 开头 → 当作字符串
      if (dotCount > 1 || /^\./.test(num) || /[.\-+eE]$/i.test(num) || /^\+/.test(num)) {
        out += '"' + num + '"';
      } else {
        out += num;
      }
      continue;
    }

    // 其他（极少出现）
    out += c;
  }

  // 安全去除末尾逗号（字符串已被正确处理，不会误伤）
  out = out.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(out);
}

// 打开 Modal
inputJsonBtn.addEventListener('click', async () => {
  modalError.style.display = 'none';
  modalError.textContent = '';

  const currentJson = JSON.stringify(tree.toJSON(), null, 2);
  jsonModal.classList.add('open');

  // 若 Monaco 尚未就绪，尝试从 CDN 加载
  if (!monacoReady) {
    try {
      editorContainer.innerHTML = '<div class="editor-loading">正在加载编辑器...</div>';
      await ensureMonaco();
    } catch {
      // Monaco 加载失败 → 降级为 textarea
      editorContainer.innerHTML = '';
      const ta = document.createElement('textarea');
      ta.id = 'jsonFallbackEditor';
      ta.spellcheck = false;
      Object.assign(ta.style, {
        width: '100%', height: '100%',
        background: '#0a0e17', color: '#c8d6e5',
        border: 'none', padding: '14px',
        fontFamily: 'inherit', fontSize: '13px',
        resize: 'none', outline: 'none',
        tabSize: '2', whiteSpace: 'pre',
        overflowWrap: 'normal', overflowX: 'auto',
        lineHeight: '1.6'
      });
      ta.value = currentJson;
      editorContainer.appendChild(ta);
      setTimeout(() => ta.focus(), 100);
      return;
    }
  }

  // 创建或更新 Monaco 编辑器
  if (!monacoEditor) {
    editorContainer.innerHTML = '';
    monacoEditor = window.monaco.editor.create(editorContainer, {
      value: currentJson,
      language: 'json',
      theme: 'vs-dark',
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
      tabSize: 2,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      padding: { top: 8 },
      wordWrap: 'off',
    });
  } else {
    monacoEditor.setValue(currentJson);
  }
  setTimeout(() => monacoEditor?.focus(), 200);
});

function closeModal() {
  jsonModal.classList.remove('open');
  // 关闭时释放 Monaco 编辑器，防止内存泄漏
  if (monacoEditor) {
    monacoEditor.dispose();
    monacoEditor = null;
  }
}

function showParseError(msg) {
  modalError.textContent = msg;
  modalError.style.display = 'block';
}

// 导入按钮 — 解析并应用
modalImportBtn.addEventListener('click', () => {
  const text = monacoEditor
    ? monacoEditor.getValue()
    : document.getElementById('jsonFallbackEditor')?.value || '';

  if (!text.trim()) {
    showParseError('请输入 JSON 内容');
    return;
  }
  try {
    const obj = parseLooseJson(text);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('根节点必须是一个对象（Object）');
    }
    if (!obj.label) {
      throw new Error('缺少 "label" 字段（根节点名称）');
    }
    tree = Tree.fromJSON(obj);
    ui = new TreeUI(tree, treeContainer, () => updateOutput());
    renderAll();
    closeModal();
    showToast('JSON 已导入', 'success');
  } catch (err) {
    showParseError('导入失败：' + err.message);
  }
});

// 关闭事件
modalCloseBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
jsonModal.addEventListener('click', (e) => {
  if (e.target === jsonModal) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && jsonModal.classList.contains('open')) {
    // 如果焦点在 Monaco 编辑器内（Escape 用于关闭提示框等），不关闭模态窗口
    if (editorContainer.contains(document.activeElement)) return;
    closeModal();
  }
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
