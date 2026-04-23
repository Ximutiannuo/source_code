
import sys
import os
import json
from pathlib import Path
import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime

# 设置项目路径
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend")) # 确保能找到 app 目录

from app.database import SessionLocal
from app.models.report import ITPDefinition, RFIGroundField

def format_list(val):
    """还原 JSON 列表为带换行的字符串"""
    if not val:
        return ""
    if isinstance(val, str):
        try:
            val = json.loads(val)
        except:
            return val
    if isinstance(val, list):
        return "\n".join(val)
    return str(val)

def combine_lang(eng, rus):
    """合并英俄内容，用分隔线区分"""
    eng = str(eng or "").strip()
    rus = str(rus or "").strip()
    if eng and rus:
        return f"{eng}\n------------------\n{rus}"
    return eng or rus

def export_itp_to_excel(output_dir: str, doc_num: str = None):
    db = SessionLocal()
    try:
        # 查询文档
        query = db.query(ITPDefinition)
        if doc_num:
            query = query.filter(ITPDefinition.document_number == doc_num)
        itps = query.all()

        if not itps:
            print("No ITP found in database.")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(output_dir, f"ITP_Verification_{timestamp}.xlsx")
        
        # 使用 XlsxWriter 作为引擎以支持高级格式
        writer = pd.ExcelWriter(file_path, engine='xlsxwriter')
        workbook = writer.book

        # 定义样式
        header_fmt = workbook.add_format({
            'bold': True, 'bg_color': '#D7E4BC', 'border': 1, 'align': 'center', 'valign': 'vcenter', 'text_wrap': True,
            'font_name': 'Arial'
        })
        section_fmt = workbook.add_format({
            'bold': True, 'bg_color': '#F2F2F2', 'border': 1, 'valign': 'vcenter',
            'font_name': 'Arial'
        })
        item_fmt = workbook.add_format({
            'border': 1, 'valign': 'top', 'text_wrap': True, 'font_size': 10,
            'font_name': 'Arial'
        })
        center_fmt = workbook.add_format({
            'border': 1, 'valign': 'top', 'align': 'center', 'text_wrap': True, 'font_size': 10,
            'font_name': 'Arial'
        })

        for itp in itps:
            # 导出每个 ITP 到一个独立的 Sheet，Sheet 名取编号后几位
            sheet_name = itp.document_number[-20:].replace(':', '_').replace('/', '_')
            worksheet = workbook.add_worksheet(sheet_name)
            
            # 设置列宽
            worksheet.set_column('A:A', 8)   # No.
            worksheet.set_column('B:B', 40)  # Description
            worksheet.set_column('C:C', 30)  # Documents
            worksheet.set_column('D:D', 35)  # Criteria
            worksheet.set_column('E:E', 30)  # QC Forms
            worksheet.set_column('F:I', 5)   # Involvement

            # 写表头
            headers = [
                "No.", "Work Description (Eng/Rus)", "Applicable Documents", 
                "Acceptance Criteria", "Quality Control Form", 
                "Sub", "Con", "Cust", "AQC"
            ]
            for col, text in enumerate(headers):
                worksheet.write(0, col, text, header_fmt)

            # 获取所有行并排序
            fields = db.query(RFIGroundField).filter(
                RFIGroundField.document_number == itp.document_number
            ).order_by(RFIGroundField.id).all() 

            row_idx = 1
            for f in fields:
                if f.level == 2:
                    # 大节行：合并单元格
                    worksheet.merge_range(row_idx, 0, row_idx, 8, f" {f.itp_id} {f.section_name or ''}", section_fmt)
                else:
                    # 数据行
                    worksheet.write(row_idx, 0, f.itp_id, center_fmt)
                    worksheet.write(row_idx, 1, combine_lang(f.workdescription_eng, f.workdescription_rus), item_fmt)
                    worksheet.write(row_idx, 2, combine_lang(format_list(f.applicable_documents_eng), format_list(f.applicable_documents_rus)), item_fmt)
                    worksheet.write(row_idx, 3, combine_lang(format_list(f.acceptance_criteria_eng), format_list(f.acceptance_criteria_rus)), item_fmt)
                    worksheet.write(row_idx, 4, combine_lang(f.quality_control_form_master_document_eng, f.quality_control_form_master_document_rus), item_fmt)
                    worksheet.write(row_idx, 5, f.involvement_subcon or "", center_fmt)
                    worksheet.write(row_idx, 6, f.involvement_contractor or "", center_fmt)
                    worksheet.write(row_idx, 7, f.involvement_customer or "", center_fmt)
                    worksheet.write(row_idx, 8, f.involvement_aqc or "", center_fmt)
                row_idx += 1

        writer.close()
        print(f"\nExport successful! File saved to: {file_path}")

    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--doc", help="Specific document number to export")
    args = parser.parse_args()
    
    # 默认输出到 D:/
    output_dir = "D:/"
    if not os.path.exists(output_dir):
        output_dir = "./" # 如果 D 盘不存在则输出到当前目录
        
    export_itp_to_excel(output_dir, args.doc)
