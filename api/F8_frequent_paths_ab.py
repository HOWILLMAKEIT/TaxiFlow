from flask import Blueprint, request, jsonify
import os
import sqlite3
import numpy as np
import hashlib
import json

def point_in_rect(point, rect):
    """
    判断点是否在矩形区域内
    point: [lon, lat]
    rect: [min_lon, min_lat, max_lon, max_lat]
    """
    lon, lat = point
    return rect[0] <= lon <= rect[2] and rect[1] <= lat <= rect[3]

# 创建蓝图
frequent_paths_ab_bp = Blueprint('frequent_paths_ab_bp', __name__)

@frequent_paths_ab_bp.route('/analyze_ab', methods=['POST'])
def analyze_frequent_paths_ab():
    """
    频繁路径分析2：给定两个矩形区域A和B，分析从A到B的最为频繁的前k个通行路径
    请求体JSON格式:
    {
        "k": 前k个最频繁路径的数量,
        "rect_a": [min_lon, min_lat, max_lon, max_lat],
        "rect_b": [min_lon, min_lat, max_lon, max_lat]
    }
    """
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    CACHE_DIR = os.path.join(PROJECT_ROOT, 'Data', 'f8_query_cache')
    DB_PATH = os.path.join(PROJECT_ROOT, 'Data', 'all_paths_from_pkl.sqlite')
    os.makedirs(CACHE_DIR, exist_ok=True)
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '请求体必须是JSON格式'}), 400
        if 'k' not in data or 'rect_a' not in data or 'rect_b' not in data:
            return jsonify({'error': '缺少必要参数: k、rect_a 或 rect_b'}), 400
        k = int(data['k'])
        rect_a = data['rect_a']
        rect_b = data['rect_b']
        min_distance = 100  # 默认最小距离为100米
        
        if k <= 0:
            return jsonify({'error': 'k必须大于0'}), 400
        if len(rect_a) != 4 or len(rect_b) != 4:
            return jsonify({'error': 'rect_a和rect_b必须为4元素数组'}), 400

        # 查询参数生成唯一key
        cache_key = json.dumps({'k': k, 'min_distance': min_distance, 'rect_a': rect_a, 'rect_b': rect_b}, sort_keys=True)
        cache_hash = hashlib.md5(cache_key.encode('utf-8')).hexdigest()
        cache_path = os.path.join(CACHE_DIR, f'{cache_hash}.json')
        if os.path.exists(cache_path):
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            return jsonify(cache_data)

        # 查询数据库，筛选起点在A、终点在B的路径
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''SELECT points, frequency, length FROM paths WHERE length >= ?''', (min_distance,))
        rows = c.fetchall()
        conn.close()
        result_paths = []
        for points_str, frequency, path_length in rows:
            points = [[float(x), float(y)] for x, y in (p.split(',') for p in points_str.split(';'))]
            if not points:
                continue
            if point_in_rect(points[0], rect_a) and point_in_rect(points[-1], rect_b):
                result_paths.append({
                    'frequency': frequency,
                    'length': path_length,
                    'points': points
                })
        result_paths = sorted(result_paths, key=lambda x: x['frequency'], reverse=True)[:k]
        result = {
            'paths': result_paths,
            'total_paths_analyzed': len(result_paths)
        }
        try:
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False)
        except Exception:
            pass
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'分析过程中发生错误: {str(e)}'}), 500
