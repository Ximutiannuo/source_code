# ProjectControls 部署检查清单

本文档用于确保部署过程的完整性和正确性。

## 部署前检查

### 1. 环境准备

- [ ] **操作系统**: Windows Server（已确认）
- [ ] **Python**: 3.8+ 已安装
- [ ] **Node.js**: 16+ 已安装
- [ ] **MySQL**: 8.0+ 已安装并运行
- [ ] **Nginx**: 已安装（路径：`C:\nginx`）
- [ ] **NSSM**: 已安装（路径：`C:\nssm\win64`）

### 2. 项目代码

- [ ] 代码已从 Git 仓库拉取到服务器
- [ ] 项目路径：`C:\ProjectControls`（或确认的实际路径）
- [ ] 所有代码修改已提交并推送

### 3. 数据库配置

- [ ] MySQL 数据库已创建
- [ ] 数据库字符集：`utf8mb4`
- [ ] 数据库排序规则：`utf8mb4_unicode_ci`
- [ ] 数据库用户已创建并授权
- [ ] `backend/.env` 文件已配置：
  - [ ] `DATABASE_URL` 已设置
  - [ ] `SECRET_KEY` 已设置为强随机字符串（见下方生成方法）
  - [ ] 其他环境变量已配置

**生成 SECRET_KEY 的方法**：

1. **使用 Python 脚本（推荐）**：
   ```powershell
   cd C:\ProjectControls\backend
   python generate_secret_key.py
   ```
   脚本会自动生成并显示密钥，Windows 上还会尝试复制到剪贴板。

2. **使用 PowerShell 脚本**：
   ```powershell
   cd C:\ProjectControls\backend\scripts
   .\generate_secret_key.ps1
   ```

3. **使用 Python 命令行**：
   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

4. **使用 OpenSSL（如果已安装）**：
   ```powershell
   openssl rand -hex 32
   ```

生成后，将密钥添加到 `backend/.env` 文件：
```env
SECRET_KEY=你的生成的密钥
```

### 4. SSL 证书

- [ ] SSL 证书已生成或已配置
- [ ] 证书路径：`C:\nginx\ssl\projectcontrols_cert.pem`
- [ ] 私钥路径：`C:\nginx\ssl\projectcontrols_key.pem`
- [ ] 证书有效期检查

## 部署步骤

### 步骤 1: 运行部署脚本

```powershell
# 以管理员权限运行 PowerShell
cd C:\ProjectControls
.\deploy-windows.ps1
```

**检查项**：
- [ ] 脚本执行无错误
- [ ] 后端虚拟环境创建成功
- [ ] 后端依赖安装成功
- [ ] 前端依赖安装成功
- [ ] 前端构建成功（`frontend/dist` 目录存在）

### 步骤 2: 验证后端服务

```powershell
# 检查服务状态
Get-Service ProjectControlsBackend

# 检查服务日志
C:\nssm\win64\nssm.exe status ProjectControlsBackend

# 测试健康检查
Invoke-WebRequest -Uri "http://localhost:8200/health" -UseBasicParsing
```

**检查项**：
- [ ] 服务状态为 "Running"
- [ ] 健康检查返回 200 状态码
- [ ] 日志无错误信息

### 步骤 3: 验证 Nginx 配置

```powershell
# 测试 Nginx 配置
cd C:\nginx
.\nginx.exe -t

# 重载配置（如果 Nginx 已在运行）
.\nginx.exe -s reload
```

**检查项**：
- [ ] Nginx 配置语法正确
- [ ] 配置文件已复制到 `C:\nginx\conf\projectcontrols.conf`
- [ ] 主配置文件已包含 `include projectcontrols.conf;`

### 步骤 4: 验证前端访问

在浏览器中访问：
- [ ] `https://10.78.44.3:8443` - 主访问地址
- [ ] `http://10.78.44.3:8080` - 应自动重定向到 HTTPS

**检查项**：
- [ ] 页面正常加载
- [ ] 无控制台错误
- [ ] API 请求正常（检查网络请求）

### 步骤 5: 验证防火墙

```powershell
# 检查防火墙规则
Get-NetFirewallRule -DisplayName "ProjectControls*"
```

**检查项**：
- [ ] 端口 8080（HTTP）已开放
- [ ] 端口 8443（HTTPS）已开放
- [ ] 端口 8200（后端 API）已开放（如果需要外部访问）

## 部署后验证

### 功能测试

- [ ] **用户登录**: 能够正常登录
- [ ] **权限检查**: 权限系统正常工作
- [ ] **数据加载**: 主要页面数据正常加载
- [ ] **数据操作**: 创建、编辑、删除操作正常
- [ ] **文件上传**: 文件上传功能正常
- [ ] **报表导出**: Excel 导出功能正常

### 性能检查

- [ ] 页面加载速度正常
- [ ] API 响应时间正常
- [ ] 无内存泄漏迹象
- [ ] 日志文件大小正常

### 安全检查

- [ ] HTTPS 正常工作
- [ ] 证书有效且未过期
- [ ] CORS 配置正确
- [ ] 敏感信息未暴露在前端代码中

## 常见问题排查

### 后端服务无法启动

1. 检查服务日志：
   ```powershell
   C:\nssm\win64\nssm.exe status ProjectControlsBackend
   ```

2. 检查 Python 环境：
   ```powershell
   C:\ProjectControls\myenv\Scripts\python.exe --version
   ```

3. 检查依赖：
   ```powershell
   cd C:\ProjectControls\backend
   C:\ProjectControls\myenv\Scripts\pip.exe list
   ```

4. 手动测试启动：
   ```powershell
   cd C:\ProjectControls\backend
   C:\ProjectControls\myenv\Scripts\python.exe -m gunicorn app.main:app -c gunicorn_config.py
   ```

### 前端无法访问

1. 检查 Nginx 是否运行：
   ```powershell
   Get-Process nginx -ErrorAction SilentlyContinue
   ```

2. 检查前端构建产物：
   ```powershell
   Test-Path C:\ProjectControls\frontend\dist\index.html
   ```

3. 检查 Nginx 配置路径：
   - 确认 `nginx-windows.conf` 中的路径正确
   - 确认 `root` 指令指向正确的 `dist` 目录

### API 请求失败

1. 检查后端服务状态
2. 检查 Nginx 代理配置
3. 检查 CORS 配置
4. 查看浏览器控制台和网络请求

### SSL 证书问题

1. 检查证书文件是否存在
2. 检查证书路径配置
3. 检查证书格式（PEM）
4. 重新生成证书（如果需要）

## 维护任务

### 日常维护

- [ ] 定期检查服务状态
- [ ] 定期检查日志文件大小
- [ ] 定期备份数据库
- [ ] 定期更新依赖（谨慎操作）

### 更新部署

1. 拉取最新代码
2. 运行部署脚本（或手动更新）
3. 重启服务
4. 验证功能

### 日志位置

- **后端访问日志**: `C:\ProjectControls\logs\gunicorn_access.log`
- **后端错误日志**: `C:\ProjectControls\logs\gunicorn_error.log`
- **Nginx 访问日志**: `C:\nginx\logs\projectcontrols_access.log`
- **Nginx 错误日志**: `C:\nginx\logs\projectcontrols_error.log`

## 联系信息

如遇到问题，请：
1. 查看日志文件
2. 检查本文档的常见问题部分
3. 联系开发团队
