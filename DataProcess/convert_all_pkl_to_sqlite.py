import os
import pickle
import sqlite3
import numpy as np
import glob
from tqdm import tqdm  # 用于显示进度条

def haversine_distance(lon1, lat1, lon2, lat2):
    lon1, lat1, lon2, lat2 = map(np.radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = np.sin(dlat/2.0)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2.0)**2
    c = 2 * np.arcsin(np.sqrt(a))
    r = 6371000
    return c * r

def calculate_path_length(points):
    total_length = 0
    for i in range(len(points) - 1):
        lon1, lat1 = points[i]
        lon2, lat2 = points[i + 1]
        total_length += haversine_distance(lon1, lat1, lon2, lat2)
    return total_length

# 基础路径设置
BASE_DIR = os.path.dirname(__file__)
BLOCK_DIR = os.path.join(BASE_DIR, '../Data/path_invert_blocks')
DB_PATH = os.path.join(BASE_DIR, '../Data/all_paths_from_pkl.sqlite')

# 删除已有数据库
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

# 初始化数据库
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
c.execute('''
    CREATE TABLE paths (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        frequency INTEGER,
        length REAL,
        points TEXT
    )
''')
conn.commit()

# 遍历每一个子文件夹 path_invert_blocks_5 到 path_invert_blocks_17
for window_size in range(5, 18):
    sub_dir = os.path.join(BLOCK_DIR, f'path_invert_blocks_{window_size}')
    if not os.path.exists(sub_dir):
        print(f"❌ 子目录不存在：{sub_dir}")
        continue

    pkl_files = glob.glob(os.path.join(sub_dir, '*.pkl'))
    print(f"\n📂 正在处理子目录: path_invert_blocks_{window_size}，共 {len(pkl_files)} 个文件")

    # ✅ 使用 tqdm 显示当前子目录的处理进度
    for pkl_file in tqdm(pkl_files, desc=f"正在处理 path_invert_blocks_{window_size}", unit="文件"):
        try:
            with open(pkl_file, 'rb') as f:
                block = pickle.load(f)

            for path_key, taxi_ids in block.items():
                points = list(path_key)
                path_length = calculate_path_length(points)
                points_str = ';'.join([f"{p[0]},{p[1]}" for p in points])
                c.execute('INSERT INTO paths (frequency, length, points) VALUES (?, ?, ?)',
                          (len(taxi_ids), path_length, points_str))

            conn.commit()
        except Exception as e:
            print(f"❌ 错误文件: {pkl_file}，错误信息: {e}")

# 关闭数据库连接
conn.close()
print(f"\n✅ 所有路径数据已写入 SQLite：{DB_PATH}")
