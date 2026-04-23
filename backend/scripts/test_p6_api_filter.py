"""
测试P6 API Filter功能
用于验证Filter参数是否能正常工作，特别是ProjectObjectId和LastUpdateDate过滤
"""
import sys
import os
from pathlib import Path
from collections import Counter

# 设置路径
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent
backend_dir = project_root / "backend"

if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# 先加载.env文件
from app.database import load_env_with_fallback
import os
if not os.getenv('DATABASE_URL'):
    load_env_with_fallback()

from app.services.p6_sync_service import P6SyncService
from app.config import settings
import json
import time
import logging

# 设置日志级别为INFO，以便看到P6服务的详细日志
logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

def analyze_project_distribution(data_list, entity_type):
    """分析数据中的项目分布"""
    project_object_ids = []
    for item in data_list:
        if isinstance(item, dict):
            proj_obj_id = item.get('ProjectObjectId')
            if proj_obj_id:
                project_object_ids.append(proj_obj_id)
    
    if not project_object_ids:
        return {}
    
    counter = Counter(project_object_ids)
    return dict(counter.most_common(10))

def test_p6_filter():
    """测试P6 API Filter功能"""
    print("=" * 80)
    print("P6 API Filter 测试脚本")
    print("=" * 80)
    
    # 检查P6配置
    print("\n[0] 检查P6配置...")
    print(f"   P6_SERVER_URL: {settings.P6_SERVER_URL}")
    print(f"   P6_DATABASE: {settings.P6_DATABASE}")
    print(f"   P6_USERNAME: {settings.P6_USERNAME}")
    print(f"   P6_PASSWORD: {'*' * len(settings.P6_PASSWORD) if settings.P6_PASSWORD else '(未设置)'}")
    
    if not settings.P6_SERVER_URL or settings.P6_SERVER_URL == "http://your-p6-server:8206/p6ws/restapi":
        print("❌ P6_SERVER_URL未配置或使用默认值，请在.env文件中配置")
        return
    
    if not settings.P6_DATABASE or settings.P6_DATABASE == "your_database_name":
        print("❌ P6_DATABASE未配置或使用默认值，请在.env文件中配置")
        return
    
    # 初始化P6服务
    print("\n[1] 初始化P6服务...")
    print("   正在连接P6服务器（可能需要10-30秒）...")
    print("   服务器: " + settings.P6_SERVER_URL)
    print("   数据库: " + settings.P6_DATABASE)
    import sys
    sys.stdout.flush()  # 确保输出立即显示
    
    try:
        # 使用信号或超时来避免无限等待
        import signal
        
        def timeout_handler(signum, frame):
            raise TimeoutError("P6连接超时（超过60秒）")
        
        # Windows不支持signal.SIGALRM，使用threading.Timer代替
        import threading
        timeout_occurred = threading.Event()
        
        def timeout_timer():
            import time
            time.sleep(60)  # 60秒超时
            if not timeout_occurred.is_set():
                timeout_occurred.set()
                print("\n   ⚠️  警告: P6连接已超过60秒，可能卡住了...")
                print("   尝试中断...")
                sys.stdout.flush()
        
        timer = threading.Timer(60.0, timeout_timer)
        timer.start()
        
        try:
            p6_service = P6SyncService()
            timeout_occurred.set()  # 标记已完成
            timer.cancel()
        except Exception as e:
            timeout_occurred.set()
            timer.cancel()
            raise
        
        if not p6_service.app:
            print("\n❌ P6连接失败，无法继续测试")
            print("\n可能的原因：")
            print("   1. P6服务器不可达（检查P6_SERVER_URL是否正确）")
            print("   2. P6 REST API服务未启动（检查WebLogic服务）")
            print("   3. 用户名或密码错误（检查P6_USERNAME和P6_PASSWORD）")
            print("   4. 数据库名称错误（检查P6_DATABASE）")
            print("\n请查看上方的日志信息获取更多详情")
            return
        
        print("✅ P6服务初始化成功")
    except TimeoutError as e:
        print(f"\n❌ {e}")
        print("   建议:")
        print("   1. 检查网络连接")
        print("   2. 检查P6服务器是否正常运行")
        print("   3. 检查防火墙设置")
        return
    except Exception as e:
        print(f"\n❌ 初始化P6服务时出错: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 获取指定项目（UIOPRJ）
    target_project_id = "UIOPRJ"
    print(f"\n[2] 查找项目: {target_project_id}...")
    try:
        projects = p6_service.get_projects()
        if not projects:
            print("❌ 未获取到项目列表")
            return
        
        print(f"✅ 获取到 {len(projects)} 个项目")
        
        # 查找目标项目
        test_project = None
        for proj in projects:
            proj_id = proj.get('Id') or proj.get('ProjectId')
            if proj_id == target_project_id:
                test_project = proj
                break
        
        if not test_project:
            print(f"❌ 未找到项目: {target_project_id}")
            print(f"   可用的项目ID示例（前10个）:")
            for i, proj in enumerate(projects[:10], 1):
                proj_id = proj.get('Id') or proj.get('ProjectId')
                proj_name = proj.get('Name') or proj.get('ProjectName')
                print(f"   {i}. {proj_id} - {proj_name}")
            return
        
        project_id = test_project.get('Id') or test_project.get('ProjectId')
        project_object_id = test_project.get('ObjectId')
        project_name = test_project.get('Name') or test_project.get('ProjectName')
        
        print(f"✅ 找到项目:")
        print(f"   项目ID: {project_id}")
        print(f"   项目ObjectId: {project_object_id}")
        print(f"   项目名称: {project_name}")
        
        # 测试不同方式读取数据
        session = p6_service.app.eppmSession.session
        prefix = p6_service.app.eppmSession.prefix
        
        # 测试Activity实体
        test_entity_type = "activity"
        url = f"{prefix}/{test_entity_type}"
        fields = ['ObjectId', 'Id', 'Name', 'ProjectObjectId', 'CreateDate', 'LastUpdateDate']
        
        # 为了测试4.5，我们需要另一个项目
        other_project = None
        for proj in projects:
            proj_id_temp = proj.get('Id') or proj.get('ProjectId')
            proj_obj_id_temp = proj.get('ObjectId')
            if proj_id_temp != target_project_id and proj_obj_id_temp:
                other_project = proj
                break
        
        print(f"\n{'='*80}")
        print(f"开始测试项目: {project_id}")
        print(f"{'='*80}")
        
        # 测试不同方式读取数据
        session = p6_service.app.eppmSession.session
        prefix = p6_service.app.eppmSession.prefix
        
        # 测试Activity实体
        test_entity_type = "activity"
        url = f"{prefix}/{test_entity_type}"
        fields = ['ObjectId', 'Id', 'Name', 'ProjectObjectId', 'CreateDate', 'LastUpdateDate']
        
        # 限制：只读取前10条用于测试（使用OrderBy和限制）
        MAX_TEST_RECORDS = 10
        
        # 添加请求延迟，避免过载API
        def safe_request_with_delay(url, params, delay=1.0, timeout=30):
            """安全的API请求，带延迟和较短超时"""
            time.sleep(delay)  # 请求之间延迟
            return session.get(url=url, params=params, timeout=timeout)
        
        print(f"\n⚠️  注意: 为保护API服务器，将限制测试数据量（最多{MAX_TEST_RECORDS}条）")
        print(f"   并在每次请求之间延迟1秒")
        
        # 测试1: 选择项目后，不使用Filter，使用直接API调用（测试Primavera库是否在session级别应用Filter）
        print(f"\n--- 测试1: 选择项目后，直接API调用不使用Filter参数（限制{MAX_TEST_RECORDS}条）---")
        try:
            # 先选择项目，确保session有效
            p6_service.app.select_project(projectId=project_id)
            # 使用ObjectId限制，只读取前10条
            params = {
                "Fields": ','.join(fields),
                "OrderBy": "ObjectId",  # 按ObjectId排序
                # 注意：P6 API可能不支持Limit参数，但我们可以通过Filter限制ObjectId范围
            }
            # 先读取少量数据测试（使用Filter限制ObjectId范围）
            # 尝试读取ObjectId较小的前10条
            start_time = time.time()
            # 使用较短超时和延迟
            response = safe_request_with_delay(url, params, delay=1.0, timeout=30)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                all_data = json.loads(response.text)
                if not isinstance(all_data, list):
                    all_data = [all_data] if all_data else []
                
                # 限制显示的数据量
                original_count = len(all_data)
                all_data = all_data[:MAX_TEST_RECORDS]  # 只分析前N条
                print(f"✅ 读取成功: {original_count} 条（只分析前{MAX_TEST_RECORDS}条），耗时: {duration:.2f} 秒")
                
                # 分析项目分布（如果select_project生效，应该只有目标项目）
                proj_dist = analyze_project_distribution(all_data, test_entity_type)
                print(f"   项目分布（前10个）: {proj_dist}")
                
                # 检查是否包含目标项目
                target_count = sum(1 for item in all_data if isinstance(item, dict) and item.get('ProjectObjectId') == project_object_id)
                non_target_count = len(all_data) - target_count
                print(f"   包含目标项目 {project_object_id} 的数据: {target_count} 条")
                print(f"   其他项目的数据: {non_target_count} 条")
                if non_target_count > 0:
                    print(f"   ⚠️  警告: select_project()可能未在API级别生效，包含其他项目的数据！")
            else:
                print(f"❌ 读取失败: {response.status_code}")
                print(f"   错误: {response.text[:300]}")
        except Exception as e:
            print(f"❌ 测试失败: {e}")
            import traceback
            traceback.print_exc()
            
        # 测试2: 跳过（使用Primavera库方法会读取所有数据，数据量太大）
        print(f"\n--- 测试2: 跳过（Primavera库方法会读取所有数据，数据量太大）---")
        print(f"   ⚠️  为避免过载API，跳过此测试")
        
        # 测试3: 直接API调用，使用Filter（根据OpenAPI文档的标准格式）
        # 根据OpenAPI文档，Filter支持的操作符：:gt:, :lt:, :eq:, :gte:, :lte:, :and:, :or:
        # 示例：ObjectId IN(1,2) :and: CreateDate:gte:'2021-04-20'
        print(f"\n--- 测试3: 直接API调用，使用Filter参数（不依赖select_project）---")
        test_filters = [
                # 格式1: 标准格式（带空格的操作符）
                f"ProjectObjectId :eq: {project_object_id}",
                # 格式2: 无空格的操作符
                f"ProjectObjectId:eq:{project_object_id}",
                # 格式3: 使用IN语法（如果支持）
                f"ProjectObjectId IN({project_object_id})",
        ]
        
        # 先确保选择了项目（为了保持session有效），但我们会在API调用中明确使用Filter
        p6_service.app.select_project(projectId=project_id)
        
        for filter_idx, filter_str in enumerate(test_filters, 1):
            print(f"\n   尝试Filter格式 {filter_idx}: {filter_str}")
            try:
                    params = {
                        "Fields": ','.join(fields),
                        "Filter": filter_str,
                        "OrderBy": "ObjectId"  # 排序以便限制范围
                    }
                    start_time = time.time()
                    # 使用延迟和较短超时
                    response = safe_request_with_delay(url, params, delay=1.0, timeout=30)
                    duration = time.time() - start_time
                    
                    print(f"   请求URL: {response.url if hasattr(response, 'url') else url}")
                    print(f"   状态码: {response.status_code}")
                    
                    if response.status_code == 200:
                        filtered_data = json.loads(response.text)
                        if not isinstance(filtered_data, list):
                            filtered_data = [filtered_data] if filtered_data else []
                        
                        original_count = len(filtered_data)
                        filtered_data_sample = filtered_data[:MAX_TEST_RECORDS]  # 只分析前N条
                        print(f"   ✅ 成功: {original_count} 条（只分析前{MAX_TEST_RECORDS}条），耗时: {duration:.2f} 秒")
                        
                        # 验证数据是否正确过滤
                        if filtered_data_sample:
                            proj_dist = analyze_project_distribution(filtered_data_sample, test_entity_type)
                            print(f"      项目分布（样本）: {proj_dist}")
                            
                            target_count = sum(1 for item in filtered_data_sample if isinstance(item, dict) and item.get('ProjectObjectId') == project_object_id)
                            non_target_count = len(filtered_data_sample) - target_count
                            if non_target_count == 0 and len(filtered_data_sample) > 0:
                                print(f"      ✅ Filter生效！样本数据都属于目标项目")
                                if original_count > MAX_TEST_RECORDS:
                                    print(f"      （实际返回{original_count}条，但只验证了前{MAX_TEST_RECORDS}条）")
                            elif len(filtered_data) == 0:
                                print(f"      ⚠️  返回数据为空（可能Filter太严格或格式不正确）")
                            else:
                                print(f"      ⚠️  警告: Filter可能未完全生效，样本中包含 {non_target_count} 条其他项目的数据")
                                print(f"      （如果这是格式{filter_idx}，说明该格式不正确）")
                    else:
                        print(f"   ❌ 失败: {response.status_code}")
                        error_text = response.text[:500] if response.text else "无错误信息"
                        print(f"      错误: {error_text}")
                        # 尝试解析JSON错误
                        try:
                            error_json = json.loads(response.text)
                            if isinstance(error_json, dict):
                                print(f"      错误详情: {error_json}")
                        except:
                            pass
            except Exception as e:
                print(f"   ❌ 异常: {e}")
                import traceback
                traceback.print_exc()
        
        # 测试4: 选择项目后再使用Filter（验证Filter是否能覆盖select_project的过滤）
            print(f"\n--- 测试4: 选择项目后再使用Filter（双重过滤，限制{MAX_TEST_RECORDS}条）---")
            try:
                p6_service.app.select_project(projectId=project_id)
                filter_str = f"ProjectObjectId :eq: {project_object_id}"
                
                params = {
                    "Fields": ','.join(fields),
                    "Filter": filter_str,
                    "OrderBy": "ObjectId"
                }
                start_time = time.time()
                response = safe_request_with_delay(url, params, delay=1.0, timeout=30)
                duration = time.time() - start_time
                
                if response.status_code == 200:
                    filtered_data = json.loads(response.text)
                    if not isinstance(filtered_data, list):
                        filtered_data = [filtered_data] if filtered_data else []
                    
                    original_count = len(filtered_data)
                    filtered_data_sample = filtered_data[:MAX_TEST_RECORDS]
                    print(f"✅ 读取成功: {original_count} 条（只分析前{MAX_TEST_RECORDS}条），耗时: {duration:.2f} 秒")
                    
                    # 验证数据
                    proj_dist = analyze_project_distribution(filtered_data_sample, test_entity_type)
                    print(f"   项目分布（样本）: {proj_dist}")
                    
                    target_count = sum(1 for item in filtered_data_sample if isinstance(item, dict) and item.get('ProjectObjectId') == project_object_id)
                    non_target_count = len(filtered_data_sample) - target_count
                    print(f"   目标项目数据（样本）: {target_count} 条，其他项目数据: {non_target_count} 条")
            except Exception as e:
                print(f"❌ 测试失败: {e}")
                import traceback
                traceback.print_exc()
            
        # 测试4.5: 选择UIOPRJ项目，但使用Filter获取另一个项目的数据（验证Filter是否真的在API级别生效）
        if other_project:
            other_project_id = other_project.get('Id') or other_project.get('ProjectId')
            other_project_object_id = other_project.get('ObjectId')
            other_project_name = other_project.get('Name') or other_project.get('ProjectName')
            
            print(f"\n--- 测试4.5: 选择项目{project_id}，但使用Filter获取项目{other_project_id}的数据 ---")
            print(f"   目的：验证Filter是否能在API级别覆盖select_project的过滤")
            try:
                # 选择当前项目
                p6_service.app.select_project(projectId=project_id)
                # 但使用Filter获取另一个项目的数据
                filter_str = f"ProjectObjectId :eq: {other_project_object_id}"
                
                params = {
                    "Fields": ','.join(fields),
                    "Filter": filter_str,
                    "OrderBy": "ObjectId"
                }
                start_time = time.time()
                response = safe_request_with_delay(url, params, delay=1.0, timeout=30)
                duration = time.time() - start_time
                
                if response.status_code == 200:
                    filtered_data = json.loads(response.text)
                    if not isinstance(filtered_data, list):
                        filtered_data = [filtered_data] if filtered_data else []
                    
                    original_count = len(filtered_data)
                    filtered_data_sample = filtered_data[:MAX_TEST_RECORDS]
                    print(f"✅ 读取成功: {original_count} 条（只分析前{MAX_TEST_RECORDS}条），耗时: {duration:.2f} 秒")
                    
                    # 验证数据：应该只包含另一个项目的数据
                    proj_dist = analyze_project_distribution(filtered_data_sample, test_entity_type)
                    print(f"   项目分布（样本）: {proj_dist}")
                    
                    target_count = sum(1 for item in filtered_data_sample if isinstance(item, dict) and item.get('ProjectObjectId') == other_project_object_id)
                    current_project_count = sum(1 for item in filtered_data_sample if isinstance(item, dict) and item.get('ProjectObjectId') == project_object_id)
                    
                    print(f"   目标项目({other_project_object_id})数据（样本）: {target_count} 条")
                    print(f"   当前选择项目({project_object_id})数据（样本）: {current_project_count} 条")
                    
                    if target_count > 0 and current_project_count == 0:
                        print(f"   ✅ Filter在API级别生效！成功覆盖了select_project的过滤")
                    elif current_project_count > 0:
                        print(f"   ⚠️  警告: Filter可能未生效，仍返回了当前选择项目的数据")
                    elif len(filtered_data) == 0:
                        print(f"   ⚠️  返回数据为空（可能是Filter格式不正确或另一个项目无数据）")
                else:
                    print(f"❌ API调用失败: {response.status_code}")
                    print(f"   错误: {response.text[:300]}")
            except Exception as e:
                print(f"❌ 测试失败: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"\n--- 测试4.5: 跳过（未找到其他项目用于对比测试）---")
        
        # 测试5: 测试WBS和ResourceAssignment实体（这些在删除检测中也出现了问题）
        for other_entity in ['wbs', 'resource_assignment']:
            print(f"\n--- 测试5: {other_entity.upper()}实体，直接API调用使用Filter ---")
            try:
                url_other = f"{prefix}/{other_entity}"
                fields_other = ['ObjectId', 'ProjectObjectId'] if other_entity == 'wbs' else ['ObjectId', 'ProjectObjectId', 'ActivityObjectId']
                
                # 先确保选择了项目
                p6_service.app.select_project(projectId=project_id)
                
                # 测试不使用Filter参数（依赖select_project）- 限制数据量
                params_no_filter = {
                    "Fields": ','.join(fields_other),
                    "OrderBy": "ObjectId"
                }
                start_time = time.time()
                response = safe_request_with_delay(url_other, params_no_filter, delay=1.0, timeout=30)
                duration = time.time() - start_time
                
                if response.status_code == 200:
                    all_data = json.loads(response.text)
                    if not isinstance(all_data, list):
                        all_data = [all_data] if all_data else []
                    original_count = len(all_data)
                    all_data_sample = all_data[:MAX_TEST_RECORDS]
                    print(f"   不使用Filter参数（依赖select_project）: {original_count} 条（只分析前{MAX_TEST_RECORDS}条），耗时: {duration:.2f} 秒")
                    
                    # 分析项目分布
                    proj_dist = analyze_project_distribution(all_data_sample, other_entity)
                    print(f"   项目分布（样本）: {proj_dist}")
                    
                    # 测试使用Filter参数
                    filter_str = f"ProjectObjectId :eq: {project_object_id}"
                    params_filter = {
                        "Fields": ','.join(fields_other),
                        "Filter": filter_str,
                        "OrderBy": "ObjectId"
                    }
                    start_time = time.time()
                    response = safe_request_with_delay(url_other, params_filter, delay=1.0, timeout=30)
                    duration = time.time() - start_time
                    
                    if response.status_code == 200:
                        filtered_data = json.loads(response.text)
                        if not isinstance(filtered_data, list):
                            filtered_data = [filtered_data] if filtered_data else []
                        original_count = len(filtered_data)
                        filtered_data_sample = filtered_data[:MAX_TEST_RECORDS]
                        print(f"   使用Filter参数: {original_count} 条（只分析前{MAX_TEST_RECORDS}条），耗时: {duration:.2f} 秒")
                        
                        # 验证过滤效果
                        if filtered_data_sample:
                            proj_dist_filtered = analyze_project_distribution(filtered_data_sample, other_entity)
                            print(f"   项目分布（样本）: {proj_dist_filtered}")
                            target_count = sum(1 for item in filtered_data_sample if isinstance(item, dict) and item.get('ProjectObjectId') == project_object_id)
                            non_target_count = len(filtered_data_sample) - target_count
                            print(f"   目标项目数据（样本）: {target_count} 条，其他项目数据: {non_target_count} 条")
                            if non_target_count == 0 and len(filtered_data_sample) > 0:
                                print(f"   ✅ Filter对{other_entity}生效（样本验证）")
                            elif len(filtered_data) == 0:
                                print(f"   ⚠️  返回数据为空（可能Filter格式不正确）")
                            else:
                                print(f"   ⚠️  Filter对{other_entity}可能未完全生效（样本验证）")
                    else:
                        print(f"   ❌ Filter请求失败: {response.status_code}")
                        print(f"      错误: {response.text[:200]}")
                else:
                    print(f"   ❌ 读取失败: {response.status_code}")
                    print(f"      错误: {response.text[:200]}")
            except Exception as e:
                print(f"   ❌ 测试{other_entity}失败: {e}")
    
    except Exception as e:
        print(f"❌ 测试过程出错: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)
    print("\n关键发现:")
    print("1. Primavera库的select_project()在选择项目后，Primavera库方法会自动应用Filter")
    print("2. 但是直接API调用时，即使选择了项目，也需要在URL参数中明确传递Filter")
    print("3. 根据OpenAPI文档，Filter支持的操作符: :gt:, :lt:, :eq:, :gte:, :lte:, :and:, :or:")
    print("4. Filter格式应该是: 'ProjectObjectId :eq: {id}' （带空格的操作符格式）")
    print("\n建议:")
    print("1. 如果直接API调用，必须明确传递Filter参数，不能依赖select_project()")
    print("2. 检查测试3的结果，找出哪种Filter格式有效")
    print("3. 如果所有Filter格式都失败，检查P6 API版本或配置")
    print("4. 使用有效的Filter格式更新raw_data_sync_direct.py中的代码")

if __name__ == "__main__":
    test_p6_filter()

