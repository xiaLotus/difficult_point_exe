import os
import json
import logging
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
from utils.config import config  # ✅ 匯入配置

logger = logging.getLogger(__name__)

# ✅ 從配置檔讀取路徑
path = config.get_path('Paths', 'meeting_csv')

def save_new_record(username, newrecords):
    logger.warning(f"{username} 準備儲存新的一筆資訊")
    logger.warning(f"更新資訊如下：{newrecords}")
    
    fieldnames = [
        "id", "項次", "提案日期", "棟別", "樓層", "站點", "類別", "提案人", "案件分類",
        "問題描述", "PDCA", "截止日期", "專案Owner", "項目DueDate", "進度紀錄", "Status"
    ]
    
    try:
        if isinstance(newrecords.get("進度紀錄"), list):
            newrecords["進度紀錄"] = "\n".join(newrecords["進度紀錄"])

        if Path(path).exists():
            df = pd.read_csv(path, dtype=str, encoding='utf-8-sig').fillna("")
        else:
            df = pd.DataFrame(columns=fieldnames)

        for field in fieldnames:
            if field not in newrecords:
                newrecords[field] = ""

        df = pd.concat([pd.DataFrame([newrecords]), df], ignore_index=True)
        df = df[fieldnames]
        
        df.to_csv(path, index=False, encoding='utf-8-sig')
        logger.info(f"{username} 的新資料已成功寫入 CSV：{path}")
        return True
        
    except Exception as e:
        logger.error(f"{username} 的新資料無法正常寫入，錯誤：{str(e)}")
        return False


def update_existing_record(username, record_id, updated_data):
    """更新現有記錄 - 修正 JSON 處理邏輯避免巢狀問題"""
    logger.warning(f"{username} 準備更新記錄，ID/項次：{record_id}")
    logger.warning(f"更新資訊如下：{updated_data}")
    
    fieldnames = [
        "id", "項次", "提案日期", "棟別", "樓層", "站點", "類別", "提案人", "案件分類",
        "問題描述", "PDCA", "截止日期", "專案Owner", "項目DueDate", "進度紀錄", "Status"
    ]
    
    try:
        if not Path(path).exists():
            logger.error(f"CSV 檔案不存在：{path}")
            return False
            
        df = pd.read_csv(path, dtype=str, encoding='utf-8-sig').fillna("")
        
        record_index = None
        
        if 'id' in df.columns:
            id_match = df[df['id'] == str(record_id)].index
            if len(id_match) > 0:
                record_index = id_match
        
        if record_index is None and '項次' in df.columns:
            seq_match = df[df['項次'] == str(record_id)].index
            if len(seq_match) > 0:
                record_index = seq_match
        
        if record_index is None or len(record_index) == 0:
            logger.error(f"找不到記錄 ID/項次：{record_id}")
            return False
        
        if "進度紀錄" in updated_data:
            progress_data = updated_data["進度紀錄"]
            
            existing_progress = df.loc[record_index[0], '進度紀錄'] if '進度紀錄' in df.columns else ""
            existing_progress_obj = {}
            
            if existing_progress and existing_progress.strip():
                try:
                    existing_progress_obj = json.loads(existing_progress)
                    if not isinstance(existing_progress_obj, dict):
                        existing_progress_obj = {}
                except json.JSONDecodeError:
                    logger.warning(f"現有進度紀錄格式錯誤，將重置: {existing_progress}")
                    existing_progress_obj = {}
            
            if isinstance(progress_data, dict):
                existing_progress_obj.update(progress_data)
                final_progress = existing_progress_obj
                
            elif isinstance(progress_data, list):
                for i, content in enumerate(progress_data):
                    timestamp = (datetime.now() - timedelta(seconds=i)).isoformat()
                    existing_progress_obj[timestamp] = content
                final_progress = existing_progress_obj
                
            elif isinstance(progress_data, str):
                try:
                    parsed_json = json.loads(progress_data)
                    if isinstance(parsed_json, dict):
                        existing_progress_obj.update(parsed_json)
                        final_progress = existing_progress_obj
                    elif isinstance(parsed_json, list):
                        for i, content in enumerate(parsed_json):
                            timestamp = (datetime.now() - timedelta(seconds=i)).isoformat()
                            existing_progress_obj[timestamp] = content
                        final_progress = existing_progress_obj
                    else:
                        timestamp = datetime.now().isoformat()
                        existing_progress_obj[timestamp] = str(parsed_json)
                        final_progress = existing_progress_obj
                except json.JSONDecodeError:
                    if progress_data.strip():
                        lines = progress_data.split('\n')
                        clean_lines = [line.strip() for line in lines if line.strip()]
                        for i, content in enumerate(clean_lines):
                            timestamp = (datetime.now() - timedelta(seconds=i)).isoformat()
                            existing_progress_obj[timestamp] = content
                        final_progress = existing_progress_obj
                    else:
                        final_progress = existing_progress_obj
            else:
                timestamp = datetime.now().isoformat()
                existing_progress_obj[timestamp] = str(progress_data)
                final_progress = existing_progress_obj
            
            updated_data["進度紀錄"] = json.dumps(final_progress, ensure_ascii=False, separators=(',', ':'))
            logger.info(f"最終進度紀錄 JSON: {updated_data['進度紀錄']}")
        
        for key, value in updated_data.items():
            if key in df.columns:
                df.loc[record_index[0], key] = str(value) if value is not None else ""
        
        existing_fields = [f for f in fieldnames if f in df.columns]
        df = df[existing_fields]
        
        df.to_csv(path, index=False, encoding='utf-8-sig')
        logger.info(f"{username} 成功更新記錄 ID/項次：{record_id}")
        return True
        
    except Exception as e:
        logger.error(f"{username} 更新記錄失敗，ID/項次：{record_id}，錯誤：{str(e)}")
        return False
    

def delete_record(username, record_id):
    """刪除記錄 - 支援用 id 或 項次 查找"""
    logger.warning(f"{username} 準備刪除記錄 ID/項次：{record_id}")
    
    try:
        if not Path(path).exists():
            logger.error(f"CSV 檔案不存在：{path}")
            return False
            
        df = pd.read_csv(path, dtype=str, encoding='utf-8-sig').fillna("")
        
        record_index = None
        
        if 'id' in df.columns:
            id_match = df[df['id'] == str(record_id)].index
            if len(id_match) > 0:
                record_index = id_match
        
        if record_index is None and '項次' in df.columns:
            seq_match = df[df['項次'] == str(record_id)].index
            if len(seq_match) > 0:
                record_index = seq_match
        
        if record_index is None or len(record_index) == 0:
            logger.error(f"找不到要刪除的記錄 ID/項次：{record_id}")
            return False
        
        df = df.drop(record_index).reset_index(drop=True)
        df.to_csv(path, index=False, encoding='utf-8-sig')
        logger.info(f"{username} 成功刪除記錄 ID/項次：{record_id}")
        return True
        
    except Exception as e:
        logger.error(f"{username} 刪除記錄失敗，ID/項次：{record_id}，錯誤：{str(e)}")
        return False