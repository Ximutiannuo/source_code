"""
工效预聚合缓存模型
参考 dashboard_s_curve_cache，支持按 filter_key + group_by 预聚合，由定时任务每日刷新
"""
from sqlalchemy import Column, Integer, String, Date, Numeric, DateTime, Index
from app.database import Base
from app.utils.timezone import now as system_now


class ProductivityCache(Base):
    """
    工效预聚合主表 - 按日存储 (filter_key, date, group_by, dim_val) 的 mp/achieved/mp_prod/mp_nonprod
    供 get_productivity_analysis / get_productivity_trend 优先读取，避免实时大表 JOIN
    """
    __tablename__ = "productivity_cache"

    id = Column(Integer, primary_key=True, index=True)
    filter_key = Column(String(512), nullable=False, default="", comment="维度组合键，空=全局")
    date = Column(Date, nullable=False, comment="日期")
    group_by = Column(String(64), nullable=False, comment="分组维度: scope, subproject, summary 等")
    dim_val = Column(String(512), nullable=False, comment="维度取值，summary 时为 __total__")
    mp = Column(Numeric(18, 4), default=0, comment="人力投入")
    achieved = Column(Numeric(18, 4), default=0, comment="完成量")
    mp_prod = Column(Numeric(18, 4), default=0, comment="生产性人力")
    mp_nonprod = Column(Numeric(18, 4), default=0, comment="非生产性人力(CO01/CO03/CO04)")
    updated_at = Column(DateTime, default=system_now, onupdate=system_now, comment="刷新时间")

    __table_args__ = (
        Index("idx_prod_cache_key_date", "filter_key", "date", mysql_length={"filter_key": 191}),
        Index("idx_prod_cache_lookup", "filter_key", "group_by", "date", "dim_val",
              mysql_length={"filter_key": 191, "group_by": 32, "dim_val": 191}),
    )


class ProductivityCacheWp(Base):
    """
    工效按工作包预聚合 - 用于 weighted_norms 计算
    按 (filter_key, date, group_by, dim_val, work_package) 存储 mp
    """
    __tablename__ = "productivity_cache_wp"

    id = Column(Integer, primary_key=True, index=True)
    filter_key = Column(String(512), nullable=False, default="")
    date = Column(Date, nullable=False)
    group_by = Column(String(64), nullable=False)
    dim_val = Column(String(512), nullable=False)
    work_package = Column(String(128), nullable=False)
    mp = Column(Numeric(18, 4), default=0)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (
        Index("idx_prod_cache_wp_lookup", "filter_key", "group_by", "date", "dim_val", "work_package",
              mysql_length={"filter_key": 191, "group_by": 32, "dim_val": 191, "work_package": 64}),
    )
