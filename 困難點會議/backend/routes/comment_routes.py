"""
留言板 API 路由模組
處理會議記錄的留言功能
"""
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from utils.config import config  # ✅ 匯入配置

# 導入工具函數
from utils.comment_utils import (
    allowed_file,
    ensure_directories,
    get_comment_file_path,
    get_comment_images_dir,
    load_comments,
    save_comments,
    get_user_info,
    get_user_role,
    check_delete_permission,
    delete_comment_images,
    create_comment_data,
    validate_request_data
)

# 創建 Blueprint
bp = Blueprint('comment', __name__)

# ==================== API 路由 ====================

@bp.route('/api/get_comments/<record_id>', methods=['GET'])
def get_comments(record_id):
    """
    獲取指定記錄的所有留言
    
    Query Parameters:
        username (str): 用戶員工編號
        
    Returns:
        JSON: {
            "status": "success",
            "data": {...},
            "count": 0
        }
    """
    try:
        username = request.args.get('username')
        if not username:
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        # 載入留言數據
        comments = load_comments(record_id)
        
        return jsonify({
            'status': 'success',
            'data': comments,
            'count': len(comments)
        }), 200
        
    except Exception as e:
        print(f"獲取留言失敗: {e}")
        return jsonify({
            'status': 'error',
            'message': f'獲取留言失敗: {str(e)}'
        }), 500

@bp.route('/api/add_comment', methods=['POST'])
def add_comment():
    """
    新增留言
    
    Query Parameters:
        username (str): 用戶員工編號
        
    Request Body:
        {
            "record_id": "...",
            "content": "...",
            "timestamp": "..."
        }
        
    Returns:
        JSON: {
            "status": "success",
            "message": "留言已發布",
            "timestamp": "..."
        }
    """
    try:
        username = request.args.get('username')
        if not username:
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        data = request.get_json()
        
        # 驗證必要欄位
        is_valid, error_msg = validate_request_data(data, ['record_id'])
        if not is_valid:
            return jsonify({
                'status': 'error',
                'message': error_msg
            }), 400
        
        record_id = data.get('record_id')
        content = data.get('content', '')
        timestamp = data.get('timestamp')
        display_name = data.get('display_name', username)  # 從前端獲取
        role = data.get('role', '未知')                      # 從前端獲取
        
        # 如果沒有提供 timestamp，自動生成
        if not timestamp:
            timestamp = str(int(datetime.now().timestamp() * 1000))
        
        # 載入現有留言
        comments = load_comments(record_id)
        
        # 創建新留言（直接使用前端傳來的數據）
        new_comment = {
            'username': username,
            'display_name': display_name,
            'role': role,
            'content': content,
            'images': [],
            'created_at': datetime.now().isoformat(),
            'edited_at': None
        }
        
        # 添加到留言列表
        comments[timestamp] = new_comment
        
        # 保存
        if save_comments(record_id, comments):
            return jsonify({
                'status': 'success',
                'message': '留言已發布',
                'timestamp': timestamp
            }), 200
        else:
            return jsonify({
                'status': 'error',
                'message': '保存留言失敗'
            }), 500
        
    except Exception as e:
        print(f"新增留言失敗: {e}")
        return jsonify({
            'status': 'error',
            'message': f'新增留言失敗: {str(e)}'
        }), 500

@bp.route('/api/upload_comment_images', methods=['POST'])
def upload_comment_images():
    """
    上傳留言圖片
    
    Query Parameters:
        username (str): 用戶員工編號
        
    Form Data:
        record_id (str): 記錄 ID
        timestamp (str): 留言時間戳
        images (files): 圖片文件列表
        
    Returns:
        JSON: {
            "status": "success",
            "message": "成功上傳 N 張圖片",
            "images": [...]
        }
    """
    try:
        username = request.args.get('username')
        if not username:
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        record_id = request.form.get('record_id')
        timestamp = request.form.get('timestamp')
        
        if not record_id or not timestamp:
            return jsonify({
                'status': 'error',
                'message': '缺少 record_id 或 timestamp'
            }), 400
        
        # 檢查是否有文件
        if 'images' not in request.files:
            return jsonify({
                'status': 'error',
                'message': '沒有上傳圖片'
            }), 400
        
        files = request.files.getlist('images')
        if not files or files[0].filename == '':
            return jsonify({
                'status': 'error',
                'message': '沒有選擇圖片'
            }), 400
        
        # ✅ 定義檔案大小限制
        MAX_SIZE = int(config.get('App', 'max_content_length', fallback='104857600'))  # 從配置讀取
        
        # 創建圖片目錄
        images_dir = get_comment_images_dir(record_id)
        os.makedirs(images_dir, exist_ok=True)
        
        # 保存圖片
        uploaded_images = []
        for idx, file in enumerate(files, 1):
            if file and allowed_file(file.filename):
                # ✅ 檢查檔案大小
                file.seek(0, os.SEEK_END)
                file_size = file.tell()
                file.seek(0)  # 重置指針
                
                if file_size > MAX_SIZE:
                    return jsonify({
                        'status': 'error',
                        'message': f'{file.filename} 超過 {MAX_SIZE // (1024 * 1024)}MB 限制'
                    }), 400
                
                # 獲取原始文件擴展名
                original_filename = secure_filename(file.filename)
                ext = original_filename.rsplit('.', 1)[1].lower()
                
                # 生成新文件名：{timestamp}_img{idx}.{ext}
                new_filename = f"{timestamp}_img{idx}.{ext}"
                file_path = os.path.join(images_dir, new_filename)
                
                # 保存文件
                file.save(file_path)
                
                uploaded_images.append({
                    'filename': new_filename,
                    'original_name': original_filename,
                    'size': file_size  # ✅ 使用實際檔案大小
                })
        
        # 更新留言記錄中的圖片信息
        comments = load_comments(record_id)
        if timestamp in comments:
            comments[timestamp]['images'] = uploaded_images
            save_comments(record_id, comments)
        
        return jsonify({
            'status': 'success',
            'message': f'成功上傳 {len(uploaded_images)} 張圖片',
            'images': uploaded_images
        }), 200
        
    except Exception as e:
        print(f"上傳留言圖片失敗: {e}")
        return jsonify({
            'status': 'error',
            'message': f'上傳圖片失敗: {str(e)}'
        }), 500
    
@bp.route('/api/get_comment_image/<record_id>/<filename>', methods=['GET'])
def get_comment_image(record_id, filename):
    """
    獲取留言圖片
    
    URL Parameters:
        record_id (str): 記錄 ID
        filename (str): 圖片文件名
        
    Query Parameters:
        username (str): 用戶員工編號
        
    Returns:
        File: 圖片文件
    """
    try:
        username = request.args.get('username')
        if not username:
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        # 獲取圖片路徑
        images_dir = get_comment_images_dir(record_id)
        image_path = os.path.join(images_dir, filename)
        
        if not os.path.exists(image_path):
            return jsonify({
                'status': 'error',
                'message': '圖片不存在'
            }), 404
        
        # 返回圖片文件
        return send_file(image_path, mimetype='image/jpeg')
        
    except Exception as e:
        print(f"獲取留言圖片失敗: {e}")
        return jsonify({
            'status': 'error',
            'message': f'獲取圖片失敗: {str(e)}'
        }), 500

@bp.route('/api/delete_comment', methods=['DELETE'])
def delete_comment():
    """
    刪除留言
    
    Query Parameters:
        username (str): 用戶員工編號
        
    Request Body:
        {
            "record_id": "...",
            "timestamp": "..."
        }
        
    Returns:
        JSON: {
            "status": "success",
            "message": "留言已刪除"
        }
    """
    try:
        username = request.args.get('username')
        if not username:
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        data = request.get_json()
        
        # 驗證必要欄位
        is_valid, error_msg = validate_request_data(data, ['record_id', 'timestamp'])
        if not is_valid:
            return jsonify({
                'status': 'error',
                'message': error_msg
            }), 400
        
        record_id = data.get('record_id')
        timestamp = data.get('timestamp')
        
        # 載入留言
        comments = load_comments(record_id)
        
        if timestamp not in comments:
            return jsonify({
                'status': 'error',
                'message': '留言不存在'
            }), 404
        
        # 檢查權限
        comment_owner = comments[timestamp].get('username')
        if not check_delete_permission(username, comment_owner):
            return jsonify({
                'status': 'error',
                'message': '沒有權限刪除此留言'
            }), 403
        
        # 刪除留言的圖片
        comment_images = comments[timestamp].get('images', [])
        if comment_images:
            deleted_count = delete_comment_images(record_id, comment_images)
            print(f"已刪除 {deleted_count} 張圖片")
        
        # 刪除留言
        del comments[timestamp]
        
        # 保存
        if save_comments(record_id, comments):
            return jsonify({
                'status': 'success',
                'message': '留言已刪除'
            }), 200
        else:
            return jsonify({
                'status': 'error',
                'message': '刪除留言失敗'
            }), 500
        
    except Exception as e:
        print(f"刪除留言失敗: {e}")
        return jsonify({
            'status': 'error',
            'message': f'刪除留言失敗: {str(e)}'
        }), 500