import re
import pandas as pd
import logging
import numpy as np

def load_meeting_records(file_path="static/MeetingRecording.csv"):
    """讀取會議記錄 CSV 並轉成 dict (保留空行，依日期分組)"""
    # 讀取 CSV 並將 NaN 替換為空字串
    df = pd.read_csv(file_path, encoding="utf-8-sig")
    df = df.fillna("")  # ✅ 關鍵：將所有 NaN 替換為空字串
    
    records = df.to_dict(orient="records")

    date_pattern = re.compile(r"^\d{1,2}/\d{1,2}:")  # 例如 5/11: 或 10/11:

    for r in records:
        # ✅ 處理進度紀錄的 NaN 和空值
        if "進度紀錄" in r:
            progress_value = r["進度紀錄"]
            
            # 檢查是否為空、NaN 或無效值
            if (progress_value == "" or 
                progress_value is None or 
                (isinstance(progress_value, float) and np.isnan(progress_value))):
                r["進度紀錄"] = []  # 設為空陣列
                continue
            
            # 如果是有效的字串，才進行處理
            if isinstance(progress_value, str) and progress_value.strip():
                lines = progress_value.split("\n")
                grouped = []
                buffer = ""

                for line in lines:
                    # 保留空行，不要 strip()
                    raw_line = line.rstrip("\r")  

                    if date_pattern.match(raw_line):  
                        if buffer:
                            grouped.append(buffer)
                        buffer = raw_line
                    else:
                        # 即使是空行也要保留
                        buffer += "\n" + raw_line
                if buffer:
                    grouped.append(buffer)

                # 這裡 grouped 裡的元素會保留空行
                r["進度紀錄"] = grouped
            else:
                # 如果不是字串或為空，設為空陣列
                r["進度紀錄"] = []
    
    logging.info(f"處理完成，共 {len(records)} 筆記錄")
    return records