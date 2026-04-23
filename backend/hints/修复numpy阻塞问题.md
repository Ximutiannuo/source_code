# 修复 numpy 阻塞问题

## 问题确认

✅ **已确认**：numpy 2.4.0 导入阻塞
- 重新安装后仍然阻塞
- 说明问题在版本兼容性，不是安装问题

## 解决方案：降级到稳定版本

numpy 2.4.0 是 2024 年发布的新版本，可能在 Windows Server 2016 上有兼容性问题。

### 推荐方案：降级到 numpy 1.26.x

```powershell
# 卸载当前版本
pip uninstall numpy pandas -y

# 安装稳定版本（兼容 Python 3.12）
pip install numpy==1.26.4
pip install pandas==2.2.2

# 测试
python -c "import numpy; print('numpy OK'); import pandas; print('pandas OK')"
```

### 如果还是不行，尝试更保守的版本

```powershell
pip uninstall numpy pandas -y
pip install numpy==1.24.3
pip install pandas==2.0.3
```

## 版本兼容性说明

- **numpy 2.4.0**：2024 年最新版本，可能对 Windows Server 2016 支持不好
- **numpy 1.26.4**：2024 年发布，稳定版本，完全支持 Python 3.12
- **numpy 1.24.3**：2023 年发布，非常稳定，支持 Python 3.8-3.12

## 为什么其他电脑正常？

可能的原因：
1. **其他电脑的 numpy 版本不同**（可能是 1.26.x 或更早）
2. **系统环境不同**（Windows 版本、更新补丁等）
3. **安装方式不同**（可能使用了不同的 wheel 文件）

## 临时方案：延迟导入

如果降级后还是阻塞，可以使用延迟导入：

在 `import_api.py` 中将 `import pandas as pd` 改为函数内部导入。

