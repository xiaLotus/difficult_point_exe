import logging
import json
import urllib.parse
from flask import Blueprint, jsonify, request
from utils.auth import authenticate_user

# Configure logger
logger = logging.getLogger(__name__)  # ✅ 建議保持這樣，使用 app.py 的全域 logger 設定

auth_bp = Blueprint("auth", __name__)


@auth_bp.route('/login', methods=['POST'])
def get_current_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    logger.info(f"收到用戶名為 {username} 的登錄請求")
    
    if authenticate_user(username, password):
        logger.info(f"用戶名為 {username} 的登錄成功")
        return jsonify({"success": True, "message": "登入成功!"})
    else:
        logger.warning(f"用戶名為 {username} 的登錄失敗")
        return jsonify({"success": False, "message": "帳號或密碼錯誤，請重新輸入"})



@auth_bp.route('/check_Permission', methods=['GET'])
def check_Permission():
    # Decode query parameters to handle UTF-8 (e.g., Chinese characters)
    params = {k: urllib.parse.unquote(v) for k, v in request.args.items()}
    logger.info(f"收到權限檢查請求，參數：{params}")
    
    try:
        with open('static/proposals.json', 'r', encoding='utf-8') as f:
            permission_data = json.load(f)
    except Exception as e:
        logger.error(f"無法加載 proposals.json：{str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

    filename = params.get('filename')
    role = params.get('role')
    
    if not filename:
        logger.warning("權限檢查失敗：缺少 filename 參數")
        return jsonify({'error': 'Missing filename parameter'}), 400

    if role not in permission_data:
        logger.warning(f"權限檢查失敗：無效的角色類型 '{role}'")
        return jsonify({'error': 'Invalid role type'}), 400

    if filename in permission_data[role]:
        logger.info(f"確認 {filename} 具備 {role} 的權限")
        return jsonify({'filename': filename, 'role': role, 'valid': True}), 200
    else:
        logger.info(f"查找不到 {filename} 具備 {role} 的權限")
        return jsonify({'filename': filename, 'role': role, 'valid': False}), 200