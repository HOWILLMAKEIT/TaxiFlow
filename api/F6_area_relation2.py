from flask import Blueprint, request, jsonify
import os
import sys
import time as time_module  # 使用别名避免与变量冲突
from datetime import datetime, timedelta
from rtree import index
from collections import defaultdict

# 创建蓝图
area_relation2 = Blueprint('area_relation2', __name__)

# 索引文件路径
INDEX_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Data', 'taxi_rtree')

# 北京市边界范围
BEIJING_BOUNDS = {
    'min_lon': 116.0,
    'min_lat': 39.6,
    'max_lon': 116.8,
    'max_lat': 40.2
}

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

@area_relation2.route('/analyze', methods=['POST'])
def analyze_area_relation2():
    """
    分析指定矩形区域与其他区域之间的车流量变化

    请求体JSON格式:
    {
        "inner_rect": {
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
        required_params = ['inner_rect', 'start_time', 'end_time']
        for param in required_params:
            if param not in data:
                return jsonify({'error': f'缺少必要参数: {param}'}), 400

        # 解析内部矩形的坐标
        inner_rect = data['inner_rect']
        min_lon = float(inner_rect['min_lon'])
        min_lat = float(inner_rect['min_lat'])
        max_lon = float(inner_rect['max_lon'])
        max_lat = float(inner_rect['max_lat'])

        # 计算内部矩形的中心点和尺寸
        center_lon = (min_lon + max_lon) / 2
        center_lat = (min_lat + max_lat) / 2
        width = max_lon - min_lon
        height = max_lat - min_lat

        # 创建1.5倍大小的外部矩形
        outer_min_lon = center_lon - width * 0.75
        outer_min_lat = center_lat - height * 0.75
        outer_max_lon = center_lon + width * 0.75
        outer_max_lat = center_lat + height * 0.75

        # 确保外部矩形不超出北京市边界
        outer_min_lon = max(outer_min_lon, BEIJING_BOUNDS['min_lon'])
        outer_min_lat = max(outer_min_lat, BEIJING_BOUNDS['min_lat'])
        outer_max_lon = min(outer_max_lon, BEIJING_BOUNDS['max_lon'])
        outer_max_lat = min(outer_max_lat, BEIJING_BOUNDS['max_lat'])

        # 解析时间范围
        try:
            start_timestamp = str_to_timestamp(data['start_time'])
            end_timestamp = str_to_timestamp(data['end_time'])
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

        # 检查时间范围
        if start_timestamp >= end_timestamp:
            return jsonify({'error': '时间范围无效，确保start_time < end_time'}), 400

        # 不再考虑时间间隔

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
                    'inner_to_outer': 0,  # 从内部矩形到外部区域的车辆数
                    'outer_to_inner': 0   # 从外部区域到内部矩形的车辆数
                })
                current_time = next_time

            # 查询内部矩形和外部矩形内的所有轨迹点
            # 创建查询边界框
            bbox_inner = (min_lon, min_lat, start_timestamp, max_lon, max_lat, end_timestamp)
            bbox_outer = (outer_min_lon, outer_min_lat, start_timestamp, outer_max_lon, outer_max_lat, end_timestamp)

            # 收集内部矩形和外部矩形内的轨迹点
            points_in_inner = defaultdict(list)  # 按出租车ID分组的内部矩形内的点
            points_in_outer = defaultdict(list)  # 按出租车ID分组的外部矩形内的点

            # 查询内部矩形内的点
            for item in idx.intersection(bbox_inner, objects=True):
                taxi_id = item.object
                timestamp = item.bbox[2]  # 时间戳
                points_in_inner[taxi_id].append(timestamp)

            # 查询外部矩形内的点
            for item in idx.intersection(bbox_outer, objects=True):
                taxi_id = item.object
                timestamp = item.bbox[2]  # 时间戳
                # 只有不在内部矩形的点才添加到外部区域
                if taxi_id not in points_in_inner or timestamp not in points_in_inner[taxi_id]:
                    points_in_outer[taxi_id].append(timestamp)

            # 分析每辆出租车的轨迹，识别从内部矩形到外部区域和从外部区域到内部矩形的移动
            for taxi_id in set(points_in_inner.keys()) | set(points_in_outer.keys()):
                points_inner = sorted(points_in_inner.get(taxi_id, []))
                points_outer = sorted(points_in_outer.get(taxi_id, []))

                if not points_inner or not points_outer:
                    continue  # 如果出租车只出现在一个区域，则跳过

                # 合并并排序所有点
                all_events = []
                for event_time in points_inner:
                    all_events.append((event_time, 'inner'))
                for event_time in points_outer:
                    all_events.append((event_time, 'outer'))
                all_events.sort()

                # 跟踪车辆状态
                last_area = None

                for event_time, area in all_events:
                    # 如果状态从内部矩形变为外部区域
                    if last_area == 'inner' and area == 'outer':
                        # 找到了一次从内部矩形到外部区域的移动
                        for slot in time_slots:
                            if slot['start'] <= event_time < slot['end']:
                                slot['inner_to_outer'] += 1
                                break
                    # 如果状态从外部区域变为内部矩形
                    if last_area == 'outer' and area == 'inner':
                        # 找到了一次从外部区域到内部矩形的移动
                        for slot in time_slots:
                            if slot['start'] <= event_time < slot['end']:
                                slot['outer_to_inner'] += 1
                                break

                    last_area = area

            # 计算总流量
            total_inner_to_outer = sum(slot['inner_to_outer'] for slot in time_slots)
            total_outer_to_inner = sum(slot['outer_to_inner'] for slot in time_slots)

            # 计算查询执行时间
            query_execution_time = time_module.time() - start_timestamp

            # 返回结果
            return jsonify({
                'time_slots': time_slots,
                'total': {
                    'inner_to_outer': total_inner_to_outer,
                    'outer_to_inner': total_outer_to_inner
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
