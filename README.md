# 机械制造管理平台 (Manufacturing Management Platform)

本平台是一套面向机械制造企业的综合性管理系统，核心理念是围绕订单交付主线，打通设计、工艺、计划、执行与成本核算。

## 核心建设目标

针对非标定制频率高、BOM 结构复杂、工艺路径多变的业务场景，本系统旨在解决以下痛点：

- **全链路版本控制**：解决设计到制造的版本断层。
- **BOM 驱动逻辑**：由 BOM 直接驱动采购、齐套分析与生产。
- **有限产能排产**：解决交期不准与资源瓶颈问题。
- **精细化成本核算**：按订单/项目号归集料工费。

## 技术栈

- **后端**：FastAPI + SQLAlchemy + MySQL + Redis
- **前端**：React + TypeScript + Vite + Ant Design

**关键能力**：
- **P6 集成**：支持 Primavera P6 进度数据同步与大型项目里程碑管理。
- **AI 助手**：内置 AI 工具集（包括 OCR 识别），辅助业务决策与数据录入。
- **制造模型**：已实现物料管理、BOM 结构、工艺模板及制造订单等核心模块。

## 业务架构 (8 层体系)

系统按照以下业务层次进行建设：

1. **经营与项目层**：订单管理、项目立项、P6 里程碑联动。
2. **PLM 与技术数据层**：图纸管理、多级 BOM (EBOM/MBOM)、ECN 变更控制。
3. **工艺与制造工程层**：工艺模板、标准工时、工序路线管理。
4. **计划与 APS 层**：MRP 运算、有限产能排产、齐套校验。
5. **MES 执行层**：工单下达、派工报工、WIP 在制品跟踪。
6. **SCM/WMS 资源保障层**：采购申请、供应商协同、项目物料池。
7. **QMS 与 EAM 层**：全流程质检、设备台账及预防性维护。
8. **BI 与经营分析层**：项目成本台账、交付进度驾驶舱。

## 快速开始

### 1. 环境准备
Python 3.8+ / Node.js 18+ / MySQL 8.0+ / Redis

### 2. 后端部署 (backend)
```bash
cd backend
python -m venv venv
# 激活环境后安装依赖
venv\Scripts\activate  # Windows
pip install -r requirements.txt
# 配置环境变量
copy .env.example .env
# 初始化数据库 (执行 database/init.sql)
python run.py
```
后端服务运行于 `http://localhost:8001`。

### 3. 前端部署 (frontend)
```bash
cd frontend
npm install
npm run dev
```
前端服务运行于 `http://localhost:3000`。

## 项目结构
```plaintext
ProjectControls/
├── backend/                # FastAPI 后端应用
│   ├── app/
│   │   ├── api/           # API 路由 (权限、制造、PLM、质量等)
│   │   ├── models/        # 数据模型 (BOM、ECN、工单、设备等)
│   │   ├── services/      # 业务逻辑服务层
│   │   └── ocr/           # OCR 识别模块
├── frontend/               # React 前端应用
│   ├── src/
│   │   ├── components/    # 通用 UI 组件
│   │   ├── pages/         # 业务页面 (看板、BOM、工艺配置等)
│   │   └── services/      # 前端 API 接口
├── database/               # 数据库初始化及迁移脚本
└── docs/                   # 项目文档与功能架构说明
```

## 实施路线图 (Roadmap)

- **阶段一：主数据与版本控制 (当前重点)**：重构订单主线，补齐 EBOM/MBOM 转换规则。
- **阶段二：执行闭环**：完善工位报工、WIP 状态流转与质量过站闭环。
- **阶段三：智能决策**：引入 APS 排产系统与基于料工费偏差的订单利润分析。

## 生产部署要点
- 详细部署指南请参阅 `DEPLOYMENT_WINDOWS.md`。
- 必须修改 `SECRET_KEY`。
- 推荐使用 Nginx 作为反向代理并配置 SSL。
- Windows 环境建议使用 NSSM 注册为系统服务。

---
**许可证**: [待补充]
