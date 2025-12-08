"""
留言板工具函數模組
提供留言管理相關的輔助功能
"""
import os
import json
from datetime import datetime
from utils.config import config  # ✅ 匯入配置

# 允許的圖片格式
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    """
    檢查文件是否為允許的圖片格式
    
    Args:
        filename (str): 文件名
        
    Returns:
        bool: 是否為允許的格式
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def ensure_directories():
    """確保必要的目錄存在"""
    # ✅ 從配置讀取路徑
    comments_dir = config.get_path('Paths', 'comments_dir')
    comments_images_dir = config.get_path('Paths', 'comments_images_dir')
    
    os.makedirs(comments_dir, exist_ok=True)
    os.makedirs(comments_images_dir, exist_ok=True)

def get_comment_file_path(record_id):
    """
    獲取留言 JSON 文件路徑
    
    Args:
        record_id (str): 記錄 ID
        
    Returns:
        str: JSON 文件路徑
    """
    # ✅ 從配置讀取路徑
    comments_dir = config.get_path('Paths', 'comments_dir')
    return os.path.join(comments_dir, f'{record_id}.json')

def get_comment_images_dir(record_id):
    """
    獲取留言圖片目錄路徑
    
    Args:
        record_id (str): 記錄 ID
        
    Returns:
        str: 圖片目錄路徑
    """
    # ✅ 從配置讀取路徑
    comments_images_dir = config.get_path('Paths', 'comments_images_dir')
    return os.path.join(comments_images_dir, record_id)

def load_comments(record_id):
    """
    載入指定記錄的所有留言
    
    Args:
        record_id (str): 記錄 ID
        
    Returns:
        dict: 留言數據字典
    """
    file_path = get_comment_file_path(record_id)
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"載入留言失敗: {e}")
            return {}
    return {}

def save_comments(record_id, comments_data):
    """
    保存留言數據到 JSON 文件
    
    Args:
        record_id (str): 記錄 ID
        comments_data (dict): 留言數據
        
    Returns:
        bool: 是否保存成功
    """
    ensure_directories()
    file_path = get_comment_file_path(record_id)
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(comments_data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存留言失敗: {e}")
        return False

def get_user_info(username):
    """
    從 emoinfo.json 獲取用戶顯示名稱
    
    Args:
        username (str): 用戶員工編號
        
    Returns:
        str: 用戶顯示名稱
    """
    try:
        # ✅ 從配置讀取路徑
        employee_info_path = config.get_path('Paths', 'employee_info')
        print(f"🔍 查找用戶信息: username={username}")
        print(f"📁 employee_info 路徑: {employee_info_path}")
        print(f"📝 文件是否存在: {os.path.exists(employee_info_path)}")
        
        if os.path.exists(employee_info_path):
            with open(employee_info_path, 'r', encoding='utf-8-sig') as f:
                employees = json.load(f)
                for emp in employees:
                    if emp.get('工號') == username:
                        print(f"✅ 找到用戶: {emp.get('工號')} -> {emp.get('姓名')}")
                        return emp.get('姓名', username)
        print(f"⚠️ 找不到用戶 {username}，使用員工編號")
    except Exception as e:
        print(f"❌ 獲取用戶信息失敗: {e}")
    return username

def get_user_role(username):
    """
    獲取用戶角色
    
    Args:
        username (str): 用戶員工編號
        
    Returns:
        str: 用戶角色（管理員/編輯人/提案人/預覽人/未知）
    """
    print(f"🔍 查找用戶角色: username={username}")
    
    try:
        # ✅ 從配置讀取權限檔案路徑
        permissions_path = config.get_path('Paths', 'permissions')
        print(f"📁 permissions 路徑: {permissions_path}")
        print(f"📝 文件是否存在: {os.path.exists(permissions_path)}")
        
        if os.path.exists(permissions_path):
            with open(permissions_path, 'r', encoding='utf-8') as f:
                permissions_data = json.load(f)
                
                # 檢查各個角色
                for role in ['管理員', '編輯人', '提案人', '預覽人']:
                    if role in permissions_data:
                        if username in permissions_data[role]:
                            print(f"✅ 找到角色: {username} -> {role}")
                            return role
        
        print(f"⚠️ 找不到用戶 {username} 的角色，返回'未知'")
    except Exception as e:
        print(f"❌ 獲取用戶角色失敗: {e}")
    
    return '未知'

def check_delete_permission(username, comment_owner):
    """
    檢查用戶是否有權限刪除留言
    
    Args:
        username (str): 當前用戶
        comment_owner (str): 留言所有者
        
    Returns:
        bool: 是否有權限
    """
    user_role = get_user_role(username)
    
    # 管理員可以刪除任何留言
    if user_role == '管理員':
        return True
    
    # 用戶可以刪除自己的留言
    if username == comment_owner:
        return True
    
    return False

def delete_comment_images(record_id, image_list):
    """
    刪除留言的圖片文件
    
    Args:
        record_id (str): 記錄 ID
        image_list (list): 圖片信息列表
        
    Returns:
        int: 成功刪除的圖片數量
    """
    if not image_list:
        return 0
    
    images_dir = get_comment_images_dir(record_id)
    deleted_count = 0
    
    for img in image_list:
        img_path = os.path.join(images_dir, img.get('filename', ''))
        if os.path.exists(img_path):
            try:
                os.remove(img_path)
                deleted_count += 1
            except Exception as e:
                print(f"刪除圖片失敗 ({img_path}): {e}")
    
    return deleted_count

def create_comment_data(username, content):
    """
    創建留言數據結構
    
    Args:
        username (str): 用戶員工編號
        content (str): 留言內容
        
    Returns:
        dict: 留言數據
    """
    return {
        'username': username,
        'display_name': get_user_info(username),
        'role': get_user_role(username),
        'content': content,
        'images': [],
        'created_at': datetime.now().isoformat(),
        'edited_at': None
    }

def validate_request_data(data, required_fields):
    """
    驗證請求數據是否包含必要欄位
    
    Args:
        data (dict): 請求數據
        required_fields (list): 必要欄位列表
        
    Returns:
        tuple: (是否有效, 錯誤信息)
    """
    for field in required_fields:
        if field not in data or not data[field]:
            return False, f'缺少必要欄位: {field}'
    return True, None