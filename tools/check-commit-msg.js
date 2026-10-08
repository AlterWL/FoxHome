/*
 * tools/check-commit-msg.js —— 校验提交信息是否符合约定式提交
 *
 * 规则见 CONTRIBUTING.md。退出码：0 通过，1 不合规，2 用法错误。
 *
 * 用法：
 *   node tools/check-commit-msg.js .git/COMMIT_EDITMSG    # 校验文件（git 钩子就是这么调的）
 *   node tools/check-commit-msg.js "feat(page): 加个东西"  # 校验一段文字
 */
'use strict';

const fs = require('fs');

const TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf',
  'test', 'build', 'ci', 'chore', 'revert',
];

// type(scope)!: subject —— 括号与 ! 都可省略
const HEADER_RE = /^([a-z]+)(?:\(([^()]*)\))?(!)?: (.+)$/;

const MAX_SUBJECT = 72;   // 描述长度上限
const MAX_HEADER = 100;   // 标题整行上限

// git 自己生成的、或约定俗成的特殊标题，直接放行
const EXEMPT_RE = /^(Merge |Revert |fixup! |squash! |Initial commit$)/;

function readMessage(args) {
  const arg = args[0];
  if (!arg) return null;
  if (fs.existsSync(arg)) return fs.readFileSync(arg, 'utf8');
  return arg;
}

/** 去掉注释行与首尾空行 */
function normalize(text) {
  const lines = String(text).split(/\r?\n/).filter((line) => !/^\s*#/.test(line));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

function check(text) {
  const lines = normalize(text);
  if (!lines.length) return ['提交信息是空的'];

  const header = lines[0].trim();
  if (EXEMPT_RE.test(header)) return [];

  const match = HEADER_RE.exec(header);
  if (!match) {
    return ['标题得是 `type(scope): 描述` 的格式（scope 和 ! 可省略），当前是：' + header];
  }

  const type = match[1];
  const scope = match[2];
  const bang = match[3];
  const subject = match[4];
  const problems = [];

  if (TYPES.indexOf(type) < 0) {
    problems.push('不认识的 type `' + type + '`，可选：' + TYPES.join(' / '));
  }
  if (scope !== undefined && !/^[a-z][a-z0-9-]*$/.test(scope)) {
    problems.push('scope 用小写字母和连字符，当前是：' + (scope || '(空)'));
  }
  if (!subject.trim()) {
    problems.push('描述不能为空');
  }
  if (subject.length > MAX_SUBJECT) {
    problems.push('描述 ' + subject.length + ' 字符，超过上限 ' + MAX_SUBJECT);
  }
  if (/[。.]$/.test(subject.trim())) {
    problems.push('描述结尾不要加句号');
  }
  if (header.length > MAX_HEADER) {
    problems.push('标题整行 ' + header.length + ' 字符，超过上限 ' + MAX_HEADER);
  }
  if (bang && lines.slice(1).join('\n').indexOf('BREAKING CHANGE') < 0) {
    problems.push('标题带了 `!`，请再在脚注补一行 `BREAKING CHANGE: 说明`');
  }

  return problems;
}

function main() {
  const text = readMessage(process.argv.slice(2));
  if (text === null) {
    console.error('用法：node tools/check-commit-msg.js <提交信息文件或文字>');
    process.exit(2);
  }

  const problems = check(text);
  if (!problems.length) {
    process.exit(0);
  }

  console.error('提交信息不符合规范（规则见 CONTRIBUTING.md）：');
  problems.forEach(function (line) { console.error('  - ' + line); });
  console.error('');
  console.error('示例：feat(shortcuts): 按浏览历史自动补充快捷方式');
  process.exit(1);
}

main();
