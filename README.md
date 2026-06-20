# 推币机游戏 MVP

一个可部署到 Netlify 或自有香港服务器的合规休闲推币机 Web MVP。

## 技术栈

- Vite
- TypeScript
- Phaser 3
- Matter.js

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`，Netlify 会读取 `netlify.toml` 自动发布；自有服务器可让 Nginx 指向 `dist/`。

## 合规边界

- 不做现金返还。
- 不做实物兑换。
- 不做付费随机抽奖。
- 不使用“提现”“返现”“中奖”等敏感表达。

## Netlify 发布

1. 推送代码到 GitHub。
2. Netlify 选择 `Add new site -> Import an existing project`。
3. 连接 GitHub 仓库。
4. Build command 使用 `npm run build`。
5. Publish directory 使用 `dist`。

## 香港服务器部署

推荐域名：

```text
https://coinpusher.xhscopy.top
```

本地构建并同步到服务器：

```bash
./deploy/deploy_hk.sh root@你的香港服务器IP /var/www/coinpusher
```

Nginx 配置模板：

```text
deploy/nginx/coinpusher.xhscopy.top.conf
```

DNS 建议在阿里云添加：

```text
类型：A
主机记录：coinpusher
记录值：香港服务器公网 IP
```
