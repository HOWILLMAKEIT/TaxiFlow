import os
import pickle
import sqlite3
import numpy as np
import glob
from collections import defaultdict


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

BLOCK_DIR = os.path.join(os.path.dirname(__file__), '../Data/path_invert_blocks')
# 分块遍历所有path_invert_blocks下的pkl文件，分批加载
result_paths = []
block_files = glob.glob(os.path.join(BLOCK_DIR, '*.pkl'))
for idx, block_file in enumerate(block_files, 1):
    print(f"正在处理 {idx}/{len(block_files)}: {os.path.basename(block_file)}")
    with open(block_file, 'rb') as f:
         block = pickle.load(f)
    for path_key, taxi_ids in block.items():
        points = list(path_key)
        path_length = calculate_path_length(points)
        result_paths.append({
            'frequency': len(taxi_ids),
            'length': path_length,
            'points': [[p[0], p[1]] for p in points]
        })
# 计算路径长度
result_paths = sorted(result_paths, key=lambda x: x['frequency'], reverse=True)

result = {
            'paths': result_paths,
            'total_paths_analyzed': len(result_paths)
        }

# 将 result_paths 写入 SQLite 数据库
DB_PATH = os.path.join(os.path.dirname(__file__), '../Data/all_paths_from_pkl.sqlite')
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
c.execute('''CREATE TABLE paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frequency INTEGER,
    length REAL,
    points TEXT
)''')
for idx, item in enumerate(result_paths, 1):
    # points 序列化为字符串存储
    points_str = ';'.join([f"{p[0]},{p[1]}" for p in item['points']])
    c.execute('INSERT INTO paths (frequency, length, points) VALUES (?, ?, ?)',
              (item['frequency'], item['length'], points_str))
    if idx % 10000 == 0 or idx == len(result_paths):
        print(f"已写入 {idx}/{len(result_paths)} 条路径")
conn.commit()
conn.close()
print(f"已写入SQLite数据库: {DB_PATH}")