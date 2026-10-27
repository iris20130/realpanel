# realpanel 导航面板

自建内网导航面板，基于 Next.js 15 App Router 的单端口应用。多用户、多分组，支持内网 / 外网地址自动分流、SMB 共享、RDP 远程桌面、WebDAV / OpenList 文件直链、离线文件和内嵌网页窗口。

所有数据保存在独立数据目录（`DATA_DIR`，Linux 部署建议 `/opt/realpanel-data`），升级程序不会丢数据。

## 致谢

本项目基于原作者 [lichong-a](https://github.com/lichong-a) 的开源项目 [navigation_panel](https://github.com/lichong-a/navigation_panel) 二次开发。原项目提供了导航面板的基础框架、视觉风格与交互设计，在此感谢原作者的开源与持续维护。

本仓库是在个人内网场景下的定制分支，主要新增多用户体系、内外网地址分流、WebDAV 挂载、离线文件、SMB / RDP 打开方式等能力，实际部署方式为 **Linux 原生运行（Node.js standalone + systemd）**，不使用 Docker 构建。

## 功能

| 分类 | 说明 |
| --- | --- |
| 导航与分组 | 站点卡片、自定义分组、拖拽排序、跨分组拖动、桌面端分组按 8 列合并排版、手机端分组抽屉 |
| 内外网 | 每个站点可填内网 / 外网地址，按访客所在网段自动选择；顶栏可切自动 / 强制内网 / 强制外网 / 全部显示 |
| 打开方式 | 当前页、新标签页、内嵌弹窗（可全屏 / 最小化）、SMB 共享、`rdp://` 远程桌面 |
| 点击确认 | 站点可自定义点击提示，填写后点击卡片先弹居中确认框，点「确认打开」才执行打开或下载 |
| WebDAV | 挂载 OpenList 等 WebDAV，直接选文件生成面板代理直链；内网由面板带账号取文件，外网 302 到反代直链 |
| 访问地址 | 配置面板的内网地址与反代地址，上传离线文件或选 WebDAV 文件时自动拼出内外网链接 |
| 离线文件 | 上传 html / svg / 图片等，按 `面板地址/文件名` 访问，可内联展示或下载 |
| 图标 | Iconify 搜索、favicon 自动识别、上传图片、WebDAV 选图 |
| 多用户 | 邀请码注册、用户启用 / 禁用 / 改密 / 改角色、每位用户独立面板、分组与站点可见范围 |
| 外观 | 品牌图标 / 文字切换、favicon 自定义、暗色 / 亮色 / 跟随系统、4 套动态背景 |
| 备份 | 管理员 JSON / ZIP 全量导出导入，成员仅导出本人面板 |

## 新特性（v1.0.0）

- 多用户 + 邀请码注册，每人独立面板，分组 / 站点可见范围可控
- 内网 / 外网地址自动分流，顶栏可切自动、强制内网、强制外网、全部显示
- SMB 共享与 `rdp://` 远程桌面，支持下载 `.reg` / `.rdp` 文件
- WebDAV / OpenList 挂载，签名直链 + 内外网通道，外网走 302 不占面板带宽
- 面板访问地址配置，选文件自动生成内网 / 外网两条链接
- 离线文件、品牌与主题、JSON / ZIP 全量备份

完整列表见 [更新日志](CHANGELOG.md)。

## 快速开始（Linux）

交付包是 Next.js standalone 产物，已包含全部运行依赖，服务器上只需装 **Node.js 22**（系统自带的 Node 18 跑不了 Next.js 15），**不需要再执行 `npm install` 或 `pnpm build`**。

```bash
# 1. 安装 Node.js 22（系统已有 22 可跳过）
mkdir -p /opt/node
curl -fsSL https://nodejs.org/dist/v22.20.0/node-v22.20.0-linux-x64.tar.xz -o /tmp/node.tar.xz
tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1

# 2. 解压程序
mkdir -p /opt/realpanel
tar -xzf realpanel-linux-deploy-<日期>.tar.gz -C /opt/realpanel

# 3. 建数据目录（备份、迁移只需搬这个目录）
mkdir -p /opt/realpanel-data

# 4. 前台试跑
cd /opt/realpanel
PORT=3000 DATA_DIR=/opt/realpanel-data /opt/node/bin/node server.js
```

正式使用建议注册成 systemd 常驻服务，unit 文件、Node 安装、防火墙放行等完整步骤见 [安装手册（Linux）](安装手册.md)。

启动后访问：

- 面板首页：`http://<服务器IP>:3000`
- 首次初始化：`http://<服务器IP>:3000/setup`（创建管理员账号）
- 登录 / 注册：`http://<服务器IP>:3000/login`
- 管理面板：`http://<服务器IP>:3000/admin`（`/portal` 为兼容别名）

首次启动数据目录为空，需要先完成 `/setup` 初始化。

### 其他部署方式

仓库同时提供 `Dockerfile` 与 `docker-compose.yml`，如需容器化可自行构建；本项目实际以 Linux 原生方式运行，容器方式未经长期验证。

## 数据目录

运行时的 `config.json`、用户、面板、图标、离线文件全部写到 `DATA_DIR`，未设置时默认是程序目录下的 `data/`。Linux 部署建议放在独立目录并写进 systemd：

```ini
Environment=DATA_DIR=/opt/realpanel-data
```

目录结构：

```
data/
├── config.json          # 初始化状态、JWT 密钥、品牌设置、WebDAV 配置
├── users.json           # 用户账号（密码为 bcrypt 哈希）
├── invites.json         # 邀请码
├── panels/<userId>.json # 每位用户的分组与站点
├── uploads/             # 上传的站点图标 / 品牌图
├── files/               # 离线文件
└── files.json           # 离线文件元数据
```

- 运行服务的系统用户必须对数据目录有写权限，必要时执行 `chown -R <运行用户> /opt/realpanel-data`。
- 备份直接打包整个数据目录，或在「设置 → 导入导出」导出 JSON / ZIP（不含 JWT 密钥）。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `DATA_DIR` | `./data` | 数据目录，Linux 部署建议指向 `/opt/realpanel-data` |
| `TZ` | 系统时区 | 时区，建议 `Asia/Shanghai` |
| `NODE_ENV` | `production` | 运行环境，生产部署固定为 `production` |

## 反向代理

面板会读取访客 IP 判断是否与站点内网地址同网段（IPv4 按 /24，IPv6 按 /64）。经反向代理访问时，请务必透传真实客户端 IP：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Caddy：

```
nav.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

代理不透传客户端 IP 时，内外网可能判断不准，可在顶栏「网卡选择」里手动补充本机地址。

## SMB / RDP 协议

- SMB 地址（`\\host\share`、`smb://host/share`）点击时调用系统 `smb://` 协议打开资源管理器，并复制 UNC 路径。
- RDP 地址（`rdp://host:port`）点击时调用 `mstsc`，右键还可下载 `.rdp` 连接文件。
- 浏览器不能直接写注册表。「设置 → 导入导出」提供协议注册文件下载，需用户自行下载后双击导入（仅写 `HKCU`，无需管理员权限）。

## WebDAV / OpenList

在「设置 → WebDAV 挂载」填写内网地址、外网 / 反代地址和账号密码后：

- 「从 WebDAV 选择」选出的文件会生成相对直链 `/api/webdav/file?path=…&sig=…&via=…`，由服务端带 Basic 认证取文件，浏览器不再弹登录框。
- 内网链接带 `via=internal`，优先走内网 WebDAV；外网链接带 `via=external`，配置了反代地址时直接 302 到反代直链，由该地址自行校验登录，面板不再转发外网流量。
- 在「设置 → 访问地址」配置面板的内网地址与反代地址后，直链会带上对应前缀；未配置时跟随当前访问面板的域名。

WebDAV 账号密码保存在 `data/config.json`，不会下发到浏览器，但请注意保护数据目录。

## 本地开发

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

生产构建：

```bash
pnpm build
PORT=3000 node server.js
```

数据默认写到项目下的 `data/`，可用 `DATA_DIR` 指向其它位置。

## 相关文档

- [安装手册（Linux）](安装手册.md)
- [更新日志](CHANGELOG.md)
- [需求与变更记录](需求与变更记录.md)
- [常见问题](docs/faq.md)
- [部署文档（Docker，原项目遗留）](docs/deployment.md)

## License

本项目基于原作者 [lichong-a](https://github.com/lichong-a) 的开源项目 [navigation_panel](https://github.com/lichong-a/navigation_panel) 二次开发，遵循 MIT License，原项目版权归原作者所有。
