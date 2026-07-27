# Buddy Skill 安装手册

将代码执行任务委派给 CodeBuddy CLI 的 Claude Code Skill。

## 前置条件

### 1. CodeBuddy CLI

Buddy Skill 依赖 CodeBuddy CLI，需先安装并完成认证。

**安装方式**（以官方文档为准）：

```bash
# macOS/Linux
curl -fsSL https://codebuddy.ai/install.sh | sh

# 或通过 npm
npm install -g @codebuddy/cli
```

**验证安装**：

```bash
codebuddy --version
# 输出类似: codebuddy 2.x.x
```

**认证**：

```bash
codebuddy auth login
```

### 2. Node.js

需要 Node.js 18+ 运行 buddy-runner。

```bash
node --version
# v18.x.x 或更高
```

### 3. Claude Code

需要 Claude Code 2.1+ 版本。

```bash
claude --version
# 2.1.x 或更高
```

---

## 安装

### 方式一：一键安装（推荐）

```bash
# 克隆仓库
git clone https://github.com/your-username/claude-buddy-skill.git

# 进入目录
cd claude-buddy-skill

# 执行安装脚本
./install.sh
```

安装脚本会将 skill 复制到 `~/.claude/skills/buddy/`。

### 方式二：手动安装

```bash
# 创建 skill 目录
mkdir -p ~/.claude/skills/buddy/scripts

# 复制文件
cp skills/buddy/SKILL.md ~/.claude/skills/buddy/
cp skills/buddy/scripts/buddy-runner.mjs ~/.claude/skills/buddy/scripts/

# 设置权限
chmod +x ~/.claude/skills/buddy/scripts/buddy-runner.mjs
```

### 方式三：符号链接（开发者）

适合需要频繁更新的场景：

```bash
# 克隆仓库
git clone https://github.com/your-username/claude-buddy-skill.git

# 创建符号链接
ln -s $(pwd)/claude-buddy-skill/skills/buddy ~/.claude/skills/buddy
```

---

## 验证安装

### 1. 检查文件结构

```bash
ls -la ~/.claude/skills/buddy/
# 应显示:
# SKILL.md
# scripts/buddy-runner.mjs
```

### 2. 运行 Doctor

```bash
node ~/.claude/skills/buddy/scripts/buddy-runner.mjs doctor
```

预期输出：

```json
{
  "status": "ready",
  "binary": "/usr/local/bin/codebuddy",
  "version": "2.x.x",
  "message": "CodeBuddy is ready (version: 2.x.x)"
}
```

### 3. 在 Claude Code 中测试

重启 Claude Code 会话，然后输入：

```
/buddy
```

Claude 应加载 Buddy Skill 并显示帮助信息。

---

## 基本使用

### Doctor 命令

检查 CodeBuddy 状态：

```bash
node ~/.claude/skills/buddy/scripts/buddy-runner.mjs doctor
```

### Run 命令

执行代码任务：

```bash
node ~/.claude/skills/buddy/scripts/buddy-runner.mjs run \
  --cwd /path/to/project \
  --task "在 README.md 末尾添加一行：Buddy verified."
```

输出示例：

```json
{
  "provider": "codebuddy",
  "status": "completed",
  "runId": "run-1785123218879-b5582870",
  "cwd": "/path/to/project",
  "sessionId": "f4e08892-5376-4bd1-8b62-77ffe3189257",
  "summary": "Added line to README.md",
  "evidenceDir": "/path/to/project/.agent-runtime/runs/run-1785123218879-b5582870"
}
```

### Continue 命令

继续之前的会话：

```bash
node ~/.claude/skills/buddy/scripts/buddy-runner.mjs continue \
  --session f4e08892-5376-4bd1-8b62-77ffe3189257 \
  --cwd /path/to/project \
  --task "检查刚才的修改是否正确"
```

---

## 故障排除

### CodeBuddy 未安装

**症状**：

```json
{
  "status": "not_installed",
  "errorCode": "CODEBUDDY_NOT_INSTALLED"
}
```

**解决**：安装 CodeBuddy CLI 并确保在 PATH 中。

### 认证失效

**症状**：

```json
{
  "status": "authentication_required"
}
```

**解决**：运行 `codebuddy auth login`。

### 权限不足

**症状**：

```json
{
  "status": "not_executable",
  "errorCode": "CODEBUDDY_NOT_EXECUTABLE"
}
```

**解决**：

```bash
chmod +x $(which codebuddy)
```

### Skill 未加载

**症状**：输入 `/buddy` 无响应或报错。

**解决**：

1. 检查文件路径是否正确
2. 重启 Claude Code 会话
3. 检查 SKILL.md frontmatter 格式：

```yaml
---
name: buddy
description: ...
license: MIT
---
```

### 自定义 Binary 路径

如果 CodeBuddy 安装在非标准位置：

```bash
# 方式一：环境变量
export CODEBUDDY_BIN=/custom/path/to/codebuddy

# 方式二：CLI 参数
node buddy-runner.mjs doctor --binary /custom/path/to/codebuddy

# 方式三：配置文件
echo '{"codebuddyBinary": "/custom/path/to/codebuddy"}' > ~/.claude/skills/buddy/config.json
```

---

## 卸载

```bash
# 运行卸载脚本
./uninstall.sh

# 或手动删除
rm -rf ~/.claude/skills/buddy
```

---

## 更多信息

- [README.md](README.md) - 项目概述
- [SKILL.md](skills/buddy/SKILL.md) - Skill 完整文档
- [PHASE2_REPORT.md](PHASE2_REPORT.md) - 兼容性验收报告

---

## 开源协议

MIT License