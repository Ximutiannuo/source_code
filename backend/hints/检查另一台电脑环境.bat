@echo off
REM 在另一台正常工作的电脑上运行此脚本

echo ========================================
echo 检查另一台电脑的环境
echo ========================================
echo.

echo 1. Python 版本:
python --version
echo.

echo 2. 已安装的包（查找 numpy 和 pandas）:
pip list | findstr /i "numpy pandas"
echo.

echo 3. 测试 pandas 导入:
python -c "import pandas; print('pandas 版本:', pandas.__version__)" 2>&1
echo.

echo 4. 测试 numpy 导入:
python -c "import numpy; print('numpy 版本:', numpy.__version__)" 2>&1
echo.

echo 5. 检查 main.py 是否导入了 import_api:
findstr /n "import_api" app\main.py
echo.

echo 6. 检查 import_api.py 是否在模块级别导入了 pandas:
findstr /n "import pandas" app\api\import_api.py
echo.

pause

