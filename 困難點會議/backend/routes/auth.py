import logging
import json
import os
import urllib.parse
from flask import Blueprint, jsonify, request
from utils.auth import authenticate_user
from utils.config import config  # ✅ 匯入配置

logger = logging.getLogger(__name__)
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


@auth_bp.route('/getinfoname', methods=['GET'])
def get_infoname():
    try:
        emp_id = request.args.get("username")
        if not emp_id:
            return jsonify({"status": "error", "message": "缺少工號參數"})

        # ✅ 從配置檔讀取路徑
        json_path = config.get_path('Paths', 'employee_info')
        
        with open(json_path, "r", encoding="utf-8-sig") as f:
            infonames = json.load(f)

        result = next((item for item in infonames if item["工號"] == emp_id), None)
        
        if result:
            logger.info(f"使用者: {emp_id} 查詢中文名，搜索成功 - {result}")
            return jsonify({"status": "success", "姓名": result["姓名"]})
        else:
            logger.info(f"使用者: {emp_id} 查詢中文名，搜索異常，出錯請找 #14586")
            return jsonify({"status": "error", "message": f"找不到工號 {emp_id}"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})
    

@auth_bp.route('/check_Permission', methods=['GET'])
def check_Permission():
    params = {k: urllib.parse.unquote(v) for k, v in request.args.items()}
    logger.info(f"收到權限檢查請求，參數：{params}")
    
    try:
        # ✅ 從配置檔讀取路徑
        permissions_path = config.get_path('Paths', 'permissions')
        
        with open(permissions_path, 'r', encoding='utf-8') as f:
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