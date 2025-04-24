import os
import glob
import sys
import time
from datetime import datetime
from rtree import index
from tqdm import tqdm  # 用于显示进度条（需要安装 tqdm）

script_dir = os.path.dirname(os.path.abspath(__file__))
# 输入数据目录 - 包含所有出租车轨迹文件的文件夹
input_dir = os.path.join(script_dir, '..', 'Data', 'taxi_log_2008_by_id')
# 输出索引文件基名 - 使用D盘根目录下的临时目录存储索引文件
temp_dir = 'D:\\temp'
# 确保临时目录存在
try:
    os.makedirs(temp_dir, exist_ok=True)
    print(f"确保临时目录 '{temp_dir}' 存在")
except OSError as e:
    print(f"无法创建临时目录 '{temp_dir}': {e}", file=sys.stderr)
    # 如果无法创建C:\temp，则尝试使用用户临时目录
    import tempfile
    temp_dir = tempfile.gettempdir()
    print(f"使用系统临时目录: '{temp_dir}'")

index_file_basename = os.path.join(temp_dir, 'taxi_rtree')



# 时间格式字符串
time_format = '%Y-%m-%d %H:%M:%S'

def parse_line(line):
    """解析txt文件中的一行数据，返回(出租车ID, 时间戳, 经度, 纬度)"""
    try:
        parts = [p.strip() for p in line.split(',')]
        if len(parts) != 4:
            return None  # 跳过格式不正确的行

        taxi_id_str = parts[0]
        time_str = parts[1]
        lon_str = parts[2]
        lat_str = parts[3]

        # 将时间戳字符串转换为Unix时间戳（浮点数）
        dt_obj = datetime.strptime(time_str, time_format)
        timestamp_num = dt_obj.timestamp()

        lon = float(lon_str)
        lat = float(lat_str)
        taxi_id = int(taxi_id_str)

        return taxi_id, timestamp_num, lon, lat
    except ValueError:
        # 处理转换错误（例如：非数字的经纬度，错误的时间格式）
        return None
    except Exception as e:
        print(f"解析行 '{line.strip()}' 时发生意外错误: {e}", file=sys.stderr)
        return None

def main():
    global index_file_basename  
    
    print("开始构建时空 R 树索引...")
    print(f"输入目录: {input_dir}")
    print(f"输出索引文件基名: {index_file_basename}")

    # 检查输入目录是否存在
    if not os.path.isdir(input_dir):
        print(f"错误：输入目录 \"{input_dir}\" 不存在。", file=sys.stderr)
        sys.exit(1)

    # 检查索引文件是否已存在，如果存在则先删除
    if os.path.exists(index_file_basename + '.idx'):
        # Rtree库不支持通过属性直接覆盖，需要手动删除旧文件
        print(f"警告：索引文件 '{index_file_basename}.idx/.dat' 已存在。")
        try:
            os.remove(index_file_basename + '.idx')
            os.remove(index_file_basename + '.dat')
            print("已删除旧的索引文件。")
        except OSError as e:
            print(f"错误：无法删除旧的索引文件: {e}", file=sys.stderr)
            sys.exit(1)

    start_build_time = time.time()

    # 创建索引属性对象
    p = index.Property()
    p.dimension = 3  # 三维索引：经度、纬度、时间
    p.buffering_capacity = 10  # 缓冲区大小，可根据内存情况调整

    # 创建索引
    idx = index.Index(index_file_basename, properties=p)

    # 获取所有txt文件列表
    txt_files = glob.glob(os.path.join(input_dir, '*.txt'))

    if not txt_files:
        print(f"警告：在输入目录 \"{input_dir}\" 中没有找到 .txt 文件。")
        sys.exit(0)

    print(f"找到 {len(txt_files)} 个 .txt 文件准备处理。")

    item_id_counter = 0  # 用于给每个轨迹点分配唯一ID
    total_points_processed = 0  # 统计成功处理的轨迹点
    skipped_lines = 0  # 统计跳过的行数

    file_iterator = tqdm(txt_files, desc="处理文件中") if 'tqdm' in sys.modules else txt_files

    try:
        for filepath in file_iterator:
            try:
                with open(filepath, 'r', encoding='utf-8') as infile:
                    for line in infile:
                        parsed_data = parse_line(line)
                        if parsed_data:
                            taxi_id, timestamp_num, lon, lat = parsed_data

                            # 创建3D边界框元组，包含6个元素:
                            # 1. lon: 经度最小值
                            # 2. lat: 纬度最小值
                            # 3. timestamp_num: 时间戳最小值
                            # 4. lon: 经度最大值
                            # 5. lat: 纬度最大值
                            # 6. timestamp_num: 时间戳最大值
                            # 注意：对于点数据，最小值和最大值相同
                            bbox = (lon, lat, timestamp_num, lon, lat, timestamp_num)

                            # 插入数据到索引中，item_id_counter作为唯一ID
                            # obj参数存储taxi_id，便于根据索引查找原始数据
                            idx.insert(item_id_counter, bbox, obj=taxi_id)

                            item_id_counter += 1
                            total_points_processed += 1
                        else:
                            skipped_lines += 1  # 统计无法解析的行数

            except Exception as read_error:
                print(f"\n读取文件 \"{os.path.basename(filepath)}\" 时出错: {read_error}", file=sys.stderr)
                # 可以选择继续处理其他文件
                continue

        # 重要：关闭索引以确保数据写入磁盘
        idx.close()

        end_build_time = time.time()
        print("\n索引构建完成！")
        print(f"总共处理了 {total_points_processed} 个有效数据点。")
        print(f"跳过了 {skipped_lines} 行无效或格式错误的数据。")
        print(f"索引已保存到 '{index_file_basename}.idx' 和 '{index_file_basename}.dat'")
        print(f"构建索引耗时: {end_build_time - start_build_time:.2f} 秒")

    except Exception as e:
        print(f"\n构建索引过程中发生严重错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
