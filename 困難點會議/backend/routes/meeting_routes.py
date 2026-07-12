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
from utils.comment_utils import load_comments  # ✅ 匯入留言工具
import uuid
from datetime import datetime
from filelock import FileLock
from werkzeug.utils import secure_filename

logger = logging.getLogger(__name__)
meeting_bp = Blueprint("meeting", __name__)
# 允許的圖片格式
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_image_folder(record_id):
    """取得或建立記錄專屬的圖片資料夾"""
    # ✅ 從配置檔讀取根目錄路徑
    base_path = config.get_path('Paths', 'meeting_images')
    folder_path = os.path.join(base_path, record_id)
    
    # 如果資料夾不存在，建立它
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
    
    return folder_path


@meeting_bp.route('/upload_meeting_images', methods=['POST'])
def upload_meeting_images():
    """
    上傳多張圖片到指定記錄的資料夾
    
    Query Parameters:
        username (str): 上傳者的員工編號
    
    請求格式 (multipart/form-data):
        record_id (str): 記錄的 UUID
        images (files): 多個圖片檔案
    """
    try:
        # ✅ 獲取上傳者信息
        username = request.args.get('username')
        if not username:
            logger.warning("圖片上傳請求缺少 username 參數")
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        record_id = request.form.get('record_id')
        
        # 驗證 record_id
        if not record_id:
            logger.warning(f"用戶 {username} 的圖片上傳請求缺少 record_id")
            return jsonify({
                'status': 'error',
                'message': '缺少 record_id 參數'
            }), 400

        # 取得上傳的檔案
        files = request.files.getlist('images')
        
        if not files or len(files) == 0:
            logger.warning(f"用戶 {username} 的圖片上傳請求沒有包含圖片文件")
            return jsonify({
                'status': 'error',
                'message': '沒有上傳任何圖片'
            }), 400
        
        # ✅ 記錄上傳開始
        logger.info(f"📤 用戶 {username} 開始上傳圖片 - 記錄ID: {record_id}, 圖片數量: {len(files)}")
        
        # 取得/建立資料夾
        folder_path = get_image_folder(record_id)
        
        # 取得現有檔案數量，用於命名新檔案
        existing_files = os.listdir(folder_path) if os.path.exists(folder_path) else []
        start_index = len(existing_files) + 1
        
        uploaded_files = []
        errors = []
        
        for idx, file in enumerate(files):
            if file and file.filename:
                # 驗證檔案類型
                if not allowed_file(file.filename):
                    error_msg = f'{file.filename}: 不支援的檔案格式'
                    errors.append(error_msg)
                    logger.warning(f"用戶 {username} 上傳失敗 - {error_msg}")
                    continue
                
                # 生成安全的檔案名稱
                # 格式: 序號_日期時間_UUID.副檔名
                original_ext = file.filename.rsplit('.', 1)[1].lower()
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                new_filename = f"{start_index + idx}_{timestamp}_{uuid.uuid4().hex[:8]}.{original_ext}"
                
                # 儲存檔案
                file_path = os.path.join(folder_path, new_filename)
                file.save(file_path)
                
                # 獲取文件大小
                file_size = os.path.getsize(file_path)
                file_size_mb = file_size / (1024 * 1024)
                
                # ✅ 記錄每個成功上傳的文件
                logger.info(
                    f"✅ 圖片上傳成功 - "
                    f"用戶: {username}, "
                    f"記錄ID: {record_id}, "
                    f"原始文件名: {file.filename}, "
                    f"新文件名: {new_filename}, "
                    f"大小: {file_size_mb:.2f}MB"
                )
                
                # 記錄成功上傳的檔案
                uploaded_files.append({
                    'filename': new_filename,
                    'original_name': file.filename,
                    'path': f'../../backend/static/meeting_images/{record_id}/{new_filename}'
                })
        
        # ✅ 記錄上傳完成摘要
        if uploaded_files:
            logger.info(
                f"📊 上傳完成 - "
                f"用戶: {username}, "
                f"記錄ID: {record_id}, "
                f"成功: {len(uploaded_files)}張, "
                f"失敗: {len(errors)}張"
            )
        
        return jsonify({
            'status': 'success',
            'message': f'成功上傳 {len(uploaded_files)} 張圖片',
            'uploaded': uploaded_files,
            'errors': errors if errors else None,
            'folder': f'../../backend/static/meeting_images/{record_id}'
        })
        
    except Exception as e:
        username = request.args.get('username', '未知')
        record_id = request.form.get('record_id', '未知')
        logger.error(f"❌ 圖片上傳失敗 - 用戶: {username}, 記錄ID: {record_id}, 錯誤: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'上傳失敗: {str(e)}'
        }), 500


@meeting_bp.route('/get_meeting_images/<record_id>', methods=['GET'])
def get_meeting_images(record_id):
    """
    取得指定記錄的所有圖片
    """
    try:
        # 驗證 UUID 格式
        # ✅ 驗證 record_id 不為空
        if not record_id or not str(record_id).strip():
            return jsonify({
                'status': 'error',
                'message': '缺少 record_id 參數'
            }), 400
        
        base_path = config.get_path('Paths', 'meeting_images')
        folder_path = os.path.join(base_path, record_id)
        
        if not os.path.exists(folder_path):
            return jsonify({
                'status': 'success',
                'images': [],
                'message': '該記錄尚無圖片'
            })
        
        images = []
        for filename in sorted(os.listdir(folder_path)):
            if allowed_file(filename):
                images.append({
                    'filename': filename,
                    'url': f'../../backend/static/meeting_images/{record_id}/{filename}'
                })
        
        return jsonify({
            'status': 'success',
            'images': images,
            'count': len(images)
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'取得圖片失敗: {str(e)}'
        }), 500


@meeting_bp.route('/get_meeting_image/<record_id>/<filename>', methods=['GET'])
def get_meeting_image(record_id, filename):
    """
    獲取會議圖片
    
    URL Parameters:
        record_id (str): 記錄 ID
        filename (str): 圖片文件名
        
    Query Parameters:
        username (str): 用戶員工編號
        
    Returns:
        File: 圖片文件
    """
    from flask import send_file
    import mimetypes
    
    try:
        username = request.args.get('username')
        if not username:
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        # 獲取圖片路徑
        base_path = config.get_path('Paths', 'meeting_images')
        image_path = os.path.join(base_path, record_id, secure_filename(filename))
        
        if not os.path.exists(image_path):
            logger.error(f"圖片不存在: {image_path}")
            return jsonify({
                'status': 'error',
                'message': '圖片不存在'
            }), 404
        
        # ✅ 根據文件擴展名動態設置 MIME type
        mimetype, _ = mimetypes.guess_type(filename)
        if mimetype is None:
            mimetype = 'application/octet-stream'  # 默認類型
        
        logger.info(f"返回圖片: {filename}, MIME type: {mimetype}")
        
        # 返回圖片文件
        return send_file(image_path, mimetype=mimetype)
        
    except Exception as e:
        logger.error(f"獲取會議圖片失敗: {e}")
        return jsonify({
            'status': 'error',
            'message': f'獲取圖片失敗: {str(e)}'
        }), 500


@meeting_bp.route('/delete_meeting_image', methods=['POST'])
def delete_meeting_image():
    """
    刪除指定的圖片
    
    Query Parameters:
        username (str): 執行刪除的用戶員工編號
    
    Request Body:
        record_id (str): 記錄 ID
        filename (str): 圖片文件名
    """
    try:
        # ✅ 獲取用戶信息
        username = request.args.get('username')
        if not username:
            logger.warning("圖片刪除請求缺少 username 參數")
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        data = request.json
        record_id = data.get('record_id')
        filename = data.get('filename')
        
        if not record_id or not filename:
            logger.warning(f"用戶 {username} 的圖片刪除請求缺少必要參數")
            return jsonify({
                'status': 'error',
                'message': '缺少必要參數'
            }), 400
        
        base_path = config.get_path('Paths', 'meeting_images')
        file_path = os.path.join(base_path, record_id, secure_filename(filename))
        
        if os.path.exists(file_path):
            # 獲取文件大小（刪除前）
            file_size = os.path.getsize(file_path)
            file_size_mb = file_size / (1024 * 1024)
            
            # 刪除文件
            os.remove(file_path)
            
            # ✅ 記錄刪除操作
            logger.info(
                f"🗑️ 圖片已刪除 - "
                f"用戶: {username}, "
                f"記錄ID: {record_id}, "
                f"文件名: {filename}, "
                f"大小: {file_size_mb:.2f}MB"
            )
            
            return jsonify({
                'status': 'success',
                'message': '圖片已刪除'
            })
        else:
            logger.warning(
                f"⚠️ 圖片刪除失敗(文件不存在) - "
                f"用戶: {username}, "
                f"記錄ID: {record_id}, "
                f"文件名: {filename}"
            )
            return jsonify({
                'status': 'error',
                'message': '圖片不存在'
            }), 404
            
    except Exception as e:
        username = request.args.get('username', '未知')
        record_id = data.get('record_id', '未知') if 'data' in locals() else '未知'
        filename = data.get('filename', '未知') if 'data' in locals() else '未知'
        
        logger.error(
            f"❌ 圖片刪除失敗 - "
            f"用戶: {username}, "
            f"記錄ID: {record_id}, "
            f"文件名: {filename}, "
            f"錯誤: {str(e)}"
        )
        return jsonify({
            'status': 'error',
            'message': f'刪除失敗: {str(e)}'
        }), 500


@meeting_bp.route('/delete_all_meeting_images/<record_id>', methods=['DELETE'])
def delete_all_meeting_images(record_id):
    """
    刪除指定記錄的所有圖片（包含資料夾）
    
    Query Parameters:
        username (str): 執行刪除的用戶員工編號
    """
    try:
        import shutil
        
        # ✅ 獲取用戶信息
        username = request.args.get('username')
        if not username:
            logger.warning("批量刪除圖片請求缺少 username 參數")
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        base_path = config.get_path('Paths', 'meeting_images')
        folder_path = os.path.join(base_path, record_id)
        
        if os.path.exists(folder_path):
            # ✅ 計算要刪除的圖片數量和總大小
            image_files = [f for f in os.listdir(folder_path) if allowed_file(f)]
            total_count = len(image_files)
            total_size = sum(os.path.getsize(os.path.join(folder_path, f)) for f in image_files)
            total_size_mb = total_size / (1024 * 1024)
            
            # 刪除整個文件夾
            shutil.rmtree(folder_path)
            
            # ✅ 記錄批量刪除操作
            logger.info(
                f"🗑️ 批量刪除圖片 - "
                f"用戶: {username}, "
                f"記錄ID: {record_id}, "
                f"刪除數量: {total_count}張, "
                f"總大小: {total_size_mb:.2f}MB"
            )
            
            return jsonify({
                'status': 'success',
                'message': '已刪除該記錄的所有圖片'
            })
        else:
            logger.info(
                f"ℹ️ 批量刪除圖片(無圖片) - "
                f"用戶: {username}, "
                f"記錄ID: {record_id}"
            )
            return jsonify({
                'status': 'success',
                'message': '該記錄沒有圖片'
            })
            
    except Exception as e:
        username = request.args.get('username', '未知')
        logger.error(
            f"❌ 批量刪除圖片失敗 - "
            f"用戶: {username}, "
            f"記錄ID: {record_id}, "
            f"錯誤: {str(e)}"
        )
        return jsonify({
            'status': 'error',
            'message': f'刪除失敗: {str(e)}'
        }), 500
    

@meeting_bp.route("/meeting_records", methods=["GET"])
def meeting_records():
    try:
        username = request.args.get("username", "").strip()
        data = load_meeting_records()
        
        # ✅ 為每筆記錄載入最新的留言討論
        for record in data:
            record_id = record.get('id') or record.get('項次')
            if record_id:
                # 載入該記錄的所有留言
                comments = load_comments(str(record_id))
                
                # 將留言轉換為列表（按時間戳排序）
                if comments:
                    # 取得所有留言的內容，按時間戳排序
                    comment_list = []
                    for timestamp in sorted(comments.keys()):
                        comment_data = comments[timestamp]
                        # 格式化留言內容：日期 + 姓名 + 內容
                        created_at = comment_data.get('created_at', '')
                        display_name = comment_data.get('display_name', '')
                        content = comment_data.get('content', '')
                        
                        # 格式化日期（從 ISO 格式轉為友好格式）
                        try:
                            from datetime import datetime as dt
                            date_obj = dt.fromisoformat(created_at)
                            date_str = date_obj.strftime('%m/%d')
                        except:
                            date_str = created_at[:10] if len(created_at) >= 10 else ''
                        
                        # 組合格式：日期 姓名: 內容
                        if content:
                            # 有文字內容
                            formatted_comment = f"{date_str} {display_name}: {content}"
                        elif comment_data.get('images') and len(comment_data.get('images', [])) > 0:
                            # 沒有文字但有圖片
                            formatted_comment = f"{date_str} {display_name}: 圖片"
                        else:
                            formatted_comment = ''
                        
                        if formatted_comment:
                            comment_list.append(formatted_comment)
                    
                    record['留言討論'] = comment_list
                else:
                    record['留言討論'] = []
            else:
                record['留言討論'] = []
        
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


# 2026/04/09 修改 圖表第一章的 route
@meeting_bp.route("/first_status_chart", methods=["GET"])
def first_status_chart():
    try:
        file_path = config.get_path('Paths', 'first_status_chart_route')

        if not file_path:
            logger.error("❌ first_status_chart_route 沒設定")
            return jsonify({"weeks": [], "counts": {}})

        if not os.path.exists(file_path):
            logger.error(f"❌ 找不到檔案: {file_path}")
            return jsonify({"weeks": [], "counts": {}})

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        weeks = data.get("weeks", [])
        counts = data.get("counts", {})

        # 🔥 關鍵：先排序（年 + 週）
        def week_key(w):
            try:
                year, week = w.split("-W")
                return (int(year), int(week))
            except:
                return (0, 0)

        weeks_sorted = sorted(weeks, key=week_key)

        # 🔥 取最後8週
        last_8_weeks = weeks_sorted[-8:]

        result_counts = {
            w: counts.get(w, {
                "New": 0,
                "On Going": 0,
                "Pending": 0,
                "Closed": 0
            })
            for w in last_8_weeks
        }

        return jsonify({
            "weeks": last_8_weeks,
            "counts": result_counts
        })

    except Exception:
        logger.exception("❌ first_status_chart failed")
        return jsonify({"weeks": [], "counts": {}})
    

@meeting_bp.route('/get_all_owners', methods=['GET'])
def get_all_owners():
    owners_data = get_all_owner()
    
    if not owners_data:
        return jsonify({"status": "success", "data": []})
        
    return jsonify({
        "status": "success",
        "data": owners_data
    })

