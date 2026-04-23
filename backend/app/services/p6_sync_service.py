"""
P6同步服务 - 使用Primavera REST API
参考: https://github.com/EnverMT/Primavera_REST_API
"""
from typing import List, Dict, Optional
from datetime import datetime, timezone
from app.config import settings
from app.database import SessionLocal
from app.models.activity_summary import ActivitySummary
# 使用新的P6SyncLog模型
from app.p6_sync.models.sync_log import P6SyncLog, SyncStatus
import logging
import json

logger = logging.getLogger(__name__)

try:
    from Primavera_REST_Api import Primavera
except ImportError:
    logger.warning("Primavera-REST-Api not installed. P6 sync will not work.")
    Primavera = None


class P6SyncService:
    """P6同步服务类"""
    
    def __init__(self):
        self.app: Optional[Primavera] = None
        self._connection_attempted = False  # 标记是否已尝试过连接
        self._connection_failed = False  # 标记连接是否失败
        self._initialize_p6_connection()
    
    def get_projects(self, eps_object_id: Optional[int] = None) -> List[Dict]:
        """获取P6项目列表"""
        if not self.app:
            logger.warning("P6 app not initialized")
            return []
        
        # 检查并重新连接（如果需要）
        self._reconnect_if_needed()
        if not self.app:
            logger.warning("P6 app not initialized after reconnect attempt")
            return []
        
        try:
            # 直接重新读取项目列表，确保获取最新数据
            # 根据P6 API文档，Project对象有ParentEPSObjectId字段
            # 请求所有相关字段
            requested_fields = ['ObjectId', 'Name', 'Id', 'ParentEPSObjectId', 'ParentEPSId', 'ParentEPSName']
            
            try:
                # 如果指定了 EPS，使用 Filter 参数筛选
                if eps_object_id is not None:
                    # 先获取所有项目，然后在代码中筛选
                    all_projects = self.app.project.read(fields=requested_fields)
                    # 检查是否是错误响应
                    if isinstance(all_projects, dict) and 'message' in all_projects:
                        error_msg = all_projects.get('message', 'Unknown error')
                        if 'not logged in' in error_msg.lower() or 'unauthorized' in error_msg.lower():
                            logger.warning("P6 session expired, re-logging in...")
                            self._connection_failed = False
                            self._connection_attempted = False
                            self._initialize_p6_connection()
                            if not self.app:
                                return []
                            all_projects = self.app.project.read(fields=requested_fields)
                    if isinstance(all_projects, list):
                        # 筛选特定EPS下的项目
                        projects_data = []
                        for p in all_projects:
                            if isinstance(p, dict):
                                # 检查ParentEPSObjectId
                                parent_eps = p.get('ParentEPSObjectId')
                                if parent_eps == eps_object_id:
                                    projects_data.append(p)
                    else:
                        projects_data = []
                else:
                    # 获取所有项目
                    projects_data = self.app.project.read(fields=requested_fields)
                    # 检查是否是错误响应
                    if isinstance(projects_data, dict) and 'message' in projects_data:
                        error_msg = projects_data.get('message', 'Unknown error')
                        if 'not logged in' in error_msg.lower() or 'unauthorized' in error_msg.lower():
                            logger.warning("P6 session expired, re-logging in...")
                            self._connection_failed = False
                            self._connection_attempted = False
                            self._initialize_p6_connection()
                            if not self.app:
                                return []
                            projects_data = self.app.project.read(fields=requested_fields)
                    
            except Exception as e:
                logger.error(f"Error reading projects: {e}")
                projects_data = []
            
            # 确保返回列表类型
            if projects_data is None:
                logger.warning("项目数据为None")
                return []
            
            # 如果是字典类型，转换为列表
            if isinstance(projects_data, dict):
                logger.info(f"项目数据是字典类型，转换为列表: {type(projects_data)}")
                # 可能是单个项目对象，或者包含项目列表的字典
                if 'projects' in projects_data or 'data' in projects_data:
                    # 尝试从字典中提取列表
                    projects_data = projects_data.get('projects') or projects_data.get('data') or [projects_data]
                else:
                    # 单个项目对象，转换为列表
                    projects_data = [projects_data]
            
            if not isinstance(projects_data, list):
                logger.warning(f"项目数据无法转换为列表类型: {type(projects_data)}")
                return []
            
            return projects_data
        except Exception as e:
            logger.error(f"Error getting projects: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def _initialize_p6_connection(self):
        """初始化P6连接"""
        # 如果已经尝试过连接且失败了，不再重复尝试
        if self._connection_attempted and self._connection_failed:
            return
        
        self._connection_attempted = True
        
        if Primavera is None:
            logger.warning("Primavera-REST-Api package not installed. P6 sync features will be disabled.")
            self._connection_failed = True
            return
        
        # 检查P6配置是否已设置（不是示例值）
        if not settings.P6_SERVER_URL or settings.P6_SERVER_URL == "http://your-p6-server:8206/p6ws/restapi":
            logger.info("P6 server not configured. P6 sync features will be disabled. Configure P6 settings in .env to enable.")
            self._connection_failed = True
            return
        
        if not settings.P6_DATABASE or settings.P6_DATABASE == "your_database_name":
            logger.info("P6 database not configured. P6 sync features will be disabled. Configure P6 settings in .env to enable.")
            self._connection_failed = True
            return
        
        try:
            self.app = Primavera(
                rest_api_prefix=settings.P6_SERVER_URL,
                database_name=settings.P6_DATABASE,
                login=settings.P6_USERNAME or "",
                password=settings.P6_PASSWORD or ""
            )
            # 验证连接是否真的成功（检查是否能获取项目列表）
            try:
                test_projects = self.app.project.read(fields=['ObjectId', 'Name', 'Id'])
                if isinstance(test_projects, dict) and 'message' in test_projects:
                    # 如果返回错误消息，说明登录失败
                    error_msg = test_projects.get('message', 'Unknown error')
                    logger.warning(f"P6登录验证失败: {error_msg}")
                    self.app = None
                    self._connection_failed = True
                    return
                # 验证成功
                project_count = len(test_projects) if isinstance(test_projects, list) else 0
                logger.info(f"P6 connection initialized successfully. Found {project_count} projects.")
                self._connection_failed = False
            except Exception as e:
                logger.warning(f"P6连接验证失败: {e}")
                self.app = None
                self._connection_failed = True
        except Exception as e:
            # 只记录一次连接失败的警告，不打印完整堆栈跟踪
            error_msg = str(e)
            if "ConnectionRefusedError" in error_msg or "Max retries exceeded" in error_msg:
                logger.warning(f"P6服务器连接失败: 无法连接到 {settings.P6_SERVER_URL}。请检查P6 REST API服务是否在WebLogic中启动。P6同步功能将被禁用。")
            else:
                logger.warning(f"Failed to initialize P6 connection: {e}. P6 sync features will be disabled.")
            self.app = None
            self._connection_failed = True
            # 不再打印堆栈跟踪，减少日志噪音（只在DEBUG级别记录详细信息）
            self.app = None
    
    def sync_activities(self, project_id: str) -> Dict:
        """
        同步P6作业数据
        
        Args:
            project_id: P6项目ID
            
        Returns:
            同步结果字典
        """
        if not self.app:
            return {
                "success": False,
                "error": "P6 connection not initialized"
            }
        
        db = SessionLocal()
        sync_log = None
        
        try:
            # 创建同步日志
            from app.p6_sync.models.sync_log import SyncEntityType
            sync_log = P6SyncLog(
                sync_type=SyncEntityType.ACTIVITY,
                sync_status=SyncStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
                project_id=project_id
            )
            db.add(sync_log)
            db.commit()
            
            # 选择项目
            self.app.select_project(projectId=project_id)
            
            # 读取作业数据
            activities_data = self.app.activity.read()
            
            # 同步到数据库
            synced_count = 0
            updated_count = 0
            created_count = 0
            
            for act_data in activities_data:
                activity_id = act_data.get('ActivityId') or act_data.get('Id')
                if not activity_id:
                    continue
                
                # 查找现有作业
                existing = db.query(ActivitySummary).filter(
                    ActivitySummary.activity_id == str(activity_id)
                ).first()
                
                # 构建作业数据
                activity_dict = self._map_p6_to_activity(act_data)
                
                if existing:
                    # 更新现有作业（注意：ActivitySummary 是只读汇总表，通常通过刷新脚本生成）
                    # 排除以下字段，这些字段由系统自动计算或从日报数据更新：
                    # - weight_factor, calculated_mhrs: 通过计算服务计算
                    # - completed, actual_manhour: 从 VFACTDB/MPDB 日报数据实时更新
                    excluded_fields = ['weight_factor', 'calculated_mhrs', 'completed', 'actual_manhour']
                    for key, value in activity_dict.items():
                        if key not in excluded_fields:
                            setattr(existing, key, value)
                    existing.updated_at = datetime.now(timezone.utc)
                    updated_count += 1
                else:
                    # 创建新作业（注意：ActivitySummary 是只读汇总表，通常通过刷新脚本生成）
                    new_activity = ActivitySummary(**activity_dict)
                    db.add(new_activity)
                    created_count += 1
                
                synced_count += 1
            
            db.commit()
            
            # 更新同步日志
            sync_log.sync_status = SyncStatus.COMPLETED
            sync_log.completed_at = datetime.now(timezone.utc)
            sync_log.total_count = synced_count
            sync_log.created_count = created_count
            sync_log.updated_count = updated_count
            db.commit()
            
            return {
                "success": True,
                "synced_count": synced_count,
                "created_count": created_count,
                "updated_count": updated_count,
                "sync_log_id": sync_log.id
            }
            
        except Exception as e:
            logger.error(f"Error syncing activities: {e}")
            if sync_log:
                sync_log.sync_status = SyncStatus.FAILED
                sync_log.completed_at = datetime.now(timezone.utc)
                sync_log.error_message = str(e)
                db.commit()
            
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            db.close()
    
    def _map_p6_to_activity(self, p6_data: Dict) -> Dict:
        """
        将P6数据映射到ActivitySummary模型
        
        注意：ActivitySummary 是只读汇总表，通常通过刷新脚本生成
        此方法仅用于特殊情况下的手动同步
        
        Args:
            p6_data: P6返回的作业数据
            
        Returns:
            ActivitySummary模型字典
        """
        # 根据P6数据结构映射字段
        # 这里需要根据实际的P6 API返回结构进行调整
        return {
            "activity_id": str(p6_data.get('ActivityId') or p6_data.get('Id', '')),
            "wbs_code": p6_data.get('WBSObjectId', ''),
            "project": p6_data.get('ProjectId', ''),
            "description": p6_data.get('Name', ''),
            "planned_start": self._parse_date(p6_data.get('StartDate')),
            "planned_finish": self._parse_date(p6_data.get('FinishDate')),
            "baseline_start": self._parse_date(p6_data.get('BLProjectStartDate')),
            "baseline_finish": self._parse_date(p6_data.get('BLProjectFinishDate')),
            "status": p6_data.get('StatusCode', 'Not Started'),
            # 其他字段需要根据P6实际返回的数据结构进行映射
        }
    
    def _parse_date(self, date_str: Optional[str]):
        """解析日期字符串"""
        if not date_str:
            return None
        try:
            # 根据P6返回的日期格式进行解析
            return datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
        except:
            return None
    
    def sync_wbs(self, project_id: str) -> Dict:
        """同步P6 WBS数据"""
        if not self.app:
            return {"success": False, "error": "P6 connection not initialized"}
        
        try:
            self.app.select_project(projectId=project_id)
            wbs_data = self.app.wbs.read()
            # TODO: 实现WBS同步逻辑
            return {"success": True, "count": len(wbs_data)}
        except Exception as e:
            logger.error(f"Error syncing WBS: {e}")
            return {"success": False, "error": str(e)}
    
    def sync_resources(self, project_id: str) -> Dict:
        """同步P6资源数据"""
        if not self.app:
            return {"success": False, "error": "P6 connection not initialized"}
        
        try:
            self.app.select_project(projectId=project_id)
            resource_data = self.app.resource.read()
            # TODO: 实现资源同步逻辑
            return {"success": True, "count": len(resource_data)}
        except Exception as e:
            logger.error(f"Error syncing resources: {e}")
            return {"success": False, "error": str(e)}
    
    def _reconnect_if_needed(self):
        """如果连接失败，尝试重新连接"""
        if not self.app:
            self._initialize_p6_connection()
            return
        
        # 测试连接是否有效
        try:
            test_response = self.app.eppmSession.session.get(f"{self.app.eppmSession.prefix}/project", params={"Fields": "ObjectId"})
            if test_response.status_code == 401:
                logger.warning("P6 session已过期，尝试重新登录...")
                self._connection_failed = False
                self._connection_attempted = False
                self._initialize_p6_connection()
        except Exception as e:
            logger.warning(f"P6连接测试失败，尝试重新连接: {e}")
            self._connection_failed = False
            self._connection_attempted = False
            self._initialize_p6_connection()
    
    def get_eps(self) -> List[Dict]:
        """获取EPS（企业项目结构）层级结构"""
        if not self.app:
            logger.warning("P6 app not initialized")
            return []
        
        try:
            # 检查并重新连接（如果需要）
            self._reconnect_if_needed()
            if not self.app:
                logger.warning("P6 app not initialized after reconnect attempt")
                return []
            
            # 直接调用P6 REST API获取EPS数据
            # EPS端点不在Primavera_REST_Api包的EndpointEnum中，需要直接调用
            url = f"{self.app.eppmSession.prefix}/eps"
            
            # 先尝试获取可用字段
            try:
                fields_url = f"{url}/fields"
                fields_response = self.app.eppmSession.session.get(fields_url)
                if fields_response.status_code == 200:
                    available_fields = fields_response.text.split(',')
                    logger.info(f"EPS可用字段: {available_fields[:10]}...")  # 只显示前10个
                    # 选择需要的字段（根据P6 API文档，使用正确的字段名）
                    requested_fields = []
                    # 优先使用的字段名（根据P6 API文档）
                    preferred_fields = ['ObjectId', 'Name', 'ParentObjectId', 'ParentEPSId', 'Id', 'ObsName', 'ObsObjectId']
                    
                    for field in preferred_fields:
                        if field in available_fields:
                            requested_fields.append(field)
                    
                    if requested_fields:
                        params = {"Fields": ','.join(requested_fields)}
                    else:
                        # 如果找不到，使用基础字段
                        params = {"Fields": ','.join(available_fields[:5]) if len(available_fields) > 0 else "ObjectId,Name"}
                else:
                    # 如果获取字段失败，使用P6 API文档中的标准字段名
                    params = {"Fields": "ObjectId,Name,ParentObjectId,ParentEPSId,Id,ObsName,ObsObjectId"}
            except Exception as fields_error:
                logger.warning(f"无法获取EPS字段列表，使用默认字段: {fields_error}")
                # 使用P6 API文档中的标准字段名
                params = {"Fields": "ObjectId,Name,ParentObjectId,ParentEPSId,Id,ObsName,ObsObjectId"}
            
            response = self.app.eppmSession.session.get(url, params=params)
            
            # 如果401错误，尝试重新登录
            if response.status_code == 401:
                logger.warning("P6 session已过期，尝试重新登录...")
                self._connection_failed = False
                self._connection_attempted = False
                self._initialize_p6_connection()
                if not self.app:
                    logger.error("重新登录失败")
                    return []
                # 重试请求
                response = self.app.eppmSession.session.get(url, params=params)
            
            # 如果400错误，尝试不指定字段（让API返回所有字段）
            if response.status_code == 400:
                logger.warning("使用Fields参数失败，尝试不指定字段")
                response = self.app.eppmSession.session.get(url)
                # 如果还是401，再次尝试重新登录
                if response.status_code == 401:
                    logger.warning("P6 session已过期，尝试重新登录...")
                    self._connection_failed = False
                    self._connection_attempted = False
                    self._initialize_p6_connection()
                    if not self.app:
                        logger.error("重新登录失败")
                        return []
                    response = self.app.eppmSession.session.get(url)
            
            response.raise_for_status()
            
            eps_data = response.json()
            
            # 确保返回列表类型
            if isinstance(eps_data, dict):
                if 'message' in eps_data:
                    logger.error(f"获取EPS失败: {eps_data.get('message')}")
                    return []
                # 可能是单个EPS对象
                eps_data = [eps_data] if eps_data else []
            
            if not isinstance(eps_data, list):
                logger.warning(f"EPS数据格式错误: {type(eps_data)}")
                return []
            
            logger.info(f"成功获取 {len(eps_data)} 个EPS节点")
            # 记录前几个EPS的字段和数据，用于调试
            if len(eps_data) > 0:
                logger.info(f"EPS字段示例: {list(eps_data[0].keys()) if isinstance(eps_data[0], dict) else 'N/A'}")
                # 记录前3个EPS的详细信息
                for i, eps in enumerate(eps_data[:3]):
                    if isinstance(eps, dict):
                        logger.info(f"EPS {i+1}: Name={eps.get('Name')}, ObjectId={eps.get('ObjectId')}, "
                                  f"Id={eps.get('Id')}, ParentObjectId={eps.get('ParentObjectId')}, "
                                  f"ParentEPSId={eps.get('ParentEPSId')}")
            
            return eps_data
            
        except Exception as e:
            logger.error(f"Error getting EPS: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def get_eps_tree(self) -> List[Dict]:
        """获取EPS树结构（层级化的）"""
        eps_list = self.get_eps()
        if not eps_list:
            logger.warning("EPS列表为空，无法构建树结构")
            return []
        
        logger.info(f"开始构建EPS树，共 {len(eps_list)} 个EPS节点")
        
        # 获取所有项目，收集所有在项目中出现的EPS ObjectId
        # 这样可以确保所有有项目的EPS都被包含在树中
        projects_data = self.get_projects()
        project_eps_ids = set()
        eps_info_from_projects = {}  # 从项目中提取的EPS信息
        existing_eps_object_ids = {eps.get('ObjectId') for eps in eps_list if isinstance(eps, dict) and eps.get('ObjectId') is not None}
        
        for proj in projects_data:
            if isinstance(proj, dict):
                parent_eps_object_id = proj.get("ParentEPSObjectId")
                if parent_eps_object_id is not None:
                    project_eps_ids.add(parent_eps_object_id)
                    # 如果这个EPS不在EPS列表中，保存从项目数据中提取的信息
                    if parent_eps_object_id not in existing_eps_object_ids:
                        if parent_eps_object_id not in eps_info_from_projects:
                            # 尝试从项目数据中获取EPS信息
                            eps_name = proj.get('ParentEPSName', '')
                            if not eps_name:
                                eps_name = f'EPS-{parent_eps_object_id}'
                            
                            eps_info_from_projects[parent_eps_object_id] = {
                                'ObjectId': parent_eps_object_id,
                                'Name': eps_name,
                                'Id': proj.get('ParentEPSId', ''),
                                'ParentObjectId': None,  # 暂时设为None，后续在构建树时会尝试查找
                                'ParentEPSId': '',
                                'ObsName': '',
                                'ObsObjectId': None
                            }
        
        logger.info(f"项目中出现的EPS ObjectId数量: {len(project_eps_ids)}")
        logger.info(f"EPS列表中已有的EPS ObjectId数量: {len(existing_eps_object_ids)}")
        logger.info(f"EPS列表中不存在的EPS ObjectId数量: {len(eps_info_from_projects)}")
        
        # 将项目中存在但EPS列表中不存在的EPS添加到EPS列表
        if eps_info_from_projects:
            logger.warning(f"发现 {len(eps_info_from_projects)} 个EPS节点在项目数据中存在但不在EPS列表中，将添加占位节点")
            missing_eps_names = [f"{eps_info['Name']} (ObjectId={oid})" for oid, eps_info in list(eps_info_from_projects.items())[:10]]
            logger.info(f"缺失的EPS节点示例: {', '.join(missing_eps_names)}")
            for eps_object_id, eps_info in eps_info_from_projects.items():
                eps_list.append(eps_info)
            logger.info(f"添加占位EPS节点后，EPS列表总数: {len(eps_list)}")
        
        # 构建EPS字典，以ObjectId为键
        eps_dict = {}
        eps_id_to_object_id = {}  # EPS Id（字符串）到ObjectId（数字）的映射
        
        # 第一遍：建立所有EPS的字典和Id到ObjectId的映射
        for eps in eps_list:
            if not isinstance(eps, dict):
                continue
            # 获取ObjectId
            object_id = eps.get('ObjectId')
            if object_id is None:
                logger.warning(f"EPS节点缺少ObjectId: {eps}")
                continue
            
            # 获取EPS的Id（字符串类型的短代码）
            eps_id = eps.get('Id', '')
            # 建立Id到ObjectId的映射（用于通过ParentEPSId查找父EPS）
            if eps_id:
                eps_id_to_object_id[eps_id] = object_id
                logger.debug(f"EPS映射: Id='{eps_id}' -> ObjectId={object_id}")
            
            eps_dict[object_id] = {
                "object_id": object_id,
                "name": eps.get('Name', ''),
                "id": eps_id,
                "parent_eps_object_id": eps.get('ParentObjectId'),  # 数字类型
                "parent_eps_id": eps.get('ParentEPSId', ''),  # 字符串类型
                "parent_eps_name": eps.get('ParentEPSName', ''),
                "obs_name": eps.get('ObsName', ''),
                "obs_object_id": eps.get('ObsObjectId'),
                "children": []
            }
        
        logger.info(f"建立了 {len(eps_id_to_object_id)} 个EPS Id到ObjectId的映射")
        if len(eps_id_to_object_id) > 0:
            sample_mappings = list(eps_id_to_object_id.items())[:5]
            logger.info(f"映射示例: {sample_mappings}")
        
        # 第二遍：如果某些EPS的parent_object_id为空，尝试通过parent_eps_id（字符串）查找
        fixed_count = 0
        for object_id, eps_node in eps_dict.items():
            parent_object_id = eps_node.get('parent_eps_object_id')
            parent_eps_id = eps_node.get('parent_eps_id')
            
            # 如果parent_object_id为空但parent_eps_id存在，尝试通过Id映射查找
            if parent_object_id is None and parent_eps_id:
                if parent_eps_id in eps_id_to_object_id:
                    found_parent_object_id = eps_id_to_object_id[parent_eps_id]
                    eps_node['parent_eps_object_id'] = found_parent_object_id
                    fixed_count += 1
                    logger.info(f"通过ParentEPSId找到父EPS: {eps_node.get('name')} (ObjectId={object_id}) -> ParentEPSId='{parent_eps_id}' -> ParentObjectId={found_parent_object_id}")
                else:
                    logger.warning(f"无法通过ParentEPSId找到父EPS: EPS={eps_node.get('name')} (ObjectId={object_id}), ParentEPSId='{parent_eps_id}' 不在映射表中")
        
        if fixed_count > 0:
            logger.info(f"通过ParentEPSId修复了 {fixed_count} 个EPS节点的父节点关系")
        
        # 构建树结构
        root_nodes = []
        
        # 记录每个节点的父子关系信息（用于调试）
        logger.info("开始构建EPS树结构...")
        for object_id, eps_node in eps_dict.items():
            parent_object_id = eps_node.get('parent_eps_object_id')
            parent_eps_id = eps_node.get('parent_eps_id')
            eps_name = eps_node.get('name')
            eps_id = eps_node.get('id')
            
            logger.debug(f"EPS节点: {eps_name} (ObjectId={object_id}, Id='{eps_id}')")
            logger.debug(f"  父节点信息: ParentObjectId={parent_object_id}, ParentEPSId='{parent_eps_id}'")
        
        # 构建树结构 - 遍历所有节点，将子节点添加到父节点的children中
        for object_id, eps_node in eps_dict.items():
            parent_id = eps_node.get('parent_eps_object_id')
            
            # 如果是根节点（没有父节点或父节点不在字典中）
            if parent_id is None:
                root_nodes.append(eps_node)
                logger.debug(f"根节点: {eps_node.get('name')} (ObjectId={object_id})")
            elif parent_id not in eps_dict:
                # 父节点不在字典中，作为根节点处理
                logger.warning(f"父节点不存在: EPS={eps_node.get('name')} (ObjectId={object_id}), ParentObjectId={parent_id} 不在EPS字典中")
                root_nodes.append(eps_node)
            else:
                # 子节点，添加到父节点的children中
                parent_node = eps_dict[parent_id]
                if 'children' not in parent_node:
                    parent_node['children'] = []
                parent_node['children'].append(eps_node)
                logger.debug(f"子节点: {eps_node.get('name')} (ObjectId={object_id}) -> 父节点: {parent_node.get('name')} (ObjectId={parent_id})")
        
        # 第三步：检查是否有循环引用或孤立节点
        # 统计所有在树中的节点
        def collect_node_ids(nodes, collected):
            """递归收集所有节点ID"""
            for node in nodes:
                node_id = node.get('object_id')
                if node_id and node_id not in collected:
                    collected.add(node_id)
                    if node.get('children'):
                        collect_node_ids(node['children'], collected)
        
        collected_ids = set()
        collect_node_ids(root_nodes, collected_ids)
        
        # 检查是否有未包含的节点
        unprocessed = [oid for oid in eps_dict.keys() if oid not in collected_ids]
        if unprocessed:
            logger.warning(f"有 {len(unprocessed)} 个EPS节点未包含在树中，可能存在问题")
            for oid in unprocessed:
                eps_node = eps_dict[oid]
                parent_id = eps_node.get('parent_eps_object_id')
                logger.warning(f"  未处理的EPS: {eps_node.get('name')} (ObjectId={oid}, ParentObjectId={parent_id})")
                # 作为根节点添加，避免丢失
                root_nodes.append(eps_node)
        
        # 记录树结构信息
        def count_tree_nodes(nodes, level=0):
            """递归统计树节点"""
            count = len(nodes)
            for node in nodes:
                if node.get('children'):
                    count += count_tree_nodes(node['children'], level + 1)
            return count
        
        def log_tree_structure(nodes, level=0, prefix=""):
            """递归记录树结构"""
            for node in nodes:
                indent = "  " * level
                children_count = len(node.get('children', []))
                logger.info(f"{indent}{prefix}{node.get('name')} (ObjectId={node.get('object_id')}, 子节点数={children_count})")
                if node.get('children'):
                    log_tree_structure(node['children'], level + 1, "├─ ")
        
        total_tree_nodes = count_tree_nodes(root_nodes)
        logger.info(f"EPS树构建完成，根节点数: {len(root_nodes)}, 树中总节点数: {total_tree_nodes}, 原始节点数: {len(eps_dict)}")
        
        # 记录树结构（仅前3层，避免日志过多）
        if len(root_nodes) <= 5:
            logger.info("完整EPS树结构:")
            log_tree_structure(root_nodes)
        else:
            logger.info("EPS树根节点信息:")
            for root in root_nodes[:10]:  # 只记录前10个根节点
                children_count = len(root.get('children', []))
                logger.info(f"  根节点: {root.get('name')} (ObjectId={root.get('object_id')}), 子节点数: {children_count}")
        
        return root_nodes
    
    def get_obs(self) -> List[Dict]:
        """获取OBS（组织分解结构）层级结构"""
        if not self.app:
            logger.warning("P6 app not initialized")
            return []
        
        try:
            # 直接调用P6 REST API获取OBS数据
            url = f"{self.app.eppmSession.prefix}/obs"
            
            # 先尝试获取可用字段
            try:
                fields_url = f"{url}/fields"
                fields_response = self.app.eppmSession.session.get(fields_url)
                if fields_response.status_code == 200:
                    available_fields = fields_response.text.split(',')
                    logger.info(f"OBS可用字段: {available_fields[:10]}...")  # 只显示前10个
                    # 选择需要的字段（OBS字段名可能与EPS类似）
                    requested_fields = []
                    # 优先使用的字段名
                    preferred_fields = ['ObjectId', 'Name', 'ParentObjectId', 'Id']
                    
                    for field in preferred_fields:
                        if field in available_fields:
                            requested_fields.append(field)
                    
                    if requested_fields:
                        params = {"Fields": ','.join(requested_fields)}
                    else:
                        # 如果找不到，使用基础字段
                        params = {"Fields": ','.join(available_fields[:5]) if len(available_fields) > 0 else "ObjectId,Name"}
                else:
                    # 如果获取字段失败，使用标准字段名
                    params = {"Fields": "ObjectId,Name,ParentObjectId,Id"}
            except Exception as fields_error:
                logger.warning(f"无法获取OBS字段列表，使用默认字段: {fields_error}")
                # 使用标准字段名
                params = {"Fields": "ObjectId,Name,ParentObjectId,Id"}
            
            response = self.app.eppmSession.session.get(url, params=params)
            
            # 如果400错误，尝试不指定字段（让API返回所有字段）
            if response.status_code == 400:
                logger.warning("使用Fields参数失败，尝试不指定字段")
                response = self.app.eppmSession.session.get(url)
            
            response.raise_for_status()
            
            obs_data = response.json()
            
            # 确保返回列表类型
            if isinstance(obs_data, dict):
                if 'message' in obs_data:
                    logger.error(f"获取OBS失败: {obs_data.get('message')}")
                    return []
                # 可能是单个OBS对象
                obs_data = [obs_data] if obs_data else []
            
            if not isinstance(obs_data, list):
                logger.warning(f"OBS数据格式错误: {type(obs_data)}")
                return []
            
            logger.info(f"成功获取 {len(obs_data)} 个OBS节点")
            # 记录第一个OBS的字段，用于调试
            if len(obs_data) > 0 and isinstance(obs_data[0], dict):
                logger.debug(f"OBS字段示例: {list(obs_data[0].keys())}")
            
            return obs_data
            
        except Exception as e:
            logger.error(f"Error getting OBS: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def get_obs_tree(self) -> List[Dict]:
        """获取OBS树结构（层级化的）"""
        obs_list = self.get_obs()
        if not obs_list:
            return []
        
        # 构建OBS字典，以ObjectId为键
        obs_dict = {}
        for obs in obs_list:
            if not isinstance(obs, dict):
                continue
            # 尝试不同的字段名
            object_id = obs.get('ObjectId') or obs.get('OBJECT_ID')
            if object_id is None:
                continue
            
            # 根据P6 API，OBS使用ParentObjectId
            parent_id = obs.get('ParentObjectId')
            
            obs_dict[object_id] = {
                "object_id": object_id,
                "name": obs.get('Name', ''),
                "id": obs.get('Id', ''),
                "parent_obs_object_id": parent_id,
                "children": []
            }
        
        # 构建树结构
        root_nodes = []
        for object_id, obs_node in obs_dict.items():
            parent_id = obs_node.get('parent_obs_object_id')
            if parent_id is None or parent_id not in obs_dict:
                # 根节点
                root_nodes.append(obs_node)
            else:
                # 子节点，添加到父节点的children中
                obs_dict[parent_id]["children"].append(obs_node)
        
        return root_nodes

