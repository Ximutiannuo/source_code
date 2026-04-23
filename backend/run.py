"""
开发环境启动脚本
"""
import uvicorn

if __name__ == "__main__":
    # 生产环境下建议通过环境变量控制 log_level
    import os
    env = os.getenv("ENV", "development")
    log_level = "info" if env != "production" else "warning"
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True if env != "production" else False,
        log_level=log_level,
        use_colors=False if os.name == 'nt' else True,  # Windows下禁用色彩以防乱码
        timeout_keep_alive=5,
        timeout_graceful_shutdown=30
    )

