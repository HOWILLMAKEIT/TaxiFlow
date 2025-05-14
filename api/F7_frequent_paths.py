from flask import Blueprint, request, jsonify
import os
from rtree import index
from collections import defaultdict
import numpy as np
from datetime import datetime
import time as time_module
import concurrent.futures
import hashlib
import json
import pickle
import glob
import sqlite3

# 创建蓝图
frequent_paths = Blueprint('frequent_paths_bp', __name__)

# 索引文件路径
INDEX_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Data', 'taxi_rtree')

# 全局缓存倒排索引
precomputed_path_to_taxis = None
PRECOMPUTED_INDEX_PATH = os.path.join(os.path.dirname(__file__), '../Data/precomputed_path_index.pkl')

def haversine_distance(lon1, lat1, lon2, lat2):
    """
    计算两个经纬度点之间的距离（单位：米）
    使用Haversine公式计算地球表面两点之间的距离
    """
    # 将经纬度转换为弧度
    lon1, lat1, lon2, lat2 = map(np.radians, [lon1, lat1, lon2, lat2])
    
    # Haversine公式
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = np.sin(dlat/2.0)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2.0)**2
    c = 2 * np.arcsin(np.sqrt(a))
    
    # 地球平均半径（米）
    r = 6371000
    
    return c * r

def calculate_path_length(points):
    """计算路径长度（使用Haversine距离）"""
    total_length = 0
    for i in range(len(points)-1):
        # 使用Haversine公式计算相邻两点间的实际地球表面距离
        lon1, lat1 = points[i][0], points[i][1]
        lon2, lat2 = points[i+1][0], points[i+1][1]
        dist = haversine_distance(lon1, lat1, lon2, lat2)
        total_length += dist
    return total_length

def batch_path_lengths(paths):
    """批量计算多个子路径的总长度（每个子路径为N*2的数组）"""
    # paths: List[List[[lon, lat], ...]]
    results = []
    for pts in paths:
        pts = np.array(pts)
        if pts.shape[0] < 2:
            results.append(0)
            continue
        lon1 = pts[:-1, 0]
        lat1 = pts[:-1, 1]
        lon2 = pts[1:, 0]
        lat2 = pts[1:, 1]
        d = haversine_distance(lon1, lat1, lon2, lat2)
        results.append(np.sum(d))
    return results

def path_to_string(points):
    """将路径点转换为字符串表示"""
    return ";".join([f"{point[0]:.6f},{point[1]:.6f}" for point in points])

def grid_point(point, grid_size=0.002):
    """将经纬度点按网格大小归并为网格中心点，默认约200米"""
    lon, lat = point
    # 计算网格索引
    grid_x = int(np.floor(lon / grid_size))
    grid_y = int(np.floor(lat / grid_size))
    # 网格中心点坐标
    center_lon = (grid_x + 0.5) * grid_size
    center_lat = (grid_y + 0.5) * grid_size
    return [center_lon, center_lat]

def grid_path(points, grid_size=0.002):
    """对路径点序列做网格化归并"""
    return [grid_point(p, grid_size) for p in points]

def load_precomputed_index():
    global precomputed_path_to_taxis
    if precomputed_path_to_taxis is None:
        with open(PRECOMPUTED_INDEX_PATH, 'rb') as f:
            precomputed_path_to_taxis = pickle.load(f)
    return precomputed_path_to_taxis

@frequent_paths.route('/analyze', methods=['POST'])
def analyze_frequent_paths():
    """
    分析最频繁的路径    请求体JSON格式:
    {
        "k": 前k个最频繁路径的数量,
        "min_distance": 路径最小长度（米）
    }
    """
    # 获取项目根目录
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    CACHE_DIR = os.path.join(PROJECT_ROOT, 'Data', 'f7_query_cache')
    DB_PATH = os.path.join(PROJECT_ROOT, 'Data', 'all_paths_from_pkl.sqlite')
    os.makedirs(CACHE_DIR, exist_ok=True)
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '请求体必须是JSON格式'}), 400
        if 'k' not in data or 'min_distance' not in data:
            return jsonify({'error': '缺少必要参数: k 或 min_distance'}), 400
        k = int(data['k'])
        min_distance = float(data['min_distance'])
        if k <= 0:
            return jsonify({'error': 'k必须大于0'}), 400
        if min_distance <= 0:
            return jsonify({'error': 'min_distance必须大于0'}), 400

        

        # 查询参数生成唯一key
        cache_key = json.dumps({'k': k, 'min_distance': min_distance}, sort_keys=True)
        cache_hash = hashlib.md5(cache_key.encode('utf-8')).hexdigest()
        cache_path = os.path.join(CACHE_DIR, f'{cache_hash}.json')
        # 命中缓存直接返回
        if os.path.exists(cache_path):
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            return jsonify(cache_data)

        # SQL查询高效获取top-k（适配all_paths_from_pkl.sqlite）
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''SELECT points, frequency, length FROM paths WHERE length >= ? ORDER BY frequency DESC LIMIT ?''', (min_distance, k))
        rows = c.fetchall()
        conn.close()
        result_paths = []
        for points_str, frequency, path_length in rows:
            # points_str: "lon1,lat1;lon2,lat2;..."
            points = [[float(x), float(y)] for x, y in (p.split(',') for p in points_str.split(';'))]
            result_paths.append({
                'frequency': frequency,
                'length': path_length,
                'points': points
            })
        result = {
            'paths': result_paths,
            'total_paths_analyzed': len(result_paths)
        }
        # 写入缓存
        try:
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False)
        except Exception:
            pass
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'分析过程中发生错误: {str(e)}'}), 500
