import logging
import json
import os
import urllib.parse
from flask import Blueprint, jsonify, request
import pandas as pd
from utils.meeting_utils import load_meeting_records, get_all_owner
from utils.save_record import save_new_record, update_existing_record
from utils.progress_manager import progress_manager
from utils.config import config  # ✅ 匯入配置
import uuid
from datetime import datetime
from filelock import FileLock

logger = logging.getLogger(__name__)
meeting_bp = Blueprint("meeting", __name__)

@meeting_bp.route("/meeting_records", methods=["GET"])
def meeting_records():
    try:
        username = request.args.get("username", "").strip()
        data = load_meeting_records()
        logger.info(f"{username} 從後端抓取資料")
        return jsonify({"status": "success", "data": data})
    except Exception as e:
        logger.error(f"取得會議記錄失敗：{str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@meeting_bp.route("/add_record", methods=["POST"])
def add_record():
    username = request.args.get("username")
    if not username:
        return jsonify({"status": "error", "message": "缺少 username"}), 400

    try:
        new_record = request.get_json()
        new_record["id"] = str(uuid.uuid4())
        
        success = save_new_record(username, new_record)
        
        if success:
            return jsonify({
                "status": "success", 
                "message": "已新增", 
                "id": new_record["id"]
            })
        else:
            return jsonify({
                "status": "error", 
                "message": "新增失敗"
            }), 500
            
    except Exception as e:
        logger.error(f"新增記錄異常：{str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@meeting_bp.route("/update_record", methods=["PUT"])
def update_record():
    username = request.args.get("username")
    if not username:
        return jsonify({"status": "error", "message": "缺少 username"}), 400

    try:
        data = request.get_json()
        record_id = data.get("id") or data.get("項次")
        
        if not record_id:
            return jsonify({"status": "error", "message": "缺少記錄 ID 或項次"}), 400
        
        logger.info(f"準備更新記錄，ID/項次：{record_id}")
        
        if "進度紀錄" in data:
            progress_data = data["進度紀錄"]
            
            if isinstance(progress_data, dict):
                success = progress_manager.save_progress_history(record_id, progress_data)
                
                if success:
                    progress_manager.update_csv_progress(record_id)
                    
                    data_without_progress = {k: v for k, v in data.items() if k != "進度紀錄"}
                    
                    if data_without_progress:
                        update_success = update_existing_record(username, record_id, data_without_progress)
                        if not update_success:
                            return jsonify({"status": "error", "message": "更新其他欄位失敗"}), 500
                    
                    return jsonify({
                        "status": "success", 
                        "message": "更新成功", 
                        "id": record_id
                    })
                else:
                    return jsonify({"status": "error", "message": "進度紀錄儲存失敗"}), 500
        
        success = update_existing_record(username, record_id, data)
        
        if success:
            return jsonify({
                "status": "success", 
                "message": "更新成功", 
                "id": record_id
            })
        else:
            return jsonify({
                "status": "error", 
                "message": "更新失敗，找不到指定記錄"
            }), 500
            
    except Exception as e:
        logger.error(f"更新記錄異常：{str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@meeting_bp.route("/edit_card", methods=["POST"])
def edit_card():
    username = request.args.get("username")
    if not username:
        return jsonify({"status": "error", "message": "缺少 username"}), 400

    try:
        updated_record = request.get_json()
        record_id = updated_record.get("id") or updated_record.get("項次")
        
        if not record_id:
            return jsonify({"status": "error", "message": "缺少記錄 ID"}), 400
        
        from utils.save_record import update_existing_record
        success = update_existing_record(username, record_id, updated_record)
        
        if success:
            return jsonify({"status": "success", "message": "記錄已更新"})
        else:
            return jsonify({"status": "error", "message": "更新失敗"}), 500
            
    except Exception as e:
        logger.error(f"編輯記錄時發生錯誤: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@meeting_bp.route("/rename_progress_file", methods=["POST"])
def rename_progress_file():
    """重新命名進度記錄 JSON 檔案"""
    username = request.args.get("username")
    if not username:
        return jsonify({"status": "error", "message": "缺少 username"}), 400

    try:
        data = request.get_json()
        old_record_id = data.get("old_record_id")
        new_record_id = data.get("new_record_id")
        
        if not old_record_id or not new_record_id:
            return jsonify({"status": "error", "message": "缺少必要參數"}), 400
        
        # ✅ 從配置檔讀取路徑
        progress_dir = config.get_path('Paths', 'progress_dir')
        old_file_path = os.path.join(progress_dir, f"{old_record_id}.json")
        new_file_path = os.path.join(progress_dir, f"{new_record_id}.json")
        
        if os.path.exists(old_file_path):
            os.rename(old_file_path, new_file_path)
            logger.info(f"JSON 檔案已重新命名: {old_record_id}.json -> {new_record_id}.json")
        
        return jsonify({"status": "success", "message": "JSON 檔案已重新命名"})
        
    except Exception as e:
        logger.error(f"重新命名 JSON 檔案失敗: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@meeting_bp.route("/get_progress_history/<record_id>", methods=["GET"])
def get_progress_history(record_id):
    """取得指定記錄的完整進度歷史"""
    try:
        username = request.args.get("username", "").strip()
        progress_data = progress_manager.load_progress_history(record_id)
        
        logger.info(f"{username} 取得記錄 {record_id} 的進度歷史")
        return jsonify({
            "status": "success", 
            "data": progress_data
        })
        
    except Exception as e:
        logger.error(f"取得進度歷史失敗：{str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@meeting_bp.route("/add_progress", methods=["POST"])
def add_progress():
    """新增單筆進度記錄"""
    try:
        username = request.args.get("username")
        data = request.get_json()
        
        record_id = data.get("record_id")
        content = data.get("content")
        
        if not record_id or not content:
            return jsonify({"status": "error", "message": "缺少必要參數"}), 400
        
        updated_progress = progress_manager.add_progress_entry(record_id, content)
        
        if updated_progress is not None:
            progress_manager.update_csv_progress(record_id)
            
            return jsonify({
                "status": "success",
                "message": "進度記錄已新增",
                "progress_data": updated_progress
            })
        else:
            return jsonify({"status": "error", "message": "新增進度記錄失敗"}), 500
            
    except Exception as e:
        logger.error(f"新增進度記錄異常：{str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@meeting_bp.route("/delete_progress", methods=["DELETE"])
def delete_progress():
    """刪除單筆進度記錄"""
    try:
        username = request.args.get("username")
        record_id = request.args.get("record_id")
        timestamp = request.args.get("timestamp")
        
        if not record_id or not timestamp:
            return jsonify({"status": "error", "message": "缺少必要參數"}), 400
        
        updated_progress = progress_manager.remove_progress_entry(record_id, timestamp)
        
        if updated_progress is not None:
            progress_manager.update_csv_progress(record_id)
            
            return jsonify({
                "status": "success",
                "message": "進度記錄已刪除",
                "progress_data": updated_progress
            })
        else:
            return jsonify({"status": "error", "message": "刪除進度記錄失敗"}), 500
            
    except Exception as e:
        logger.error(f"刪除進度記錄異常：{str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@meeting_bp.route("/delete_record/<record_id>", methods=["DELETE"])
def delete_record(record_id):
    username = request.args.get("username")
    if not username:
        return jsonify({"status": "error", "message": "缺少 username"}), 400

    try:
        # ✅ 從配置檔讀取路徑
        csv_path = config.get_path('Paths', 'meeting_csv')
        
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path, encoding="utf-8-sig")
            
            record_index = df[df['id'] == record_id].index
            
            if len(record_index) == 0:
                return jsonify({"status": "error", "message": "找不到要刪除的記錄"}), 404
            
            item_number = df.loc[record_index[0], '項次']
            
            df = df.drop(record_index)
            df.to_csv(csv_path, index=False, encoding='utf-8-sig')

        # ✅ 從配置檔讀取路徑
        progress_dir = config.get_path('Paths', 'progress_dir')
        json_file_path = os.path.join(progress_dir, f"{item_number}.json")
        
        if os.path.exists(json_file_path):
            os.remove(json_file_path)
            logger.info(f"已刪除進度記錄檔案: {json_file_path}")

        logger.info(f"{username} 徹底刪除了記錄 {record_id}，項次: {item_number}")
        
        return jsonify({"status": "success", "message": "記錄已徹底刪除"})
        
    except Exception as e:
        logger.error(f"刪除記錄失敗: {str(e)}")
        return jsonify({"status": "error", "message": "刪除失敗"}), 500


@meeting_bp.route('/save_filter_state', methods=['POST'])
def save_filter_state():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'status': 'error', 'message': '缺少 JSON 資料'}), 400

        username = data.get('username')
        filter_state = data.get('filter_state')

        if not username:
            return jsonify({'status': 'error', 'message': '缺少 username'}), 400
        if filter_state is None:
            return jsonify({'status': 'error', 'message': '缺少 filter_state'}), 400

        timestamp = datetime.now().isoformat()

        # ✅ 從配置檔讀取路徑
        filter_dir = config.get_path('Paths', 'filter_dir')
        os.makedirs(filter_dir, exist_ok=True)

        filter_file = os.path.join(filter_dir, f"{username}_filters.json")
        lock_file = filter_file + ".lock"

        filter_data = {
            'username': username,
            'filter_state': filter_state,
            'last_updated': timestamp
        }

        with FileLock(lock_file):
            with open(filter_file, 'w', encoding='utf-8-sig') as f:
                json.dump(filter_data, f, ensure_ascii=False, indent=2)

        return jsonify({'status': 'success', 'message': '篩選狀態已保存'}), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500
    

@meeting_bp.route('/load_filter_state', methods=['GET'])
def load_filter_state():
    try:
        username = request.args.get('username')
        if not username:
            return jsonify({'status': 'error', 'message': '缺少用戶名稱'}), 400
        
        # ✅ 從配置檔讀取路徑
        filter_dir = config.get_path('Paths', 'filter_dir')
        filter_file = os.path.join(filter_dir, f"{username}_filters.json")
        
        if os.path.exists(filter_file):
            with open(filter_file, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
                return jsonify({'status': 'success', 'filter_state': data['filter_state']})
        else:
            return jsonify({'status': 'success', 'filter_state': None})
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@meeting_bp.route('/get_all_owners', methods=['GET'])
def get_all_owners():
    owners_data = get_all_owner()
    
    if not owners_data:
        return jsonify({"status": "success", "data": []})
        
    return jsonify({
        "status": "success",
        "data": owners_data
    })