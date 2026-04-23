# 卸载 Python 3.13.9 指南

## 前提条件

✅ 已确认 Python 3.12.10 已安装（`py -3.12 --version` 显示正常）

## 卸载步骤

### 步骤 1：退出当前虚拟环境

```powershell
# 如果当前在虚拟环境中，先退出
deactivate
```

### 步骤 2：卸载 Python 3.13.9

**方法 A：通过 Windows 设置卸载（推荐）**

1. 打开 **"设置"** (Win + I)
2. 进入 **"应用"** > **"应用和功能"**
3. 搜索 **"Python 3.13"**
4. 找到 **"Python 3.13.9 (64-bit)"** 或类似名称
5. 点击 **"卸载"**
6. 确认卸载

**方法 B：通过控制面板卸载**

1. 打开 **"控制面板"**
2. 进入 **"程序和功能"**
3. 找到 **"Python 3.13.9 (64-bit)"**
4. 右键点击 > **"卸载"**

**方法 C：通过命令行卸载（如果安装了）**

```powershell
# 查找 Python 3.13 的安装位置
where python

# 如果找到，可以尝试使用卸载程序
# 通常在：C:\Users\你的用户名\AppData\Local\Programs\Python\Python313\uninstall.exe
```

### 步骤 3：删除旧的虚拟环境

```powershell
cd C:\Projects\ProjectControls

# 删除基于 Python 3.13 的虚拟环境（在项目根目录）
Remove-Item -Recurse -Force myenv
```

### 步骤 4：验证 Python 3.13 已卸载

```powershell
# 应该显示错误或找不到
python --version

# py launcher 应该只显示 3.12
py --list
```

### 步骤 5：创建新的虚拟环境（基于 Python 3.12.10）

```powershell
cd C:\Projects\ProjectControls

# 使用 Python 3.12 创建新的虚拟环境（在项目根目录）
py -3.12 -m venv myenv

# 或者如果 python 命令现在指向 3.12
python -m venv myenv
```

### 步骤 6：激活新虚拟环境

```powershell
.\myenv\Scripts\Activate.ps1

# 验证 Python 版本
python --version
# 应该显示：Python 3.12.10
```

### 步骤 7：安装依赖

```powershell
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

## 注意事项

### ⚠️ 重要提示

1. **备份重要数据**：虽然虚拟环境可以重建，但如果有自定义配置，建议先备份

2. **检查其他项目**：如果有其他项目使用 Python 3.13，卸载前请确认

3. **PATH 环境变量**：卸载后，检查 PATH 环境变量，确保 Python 3.12 在 PATH 中

### 验证 PATH 设置

```powershell
# 检查 PATH 中的 Python
$env:PATH -split ';' | Select-String -Pattern 'Python'

# 应该看到 Python312 的路径，不应该有 Python313
```

---

## 如果卸载后出现问题

### 问题 1：`python` 命令不存在

**解决方案：**
```powershell
# 使用 py launcher
py -3.12 --version

# 或者将 Python 3.12 添加到 PATH
# 1. 右键"此电脑" > "属性" > "高级系统设置"
# 2. "环境变量" > "系统变量" > "Path"
# 3. 添加：C:\Users\你的用户名\AppData\Local\Programs\Python\Python312
# 4. 添加：C:\Users\你的用户名\AppData\Local\Programs\Python\Python312\Scripts
```

### 问题 2：虚拟环境创建失败

**解决方案：**
```powershell
# 使用完整路径创建虚拟环境
C:\Users\你的用户名\AppData\Local\Programs\Python\Python312\python.exe -m venv myenv
```

### 问题 3：pip 命令不存在

**解决方案：**
```powershell
# 使用 python -m pip
python -m pip install --upgrade pip
```

---

## 快速命令总结

```powershell
# 1. 退出虚拟环境
deactivate

# 2. 卸载 Python 3.13.9（通过 Windows 设置）

# 3. 删除旧虚拟环境
cd C:\Projects\ProjectControls\backend
Remove-Item -Recurse -Force myenv

# 4. 创建新虚拟环境
py -3.12 -m venv myenv

# 5. 激活虚拟环境
.\myenv\Scripts\Activate.ps1

# 6. 验证版本
python --version

# 7. 安装依赖
pip install -r requirements.txt

# 8. 测试启动
python run.py
```

---

## 推荐操作顺序

1. ✅ **先创建新虚拟环境并测试**（确保 Python 3.12 工作正常）
2. ✅ **再卸载 Python 3.13.9**（避免出现问题）
3. ✅ **最后删除旧虚拟环境**

这样可以确保即使卸载出问题，你也有一个可用的环境。

