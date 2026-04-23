# ProjectControls 项目控制系统

项目控制系统，用于管理工程项目进度、活动和报告。

## 技术栈

- **后端**: FastAPI + SQLAlchemy + MySQL + Redis
- **前端**: React + TypeScript + Vite + Ant Design
- **数据库**: MySQL 8.0+
- **缓存**: Redis

## 开发环境设置

### 前置要求

- Python 3.8+ 
- Node.js 16+
- MySQL 8.0+
- Redis（可选，用于缓存）

### 1. 克隆项目

```bash
git clone <repository-url>
cd ProjectControls
```

### 2. 后端设置

#### 2.1 创建 Python 虚拟环境

```bash
cd backend
python -m venv myenv

# Windows
myenv\Scripts\activate

# Linux/Mac
source myenv/bin/activate
```

#### 2.2 安装依赖

```bash
pip install -r requirements.txt
```

#### 2.3 配置环境变量

```bash
# 复制环境变量示例文件
copy .env.example .env  # Windows
# 或
cp .env.example .env    # Linux/Mac
```

编辑 `backend/.env` 文件，修改以下配置：

- `DATABASE_URL`: 数据库连接字符串
- `SECRET_KEY`: JWT 密钥（生产环境请使用强随机字符串）
- `REDIS_HOST`, `REDIS_PORT`: Redis 配置（如果使用 Redis）

#### 2.4 初始化数据库

```bash
# 创建数据库（如果尚未创建）
mysql -u root -p < ../database/init.sql

# 或者手动在 MySQL 中执行
# CREATE DATABASE IF NOT EXISTS projectcontrols CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 2.5 启动后端服务

```bash
# 方式1: 使用 run.py
python run.py

# 方式2: 使用 uvicorn 直接启动
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端服务将在 `http://localhost:8000` 启动。

### 3. 前端设置

#### 3.1 安装依赖

```bash
cd frontend

# 如果 npm install 很慢，可以使用国内镜像
npm config set registry https://registry.npmmirror.com
npm install
```

#### 3.2 启动开发服务器

```bash
npm run dev
```

前端服务将在 `http://localhost:3000` 启动。

前端已配置代理，API 请求会自动转发到后端 `http://127.0.0.1:8000`。

## 项目结构

```
ProjectControls/
├── backend/              # 后端代码
│   ├── app/             # 应用主目录
│   │   ├── api/         # API 路由
│   │   ├── models/      # 数据模型
│   │   ├── services/    # 业务逻辑
│   │   └── ...
│   ├── .env.example     # 环境变量示例
│   ├── requirements.txt # Python 依赖
│   └── run.py          # 启动脚本
├── frontend/            # 前端代码
│   ├── src/
│   │   ├── components/  # React 组件
│   │   ├── pages/       # 页面组件
│   │   ├── services/    # API 服务
│   │   └── ...
│   ├── package.json     # Node.js 依赖
│   └── vite.config.ts   # Vite 配置
├── database/            # 数据库脚本
│   └── init.sql        # 初始化脚本
└── README.md           # 本文件
```

## 开发注意事项

### Git 忽略的文件

以下文件和目录已被 `.gitignore` 忽略，不会提交到版本控制：

- Python 虚拟环境 (`myenv/`, `venv/`, `env/`)
- Node.js 依赖 (`node_modules/`)
- 环境变量文件 (`.env`, `.env.local`)
- 编译缓存 (`__pycache__/`, `*.pyc`)
- 日志文件 (`*.log`)
- 上传文件 (`uploads/`, `reports/`, `powerbi/`)
- 原始系统文件 (`original system/`)

### 环境变量

**重要**: `.env` 文件包含敏感信息（数据库密码、密钥等），**不要**提交到 Git。

首次设置时，请：
1. 复制 `backend/.env.example` 为 `backend/.env`
2. 根据实际情况修改配置值

### 数据库迁移

表结构通过 SQLAlchemy 自动创建。首次运行时，应用会自动创建所需的表。

### 常见问题

#### 后端无法连接数据库

- 检查 MySQL 服务是否运行
- 确认 `DATABASE_URL` 配置正确
- 确认数据库已创建

#### 前端 API 请求失败

- 确认后端服务已启动（`http://localhost:8000`）
- 检查浏览器控制台错误信息
- 确认 `vite.config.ts` 中的代理配置正确

#### 端口被占用

- 后端：修改 `backend/run.py` 中的端口号
- 前端：修改 `frontend/vite.config.ts` 中的端口号

## 生产环境部署

详细的部署文档请参考：

- **[Windows Server 部署文档](./DEPLOYMENT_WINDOWS.md)** - Windows Server 详细部署指南
- **[快速部署指南](./QUICK_DEPLOY_WINDOWS.md)** - Windows Server 快速上手指南
- **[SSL证书配置](./SSL_CERT_SETUP.md)** - HTTPS证书配置指南（包含Windows部分）

### 快速开始

```powershell
# 以管理员权限运行 PowerShell
# 右键点击 PowerShell，选择"以管理员身份运行"

# 在服务器上克隆项目
cd C:\
git clone <your-repository-url> ProjectControls
cd ProjectControls

# 运行自动部署脚本
.\deploy-windows.ps1
```

### 部署要点

1. 修改 `SECRET_KEY` 为强随机字符串
2. 配置数据库连接（`.env` 文件）
3. 配置 Nginx 反向代理
4. 配置 SSL 证书（HTTPS）
5. 设置适当的 CORS 策略
6. 配置 Windows 服务（使用 NSSM）
7. 启用日志记录和监控

## 许可证

[根据实际情况填写]

