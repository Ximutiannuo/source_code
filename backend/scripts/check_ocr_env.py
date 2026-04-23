#!/usr/bin/env python
"""
OCR 环境诊断脚本

检查 PaddlePaddle / PaddleOCR 是否能正常加载，并输出修复建议。
运行: python scripts/check_ocr_env.py
"""
import sys
import platform
import os
import subprocess

def section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def ok(msg: str):
    print(f"  [OK] {msg}")

def fail(msg: str):
    print(f"  [FAIL] {msg}")

def info(msg: str):
    print(f"  [INFO] {msg}")

def main():
    print("\nOCR 环境诊断")
    
    # 1. Python 信息
    section("Python 环境")
    info(f"版本: {sys.version}")
    info(f"可执行文件: {sys.executable}")
    info(f"平台: {platform.platform()}")
    py_major, py_minor = sys.version_info[:2]
    if py_major == 3 and py_minor >= 12:
        fail(f"Python 3.{py_minor} 在 Windows 上与 PaddlePaddle 3.x 可能存在 DLL 兼容问题")
        info("建议: 使用 Python 3.10 或 3.11")
    else:
        ok(f"Python 3.{py_minor} 版本通常兼容")

    # 2. 尝试导入 paddle
    section("PaddlePaddle 加载")
    paddle_ok = False
    paddle_version = None
    paddle_error = None
    
    try:
        import paddle
        paddle_version = paddle.__version__
        paddle_ok = True
        ok(f"PaddlePaddle {paddle_version} 加载成功")
    except Exception as e:
        paddle_error = str(e)
        fail(f"导入失败: {e}")
        if "libpaddle" in paddle_error or "DLL" in paddle_error:
            info("典型 Windows DLL 问题，常见原因:")
            info("  1. 缺少 Visual C++ Redistributable (x64)")
            info("     下载: https://aka.ms/vs/17/release/vc_redist.x64.exe")
            info("  2. Python 3.12 兼容性，建议用 Python 3.10/3.11")
            info("  3. 内网/代理导致 pip 安装不完整，可离线安装")

    # 3. 尝试导入 paddleocr
    section("PaddleOCR 加载")
    ocr_ok = False
    if paddle_ok:
        try:
            from paddleocr import PaddleOCR
            ocr_ok = True
            ok("PaddleOCR 导入成功")
        except Exception as e:
            fail(f"PaddleOCR 导入失败: {e}")
    else:
        info("跳过（PaddlePaddle 未就绪）")

    # 4. 检查 VC++ 运行库（Windows）
    if platform.system() == "Windows":
        section("Windows 依赖")
        vc_dirs = [
            os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "System32", "vcruntime140.dll"),
            os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "System32", "vcruntime140_1.dll"),
        ]
        vc_found = any(os.path.exists(d) for d in vc_dirs)
        if vc_found:
            ok("检测到 VC++ 运行库")
        else:
            fail("未检测到常见 VC++ 运行库")
            info("请安装: https://aka.ms/vs/17/release/vc_redist.x64.exe")

    # 5. 可用 Python 版本
    section("本机已安装 Python")
    try:
        r = subprocess.run(
            ["py", "-0"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=os.path.dirname(__file__) or ".",
        )
        if r.returncode == 0 and r.stdout:
            for line in r.stdout.strip().split("\n"):
                info(line)
        else:
            info("py launcher 不可用或无输出")
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        info(f"py launcher 检查失败: {e}")

    # 6. 建议
    section("建议")
    if paddle_ok and ocr_ok:
        ok("OCR 环境正常，可直接使用")
        return 0
    elif not paddle_ok:
        print("""
  方案 A - 安装 VC++ 运行库后重试:
    https://aka.ms/vs/17/release/vc_redist.x64.exe

  方案 B - 使用 Python 3.10/3.11（若本机已安装）:
    py -3.10 -m venv .venv-ocr
    .venv-ocr\\Scripts\\activate
    pip install paddlepaddle==3.2.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
    pip install paddleocr

  方案 C - 降级到 PaddleOCR 2.x（Windows 兼容较好）:
    pip uninstall paddlepaddle paddleocr -y
    pip install paddlepaddle==2.6.2 paddleocr==2.9.0
    (需修改 backend 代码以适配 2.x API)

  方案 D - 使用 Docker 部署 OCR 服务（Linux 容器无 DLL 问题）
""")
    return 1 if not (paddle_ok and ocr_ok) else 0

if __name__ == "__main__":
    sys.exit(main())
