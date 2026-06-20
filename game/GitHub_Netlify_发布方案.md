---
title: GitHub Netlify 发布方案
created: 2026-06-21
status: deploy-plan
tags:
  - GitHub
  - Netlify
  - 游戏发布
  - 推币机
---

# GitHub Netlify 发布方案

## 当前项目定位

把推币机游戏 MVP 做成一个可静态发布的 Web 项目，代码托管到 GitHub，再用 Netlify 免费额度自动构建和发布。

## 技术栈

- Vite
- TypeScript
- Phaser 3
- Matter.js
- Netlify 静态部署

## 仓库结构

```text
/Users/dongzhijie/game/
  src/                 # 游戏源码
  public/assets/       # 发布用静态素材
  docs/                # 设计方案文档
  game/                # Obsidian vault
  index.html
  package.json
  netlify.toml
  README.md
```

## 发布配置

Netlify 构建命令：

```bash
npm run build
```

发布目录：

```text
dist
```

项目已包含：

```text
netlify.toml
```

## GitHub 推送步骤

当前本地仓库已经初始化：

```text
branch: main
commit: 052be5c Initial coin pusher MVP
```

下一步只需要创建 GitHub 远程仓库，然后执行：

```bash
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

如果远程仓库已经存在，只需要替换 `<你的 GitHub 仓库地址>`。

## Netlify 操作步骤

1. 打开 Netlify。
2. 选择 `Add new site`。
3. 选择 `Import an existing project`。
4. 连接 GitHub。
5. 选择推币机游戏仓库。
6. Build command 填 `npm run build`。
7. Publish directory 填 `dist`。
8. 点击 Deploy。

## 后续自动发布

每次提交并推送到 GitHub：

```bash
git add .
git commit -m "Update game"
git push
```

Netlify 会自动重新构建并更新线上版本。
