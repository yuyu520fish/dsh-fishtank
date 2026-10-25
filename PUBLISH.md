# 把鱼缸收录进插件市场

市场是 GitHub 上的 **awesome-dsh-plugin** 列表：它在 `data/plugins/` 里一插件一 YAML，网站和 README 由数据生成。收录 = **向那个仓库提一个 PR，只加一个文件**。

## 0. 前提（都已就绪）

- [x] `package.json` 里声明 `dsh.bundle`（`patch: ./cordis.patch.yml`）——没有它任何市场都装不上
- [x] `dsh.client`（platform: web）——带页面
- [x] 真实可运行代码（不是占位）
- [x] `assets/icon-180.png`（GitHub 托管的位图，市场卡片用，SVG 会被拒）
- [x] LICENSE / README

## 1. 建仓库

把 `dsh-fishtank/` 整个目录推到一个**公开的 GitHub 仓库**，仓库名建议 `dsh-fishtank`。

- 仓库根目录就是包的根目录（`package.json` 在根上）
- 给仓库加 topic：`dsh-plugin`
- 仓库要**至少 1 天老**（CI 有硬门槛；提前建好，明天再提 PR）

非 npm 安装也没问题——市场从 GitHub 装。

## 2. 填条目

复制 `market-entry.yml`（本仓库里那份模板），把 `<owner>` 换成你的 GitHub 用户名，然后放到 awesome-dsh-plugin 的 `data/plugins/<owner>__dsh-fishtank.yml`。

- `category`：先填 `fun`（鱼缸是伙伴/娱乐性质；维护者觉得该换会自动改，近义类不会被拒）
- `description.en` 必填且**必须与代码一致**——写“自己的记忆、心情、心事”没问题，别写“无限记忆”“自动学习”
- `icon` 指向仓库里的 `assets/icon-180.png`（raw.githubusercontent 链接）

## 3. 提 PR

1. fork [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
2. 加文件 `data/plugins/<owner>__dsh-fishtank.yml`
3. 提交 PR，标题类似 `Add <owner>/dsh-fishtank`

一个 PR 最多 3 条（鱼缸只有 1 条）。CI 会检查：条数、`dsh.bundle`、仓库年龄、`awesome-lint`、README 能否重新生成。通过了维护者读代码 + 核对描述，然后合入。

## 4. 上线后

- 用户：Harness → 插件市场 Discover → 找到“鱼缸 / fishtank” → 安装 → 重载 → 左侧栏出现“鱼缸”
- 更新：改自己的仓库、推新版即可（条目不用动，除非改描述/分类）
- 截图（可选）：仓库里放 `screenshots.json` 列 1–8 张图，市场详情页自动展示

## 需要我继续做的

有 GitHub 账号后告诉我用户名，我可以：
- 把 README 里所有链接改成真实仓库地址
- 生成带真实 owner 的 yml
- 写 PR 描述（中英）
- 要的话顺手把 npm 包也发了（可选，只影响下载量排序）
