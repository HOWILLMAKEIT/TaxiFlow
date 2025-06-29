from flask import Blueprint, jsonify
import os
import glob

# 创建蓝图而不是应用
taxi_routes = Blueprint('taxi_routes', __name__)

# 数据文件目录路径
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Data', 'taxi_log_2008_by_id')

# 获取单个出粗车轨迹数据
@taxi_routes.route('/<taxi_id>', methods=['GET'])
def get_taxi_track(taxi_id):
    try:
        # 构建文件路径
        file_path = os.path.join(DATA_DIR, f'{taxi_id}.txt')
        
        if not os.path.exists(file_path):
            return jsonify({'error': f'未找到出租车 {taxi_id} 的轨迹数据'}), 404
            
        return jsonify(read_taxi_track(file_path))
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def read_taxi_track(file_path):
    """读取单个出租车轨迹文件
    Args:
        file_path (str): 轨迹文件路径
    Returns: 
        dict: 轨迹数据
    """
    taxi_id = os.path.basename(file_path).replace('.txt', '')
    path = []
    timestamp = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                _, time_str, lon, lat = line.strip().split(',')
                path.append([float(lon), float(lat)])
                timestamp.append(time_str)
            except ValueError:
                continue  # 跳过格式不正确的行
    
    return {
        'id': taxi_id,
        'path': path,
        'timestamp': timestamp,
    }