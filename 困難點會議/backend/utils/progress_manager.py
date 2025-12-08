import os
import json
import logging
from pathlib import Path
from datetime import datetime
from utils.config import config  # ✅ 匯入配置

logger = logging.getLogger(__name__)

class ProgressManager:
    def __init__(self):
        # ✅ 從配置檔讀取路徑
        self.progress_dir = config.get_path('Paths', 'progress_dir')
        self.ensure_directory_exists()
    
    def ensure_directory_exists(self):
        """確保進度紀錄目錄存在"""
        Path(self.progress_dir).mkdir(parents=True, exist_ok=True)
    
    def get_progress_file_path(self, record_id):
        """取得特定記錄的進度檔案路徑"""
        return os.path.join(self.progress_dir, f"{record_id}.json")
    
    def load_progress_history(self, record_id):
        """載入指定記錄的完整進度歷史"""
        try:
            file_path = self.get_progress_file_path(record_id)
            if not os.path.exists(file_path):
                return {}
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                logger.info(f"載入記錄 {record_id} 的進度歷史，共 {len(data)} 筆")
                return data
        except Exception as e:
            logger.error(f"載入進度歷史失敗 - 記錄ID: {record_id}, 錯誤: {str(e)}")
            return {}
    
    def save_progress_history(self, record_id, progress_data):
        """儲存指定記錄的完整進度歷史"""
        try:
            file_path = self.get_progress_file_path(record_id)
            
            if not isinstance(progress_data, dict):
                logger.warning(f"進度資料格式錯誤，記錄ID: {record_id}")
                return False
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(progress_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"成功儲存記錄 {record_id} 的進度歷史，共 {len(progress_data)} 筆")
            return True
            
        except Exception as e:
            logger.error(f"儲存進度歷史失敗 - 記錄ID: {record_id}, 錯誤: {str(e)}")
            return False
    
    def add_progress_entry(self, record_id, content):
        """新增一筆進度記錄"""
        try:
            existing_progress = self.load_progress_history(record_id)
            
            timestamp = datetime.now().isoformat()
            existing_progress[timestamp] = content
            
            success = self.save_progress_history(record_id, existing_progress)
            
            if success:
                logger.info(f"新增進度記錄成功 - 記錄ID: {record_id}, 內容: {content}")
                return existing_progress
            else:
                return None
                
        except Exception as e:
            logger.error(f"新增進度記錄失敗 - 記錄ID: {record_id}, 錯誤: {str(e)}")
            return None
    
    def remove_progress_entry(self, record_id, timestamp):
        """移除一筆進度記錄"""
        try:
            existing_progress = self.load_progress_history(record_id)
            
            if timestamp in existing_progress:
                del existing_progress[timestamp]
                
                success = self.save_progress_history(record_id, existing_progress)
                
                if success:
                    logger.info(f"移除進度記錄成功 - 記錄ID: {record_id}, 時間戳記: {timestamp}")
                    return existing_progress
            
            return None
            
        except Exception as e:
            logger.error(f"移除進度記錄失敗 - 記錄ID: {record_id}, 錯誤: {str(e)}")
            return None
    
    def get_latest_progress(self, record_id):
        """取得最新的一筆進度記錄"""
        try:
            progress_data = self.load_progress_history(record_id)
            
            if not progress_data:
                return ""
            
            latest_timestamp = max(progress_data.keys(), key=lambda x: datetime.fromisoformat(x))
            return progress_data[latest_timestamp]
            
        except Exception as e:
            logger.error(f"取得最新進度失敗 - 記錄ID: {record_id}, 錯誤: {str(e)}")
            return ""
    
    def update_csv_progress(self, record_id):
        """更新 CSV 中的進度紀錄欄位（只保留最新一筆）"""
        try:
            # ✅ 從配置檔讀取路徑
            from utils.config import config
            csv_path = config.get_path('Paths', 'meeting_csv')
            import pandas as pd
            
            if not Path(csv_path).exists():
                logger.error(f"CSV 檔案不存在：{csv_path}")
                return False
            
            df = pd.read_csv(csv_path, dtype=str, encoding='utf-8-sig').fillna("")
            
            record_index = None
            if 'id' in df.columns:
                id_match = df[df['id'] == str(record_id)].index
                if len(id_match) > 0:
                    record_index = id_match[0]
            
            if record_index is None and '項次' in df.columns:
                seq_match = df[df['項次'] == str(record_id)].index
                if len(seq_match) > 0:
                    record_index = seq_match[0]
            
            if record_index is not None:
                latest_progress = self.get_latest_progress(record_id)
                
                df.loc[record_index, '進度紀錄'] = latest_progress
                df.to_csv(csv_path, index=False, encoding='utf-8-sig')
                
                logger.info(f"CSV 進度紀錄已更新 - 記錄ID: {record_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"更新 CSV 進度紀錄失敗 - 記錄ID: {record_id}, 錯誤: {str(e)}")
            return False

# 建立全域實例
progress_manager = ProgressManager()