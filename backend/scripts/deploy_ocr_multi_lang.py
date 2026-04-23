import os
import shutil
import sys
from pathlib import Path

def deploy_ultimate_precision_ocr():
    print("="*60)
    print("  ProjectControls - 极致精度 (V5 Server) & 全能表格 OCR 部署工具")
    print("="*60)

    try:
        from modelscope import snapshot_download
    except ImportError:
        print("[错误] 未安装 modelscope，请先运行: pip install modelscope")
        return

    # 1. 定义目标路径
    target_dir = Path("app/ocr/models")
    target_dir.mkdir(parents=True, exist_ok=True)

    # 2. 同步模型库
    # 我们从三个官方库中提取最强模型
    repos = [
        ('rapidai/RapidOCR', '文本识别基础库 (含 V5 Server 文本模型)'),
        ('rapidai/RapidTable', '表格结构识别库 (含 SLANet 模型)'),
        ('rapidai/RapidLayout', '版面分析库 (含 Layout 模型)')
    ]
    
    cache_dirs = []
    for repo_id, desc in repos:
        print(f"\n[1/3] 正在同步 {desc} ({repo_id})...")
        try:
            d = snapshot_download(repo_id)
            cache_dirs.append(d)
            print(f"    [OK] 已就绪: {d}")
        except Exception as e:
            print(f"    [警告] 同步 {repo_id} 失败: {e}")

    # 3. 筛选并提取模型 (严格优先级控制)
    print(f"\n[2/3] 正在提取最高精度模型文件并优化命名...\n")
    
    # 定义我们的目标映射 [目标文件名]: [搜索关键词列表]
    target_map = {
        # --- 检测模型 ---
        "ch_PP-OCRv5_server_det.onnx": ["ch_PP-OCRv5_server_det.onnx"],
        
        # --- 识别模型 (最高优先级 V5 Server) ---
        # 中文/通用
        "ch_PP-OCRv5_rec_server_infer.onnx": ["ch_PP-OCRv5_rec_server_infer.onnx", "ch_doc_PP-OCRv4_rec_server_infer.onnx"],
        # 俄语
        "ru_PP-OCRv5_rec_mobile_infer.onnx": ["cyrillic_PP-OCRv5_rec_mobile_infer.onnx", "ru_PP-OCRv4_rec_server_infer.onnx"],
        # 英语
        "en_PP-OCRv5_rec_mobile_infer.onnx": ["en_PP-OCRv5_rec_mobile_infer.onnx", "en_PP-OCRv4_rec_server_infer.onnx"],
        
        # --- 表格与结构识别 (SLANet & Layout) ---
        "ch_ppstructure_mobile_v2.0_SLANet_infer.onnx": ["ch_ppstructure_mobile_v2_SLANet.onnx", "slanet"],
        "ch_PP-Layout_v2.0_infer.onnx": ["layout_cdla.onnx", "layout_table.onnx", "layout_analysis"]
    }

    found_status = {k: False for k in target_map}
    
    # 按照 repo 顺序搜索，但文件级别的关键字匹配会优先选择列表前面的
    for cache_root in cache_dirs:
        for root, dirs, files in os.walk(cache_root):
            for f in files:
                if not f.endswith('.onnx'):
                    continue
                
                for target_name, keywords in target_map.items():
                    # 如果已经找到了该类别的顶级模型，跳过
                    if found_status[target_name]: continue
                    
                    # 匹配关键词
                    if any(k.lower() in f.lower() for k in keywords):
                        src_path = os.path.join(root, f)
                        dst_path = target_dir / target_name
                        
                        try:
                            shutil.copy2(src_path, dst_path)
                            print(f"    + 部署顶级模型: {target_name} (源文件: {f})")
                            found_status[target_name] = True
                        except Exception as e:
                            print(f"    - 拷贝失败 {f}: {e}")

    # 4. 最终报告
    print(f"\n[3/3] 部署任务完成！")
    print("--- 顶级高精度模型状态报告 ---")
    for target, status in found_status.items():
        icon = "[ OK ]" if status else "[缺失]"
        print(f"{icon} {target}")

    all_ok = True
    for task, status in found_status.items():
        if not status: all_ok = False

    if all_ok:
        print("\n🏆 恭喜！所有“神兵利器”已全部就绪。")
        print("下一步：我将为您重写 service.py，解锁表格解析和版面分析功能。")
    else:
        print("\n⚠️ 部分模型缺失，我们将根据现有模型进行最大化的精度适配。")

    print("\n[提示] 请将上述报告结果返回给我。")

if __name__ == "__main__":
    if not Path("app/ocr").exists():
        print("[错误] 请在 backend 目录下运行此脚本")
        sys.exit(1)
    deploy_ultimate_precision_ocr()
