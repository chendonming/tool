/**
 * tree-to-text.js — 核心方法：将树结构转换为 Unicode 可视文字
 *
 * 输出格式示例：
 *   Root
 *   ├── Child 1
 *   │   ├── Grandchild 1
 *   │   └── Grandchild 2
 *   └── Child 2
 */

/**
 * 将 TreeNode 递归渲染为 Unicode 树形字符串
 * @param {import('./tree-data.js').TreeNode} node  当前节点
 * @param {string} prefix  父节点传递的前缀（含缩进 + 连线）
 * @param {boolean} isRoot 是否为根节点
 * @returns {string}
 */
export function renderNode(node, prefix = '', isRoot = true) {
  let result = '';

  if (isRoot) {
    result += node.label + '\n';
  } else {
    const connector = node.isLast ? '└── ' : '├── ';
    result += prefix + connector + node.label + '\n';
  }

  // 叶子节点不展开子节点
  if (node.isLeaf) return result;

  // 构建子节点的前缀
  const childPrefix = isRoot
    ? ''
    : prefix + (node.isLast ? '    ' : '│   ');

  for (const child of node.children) {
    result += renderNode(child, childPrefix, false);
  }

  return result;
}

/**
 * 将 Tree 渲染为 Unicode 字符串（入口）
 * @param {import('./tree-data.js').Tree} tree
 * @returns {string}
 */
export function renderTree(tree) {
  if (!tree || !tree.root) return '';
  return renderNode(tree.root, '', true);
}
