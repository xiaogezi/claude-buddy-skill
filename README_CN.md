# Claude Buddy Skill

将代码执行任务委派给 CodeBuddy CLI 的 Claude Code Skill。

## 概述

本 Skill 让 Claude Code 可以将仓库探索、代码修改和测试执行任务委派给 CodeBuddy。Claude 仍负责：

- 规划和任务拆解
- 边界和验收标准定义
- 风险识别
- 结果审查和验证

## 安装

```bash
cd claude-buddy-skill
./install.sh
```

这会创建符号链接：`~/.claude/skills/buddy` → `./skills/buddy`

## 卸载

```bash
./uninstall.sh
```

## 前置条件：CodeBuddy CLI

**使用前必须安装并认证 CodeBuddy。**

### 检查可用性

```bash
node ~/.claude/skills/buddy/scripts/buddy-runner.mjs doctor
```

### 未安装时的提示

```json
{
  "status": "not_installed",
  "errorCode": "CODEBUDDY_NOT_INSTALLED",
  "message": "CodeBuddy is not installed or not in PATH",
  "suggestion": "Install CodeBuddy CLI first..."
}
```

### 指定 Binary 路径

CodeBuddy 安装在非标准位置时：

```bash
# 通过环境变量
export CODEBUDDY_BIN=/path/to/codebuddy

# 或通过 --binary 参数
node buddy-runner.mjs doctor --binary /path/to/codebuddy
```

### 安装后重新检查

```bash
node ~/.claude/skills/buddy/scripts/buddy-runner.mjs doctor
```

就绪时的预期输出：

```json
{
  "status": "ready",
  "binary": "codebuddy",
  "version": "1.2.3",
  "message": "CodeBuddy is ready (version: 1.2.3)"
}
```

## 使用方式

### 手动调用

在 Claude Code 中输入：

```
/buddy
```

### Doctor 命令

检查 CodeBuddy 可用性：

```bash
node scripts/buddy-runner.mjs doctor
node scripts/buddy-runner.mjs doctor --binary /custom/path/codebuddy
```

可能的状态：

| 状态 | 描述 |
|------|------|
| `ready` | 已安装且可用 |
| `not_installed` | 未找到 Binary |
| `not_in_path` | 存在但不在 PATH 中 |
| `not_executable` | 文件存在但无执行权限 |
| `version_check_failed` | `--version` 返回非零 |
| `authentication_required` | 需要认证 |
| `configuration_error` | 配置问题 |
| `unknown` | 无法确定状态 |

### Run 命令

执行新任务：

```bash
node scripts/buddy-runner.mjs run \
  --cwd /path/to/project \
  --task "为 UserService 添加单元测试"
```

### Continue 命令

继续已有会话：

```bash
node scripts/buddy-runner.mjs continue \
  --session abc123 \
  --cwd /path/to/project
```

## 输出格式

所有命令输出 JSON。示例 `run` 输出：

```json
{
  "provider": "codebuddy",
  "status": "completed",
  "runId": "run-1722051600000-a1b2c3d4",
  "cwd": "/path/to/project",
  "exitCode": 0,
  "startedAt": "2026-07-27T02:00:00.000Z",
  "finishedAt": "2026-07-27T02:05:00.000Z",
  "sessionId": "abc123",
  "summary": "Added unit tests for UserService",
  "evidenceDir": "/path/to/project/.agent-runtime/runs/run-1722051600000-a1b2c3d4"
}
```

### 状态值

| 状态 | 含义 |
|------|------|
| `completed` | 任务完成，有 session ID 和摘要 |
| `failed` | 非零退出码或错误 |
| `partial` | 零退出码但输出不完整 |
| `unknown` | 无法判断结果 |
| `blocked` | 预检失败，无法启动 |

## Evidence 目录

每次运行在 `<project>/.agent-runtime/runs/<run-id>/` 创建文件：

- `request.json` - 原始请求参数
- `prompt.md` - 任务提示词
- `raw.json` - 原始输出（截断）
- `stdout.log` - 完整 stdout
- `stderr.log` - 完整 stderr
- `result.json` - 结构化结果

## 错误码

| 错误码 | 描述 |
|--------|------|
| `CODEBUDDY_NOT_INSTALLED` | 未找到 Binary |
| `CODEBUDDY_NOT_IN_PATH` | 不在 PATH 中 |
| `CODEBUDDY_NOT_EXECUTABLE` | 无执行权限 |
| `CODEBUDDY_VERSION_CHECK_FAILED` | 版本检查失败 |
| `CODEBUDDY_AUTH_REQUIRED` | 需要认证 |
| `CODEBUDDY_CONFIGURATION_ERROR` | 配置错误 |
| `CODEBUDDY_START_FAILED` | 进程启动失败 |
| `SESSION_ID_REQUIRED` | Continue 缺少 session |
| `PREFLIGHT_FAILED` | 预检失败 |

## 执行后验证

**Claude 必须在 Buddy 完成后验证结果：**

1. 检查目标仓库的实际 Git diff
2. 运行测试验证改动
3. 验证验收标准
4. 不单信 Buddy 输出

**退出码 0 ≠ 成功** — 无法确认成功时，Skill 使用 `partial` 或 `unknown` 状态。

## 失败处理

- Buddy 失败 → Claude 不静默自行实现
- Buddy 不可用 → 返回 `blocked`，提供指引
- 从不伪造成功或 session ID

## 开发

### 运行测试

```bash
npm test
```

测试使用 fake `codebuddy`，无需真实安装。

### 项目结构

```
claude-buddy-skill/
├── skills/buddy/
│   ├── SKILL.md           # Skill 文档
│   └── scripts/
│       └── buddy-runner.mjs  # 主运行器
├── tests/
│   └── buddy-runner.test.mjs
├── test-helpers/
│   └── fake-codebuddy.sh
├── install.sh
├── uninstall.sh
├── package.json
├── README.md
└── README_CN.md
```

## 安全

- 使用 `spawn` 且 `shell: false` — 无 shell 插值
- 不自动修改 PATH
- 不自动安装
- 不自动认证
- 所有操作需用户显式执行

## 许可证

MIT