# CAD / SolidWorks 自动同步

CAD / SolidWorks 自动同步接口已预留。

设计人员保存装配图后，外部插件或中间服务可直接调用 `POST /api/plm/boms/cad-sync`，按产品编码、版本、BOM 类型自动覆盖更新，无需人工二次录入。

建议后续接入 SolidWorks API 或 PDM 事件，以“图纸保存事件 + JSON 推送”的方式形成自动同步闭环。
