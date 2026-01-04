"""
留言板工具類 - 支援多圖上傳
"""

import json
import os
from datetime import datetime
from flask import jsonify
import uuid
from utils.config import config


class BulletinManager:
    """留言板管理器"""
    
    def __init__(self):
        """初始化配置"""
        self.data_file = config.get_path('Paths', 'bulletin_data_file')
        self.images_dir = config.get_path('Paths', 'bulletin_images_dir')
        
        print(f"📁 [配置] bulletin_data_file: {self.data_file}")
        print(f"📁 [配置] bulletin_images_dir: {self.images_dir}")
        
        try:
            allowed_ext_str = config.get('BulletinBoard', 'allowed_extensions')
        except:
            allowed_ext_str = 'png,jpg,jpeg,gif,webp'
        self.allowed_extensions = set(ext.strip() for ext in allowed_ext_str.split(','))
        
        try:
            max_size_mb = float(config.get('BulletinBoard', 'max_file_size_mb'))
        except:
            max_size_mb = 5.0
        self.max_file_size = int(max_size_mb * 1024 * 1024)
        
        self.max_images = 9  # 最多9張圖片
        
        self._ensure_directories()
    
    def _ensure_directories(self):
        """確保必要的目錄存在"""
        data_dir = os.path.dirname(self.data_file)
        if data_dir:
            os.makedirs(data_dir, exist_ok=True)
        os.makedirs(self.images_dir, exist_ok=True)
        print(f"✅ 圖片目錄已確保存在: {self.images_dir}")
    
    def allowed_file(self, filename):
        """檢查檔案類型是否允許"""
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in self.allowed_extensions
    
    def load_messages(self):
        """載入留言資料"""
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"❌ 載入留言失敗: {e}")
                return []
        return []
    
    def save_messages(self, messages):
        """儲存留言資料"""
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(messages, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"❌ 儲存留言失敗: {e}")
            return False
    
    def get_all_messages(self):
        """取得所有留言"""
        try:
            messages = self.load_messages()
            return jsonify({
                'status': 'success',
                'messages': messages
            })
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
    
    def create_message(self, request):
        """創建新留言 - 支援多圖上傳"""
        try:
            author = request.form.get('author', 'Anonymous')
            content = request.form.get('content', '')
            
            print(f"\n" + "="*60)
            print(f"📝 收到留言請求 - 作者: {author}, 內容長度: {len(content)}")
            
            # 處理多張圖片上傳
            image_urls = []
            
            if 'images' in request.files:
                files = request.files.getlist('images')
                print(f"📸 檢測到 {len(files)} 個圖片上傳")
                
                if len(files) > self.max_images:
                    print(f"❌ 圖片數量超過限制: {len(files)} > {self.max_images}")
                    return jsonify({
                        'status': 'error',
                        'message': f'最多只能上傳 {self.max_images} 張圖片'
                    }), 400
                
                for idx, file in enumerate(files):
                    if file and file.filename and file.filename.strip():
                        print(f"📸 處理第 {idx + 1} 張圖片: {file.filename}")
                        
                        if self.allowed_file(file.filename):
                            file.seek(0, os.SEEK_END)
                            file_size = file.tell()
                            file.seek(0)
                            
                            print(f"📏 檔案大小: {file_size} bytes ({file_size / 1024:.2f} KB)")
                            
                            if file_size > self.max_file_size:
                                print(f"❌ 第 {idx + 1} 張圖片太大，跳過")
                                continue
                            
                            ext = file.filename.rsplit('.', 1)[1].lower()
                            filename = f"{uuid.uuid4()}.{ext}"
                            filepath = os.path.join(self.images_dir, filename)
                            
                            file.save(filepath)
                            
                            if os.path.exists(filepath):
                                print(f"✅ 第 {idx + 1} 張圖片已儲存: {filename}")
                                image_url = f"/api/bulletin/image/{filename}"
                                image_urls.append(image_url)
                            else:
                                print(f"❌ 第 {idx + 1} 張圖片儲存失敗")
                        else:
                            print(f"❌ 第 {idx + 1} 張圖片格式不允許: {file.filename}")
            
            print(f"✅ 成功處理 {len(image_urls)} 張圖片")
            
            if not content.strip() and len(image_urls) == 0:
                print(f"❌ 驗證失敗：沒有內容也沒有圖片")
                print("="*60 + "\n")
                return jsonify({
                    'status': 'error',
                    'message': '請輸入留言內容或上傳圖片'
                }), 400
            
            print(f"✅ 驗證通過 - 內容: {bool(content.strip())}, 圖片數: {len(image_urls)}")
            
            message = {
                'id': int(datetime.now().timestamp() * 1000),
                'author': author,
                'content': content,
                'images': image_urls,
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
            print(f"📦 [留言物件] ID: {message['id']}")
            print(f"📦 [留言物件] Images: {len(image_urls)} 張")
            
            messages = self.load_messages()
            messages.insert(0, message)
            
            if not self.save_messages(messages):
                print(f"❌ 儲存留言失敗")
                print("="*60 + "\n")
                return jsonify({
                    'status': 'error',
                    'message': '儲存留言失敗'
                }), 500
            
            print(f"✅ 留言創建成功")
            print("="*60 + "\n")
            
            return jsonify({
                'status': 'success',
                'message': '留言發布成功',
                'data': message
            })
            
        except Exception as e:
            print(f"❌ 創建留言時發生錯誤: {e}")
            import traceback
            traceback.print_exc()
            print("="*60 + "\n")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
    
    def delete_message(self, message_id):
        """刪除留言"""
        try:
            messages = self.load_messages()
            
            message_to_delete = None
            for i, msg in enumerate(messages):
                if msg['id'] == message_id:
                    message_to_delete = messages.pop(i)
                    break
            
            if not message_to_delete:
                return jsonify({
                    'status': 'error',
                    'message': '找不到該留言'
                }), 404
            
            if message_to_delete.get('images'):
                for image_url in message_to_delete['images']:
                    if image_url.startswith('/api/bulletin/image/'):
                        filename = image_url.split('/')[-1]
                        image_path = os.path.join(self.images_dir, filename)
                        if os.path.exists(image_path):
                            try:
                                os.remove(image_path)
                                print(f"✅ 已刪除圖片: {filename}")
                            except Exception as e:
                                print(f"⚠️ 刪除圖片失敗: {e}")
            elif message_to_delete.get('image'):
                image_url = message_to_delete['image']
                if image_url.startswith('/api/bulletin/image/'):
                    filename = image_url.split('/')[-1]
                    image_path = os.path.join(self.images_dir, filename)
                    if os.path.exists(image_path):
                        try:
                            os.remove(image_path)
                        except Exception as e:
                            print(f"⚠️ 刪除圖片失敗: {e}")
            
            if not self.save_messages(messages):
                return jsonify({
                    'status': 'error',
                    'message': '儲存更新失敗'
                }), 500
            
            return jsonify({
                'status': 'success',
                'message': '留言刪除成功'
            })
            
        except Exception as e:
            print(f"❌ 刪除留言時發生錯誤: {e}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
    
    def get_message_by_id(self, message_id):
        messages = self.load_messages()
        for msg in messages:
            if msg['id'] == message_id:
                return msg
        return None
    
    def get_messages_by_author(self, author):
        messages = self.load_messages()
        return [msg for msg in messages if msg['author'] == author]
    
    def get_recent_messages(self, limit=10):
        messages = self.load_messages()
        return messages[:limit]
    
    def get_statistics(self):
        messages = self.load_messages()
        author_stats = {}
        for msg in messages:
            author = msg.get('author', 'Anonymous')
            author_stats[author] = author_stats.get(author, 0) + 1
        
        total_images = 0
        for msg in messages:
            if msg.get('images'):
                total_images += len(msg['images'])
            elif msg.get('image'):
                total_images += 1
        
        return {
            'total_messages': len(messages),
            'total_authors': len(author_stats),
            'total_images': total_images,
            'author_stats': author_stats
        }