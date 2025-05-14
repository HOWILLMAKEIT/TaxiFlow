import os
import pickle
import numpy as np
import sys
from collections import defaultdict

WINDOW_SIZE = 10
GRID_SIZE = 0.002  # 约200米
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'Data', 'taxi_log_2008_by_id')
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'Data', 'precomputed_path_index.pkl')

#
def grid_point(point, grid_size=GRID_SIZE):
    lon, lat = point
    grid_x = int(np.floor(lon / grid_size))
    grid_y = int(np.floor(lat / grid_size))
    center_lon = (grid_x + 0.5) * grid_size
    center_lat = (grid_y + 0.5) * grid_size
    return (round(center_lon, 6), round(center_lat, 6))

def grid_path(points, grid_size=GRID_SIZE):# 将路径点按网格大小归并为网格中心点
    """将路径点按网格大小归并为网格中心点"""
    return [grid_point(p, grid_size) for p in points]

def path_to_tuple(points):# 将路径点转换为不可变的元组
    """将路径点转换为不可变的元组"""
    return tuple(points)

def parse_line(line):# 解析每一行数据
    parts = line.strip().split(',')
    if len(parts) < 4:
        return None
    try:
        taxi_id = str(parts[0])
        lon = float(parts[2])
        lat = float(parts[3])
        return taxi_id, lon, lat
    except Exception:
        return None

def calculate_path_length(points):
    total_length = 0
    for i in range(len(points)-1):
        lon1, lat1 = points[i][0], points[i][1]
        lon2, lat2 = points[i+1][0], points[i+1][1]
        dist = np.sqrt((lon1-lon2)**2 + (lat1-lat2)**2)  # 粗略欧氏距离，足够用于排序
        total_length += dist
    return total_length

def main():
    path_to_taxis = defaultdict(set)
    files = [fname for fname in os.listdir(DATA_DIR) if fname.endswith('.txt')]
    total = len(files)
    for idx, fname in enumerate(files, 1):
        file_path = os.path.join(DATA_DIR, fname)
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        traj = []
        taxi_id = None
        for line in lines:
            parsed = parse_line(line)
            if parsed is None:
                continue
            taxi_id, lon, lat = parsed
            traj.append((lon, lat))
        if len(traj) < WINDOW_SIZE:
            # 进度条显示
            progress = int(idx / total * 50)
            sys.stdout.write(f"\r[{'=' * progress}{' ' * (50 - progress)}] {idx}/{total} {fname}")
            sys.stdout.flush()
            continue
        seen = set()
        for i in range(len(traj) - WINDOW_SIZE + 1):# 遍历每个窗口
            # 取出窗口内的路径点
            sub_path = traj[i:i+WINDOW_SIZE]
            grid_sub_path = grid_path(sub_path)
            path_key = path_to_tuple(grid_sub_path)
            if path_key in seen:
                continue
            seen.add(path_key)
            path_to_taxis[path_key].add(taxi_id)
        # 进度条显示
        progress = int(idx / total * 50)
        sys.stdout.write(f"\r[{'=' * progress}{' ' * (50 - progress)}] {idx}/{total} {fname}")
        sys.stdout.flush()
    print()  # 换行
    # 分块存储倒排索引（每个分块存车辆ID集合）
    path_blocks = defaultdict(dict)
    for path_key, taxi_ids in path_to_taxis.items():
        first_grid = path_key[0]  # 以首点网格为key
        path_blocks[first_grid][path_key] = taxi_ids
    block_dir = os.path.join(os.path.dirname(OUT_PATH), 'path_invert_blocks')
    os.makedirs(block_dir, exist_ok=True)
    for first_grid, block in path_blocks.items():
        block_file = os.path.join(block_dir, f'{first_grid[0]:.6f}_{first_grid[1]:.6f}.pkl')
        with open(block_file, 'wb') as f:
            pickle.dump(block, f)
    print(f"分块倒排索引已保存到: {block_dir}")

if __name__ == '__main__':
    main()