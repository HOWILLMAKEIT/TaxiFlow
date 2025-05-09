from flask import Blueprint, request, jsonify
import os
import sys
import time as time_module  # 使用别名避免与变量冲突
from datetime import datetime, timedelta
from rtree import index
from collections import defaultdict

# 创建蓝图
area_relation = Blueprint('area_relation', __name__)

# 索引文件路径
INDEX_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Data', 'taxi_rtree')

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
    return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M')

@area_relation.route('/analyze', methods=['POST'])
def analyze_area_relation():
    """
    分析两个区域之间的车流量变化

    请求体JSON格式:
    {
        "area_a": {
            "min_lon": 经度最小值,
            "min_lat": 纬度最小值,
            "max_lon": 经度最大值,
            "max_lat": 纬度最大值
        },
        "area_b": {
            "min_lon": 经度最小值,
            "min_lat": 纬度最小值,
            "max_lon": 经度最大值,
            "max_lat": 纬度最大值
        },
        "start_time": "开始时间（格式：YYYY-MM-DDTHH:MM或YYYY-MM-DD HH:MM:SS）",
        "end_time": "结束时间（格式：YYYY-MM-DDTHH:MM或YYYY-MM-DD HH:MM:SS）",
        "interval": 时间间隔（分钟）
    }
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

        # 解析区域A的坐标
        area_a = data['area_a']
        min_lon_a = float(area_a['min_lon'])
        min_lat_a = float(area_a['min_lat'])
        max_lon_a = float(area_a['max_lon'])
        max_lat_a = float(area_a['max_lat'])

        # 解析区域B的坐标
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

        # 检查时间范围
        if start_timestamp >= end_timestamp:
            return jsonify({'error': '时间范围无效，确保start_time < end_time'}), 400

        # 解析用户传入的时间间隔（用于判断区域间移动）
        travel_time_minutes = int(data.get('interval', 30))  # 默认30分钟
        travel_time_seconds = travel_time_minutes * 60

        # 时间槽间隔固定为1小时或者使用单独的参数
        slot_interval_minutes = 60  # 固定为1小时
        slot_interval_seconds = slot_interval_minutes * 60

        # 检查索引文件是否存在
        if not (os.path.exists(INDEX_FILE + '.idx') and os.path.exists(INDEX_FILE + '.dat')):
            return jsonify({'error': '索引文件不存在，请先构建索引'}), 500

        # 打开索引
        p = index.Property()
        p.dimension = 3  # 三维索引：经度、纬度、时间
        idx = index.Index(INDEX_FILE, properties=p)

        try:
            # 创建时间槽
            time_slots = []
            current_time = start_timestamp
            while current_time < end_timestamp:
                next_time = min(current_time + slot_interval_seconds, end_timestamp)
                time_slots.append({
                    'start': current_time,
                    'end': next_time,
                    'label': f"{timestamp_to_str(current_time)} - {timestamp_to_str(next_time)}",
                    'a_to_b': 0,  # 从A到B的车辆数
                    'b_to_a': 0   # 从B到A的车辆数
                })
                current_time = next_time

            # 查询区域A和区域B内的所有轨迹点
            # 创建查询边界框
            bbox_a = (min_lon_a, min_lat_a, start_timestamp, max_lon_a, max_lat_a, end_timestamp)
            bbox_b = (min_lon_b, min_lat_b, start_timestamp, max_lon_b, max_lat_b, end_timestamp)

            # 收集区域A和区域B内的轨迹点
            points_in_a = defaultdict(list)  # 按出租车ID分组的区域A内的点
            points_in_b = defaultdict(list)  # 按出租车ID分组的区域B内的点

            # 查询区域A内的点
            for item in idx.intersection(bbox_a, objects=True):
                taxi_id = item.object
                timestamp = item.bbox[2]  # 时间戳

                points_in_a[taxi_id].append(timestamp)


            # 查询区域B内的点
            for item in idx.intersection(bbox_b, objects=True):
                taxi_id = item.object
                timestamp = item.bbox[2]  # 时间戳

                points_in_b[taxi_id].append(timestamp)


            # 分析每辆出租车的轨迹，识别从A到B和从B到A的移动
            for taxi_id in set(points_in_a.keys()) | set(points_in_b.keys()):
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
                    # 如果状态从A变为B，且时间间隔在允许范围内
                    if last_area == 'A' and area == 'B' and event_time - last_time <= travel_time_seconds:
                        # 找到了一次从A到B的移动
                        for slot in time_slots:
                            if slot['start'] <= event_time < slot['end']:
                                slot['a_to_b'] += 1
                                break
                    if last_area == 'B' and area == 'A' and event_time - last_time <= travel_time_seconds:
                        # 找到了一次从B到A的移动
                        for slot in time_slots:
                            if slot['start'] <= event_time < slot['end']:
                                slot['b_to_a'] += 1
                                break

                    last_area = area
                    last_time = event_time

            # 计算总流量
            total_a_to_b = sum(slot['a_to_b'] for slot in time_slots)
            total_b_to_a = sum(slot['b_to_a'] for slot in time_slots)

            # 计算查询执行时间
            query_execution_time = time_module.time() - start_timestamp

            # 返回结果
            return jsonify({
                'time_slots': time_slots,
                'total': {
                    'a_to_b': total_a_to_b,
                    'b_to_a': total_b_to_a
                },
                'query_time': query_execution_time
            })

        finally:
            # 确保关闭索引
            idx.close()

    except Exception as e:
        # 确保在发生异常时关闭索引
        try:
            if 'idx' in locals() and idx:
                idx.close()
        except:
            pass

        # 返回错误信息
        return jsonify({'error': f'分析过程中发生错误: {str(e)}'}), 500






