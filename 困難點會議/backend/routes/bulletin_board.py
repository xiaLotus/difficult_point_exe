"""
留言板 API 路由
放置在 routes/bulletin_board.py
"""

from flask import Blueprint, request, send_file
from utils.bulletin_utils import BulletinManager
import os

# 創建 Blueprint
bulletin_bp = Blueprint('bulletin', __name__, url_prefix='/api/bulletin')

# 初始化留言板管理器
bulletin_manager = BulletinManager()


@bulletin_bp.route('/messages', methods=['GET'])
def get_messages():
    """取得所有留言"""
    return bulletin_manager.get_all_messages()


@bulletin_bp.route('/post', methods=['POST'])
def post_message():
    """發布新留言"""
    return bulletin_manager.create_message(request)


@bulletin_bp.route('/messages/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    """刪除留言"""
    return bulletin_manager.delete_message(message_id)


@bulletin_bp.route('/image/<filename>', methods=['GET'])
def get_bulletin_image(filename):
    """
    提供留言板圖片
    URL 格式: /api/bulletin/image/檔名.png
    """
    try:
        # 獲取圖片目錄
        images_dir = bulletin_manager.images_dir
        image_path = os.path.join(images_dir, filename)
        
        # 檢查文件是否存在
        if not os.path.exists(image_path):
            print(f"❌ 圖片不存在: {image_path}")
            return {'status': 'error', 'message': '圖片不存在'}, 404
        
        # 返回圖片文件
        return send_file(image_path)
        
    except Exception as e:
        print(f"❌ 提供圖片時發生錯誤: {e}")
        return {'status': 'error', 'message': str(e)}, 500