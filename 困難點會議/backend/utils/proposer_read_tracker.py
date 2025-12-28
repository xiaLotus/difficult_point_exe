"""
提案人閱讀狀態追蹤工具 - 詳細版本
返回每則留言和每次進度的詳細資訊
"""
import os
import json
from datetime import datetime
import configparser

class ProposerReadTracker:
    def __init__(self):
        # 讀取設定檔
        config = configparser.ConfigParser()
        
        possible_paths = [
            'config.ini',
            os.path.join(os.path.dirname(__file__), '..', 'config.ini'),
            os.path.join(os.path.dirname(__file__), '..', '..', 'config.ini'),
        ]
        
        config_loaded = False
        for config_path in possible_paths:
            if os.path.exists(config_path):
                try:
                    config.read(config_path, encoding='utf-8')
                    if 'Paths' in config or 'paths' in config:
                        config_loaded = True
                        print(f"✅ 成功讀取 config.ini: {os.path.abspath(config_path)}")
                        break
                except Exception as e:
                    print(f"⚠️ 讀取 {config_path} 失敗: {e}")
        
        if config_loaded:
            paths_section = 'Paths' if 'Paths' in config else 'paths'
            self.data_dir = 'static'
            self.comments_dir = config[paths_section].get('comments_dir', 'static\\meeting_comments')
            self.progress_dir = config[paths_section].get('progress_dir', 'static\\progress_records')
            
            print(f"📁 留言目錄: {self.comments_dir}")
            print(f"📁 進度目錄: {self.progress_dir}")
        else:
            print("⚠️ 未找到 config.ini，使用預設路徑")
            self.data_dir = 'static'
            self.comments_dir = 'static\\meeting_comments'
            self.progress_dir = 'static\\progress_records'
        
        self.read_records_file = os.path.join(self.data_dir, 'proposer_read_records.json')
        self._ensure_file_exists()
    
    def _ensure_file_exists(self):
        """確保記錄檔案存在"""
        if not os.path.exists(self.read_records_file):
            os.makedirs(os.path.dirname(self.read_records_file), exist_ok=True)
            with open(self.read_records_file, 'w', encoding='utf-8') as f:
                json.dump({}, f)
            print(f"✅ 已創建閱讀記錄檔案: {self.read_records_file}")
    
    def mark_as_read(self, record_id):
        """標記提案人已讀"""
        try:
            with open(self.read_records_file, 'r', encoding='utf-8') as f:
                records = json.load(f)
        except:
            records = {}
        
        records[record_id] = datetime.now().isoformat()
        
        with open(self.read_records_file, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        
        return True
    
    def get_last_read_time(self, record_id):
        """獲取提案人最後閱讀時間"""
        try:
            with open(self.read_records_file, 'r', encoding='utf-8') as f:
                records = json.load(f)
            
            if record_id in records:
                return datetime.fromisoformat(records[record_id])
            return None
        except:
            return None
    
    def get_unread_comments(self, record_id, last_read_time=None, proposer_name=None):
        """
        獲取未讀留言列表（詳細）
        
        Args:
            record_id: CSV 的 id 欄位
            last_read_time: 最後閱讀時間
            proposer_name: 提案人姓名（用於過濾自己的留言）
        
        Returns:
            list: [
                {
                    'id': str,
                    'author': str,
                    'content': str,
                    'time': str,
                    'has_images': bool
                }
            ]
        """
        comment_file = os.path.join(self.comments_dir, f'{record_id}.json')
        
        if not os.path.exists(comment_file):
            return []
        
        try:
            with open(comment_file, 'r', encoding='utf-8') as f:
                comments = json.load(f)
            
            if not comments or not isinstance(comments, dict):
                return []
            
            unread_comments = []
            
            for comment_id, comment_data in comments.items():
                if not isinstance(comment_data, dict):
                    continue
                
                # 檢查留言時間
                if 'created_at' not in comment_data:
                    continue
                
                try:
                    comment_time = datetime.fromisoformat(comment_data['created_at'])
                except:
                    continue
                
                # 如果有最後閱讀時間，只返回比它新的留言
                if last_read_time and comment_time <= last_read_time:
                    continue
                
                # 提取留言作者
                author = comment_data.get('display_name', comment_data.get('username', '未知'))
                
                # ⭐ 過濾提案人自己的留言
                if proposer_name and author.strip() == proposer_name.strip():
                    print(f"⏭️ 跳過提案人自己的留言: {author}")
                    continue
                
                # 提取留言資訊
                unread_comments.append({
                    'id': comment_id,
                    'author': author,
                    'content': comment_data.get('content', ''),
                    'time': comment_data.get('created_at'),
                    'has_images': len(comment_data.get('images', [])) > 0
                })
            
            # 按時間排序（最新的在前）
            unread_comments.sort(key=lambda x: x['time'], reverse=True)
            
            return unread_comments
            
        except Exception as e:
            print(f"⚠️ 讀取留言檔案失敗 {comment_file}: {e}")
            return []
    
    def get_unread_progress(self, item_number, last_read_time=None):
        """
        獲取未讀進度列表（詳細）
        
        Args:
            item_number: CSV 的「項次」欄位（進度檔案名）
            last_read_time: 最後閱讀時間
        
        Returns:
            list: [
                {
                    'time': str,
                    'content': str
                }
            ]
        """
        # ⭐ 使用「項次」作為進度檔案名
        progress_file = os.path.join(self.progress_dir, f'{item_number}.json')
        
        print(f"🔍 檢查進度檔案: {progress_file}")
        print(f"🔍 最後閱讀時間: {last_read_time}")
        
        if not os.path.exists(progress_file):
            print(f"⚠️ 進度檔案不存在: {progress_file}")
            return []
        
        try:
            with open(progress_file, 'r', encoding='utf-8') as f:
                progress_records = json.load(f)
            
            print(f"📋 進度記錄數量: {len(progress_records) if progress_records else 0}")
            
            if not progress_records or not isinstance(progress_records, dict):
                return []
            
            unread_progress = []
            
            for time_str, content in progress_records.items():
                try:
                    progress_time = datetime.fromisoformat(time_str)
                    print(f"  📅 進度時間: {progress_time} | 內容: {content[:30]}...")
                except Exception as e:
                    print(f"  ❌ 時間解析失敗: {time_str} - {e}")
                    continue
                
                # 如果有最後閱讀時間，只返回比它新的進度
                if last_read_time and progress_time <= last_read_time:
                    print(f"  ⏭️ 跳過舊進度: {progress_time} <= {last_read_time}")
                    continue
                
                print(f"  ✅ 新進度: {progress_time}")
                unread_progress.append({
                    'time': time_str,
                    'content': content
                })
            
            # 按時間排序（最新的在前）
            unread_progress.sort(key=lambda x: x['time'], reverse=True)
            
            print(f"✅ 未讀進度總數: {len(unread_progress)}")
            return unread_progress
            
        except Exception as e:
            print(f"❌ 讀取進度檔案失敗 {progress_file}: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_unread_details(self, record_id, item_number, proposer_name=None):
        """
        獲取未讀詳情（含詳細留言和進度列表）
        
        Args:
            record_id: CSV 的「id」欄位（留言檔案名）
            item_number: CSV 的「項次」欄位（進度檔案名）
            proposer_name: 提案人姓名（用於過濾自己的留言）
        
        Returns:
            {
                'has_unread': bool,
                'comments': [...],  # 詳細留言列表（已過濾提案人自己的）
                'progress': [...],  # 詳細進度列表
                'last_read': str
            }
        """
        last_read = self.get_last_read_time(record_id)
        
        # ⭐ 獲取未讀留言和進度
        # 留言用 record_id（CSV 的 id），進度用 item_number（CSV 的項次）
        unread_comments = self.get_unread_comments(record_id, last_read, proposer_name)
        unread_progress = self.get_unread_progress(item_number, last_read)
        
        return {
            'has_unread': len(unread_comments) > 0 or len(unread_progress) > 0,
            'comments': unread_comments,
            'progress': unread_progress,
            'last_read': last_read.isoformat() if last_read else None
        }
    
    def get_proposer_unread_summary(self, proposer_name, all_meetings):
        """
        獲取提案人的所有未讀摘要（詳細版本）
        
        Returns:
            {
                'total_unread': int,
                'unread_items': [
                    {
                        'record_id': str,
                        'item_number': str,  # 項次
                        'title': str,
                        'type': 'comment' or 'progress',
                        'author': str,  # 留言才有
                        'content': str,
                        'time': str
                    }
                ]
            }
        """
        unread_items = []
        
        # 篩選出該提案人的所有提案
        proposer_meetings = [
            m for m in all_meetings 
            if str(m.get('提案人', '')).strip() == proposer_name.strip()
        ]
        
        for meeting in proposer_meetings:
            record_id = meeting.get('id')  # CSV 的 id（留言檔案名）
            item_number = meeting.get('項次', '')  # CSV 的項次（進度檔案名）
            
            # ⭐ 使用「問題描述」的前10字作為標題
            problem_desc = meeting.get('問題描述', '') or meeting.get('主旨', '')
            if len(problem_desc) > 10:
                title = problem_desc[:10] + '...'
            else:
                title = problem_desc
            
            if not record_id or not item_number:
                print(f"⚠️ 跳過：record_id={record_id}, item_number={item_number}")
                continue
            
            # ⭐ 獲取詳細的未讀資訊
            # 傳遞 record_id（id）、item_number（項次）、proposer_name
            details = self.get_unread_details(record_id, item_number, proposer_name)
            
            if not details['has_unread']:
                continue
            
            # 添加所有未讀留言（已自動過濾提案人自己的）
            for comment in details['comments']:
                unread_items.append({
                    'record_id': record_id,
                    'item_number': item_number,
                    'title': title,  # ⭐ 使用問題描述前10字
                    'type': 'comment',
                    'author': comment['author'],
                    'content': comment['content'],
                    'time': comment['time'],
                    'has_images': comment.get('has_images', False)
                })
            
            # 添加所有未讀進度
            for progress in details['progress']:
                unread_items.append({
                    'record_id': record_id,
                    'item_number': item_number,
                    'title': title,  # ⭐ 使用問題描述前10字
                    'type': 'progress',
                    'content': progress['content'],
                    'time': progress['time']
                })
        
        # 按時間排序（最新的在前）
        unread_items.sort(key=lambda x: x['time'], reverse=True)
        
        return {
            'total_unread': len(unread_items),
            'unread_items': unread_items
        }
    
    def mark_all_as_read(self, proposer_name, all_meetings):
        """
        標記提案人的所有提案為已讀
        
        Args:
            proposer_name: 提案人姓名
            all_meetings: 所有會議記錄
        
        Returns:
            int: 標記的數量
        """
        # 篩選出該提案人的所有提案
        proposer_meetings = [
            m for m in all_meetings 
            if str(m.get('提案人', '')).strip() == proposer_name.strip()
        ]
        
        marked_count = 0
        current_time = datetime.now().isoformat()
        
        try:
            # 讀取現有記錄
            with open(self.read_records_file, 'r', encoding='utf-8') as f:
                records = json.load(f)
        except:
            records = {}
        
        # 標記所有提案為已讀
        for meeting in proposer_meetings:
            record_id = meeting.get('id')
            if record_id:
                records[record_id] = current_time
                marked_count += 1
        
        # 寫回檔案
        with open(self.read_records_file, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 已標記 {marked_count} 個提案為已讀（提案人：{proposer_name}）")
        
        return marked_count