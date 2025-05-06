from flask import Blueprint, request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime
import os
from rtree import index

density_bp = Blueprint('density', __name__)

# 数据文件路径
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Data')
# R树索引文件路径
INDEX_FILE = os.path.join(DATA_DIR, 'taxi_rtree')

# 北京市边界范围
BEIJING_BOUNDS = {
    'min_lon': 115.7,
    'max_lon': 117.4,
    'min_lat': 39.4,
    'max_lat': 41.6
}

# 添加数据处理限制
MAX_POINTS = 100000  # 最大处理点数
BATCH_SIZE = 10000   # 批处理大小

def str_to_timestamp(time_str):
    try:
        return datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S').timestamp()
    except ValueError:
        try:
            return datetime.strptime(time_str, '%Y-%m-%dT%H:%M').timestamp()
        except ValueError:
            raise ValueError(f"无法解析时间字符串: {time_str}")

@density_bp.route('/analyze', methods=['POST'])
def analyze_density():
    """分析指定时间段内的车流密度
    
    请求参数:
        {
            "grid_size": float,  # 网格大小(米)
            "start_time": str,   # 开始时间 (YYYY-MM-DD HH:mm:ss)
            "end_time": str      # 结束时间 (YYYY-MM-DD HH:mm:ss)
        }
    """
    try:
        print("收到密度分析请求")
        # 获取请求参数
        data = request.get_json()
        print("请求参数:", data)
        
        grid_size = float(data.get('grid_size', 500))  # 默认500米
        start_time = str_to_timestamp(data['start_time'])
        end_time = str_to_timestamp(data['end_time'])
        
        print(f"处理后的参数: grid_size={grid_size}, start_time={start_time}, end_time={end_time}")
        
        # 检查索引文件是否存在
        if not (os.path.exists(INDEX_FILE + '.idx') and os.path.exists(INDEX_FILE + '.dat')):
            print("错误: 索引文件不存在")
            return jsonify({
                'status': 'error',
                'message': '索引文件不存在，请先构建索引'
            }), 500
        
        # 打开R树索引
        p = index.Property()
        p.dimension = 3  # 三维索引：经度、纬度、时间
        idx = index.Index(INDEX_FILE, properties=p)
        
        try:
            # 使用北京市边界范围
            min_lon = BEIJING_BOUNDS['min_lon']
            max_lon = BEIJING_BOUNDS['max_lon']
            min_lat = BEIJING_BOUNDS['min_lat']
            max_lat = BEIJING_BOUNDS['max_lat']
            
            # 查询北京市范围内指定时间段的所有点
            search_bbox = (min_lon, min_lat, start_time, max_lon, max_lat, end_time)
            points = []
            point_count = 0
            batch = []
            
            print("开始分批收集轨迹点...")
            for item in idx.intersection(search_bbox, objects=True):
                coords = item.bbox[:2]  # 获取经纬度
                # 确保点在北京市范围内
                if (min_lon <= coords[0] <= max_lon and 
                    min_lat <= coords[1] <= max_lat):
                    batch.append(coords)
                    point_count += 1
                    
                    if len(batch) >= BATCH_SIZE:
                        points.extend(batch)
                        batch = []
                        print(f"已处理 {point_count} 个点...")
                        
                    if point_count >= MAX_POINTS:
                        print(f"达到最大点数限制 ({MAX_POINTS})")
                        break
            
            points.extend(batch)  # 添加最后一批
            print(f"总共收集了 {len(points)} 个点")
            
            if not points:
                print("警告: 所选时间范围内没有数据")
                return jsonify({
                    'status': 'error',
                    'message': '所选时间范围内没有数据'
                }), 400
            
            # 将米转换为经纬度
            grid_size_degree = grid_size / 111000  # 粗略转换
            
            # 计算网格数量
            lng_grids = int((max_lon - min_lon) / grid_size_degree) + 1
            lat_grids = int((max_lat - min_lat) / grid_size_degree) + 1
            
            print(f"创建网格: {lng_grids}x{lat_grids} (经度x纬度)")
            
            # 初始化密度矩阵
            density_matrix = np.zeros((lat_grids, lng_grids))
            
            # 统计每个网格内的点数量
            for lon, lat in points:
                lng_idx = int((lon - min_lon) / grid_size_degree)
                lat_idx = int((lat - min_lat) / grid_size_degree)
                if 0 <= lng_idx < lng_grids and 0 <= lat_idx < lat_grids:
                    density_matrix[lat_idx][lng_idx] += 1
            
            # 归一化密度值
            max_density = density_matrix.max()
            if max_density > 0:
                density_matrix = (density_matrix / max_density * 100).astype(int)
            
            print(f"最大密度值: {max_density}")
            
            # 构建返回数据
            grid_data = []
            for i in range(lat_grids):
                for j in range(lng_grids):
                    if density_matrix[i][j] > 0:
                        grid_data.append({
                            'bounds': {
                                'sw': [min_lon + j * grid_size_degree, 
                                      min_lat + i * grid_size_degree],
                                'ne': [min_lon + (j + 1) * grid_size_degree, 
                                      min_lat + (i + 1) * grid_size_degree]
                            },
                            'density': int(density_matrix[i][j])
                        })
            
            print(f"生成了 {len(grid_data)} 个非空网格")
            
            # 计算统计信息
            stats = {
                'total_points': len(points),
                'total_grids': len(grid_data),
                'max_density': int(density_matrix.max()),
                'avg_density': float(density_matrix[density_matrix > 0].mean()),
                'time_range': {
                    'start': datetime.fromtimestamp(start_time).strftime('%Y-%m-%d %H:%M:%S'),
                    'end': datetime.fromtimestamp(end_time).strftime('%Y-%m-%d %H:%M:%S')
                }
            }
            
            print("分析完成，返回结果")
            return jsonify({
                'status': 'success',
                'data': {
                    'grid_data': grid_data,
                    'stats': stats,
                    'grid_size': grid_size,
                    'bounds': BEIJING_BOUNDS
                }
            })
            
        finally:
            # 确保关闭索引
            idx.close()
            
    except Exception as e:
        import traceback
        print("处理过程中发生错误:")
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@density_bp.route('/analyze/time-series', methods=['POST'])
def analyze_density_time_series():
    """分析指定时间段内的车流密度随时间的变化
    
    请求参数:
        {
            "grid_size": float,  # 网格大小(米)
            "start_time": str,   # 开始时间 (YYYY-MM-DD HH:mm:ss)
            "end_time": str,     # 结束时间 (YYYY-MM-DD HH:mm:ss)
            "interval": int      # 时间间隔(分钟)
        }
    """
    try:
        data = request.get_json()
        grid_size = float(data.get('grid_size', 500))
        start_time = str_to_timestamp(data['start_time'])
        end_time = str_to_timestamp(data['end_time'])
        interval = int(data.get('interval', 60))  # 默认1小时
        
        # 检查索引文件是否存在
        if not (os.path.exists(INDEX_FILE + '.idx') and os.path.exists(INDEX_FILE + '.dat')):
            return jsonify({
                'status': 'error',
                'message': '索引文件不存在，请先构建索引'
            }), 500
        
        # 打开R树索引
        p = index.Property()
        p.dimension = 3  # 三维索引：经度、纬度、时间
        idx = index.Index(INDEX_FILE, properties=p)
        
        try:
            # 使用北京市边界范围
            min_lon = BEIJING_BOUNDS['min_lon']
            max_lon = BEIJING_BOUNDS['max_lon']
            min_lat = BEIJING_BOUNDS['min_lat']
            max_lat = BEIJING_BOUNDS['max_lat']
            
            # 收集所有点的时间戳和坐标
            points_data = []
            
            # 查询北京市范围内的点
            search_bbox = (min_lon, min_lat, start_time, max_lon, max_lat, end_time)
            
            for item in idx.intersection(search_bbox, objects=True):
                coords = item.bbox[:2]  # 经纬度
                timestamp = item.bbox[2]  # 时间戳
                # 确保点在北京市范围内
                if (min_lon <= coords[0] <= max_lon and 
                    min_lat <= coords[1] <= max_lat):
                    points_data.append((timestamp, coords[0], coords[1]))
            
            if not points_data:
                return jsonify({
                    'status': 'error',
                    'message': '所选时间范围内没有数据'
                }), 400
            
            # 将米转换为经纬度
            grid_size_degree = grid_size / 111000
            
            # 计算网格数量
            lng_grids = int((max_lon - min_lon) / grid_size_degree) + 1
            lat_grids = int((max_lat - min_lat) / grid_size_degree) + 1
            
            # 按时间间隔分组
            interval_seconds = interval * 60
            time_buckets = {}
            
            # 将点分配到时间桶中
            for timestamp, lon, lat in points_data:
                bucket_time = int(timestamp / interval_seconds) * interval_seconds
                if bucket_time not in time_buckets:
                    time_buckets[bucket_time] = []
                time_buckets[bucket_time].append((lon, lat))
            
            # 存储每个时间段的密度数据
            time_series_data = []
            
            # 对每个时间桶计算密度
            for bucket_time in sorted(time_buckets.keys()):
                points = time_buckets[bucket_time]
                
                # 初始化密度矩阵
                density_matrix = np.zeros((lat_grids, lng_grids))
                
                # 统计每个网格内的点数量
                for lon, lat in points:
                    lng_idx = int((lon - min_lon) / grid_size_degree)
                    lat_idx = int((lat - min_lat) / grid_size_degree)
                    if 0 <= lng_idx < lng_grids and 0 <= lat_idx < lat_grids:
                        density_matrix[lat_idx][lng_idx] += 1
                
                # 归一化密度值
                if density_matrix.max() > 0:
                    density_matrix = (density_matrix / density_matrix.max() * 100).astype(int)
                
                # 记录该时间段的统计信息
                time_series_data.append({
                    'time': datetime.fromtimestamp(bucket_time).strftime('%Y-%m-%d %H:%M:%S'),
                    'max_density': int(density_matrix.max()),
                    'avg_density': float(density_matrix[density_matrix > 0].mean()) if density_matrix.max() > 0 else 0,
                    'total_points': len(points),
                    'active_grids': int((density_matrix > 0).sum())
                })
            
            return jsonify({
                'status': 'success',
                'data': {
                    'time_series': time_series_data,
                    'grid_info': {
                        'size': grid_size,
                        'rows': lat_grids,
                        'cols': lng_grids,
                        'bounds': BEIJING_BOUNDS
                    }
                }
            })
            
        finally:
            # 确保关闭索引
            idx.close()
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500