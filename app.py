from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 导入并注册各个API模块
from api.taxi_routes import taxi_routes
# 导入其他API模块...

app.register_blueprint(taxi_routes, url_prefix='/api/taxi_routes')
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
