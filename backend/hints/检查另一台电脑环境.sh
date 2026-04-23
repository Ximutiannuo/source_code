# 在另一台正常工作的电脑上运行以下命令

# 1. 检查 Python 版本
python --version

# 2. 检查已安装的包（查看是否有 numpy）
pip list | grep -i "numpy\|pandas"

# 3. 检查 pandas 是否能导入
python -c "import pandas; print('pandas 版本:', pandas.__version__)"

# 4. 检查 numpy 是否存在（如果 pandas 能导入，numpy 一定存在）
python -c "import numpy; print('numpy 版本:', numpy.__version__)"

# 5. 检查 import_api 是否被导入（查看 main.py）
# 检查 main.py 第15行是否有：from app.api import import_api

# 6. 检查 import_api.py 是否在模块级别导入了 pandas
# 检查 import_api.py 第7行是否有：import pandas as pd

