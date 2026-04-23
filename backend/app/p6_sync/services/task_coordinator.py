"""
任务协调器：管理增量同步和删除检测的并发控制
使用文件锁 + 状态文件，避免数据库依赖
"""
import os
import json
import time
import threading
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict
import logging
import sys

# Windows 和 Linux/Mac 使用不同的文件锁机制
if sys.platform == 'win32':
    import msvcrt
else:
    import fcntl

logger = logging.getLogger(__name__)

class TaskCoordinator:
    """任务协调器：管理P6同步任务的并发控制"""
    
    def __init__(self, lock_dir: Optional[str] = None):
        """
        初始化任务协调器
        
        Args:
            lock_dir: 锁文件目录（可选，默认使用系统临时目录）
        """
        if lock_dir is None:
            # 使用系统临时目录
            import tempfile
            lock_dir = tempfile.gettempdir()
        
        self.lock_dir = Path(lock_dir)
        self.lock_dir.mkdir(parents=True, exist_ok=True)
        
        # 锁文件路径
        self.lock_file = self.lock_dir / "p6_sync_task.lock"
        self.status_file = self.lock_dir / "p6_sync_status.json"
        
        # 本地锁（线程安全）
        self._local_lock = threading.Lock()
        
        # 文件锁句柄（用于释放）
        self._lock_file_handle = None
        
        # 删除检测超时时间（秒）
        self.delete_detection_timeout = 1200  # 20分钟
        # 增量更新超时时间（秒）
        self.incremental_sync_timeout = 300  # 5分钟
    
    def _read_status(self) -> Dict:
        """读取状态文件"""
        try:
            if self.status_file.exists():
                with open(self.status_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"读取状态文件失败: {e}")
        
        # 返回默认状态
        return {
            "delete_detection": {
                "running": False,
                "started_at": None,
                "pid": None
            },
            "incremental_sync": {
                "running": False,
                "started_at": None,
                "pid": None
            },
            "reset_sync": {
                "running": False,
                "started_at": None,
                "pid": None
            }
        }
    
    def _write_status(self, status: Dict):
        """写入状态文件"""
        try:
            with open(self.status_file, 'w', encoding='utf-8') as f:
                json.dump(status, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"写入状态文件失败: {e}")
    
    def _acquire_file_lock(self, timeout: float = 0) -> bool:
        """
        获取文件锁（跨进程安全）
        
        Args:
            timeout: 超时时间（秒），0表示非阻塞
        
        Returns:
            是否成功获取锁
        """
        try:
            # 确保锁文件存在
            self.lock_file.touch(exist_ok=True)
            
            if sys.platform == 'win32':
                # Windows 使用 msvcrt
                try:
                    lock_fd = open(str(self.lock_file), 'r+b')
                    if timeout > 0:
                        # 阻塞模式，带超时
                        start_time = time.time()
                        while time.time() - start_time < timeout:
                            try:
                                msvcrt.locking(lock_fd.fileno(), msvcrt.LK_NBLCK, 1)
                                self._lock_file_handle = lock_fd  # 保存句柄以便释放
                                return True
                            except IOError:
                                time.sleep(0.1)
                        return False
                    else:
                        # 非阻塞模式
                        try:
                            msvcrt.locking(lock_fd.fileno(), msvcrt.LK_NBLCK, 1)
                            self._lock_file_handle = lock_fd  # 保存句柄以便释放
                            return True
                        except IOError:
                            lock_fd.close()
                            return False
                except Exception as e:
                    logger.error(f"Windows文件锁失败: {e}")
                    return False
            else:
                # Linux/Mac 使用 fcntl
                lock_fd = os.open(str(self.lock_file), os.O_RDWR | os.O_CREAT)
                
                if timeout > 0:
                    # 阻塞模式，带超时
                    start_time = time.time()
                    while time.time() - start_time < timeout:
                        try:
                            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                            self._lock_file_handle = lock_fd  # 保存句柄以便释放
                            return True
                        except BlockingIOError:
                            time.sleep(0.1)
                    os.close(lock_fd)
                    return False
                else:
                    # 非阻塞模式
                    try:
                        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        self._lock_file_handle = lock_fd  # 保存句柄以便释放
                        return True
                    except BlockingIOError:
                        os.close(lock_fd)
                        return False
        except Exception as e:
            logger.error(f"获取文件锁失败: {e}")
            return False
    
    def _release_file_lock(self):
        """释放文件锁"""
        try:
            if self._lock_file_handle is not None:
                if sys.platform == 'win32':
                    # Windows: 解锁并关闭文件
                    try:
                        msvcrt.locking(self._lock_file_handle.fileno(), msvcrt.LK_UNLCK, 1)
                        self._lock_file_handle.close()
                    except:
                        pass
                else:
                    # Linux/Mac: 关闭文件描述符会自动释放锁
                    try:
                        os.close(self._lock_file_handle)
                    except:
                        pass
                self._lock_file_handle = None
        except Exception as e:
            logger.warning(f"释放文件锁失败: {e}")
    
    def _is_process_running(self, pid: int) -> bool:
        """检查进程是否在运行"""
        try:
            if sys.platform == 'win32':
                # Windows: 使用 tasklist 命令检查
                import subprocess
                result = subprocess.run(
                    ['tasklist', '/FI', f'PID eq {pid}'],
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    timeout=5
                )
                return str(pid) in (result.stdout or "")
            else:
                # Linux/Mac: 使用 os.kill 发送信号0（不实际杀死进程，只检查是否存在）
                os.kill(pid, 0)
                return True
        except (OSError, subprocess.TimeoutExpired, subprocess.SubprocessError):
            return False
    
    def is_delete_detection_running(self) -> bool:
        """检查删除检测是否在运行"""
        with self._local_lock:
            status = self._read_status()
            dd_status = status.get("delete_detection", {})
            
            if not dd_status.get("running", False):
                return False
            
            # 检查进程是否真的在运行（通过PID）
            pid = dd_status.get("pid")
            if pid:
                if not self._is_process_running(pid):
                    logger.warning(f"删除检测进程 {pid} 不存在，清理状态")
                    self._clear_delete_detection_status()
                    return False
            
            # 检查是否超时（僵尸进程检测）
            started_at_str = dd_status.get("started_at")
            if started_at_str:
                try:
                    started_at = datetime.fromisoformat(started_at_str)
                    elapsed = (datetime.now(timezone.utc) - started_at.replace(tzinfo=timezone.utc)).total_seconds()
                    if elapsed > self.delete_detection_timeout:
                        logger.warning(f"删除检测运行超时（{elapsed:.0f}秒），清理状态")
                        self._clear_delete_detection_status()
                        return False
                except Exception as e:
                    logger.warning(f"解析删除检测开始时间失败: {e}")
                    return False
            
            return True
    
    def is_incremental_sync_running(self) -> bool:
        """检查增量更新是否在运行"""
        with self._local_lock:
            status = self._read_status()
            sync_status = status.get("incremental_sync", {})
            
            if not sync_status.get("running", False):
                return False
            
            # 检查进程是否真的在运行（通过PID）
            pid = sync_status.get("pid")
            if pid:
                if not self._is_process_running(pid):
                    logger.warning(f"增量更新进程 {pid} 不存在，清理状态")
                    self._clear_incremental_sync_status()
                    return False
            
            # 检查是否超时（僵尸进程检测）
            started_at_str = sync_status.get("started_at")
            if started_at_str:
                try:
                    started_at = datetime.fromisoformat(started_at_str)
                    elapsed = (datetime.now(timezone.utc) - started_at.replace(tzinfo=timezone.utc)).total_seconds()
                    if elapsed > self.incremental_sync_timeout:
                        logger.warning(f"增量更新运行超时（{elapsed:.0f}秒），清理状态")
                        self._clear_incremental_sync_status()
                        return False
                except Exception as e:
                    logger.warning(f"解析增量更新开始时间失败: {e}")
                    return False
            
            return True
    
    def _clear_delete_detection_status(self):
        """清理删除检测状态"""
        status = self._read_status()
        status["delete_detection"] = {
            "running": False,
            "started_at": None,
            "pid": None
        }
        self._write_status(status)
    
    def _clear_incremental_sync_status(self):
        """清理增量更新状态"""
        status = self._read_status()
        status["incremental_sync"] = {
            "running": False,
            "started_at": None,
            "pid": None
        }
        self._write_status(status)
    
    def acquire_delete_detection_lock(self, wait: bool = True, timeout: float = 180.0) -> bool:
        """
        获取删除检测锁
        
        Args:
            wait: 是否等待增量更新完成
            timeout: 等待超时时间（秒）
        
        Returns:
            是否成功获取锁
        """
        # 等待增量更新完成
        if wait:
            wait_start = time.time()
            while self.is_incremental_sync_running():
                if time.time() - wait_start > timeout:
                    logger.warning(f"等待增量更新完成超时（{timeout}秒）")
                    return False
                time.sleep(1)
        
        # 获取文件锁
        if not self._acquire_file_lock(timeout=5.0):
            logger.warning("无法获取文件锁（可能有其他进程正在运行）")
            return False
        
        try:
            # 更新状态
            status = self._read_status()
            status["delete_detection"] = {
                "running": True,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "pid": os.getpid()
            }
            self._write_status(status)
            logger.info("✅ 已获取删除检测锁")
            return True
        except Exception as e:
            logger.error(f"更新删除检测状态失败: {e}")
            self._release_file_lock()
            return False
    
    def release_delete_detection_lock(self):
        """释放删除检测锁"""
        try:
            self._clear_delete_detection_status()
            self._release_file_lock()
            logger.info("✅ 已释放删除检测锁")
        except Exception as e:
            logger.error(f"释放删除检测锁失败: {e}")
    
    def acquire_incremental_sync_lock(self, force: bool = False) -> bool:
        """
        获取增量更新锁（非阻塞）
        
        Args:
            force: 是否强制获取（手动触发时使用）
        
        Returns:
            是否成功获取锁
        """
        # 检查删除检测是否在运行
        if not force and self.is_delete_detection_running():
            logger.info("删除检测运行中，跳过本次增量更新")
            return False
        
        # 获取文件锁（非阻塞）
        if not self._acquire_file_lock(timeout=0):
            logger.warning("无法获取文件锁（可能有其他进程正在运行）")
            return False
        
        try:
            # 更新状态
            status = self._read_status()
            status["incremental_sync"] = {
                "running": True,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "pid": os.getpid()
            }
            self._write_status(status)
            logger.debug("✅ 已获取增量更新锁")
            return True
        except Exception as e:
            logger.error(f"更新增量更新状态失败: {e}")
            self._release_file_lock()
            return False
    
    def release_incremental_sync_lock(self):
        """释放增量更新锁"""
        try:
            self._clear_incremental_sync_status()
            self._release_file_lock()
            logger.debug("✅ 已释放增量更新锁")
        except Exception as e:
            logger.error(f"释放增量更新锁失败: {e}")
    
    def wait_for_incremental_sync(self, timeout: float = 180.0) -> bool:
        """
        等待增量更新完成
        
        Args:
            timeout: 超时时间（秒）
        
        Returns:
            是否成功等待（False表示超时）
        """
        wait_start = time.time()
        while self.is_incremental_sync_running():
            if time.time() - wait_start > timeout:
                logger.warning(f"等待增量更新完成超时（{timeout}秒）")
                return False
            time.sleep(1)
        return True
    
    def wait_for_delete_detection(self, timeout: float = 1200.0) -> bool:
        """
        等待删除检测完成
        
        Args:
            timeout: 超时时间（秒）
        
        Returns:
            是否成功等待（False表示超时）
        """
        wait_start = time.time()
        while self.is_delete_detection_running():
            if time.time() - wait_start > timeout:
                logger.warning(f"等待删除检测完成超时（{timeout}秒）")
                return False
            time.sleep(1)
        return True
    
    def get_status(self) -> Dict:
        """获取当前任务状态（用于监控）"""
        with self._local_lock:
            status = self._read_status()
            return {
                "delete_detection_running": self.is_delete_detection_running(),
                "incremental_sync_running": self.is_incremental_sync_running(),
                "reset_sync_running": self.is_reset_sync_running(),
                "status": status
            }
    
    def is_reset_sync_running(self) -> bool:
        """检查重置同步是否在运行"""
        with self._local_lock:
            status = self._read_status()
            reset_status = status.get("reset_sync", {})
            
            if not reset_status.get("running", False):
                return False
            
            # 检查进程是否真的在运行（通过PID）
            pid = reset_status.get("pid")
            if pid:
                if not self._is_process_running(pid):
                    logger.warning(f"重置同步进程 {pid} 不存在，清理状态")
                    self._clear_reset_sync_status()
                    return False
            
            # 检查是否超时（僵尸进程检测）
            started_at_str = reset_status.get("started_at")
            if started_at_str:
                try:
                    started_at = datetime.fromisoformat(started_at_str)
                    elapsed = (datetime.now(timezone.utc) - started_at.replace(tzinfo=timezone.utc)).total_seconds()
                    # 重置同步超时时间设置为30分钟
                    if elapsed > 1800:
                        logger.warning(f"重置同步运行超时（{elapsed:.0f}秒），清理状态")
                        self._clear_reset_sync_status()
                        return False
                except Exception as e:
                    logger.warning(f"解析重置同步开始时间失败: {e}")
                    return False
            
            return True
    
    def _clear_reset_sync_status(self):
        """清理重置同步状态"""
        status = self._read_status()
        status["reset_sync"] = {
            "running": False,
            "started_at": None,
            "pid": None
        }
        self._write_status(status)
    
    def acquire_reset_sync_lock(self) -> bool:
        """获取重置同步锁"""
        # 检查是否有其他任务在运行
        if self.is_delete_detection_running():
            logger.warning("删除检测运行中，无法执行重置同步")
            return False
        
        if self.is_incremental_sync_running():
            logger.warning("增量同步运行中，无法执行重置同步")
            return False
        
        # 获取文件锁
        if not self._acquire_file_lock(timeout=5.0):
            logger.warning("无法获取文件锁（可能有其他进程正在运行）")
            return False
        
        try:
            # 更新状态
            status = self._read_status()
            status["reset_sync"] = {
                "running": True,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "pid": os.getpid()
            }
            self._write_status(status)
            logger.info("✅ 已获取重置同步锁")
            return True
        except Exception as e:
            logger.error(f"更新重置同步状态失败: {e}")
            self._release_file_lock()
            return False
    
    def release_reset_sync_lock(self):
        """释放重置同步锁"""
        try:
            self._clear_reset_sync_status()
            self._release_file_lock()
            logger.info("✅ 已释放重置同步锁")
        except Exception as e:
            logger.error(f"释放重置同步锁失败: {e}")

