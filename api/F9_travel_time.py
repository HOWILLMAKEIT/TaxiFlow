from flask import Blueprint, request, jsonify
import os
import sys
import time as time_module
from datetime import datetime, timedelta
from rtree import index
from collections import defaultdict

# 创建蓝图
travel_time = Blueprint('travel_time', __name__)

# 索引文件路径
INDEX_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Data', 'taxi_rtree')

# 数据文件目录路径
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Data', 'taxi_log_2008_by_id')

# 将字符串时间转换为时间戳
def str_to_timestamp(time_str):
    try:
        dt_obj = datetime.strptime(time_str, '%Y-%m-%dT%H:%M')
        return dt_obj.timestamp()
    except ValueError:
        try:
            dt_obj = datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
            return dt_obj.timestamp()
        except ValueError:
            raise ValueError(f"无法解析时间字符串: {time_str}")

# 将时间戳转换为格式化字符串
def timestamp_to_str(timestamp):
    return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

# 读取出租车轨迹数据
def read_taxi_track(taxi_id, start_time, end_time):
    try:
        # 构建文件路径
        file_path = os.path.join(DATA_DIR, f'{taxi_id}.txt')

        if not os.path.exists(file_path):
            # 尝试使用不同的文件名格式
            file_path = os.path.join(DATA_DIR, f'{int(taxi_id)}.txt')
            if not os.path.exists(file_path):
                return None

        # 读取文件内容
        track_data = {
            'id': taxi_id,
            'path': []
        }

        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split(',')
                if len(parts) >= 4:
                    try:
                        # 尝试解析时间戳，可能是整数或日期时间字符串
                        try:
                            # 首先尝试直接作为整数解析
                            timestamp = int(parts[1])
                        except ValueError:
                            # 如果失败，尝试将日期时间字符串转换为时间戳
                            try:
                                dt = datetime.strptime(parts[1], '%Y-%m-%d %H:%M:%S')
                                timestamp = dt.timestamp()
                            except ValueError:
                                continue

                        # 只保留指定时间范围内的数据
                        if start_time <= timestamp <= end_time:
                            lon = float(parts[2])
                            lat = float(parts[3])
                            track_data['path'].append({
                                'timestamp': timestamp,
                                'time': timestamp_to_str(timestamp),
                                'lon': lon,
                                'lat': lat
                            })
                    except (ValueError, IndexError):
                        continue

        # 按时间排序
        track_data['path'].sort(key=lambda x: x['timestamp'])

        return track_data
    except Exception as e:
        return None

@travel_time.route('/analyze', methods=['POST'])
def analyze_travel_time():
    """
    分析从区域A到区域B的最短通行时间
    """
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({'error': '请求体必须是JSON格式'}), 400

        # 检查并解析请求参数
        required_params = ['area_a', 'area_b', 'start_time', 'end_time']
        for param in required_params:
            if param not in data:
                return jsonify({'error': f'缺少必要参数: {param}'}), 400

        # 解析区域A和B的坐标
        area_a = data['area_a']
        min_lon_a = float(area_a['min_lon'])
        min_lat_a = float(area_a['min_lat'])
        max_lon_a = float(area_a['max_lon'])
        max_lat_a = float(area_a['max_lat'])

        area_b = data['area_b']
        min_lon_b = float(area_b['min_lon'])
        min_lat_b = float(area_b['min_lat'])
        max_lon_b = float(area_b['max_lon'])
        max_lat_b = float(area_b['max_lat'])

        # 解析时间范围
        try:
            start_timestamp = str_to_timestamp(data['start_time'])
            end_timestamp = str_to_timestamp(data['end_time'])
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

        if start_timestamp >= end_timestamp:
            return jsonify({'error': '时间范围无效，确保start_time < end_time'}), 400

        # 检查索引文件是否存在
        if not (os.path.exists(INDEX_FILE + '.idx') and os.path.exists(INDEX_FILE + '.dat')):
            return jsonify({'error': '索引文件不存在，请先构建索引'}), 500

        # 打开索引
        p = index.Property()
        p.dimension = 3  # 三维索引：经度、纬度、时间
        idx = index.Index(INDEX_FILE, properties=p)

        try:
            # 创建查询边界框
            bbox_a = (min_lon_a, min_lat_a, start_timestamp, max_lon_a, max_lat_a, end_timestamp)
            bbox_b = (min_lon_b, min_lat_b, start_timestamp, max_lon_b, max_lat_b, end_timestamp)

            # 收集区域A和区域B内的轨迹点
            points_in_a = defaultdict(list)
            points_in_b = defaultdict(list)

            # 查询区域A内的点
            for item in idx.intersection(bbox_a, objects=True):
                taxi_id = item.object
                timestamp = item.bbox[2]
                points_in_a[taxi_id].append(timestamp)

            # 查询区域B内的点
            for item in idx.intersection(bbox_b, objects=True):
                taxi_id = item.object
                timestamp = item.bbox[2]
                points_in_b[taxi_id].append(timestamp)

            # 找出同时出现在区域A和区域B的出租车
            common_taxis = set(points_in_a.keys()) & set(points_in_b.keys())

            if not common_taxis:
                return jsonify({'error': '没有找到同时出现在两个区域的出租车'}), 404

            # 分析每辆出租车从A到B的最短通行时间
            min_travel_time = float('inf')
            min_travel_taxi = None
            min_travel_start = None
            min_travel_end = None

            for taxi_id in common_taxis:
                # 获取该出租车在A和B区域的时间点
                points_a = sorted(points_in_a.get(taxi_id, []))
                points_b = sorted(points_in_b.get(taxi_id, []))

                if not points_a or not points_b:
                    continue  # 如果出租车只出现在一个区域，则跳过

                # 合并并排序所有点
                all_events = []
                for event_time in points_a:
                    all_events.append((event_time, 'A'))
                for event_time in points_b:
                    all_events.append((event_time, 'B'))
                all_events.sort()

                # 跟踪车辆状态
                last_area = None
                last_time = None

                for event_time, area in all_events:
                    # 如果状态从A变为B，记录一次从A到B的移动
                    if last_area == 'A' and area == 'B':
                        travel_time = event_time - last_time

                        # 更新最短通行时间
                        if travel_time < min_travel_time:
                            min_travel_time = travel_time
                            min_travel_taxi = taxi_id
                            min_travel_start = last_time  # A区域的时间点
                            min_travel_end = event_time   # B区域的时间点

                    last_area = area
                    last_time = event_time

            if min_travel_taxi is None:
                return jsonify({'error': '没有找到从区域A到区域B的有效路径'}), 404

            # 获取最短通行时间的出租车完整轨迹
            track_data = read_taxi_track(min_travel_taxi, min_travel_start, min_travel_end)

            if not track_data:
                return jsonify({'error': f'无法读取出租车 {min_travel_taxi} 的轨迹数据'}), 500

            # 返回结果
            return jsonify({
                'taxi_id': min_travel_taxi,
                'travel_time': min_travel_time / 60,  # 转换为分钟
                'travel_time_seconds': min_travel_time,
                'start_time': timestamp_to_str(min_travel_start),
                'end_time': timestamp_to_str(min_travel_end),
                'track': track_data
            })

        finally:
            idx.close()

    except Exception as e:
        try:
            if 'idx' in locals() and idx:
                idx.close()
        except:
            pass
        return jsonify({'error': f'分析过程中发生错误: {str(e)}'}), 500
