# clinn 测试说明
- 测试完成：是（2026-10-04）
- 测试日期：2026-10-04
- 测试内容：单元测了中文/英文分词 tokenizer、语法检查 syntax_check、模板引擎 template_engine；集成测了 file_tools / edit_tools 在临时目录的真实读写与行列编辑；注入测了工具名路径穿越/shell 元字符写盘前拒绝、模板名 `../` 路径穿越按内存 key 处理、畸形 JSON params 拒绝、write_file 写畸形 JS 报语法警告；钩子测了工具注册表 register→dispatch→权限回调(trusted/危险旁路)→注销、失败隔离、未注册工具拒绝。涉及模块：Tools/（tokenizer、edit_tools、file_tools、template_engine、syntax_check、index 注册表）。
- 运行命令：`npm test`（= `node --test "tests/*.test.js"`）
- 测试框架：Node.js 内置 node:test + node:assert/strict
- 模型：豆包（Doubao）生成

本目录 `tests/` 是 clinn 的单元 + 集成测试套件，使用 Node.js 内置的
[`node:test`](https://nodejs.org/api/test.html) 运行器与 `node:assert/strict`，
**无需安装任何 npm 依赖**（被测模块仅依赖 Node 内置模块；`Tools/index.js` 惰性加载 puppeteer，不会在测试期触发）。

## 运行方式

```powershell
# 在仓库根目录
npm test
# 等价于：
node --test "tests/*.test.js"
```

要求 Node.js >= 18（开发环境为 Node 22）。当前 **44 个用例全部通过（44 pass / 0 fail）**。

## 测试了什么

| 文件 | 覆盖模块 | 类型 |
|------|----------|------|
| `tests/tokenizer.test.js` | `Tools/tokenizer.js` 的中文/英文分词 `segment()`、`buildDictFromKeywords()` | 单元 |
| `tests/edit_tools.test.js` | `Tools/edit_tools.js` 的 `edit_lines`（insert_before/after/replace/delete）、`read_lines`、`search_in_range`，在临时目录上真实读写 | 单元 + 集成 |
| `tests/file_tools.test.js` | `Tools/file_tools.js` 的 write/read/copy/move/list/delete，非空目录删除保护，写后语法检查流水线 | 单元 + 集成 |
| `tests/template_engine.test.js` | `Tools/template_engine.js` 的 list/generate、参数注入、路径穿越拒绝 | 单元 + 注入 |
| `tests/syntax_check.test.js` | `Tools/syntax_check.js` 的 `syntaxCheck`（js/json/跳过格式）与 `findUp` | 单元 |
| `tests/registry.test.js` | `Tools/index.js` 工具注册表（钩子/插件系统） | 钩子 + 注入 |

### 注入测试（不可信输入）
- `registry.test.js` — `saveToolToFile` 对含路径穿越（`../evil`）、shell 元字符（`a;rm -rf /`）、
  空格/斜杠的工具名在**写盘前**即拒绝；空代码与超长代码被拒绝。
- `template_engine.test.js` — 畸形 JSON `params` 被拒绝；模板名 `../../../../etc/passwd` 作为内存 key 处理，
  **不会**解析为磁盘路径（路径穿越被阻断）。
- `file_tools.test.js` — `write_file` 写入畸形 JS 时 surfaced 语法警告，而非静默信任输入。

### 钩子/插件测试
- `registry.test.js` — 工具注册→分发→注销生命周期；未注册工具被拒绝（`unknown tool`）；
  危险工具默认拒绝、权限回调放行/拒绝、trusted 名单旁路；一个工具抛错不影响注册表其余工具（失败隔离）；
  `searchToolRegistry` / `toFunctionDeclarations` / `filterToolDeclarations` 行为。

## 备注
- 测试不触碰真实用户数据目录：钩子测试仅在内存注册表注册临时探针并在结束后注销；
  文件类测试全部使用 `os.tmpdir()` 下的临时目录并在 `after()` 清理。
- `search_in_files` / `find_files` 依赖外部 `grep`/`find`，在 Windows 测试环境不可用，故不测该执行路径。
