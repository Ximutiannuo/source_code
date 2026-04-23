# Python 降级到 3.12.10 指南

## 方法 1：安装 Python 3.12.10（推荐 - 可并行安装）

### 步骤 1：下载 Python 3.12.10

1. 访问 Python 官网：https://www.python.org/downloads/release/python-31210/
2. 下载 Windows installer (64-bit)：
   - 文件名类似：`python-3.12.10-amd64.exe`
   - 或者直接下载：https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe

### 步骤 2：安装 Python 3.12.10

1. **运行安装程序**
2. **重要：勾选 "Add Python 3.12 to PATH"**（如果选项可用）
3. **选择 "Install Now"** 或 **"Customize installation"**
4. 如果选择自定义安装：
   - 勾选 "pip"
   - 勾选 "Add Python to environment variables"（如果可用）
5. 点击 "Install"

**注意**：可以保留 Python 3.13.9，两个版本可以共存。

### 步骤 3：验证安装

打开新的 PowerShell 窗口，运行：

```powershell
# 检查 Python 3.12 是否安装
py -3.12 --version

# 或者
python3.12 --version
```

应该显示：`Python 3.12.10`

### 步骤 4：创建新的虚拟环境

```powershell
cd C:\Projects\ProjectControls

# 使用 Python 3.12 创建虚拟环境（在项目根目录）
py -3.12 -m venv myenv312

# 或者如果 python3.12 命令可用
python3.12 -m venv myenv312
```

### 步骤 5：激活新虚拟环境

```powershell
# 激活虚拟环境
.\myenv312\Scripts\Activate.ps1

# 如果提示执行策略错误，运行：
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 步骤 6：验证 Python 版本

```powershell
python --version
# 应该显示：Python 3.12.10
```

### 步骤 7：安装依赖

```powershell
# 进入 backend 目录
cd backend

# 升级 pip
python -m pip install --upgrade pip

# 安装项目依赖
pip install -r requirements.txt
```

### 步骤 8：测试后端启动

```powershell
python run.py
```

---

## 方法 2：使用 pyenv-win（管理多个 Python 版本）

如果你想更方便地管理多个 Python 版本，可以使用 pyenv-win：

### 步骤 1：安装 pyenv-win

```powershell
# 使用 PowerShell（以管理员身份运行）
Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/pyenv-win/pyenv-win/master/pyenv-win/install-pyenv-win.ps1" -OutFile "./install-pyenv-win.ps1"; &"./install-pyenv-win.ps1"
```

### 步骤 2：安装 Python 3.12.10

```powershell
pyenv install 3.12.10
```

### 步骤 3：设置为本地版本

```powershell
cd C:\Projects\ProjectControls\backend
pyenv local 3.12.10
```

### 步骤 4：创建虚拟环境

```powershell
python -m venv myenv312
.\myenv312\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 方法 3：完全卸载并重新安装（不推荐）

如果你确定不需要 Python 3.13.9，可以完全卸载：

### 步骤 1：卸载 Python 3.13.9

1. 打开 "设置" > "应用" > "应用和功能"
2. 搜索 "Python 3.13"
3. 点击 "卸载"

### 步骤 2：安装 Python 3.12.10

按照方法 1 的步骤安装。

---

## 验证和测试

安装完成后，运行以下命令验证：

```powershell
# 1. 检查 Python 版本
python --version
# 应该显示：Python 3.12.10

# 2. 检查 pip 版本
pip --version

# 3. 测试 pandas 导入
python -c "import pandas; print('pandas 版本:', pandas.__version__)"

# 4. 测试后端启动
python run.py
```

---

## 常见问题

### Q1: 如何切换 Python 版本？

如果安装了多个 Python 版本，可以使用：

```powershell
# 使用 py launcher
py -3.12  # 使用 Python 3.12
py -3.13  # 使用 Python 3.13

# 或者在虚拟环境中
# 激活 myenv312 使用 Python 3.12
# 激活 myenv 使用 Python 3.13
```

### Q2: 虚拟环境使用哪个 Python？

虚拟环境创建时会锁定 Python 版本：

```powershell
# 创建虚拟环境时使用的 Python 版本就是虚拟环境的版本
py -3.12 -m venv myenv312  # myenv312 使用 Python 3.12
py -3.13 -m venv myenv313  # myenv313 使用 Python 3.13
```

### Q3: 如何确认当前使用的 Python？

```powershell
# 在虚拟环境中
python --version
which python  # Linux/Mac
where python  # Windows
```

---

## 推荐方案

**推荐使用方法 1**：
- 简单直接
- 不需要卸载现有版本
- 可以保留两个版本，方便切换
- 使用虚拟环境隔离，不影响系统 Python

---

## 快速命令总结

```powershell
# 1. 下载并安装 Python 3.12.10（从官网）

# 2. 创建新虚拟环境（在项目根目录）
cd C:\Projects\ProjectControls
py -3.12 -m venv myenv312

# 3. 激活虚拟环境
.\myenv312\Scripts\Activate.ps1

# 4. 进入 backend 目录并安装依赖
cd backend
pip install --upgrade pip
pip install -r requirements.txt

# 5. 测试
python --version
python run.py
```

