import json
import os
import re
import pandas as pd
import logging
import numpy as np
from utils.config import config  # ✅ 匯入配置

def load_meeting_records(file_path=None):
    """讀取會議記錄 CSV 並轉成 dict (保留空行，依日期分組)"""
    # ✅ 從配置檔讀取路徑
    if file_path is None:
        file_path = config.get_path('Paths', 'meeting_csv')
    
    # 讀取 CSV 並將 NaN 替換為空字串
    df = pd.read_csv(file_path, encoding="utf-8-sig")
    df = df.fillna("")
    
    records = df.to_dict(orient="records")

    date_pattern = re.compile(r"^\d{1,2}/\d{1,2}:")

    for r in records:
        if "進度紀錄" in r:
            progress_value = r["進度紀錄"]
            
            if (progress_value == "" or 
                progress_value is None or 
                (isinstance(progress_value, float) and np.isnan(progress_value))):
                r["進度紀錄"] = []
                continue
            
            if isinstance(progress_value, str) and progress_value.strip():
                lines = progress_value.split("\n")
                grouped = []
                buffer = ""

                for line in lines:
                    raw_line = line.rstrip("\r")

                    if date_pattern.match(raw_line):
                        if buffer:
                            grouped.append(buffer)
                        buffer = raw_line
                    else:
                        buffer += "\n" + raw_line
                if buffer:
                    grouped.append(buffer)

                r["進度紀錄"] = grouped
            else:
                r["進度紀錄"] = []
    
    logging.info(f"處理完成，共 {len(records)} 筆記錄")
    return records


def get_all_owner():
    """從 JSON 檔案讀取員工資料"""
    # ✅ 從配置檔讀取路徑
    owners_file_path = config.get_path('Paths', 'employee_info')
    
    try:
        if not os.path.exists(owners_file_path):
            logging.error(f"嚴重錯誤：檔案不存在於指定路徑 -> {owners_file_path}")
            return []

        with open(owners_file_path, 'r', encoding='utf-8-sig') as f:
            content = f.read()
            if not content:
                logging.warning(f"警告：員工資料檔案 {owners_file_path} 是空的。")
                return []
            logging.info(f"{owners_file_path} 資訊已上拋")
            return json.loads(content)
            
    except json.JSONDecodeError as e:
        logging.error(f"嚴重錯誤：員工資料檔案 {owners_file_path} JSON 格式不正確。錯誤訊息: {e}")
        return []
    except Exception as e:
        logging.error(f"讀取員工資料檔案時發生未知錯誤: {e}")
        return []
