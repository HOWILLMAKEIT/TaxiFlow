from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 导入并注册各个API模块
from api.F1_taxi_routes import taxi_routes
from api.F3_area_query import area_query  # 导入区域查询API蓝图
from api.F4_density_analysis import density_bp  # 导入密度分析API蓝图
from api.F5_area_relation import area_relation  # 导入区域关联分析API蓝图
from api.F6_area_relation2 import area_relation2  # 导入区域关联分析2 API蓝图
# 导入其他API模块...

app.register_blueprint(taxi_routes, url_prefix='/api/taxi_routes')
app.register_blueprint(area_query, url_prefix='/api/area_query')  # 注册区域查询API蓝图
app.register_blueprint(density_bp, url_prefix='/api/density')  # 注册密度分析API蓝图
app.register_blueprint(area_relation, url_prefix='/api/area_relation')  # 注册区域关联分析API蓝图
app.register_blueprint(area_relation2, url_prefix='/api/area_relation2')  # 注册区域关联分析2 API蓝图
# 注册其他Blueprint...

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='TaxiFlow API服务')
    parser.add_argument('--port', type=int, default=5000, help='服务端口号')
    args = parser.parse_args()

    app.run(port=args.port)
