"""
提案人閱讀狀態 API 路由 - 詳細版本
返回每則留言和每次進度的詳細資訊
"""
from flask import Blueprint, request, jsonify
from utils.proposer_read_tracker import ProposerReadTracker
import pandas as pd
import os
import configparser

proposer_read_bp = Blueprint('proposer_read', __name__)
tracker = ProposerReadTracker()

# 讀取設定檔
config = configparser.ConfigParser()

possible_paths = [
    'config.ini',
    os.path.join(os.path.dirname(__file__), '..', 'config.ini'),
]

config_loaded = False
for config_path in possible_paths:
    if os.path.exists(config_path):
        try:
            config.read(config_path, encoding='utf-8')
            if 'Paths' in config or 'paths' in config:
                config_loaded = True
                print(f"✅ [Routes] 成功讀取 config.ini: {os.path.abspath(config_path)}")
                break
        except:
            pass

def get_all_meetings():
    """讀取所有會議記錄"""
    if config_loaded:
        paths_section = 'Paths' if 'Paths' in config else 'paths'
        csv_path = config[paths_section].get('meeting_csv', 'static\\MeetingRecording.csv')
    else:
        csv_path = 'static\\MeetingRecording.csv'
    
    if not os.path.exists(csv_path):
        print(f"⚠️ CSV 檔案不存在: {csv_path}")
        return []
    
    try:
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
        return df.to_dict('records')
    except Exception as e:
        print(f"❌ 讀取 CSV 失敗: {e}")
        return []


@proposer_read_bp.route('/api/proposer-read/mark/<record_id>', methods=['POST'])
def mark_read(record_id):
    """
    標記提案已讀
    
    Args:
        record_id: CSV 的 id 欄位
    """
    try:
        tracker.mark_as_read(record_id)
        return jsonify({
            'status': 'success',
            'message': '已標記為已讀'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@proposer_read_bp.route('/api/proposer-read/mark-all', methods=['POST'])
def mark_all_read():
    """
    標記提案人的所有提案為已讀
    
    Request Body:
        {
            "username": "提案人姓名"
        }
    
    Returns:
        {
            'status': 'success',
            'message': '已標記 X 個提案為已讀',
            'marked_count': int
        }
    """
    try:
        data = request.get_json()
        username = data.get('username')
        
        if not username:
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        # 讀取所有會議記錄
        all_meetings = get_all_meetings()
        
        # 標記所有提案為已讀
        marked_count = tracker.mark_all_as_read(username, all_meetings)
        
        return jsonify({
            'status': 'success',
            'message': f'已標記 {marked_count} 個提案為已讀',
            'marked_count': marked_count
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@proposer_read_bp.route('/api/proposer-read/my-summary', methods=['GET'])
def get_my_summary():
    """
    獲取指定用戶（提案人）的未讀摘要（詳細版本）
    
    Query Parameters:
        username: 用戶名（提案人姓名）
    
    Example:
        GET /api/proposer-read/my-summary?username=詹睿穎
    
    Returns:
        {
            'status': 'success',
            'data': {
                'proposer_name': str,
                'total_unread': int,
                'unread_items': [
                    {
                        'record_id': str,      # CSV 的 id
                        'item_number': str,    # 項次
                        'title': str,          # 主旨
                        'type': 'comment' or 'progress',
                        'author': str,         # 留言作者（留言才有）
                        'content': str,        # 內容
                        'time': str,           # 時間
                        'has_images': bool     # 是否有圖片（留言才有）
                    }
                ]
            }
        }
    """
    try:
        # 從 query parameter 獲取用戶名
        username = request.args.get('username')
        
        if not username:
            return jsonify({
                'status': 'error',
                'message': '缺少 username 參數'
            }), 400
        
        # 讀取所有會議記錄
        all_meetings = get_all_meetings()
        
        # 獲取詳細的未讀摘要
        summary = tracker.get_proposer_unread_summary(username, all_meetings)
        summary['proposer_name'] = username
        
        return jsonify({
            'status': 'success',
            'data': summary
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500