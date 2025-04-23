/**
 * 主JS文件，负责引入、初始化和协调各个功能模块
 */

// 导入模块
import { mapPromise, initMap } from './modules/mapInit.js';
import { showTrack, clearCurrentTracks } from './modules/trackDisplay.js';
import { 
    initAreaQueryTools, 
    startDrawCircle, 
    startDrawRectangle,
    startDrawPolygon,
    executeAreaQuery,
    clearQueryResults,
    stopDrawingTool
} from './modules/areaQuery.js';
import { analyzeDensity, clearDensityLayer } from './modules/densityAnalysis.js';

// 全局地图实例
let map;
// 模拟轨迹数据
const mockTrackData = [
    {
        id: "京B10001",
        path: [
            [116.368904, 39.913423],
            [116.382122, 39.901176],
            [116.387271, 39.912501],
            [116.398258, 39.904600]
        ],
        timestamp: [
            "2023-05-20 08:00:00",
            "2023-05-20 08:05:30",
            "2023-05-20 08:10:45",
            "2023-05-20 08:15:20"
        ],
        speed: [35, 42, 28, 30]  // km/h
    },
    {
        id: "京B20002",
        path: [
            [116.412222, 39.915678],
            [116.424589, 39.908765],
            [116.437123, 39.917654],
            [116.448888, 39.922109]
        ],
        timestamp: [
            "2023-05-20 08:02:10",
            "2023-05-20 08:07:45",
            "2023-05-20 08:12:30",
            "2023-05-20 08:18:55"
        ],
        speed: [38, 25, 32, 40]
    }
];

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM加载完成，初始化应用...");
    
    // 等待地图初始化完成
    mapPromise.then((resolvedMap) => {
        console.log("地图 Promise 已解析，获取到 map 实例:", resolvedMap);
        map = resolvedMap;

        // 地图加载完成后设置事件监听
        if (map && typeof map.on === 'function') {
             map.on('complete', function() {
                console.log("高德地图实际 complete 事件触发！");
                
                // 初始化区域查询工具
                initAreaQueryTools(map);
                
                // 为所有功能按钮绑定事件处理函数
                setupEventListeners();
                
                // 设置默认日期时间值
                setDefaultDateTimes();
            });
            console.log("已为地图添加 'complete' 事件监听器。");
        } else {
             console.error("无法添加 'complete' 事件监听器：map 对象无效或没有 on 方法。 Map:", map);
        }

        // 如果地图实例已经 'complete' (可能在 Promise 解析前就完成了)，直接执行后续逻辑
        if (map && map.getStatus && map.getStatus().complete) {
             console.log("地图在 Promise 解析时已经完成加载，直接执行后续逻辑。");
             initAreaQueryTools(map);
             setupEventListeners();
             setDefaultDateTimes();
         }

    }).catch(error => {
        console.error("地图初始化 Promise 失败:", error);
    });
});

/**
 * 设置默认的日期时间值
 */
function setDefaultDateTimes() {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    
    // 格式化为datetime-local输入框所需的格式 (YYYY-MM-DDThh:mm)
    const formatDate = (date) => {
        const pad = (num) => num.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    
    // 设置所有日期输入框的默认值
    const startTimeInputs = document.querySelectorAll('input[type="datetime-local"][id$="_start_time"]');
    const endTimeInputs = document.querySelectorAll('input[type="datetime-local"][id$="_end_time"]');
    
    startTimeInputs.forEach(input => {
        input.value = formatDate(yesterday);
    });
    
    endTimeInputs.forEach(input => {
        input.value = formatDate(now);
    });
}

/**
 * 设置所有UI事件监听器
 */
function setupEventListeners() {
    console.log("设置UI事件监听器...");
    
    // ===== F1/F2: 轨迹显示功能 =====
    document.getElementById('btn_show_track').addEventListener('click', function() {
        const taxiId = document.getElementById('taxi_id').value;
        console.log('触发: 显示轨迹', '出租车ID:', taxiId || '全部');
        
        // 调用轨迹显示模块的功能
        showTrack(map);
    });
    
    document.getElementById('btn_clear_track').addEventListener('click', function() {
        console.log('触发: 清除轨迹');
        clearCurrentTracks(map);
    });

    // ===== F3: 区域查询功能 =====
    document.getElementById('btn_draw_circle').addEventListener('click', function() {
        console.log('触发: 绘制圆形区域');
        startDrawCircle();
    });
    
    document.getElementById('btn_draw_rectangle').addEventListener('click', function() {
        console.log('触发: 绘制矩形区域');
        startDrawRectangle();
    });
    
    document.getElementById('btn_draw_polygon').addEventListener('click', function() {
        console.log('触发: 绘制多边形区域');
        startDrawPolygon();
    });
    
    document.getElementById('btn_execute_query').addEventListener('click', function() {
        console.log('触发: 执行区域查询');
        // 执行区域查询，将轨迹显示函数作为回调传入
        executeAreaQuery(map, mockTrackData, showTrack);
    });
    
    document.getElementById('btn_clear_query').addEventListener('click', function() {
        console.log('触发: 清除查询');
        clearQueryResults();
        clearCurrentTracks(map);
        stopDrawingTool();
    });

    // ===== F4: 密度分析功能 =====
    document.getElementById('btn_analyze_density').addEventListener('click', function() {
        const startTime = document.getElementById('f4_start_time').value;
        const endTime = document.getElementById('f4_end_time').value;
        const gridSize = document.getElementById('f4_grid_size').value;
        
        console.log('触发: 分析车流密度', { startTime, endTime, gridSize });
        
        // 调用密度分析模块的功能
        analyzeDensity(map, startTime, endTime, gridSize);
    });
    
    document.getElementById('btn_clear_density').addEventListener('click', function() {
        console.log('触发: 清除密度图层');
        clearDensityLayer(map);
    });

    // ===== F5-F6: 区域关联分析功能 =====
    document.getElementById('btn_analyze_f5').addEventListener('click', function() {
        const startTime = document.getElementById('f5_start_time').value;
        const endTime = document.getElementById('f5_end_time').value;
        console.log('触发: 分析区域间流量', { startTime, endTime });
        showMessage("功能尚未实现: 双区域流量分析 (F5)");
    });

    document.getElementById('btn_analyze_f6').addEventListener('click', function() {
        const startTime = document.getElementById('f5_start_time').value;
        const endTime = document.getElementById('f5_end_time').value;
        console.log('触发: 分析与该区域关联流量', { startTime, endTime });
        showMessage("功能尚未实现: 单区域关联分析 (F6)");
    });

    // ===== F7-F8: 频繁路径分析功能 =====
    document.getElementById('btn_analyze_f7').addEventListener('click', function() {
        const k = document.getElementById('f7_k').value;
        const x = document.getElementById('f7_x').value;
        console.log('触发: 查找全城频繁路径', { k, x });
        showMessage("功能尚未实现: 全城频繁路径分析 (F7)");
    });

    document.getElementById('btn_analyze_f8').addEventListener('click', function() {
        const k = document.getElementById('f7_k').value;
        console.log('触发: 查找区域间频繁路径', { k });
        showMessage("功能尚未实现: 区域间频繁路径分析 (F8)");
    });

    // ===== F9: 通行时间分析功能 =====
    document.getElementById('btn_analyze_f9').addEventListener('click', function() {
        const startTime = document.getElementById('f9_start_time').value;
        const endTime = document.getElementById('f9_end_time').value;
        console.log('触发: 分析最短通行时间', { startTime, endTime });
        showMessage("功能尚未实现: 最短通行时间分析 (F9)");
    });
}

/**
 * 显示消息提示
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型：'info', 'success', 'warning', 'error'
 */
function showMessage(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    const msgElement = document.getElementById('message-box');
    if (msgElement) {
        msgElement.textContent = message;
        msgElement.className = `message ${type}`;
        msgElement.style.display = 'block';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            msgElement.style.display = 'none';
        }, 3000);
    }
} 