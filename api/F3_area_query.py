from flask import Blueprint, request, jsonify
import os
import sys
import time
from datetime import datetime
from rtree import index

# 创建蓝图
area_query = Blueprint('area_query', __name__)

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

@area_query.route('/rectangle', methods=['POST'])
def query_rectangle():
    """
    接受一个矩形区域的经纬度坐标和时间范围，返回该区域内的出租车数量
    
    请求体JSON格式:
    {
        "min_lon": 经度最小值,
        "min_lat": 纬度最小值,
        "max_lon": 经度最大值,
        "max_lat": 纬度最大值,
        "start_time": "开始时间（格式：YYYY-MM-DDTHH:MM或YYYY-MM-DD HH:MM:SS）",
        "end_time": "结束时间（格式：YYYY-MM-DDTHH:MM或YYYY-MM-DD HH:MM:SS）"
    }
    """
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({'error': '请求体必须是JSON格式'}), 400
        
        # 检查并解析请求参数
        required_params = ['min_lon', 'min_lat', 'max_lon', 'max_lat', 'start_time', 'end_time']
        for param in required_params:
            if param not in data:
                return jsonify({'error': f'缺少必要参数: {param}'}), 400
        
        # 解析坐标和时间范围
        min_lon = float(data['min_lon'])
        min_lat = float(data['min_lat'])
        max_lon = float(data['max_lon'])
        max_lat = float(data['max_lat'])
        
        # 验证坐标范围
        if min_lon >= max_lon or min_lat >= max_lat:
            return jsonify({'error': '坐标范围无效，确保min < max'}), 400
        
        # 解析时间范围
        try:
            start_timestamp = str_to_timestamp(data['start_time'])
            end_timestamp = str_to_timestamp(data['end_time'])
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        
        # 检查时间范围
        if start_timestamp >= end_timestamp:
            return jsonify({'error': '时间范围无效，确保start_time < end_time'}), 400
        
        # 创建查询矩形边界框
        # 3D边界框格式: (min_lon, min_lat, min_time, max_lon, max_lat, max_time)
        search_bbox = (min_lon, min_lat, start_timestamp, max_lon, max_lat, end_timestamp)
        
        # 检查索引文件是否存在
        if not (os.path.exists(INDEX_FILE + '.idx') and os.path.exists(INDEX_FILE + '.dat')):
            return jsonify({'error': '索引文件不存在，请先构建索引'}), 500
        
        # 打开索引
        p = index.Property()
        p.dimension = 3  # 三维索引：经度、纬度、时间
        idx = index.Index(INDEX_FILE, properties=p)
        
        # 执行查询
        start_query_time = time.time()
        
        # 使用集合来避免重复计数
        taxi_ids = set()
        count = 0
        
        # 对结果进行遍历，收集唯一的出租车ID
        for item in idx.intersection(search_bbox, objects=True):
            taxi_id = item.object  # 获取存储的出租车ID
            taxi_ids.add(taxi_id)
            count += 1
        
        # 查询结束时间
        end_query_time = time.time()
        query_time = end_query_time - start_query_time
        
        # 关闭索引
        idx.close()
        
        # 返回结果
        return jsonify({
            'count': len(taxi_ids),  # 独立出租车数量
            'total_points': count,   # 总轨迹点数
            'taxi_ids': list(taxi_ids)[:100],  # 限制返回的ID数量以避免响应过大
            'query_time': query_time
        })
        
    except Exception as e:
        # 确保在发生异常时关闭索引
        try:
            if 'idx' in locals() and idx:
                idx.close()
        except:
            pass
        
        # 返回错误信息
        return jsonify({'error': f'查询过程中发生错误: {str(e)}'}), 500
