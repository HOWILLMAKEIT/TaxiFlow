/**
 * 主JS文件，负责引入、初始化和协调各个功能模块
 */

// 导入模块
import { mapPromise } from './modules/mapInit.js';
import { showTrack, clearCurrentTracks } from './modules/F1_taxi_routes.js';
import {
    initAreaQueryTools,
    startDrawRectangle,
    executeAreaQuery,
    clearQueryResults,
    stopDrawingTool
} from './modules/F3_area_query.js';
import { analyzeDensity, clearDensityLayer } from './modules/F4_density_analysis.js';
import {
    initAreaRelationTools,
    startDrawAreaA as startDrawAreaA_F5,
    executeAreaRelationAnalysis,
    clearAreaRelationResults
} from './modules/F5_area_relation.js';
import {
    initAreaRelation2Tools,
    startDrawTargetArea,
    executeAreaRelation2Analysis,
    clearAreaRelation2Results
} from './modules/F6_area_relation2.js';
import {
    initTravelTimeTools,
    startDrawAreaA as startDrawAreaA_F9,
    startDrawAreaB,
    analyzeTravelTime,
    clearTravelTimeResults
} from './modules/F9_travel_time.js';

// 全局地图实例
let map = null;

// 初始化应用
document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM加载完成，初始化应用...");

    try {
        // 等待地图初始化完成
        map = await mapPromise;
        console.log("地图实例获取成功:", map);

        // 初始化区域查询工具
        initAreaQueryTools(map);

        // 初始化区域关联分析工具
        initAreaRelationTools(map);

        // 初始化区域关联分析2工具
        initAreaRelation2Tools(map);

        // 初始化最短通行时间分析工具
        initTravelTimeTools(map);

        // 设置事件监听
        setupEventListeners();

        // 设置默认日期时间值
        setDefaultDateTimes();

        console.log("应用初始化完成");
    } catch (error) {
        console.error("应用初始化失败:", error);
    }
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

        // 判断是显示单个出租车还是所有出租车轨迹
        if (taxiId) {
            // 调用API获取单个出租车轨迹
            fetch(`http://localhost:5000/api/taxi_routes/${taxiId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('未找到该出租车的轨迹数据');
                    }
                    return response.json();
                })
                .then(data => {
                    // 将单个出租车数据转换为数组形式传给showTrack
                    showTrack(map, [data]);
                })
                .catch(error => {
                    console.error('获取轨迹数据失败:', error);
                    showMessage(`获取轨迹失败: ${error.message}`, 'error');
                });
        } else {
            // 调用API获取所有出租车轨迹
            fetch('http://localhost:5000/api/taxi_routes/all/tracks')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('获取轨迹数据失败');
                    }
                    return response.json();
                })
                .then(data => {
                    // 直接将轨迹数组传给showTrack
                    showTrack(map, data);
                })
                .catch(error => {
                    console.error('获取轨迹数据失败:', error);
                    showMessage(`获取轨迹失败: ${error.message}`, 'error');
                });
        }
    });

    document.getElementById('btn_clear_track').addEventListener('click', function() {
        console.log('触发: 清除轨迹');
        clearCurrentTracks(map);
    });

    // ===== F3: 区域查询功能 (仅矩形) =====
    document.getElementById('btn_draw_rectangle').addEventListener('click', function() {
        console.log('触发: 绘制矩形区域');
        startDrawRectangle();
    });

    document.getElementById('btn_execute_query').addEventListener('click', function() {
        console.log('触发: 执行区域查询');
        // 执行区域查询，将轨迹显示函数 showTrack 作为回调传入
        executeAreaQuery(map, showTrack);
    });

    document.getElementById('btn_clear_query').addEventListener('click', function() {
        console.log('触发: 清除查询');
        clearQueryResults(map); // 传入map以清除绘制的图形
        clearCurrentTracks(map); // 清除查询结果显示的轨迹
        stopDrawingTool(); // 停止可能正在进行的绘制
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
        console.log('触发: 开始绘制区域A');
        startDrawAreaA_F5(map);
    });

    document.getElementById('btn_execute_f5').addEventListener('click', function() {
        const startTime = document.getElementById('f5_start_time').value;
        const endTime = document.getElementById('f5_end_time').value;
        const interval = document.getElementById('f5_interval').value;
        console.log('触发: 分析区域间流量', { startTime, endTime, interval });
        executeAreaRelationAnalysis(map);
    });

    document.getElementById('btn_clear_f5').addEventListener('click', function() {
        console.log('触发: 清除区域关联分析结果');
        clearAreaRelationResults(map);
    });

    document.getElementById('btn_analyze_f6').addEventListener('click', function() {
        console.log('触发: 开始绘制目标区域');
        startDrawTargetArea(map);
    });

    document.getElementById('btn_execute_f6').addEventListener('click', function() {
        const startTime = document.getElementById('f6_start_time').value;
        const endTime = document.getElementById('f6_end_time').value;
        console.log('触发: 分析区域与其他区域间流量', { startTime, endTime });
        executeAreaRelation2Analysis(map);
    });

    document.getElementById('btn_clear_f6').addEventListener('click', function() {
        console.log('触发: 清除区域关联分析2结果');
        clearAreaRelation2Results(map);
    });

    // ===== F7: 全城频繁路径分析功能 =====
    document.getElementById('btn_analyze_f7').addEventListener('click', function() {
        const k = document.getElementById('f7_k').value;
        const x = document.getElementById('f7_x').value;
        console.log('触发: 查找全城频繁路径', { k, x });
        showMessage("功能尚未实现: 全城频繁路径分析 (F7)");
    });
    // 可能需要添加清除F7结果的按钮监听
    // document.getElementById('btn_clear_f7').addEventListener(...);

    // ===== F8: 区域间频繁路径分析功能 =====
    document.getElementById('btn_analyze_f8').addEventListener('click', function() {
        const k = document.getElementById('f8_k').value; // 注意这里用了f8的k
        // 获取区域A和B的坐标...
        console.log('触发: 查找区域间频繁路径', { k });
        showMessage("功能尚未实现: 区域间频繁路径分析 (F8)");
    });
    // 可能需要添加绘制区域A/B和清除F8结果的按钮监听
    // document.getElementById('btn_draw_area_a').addEventListener(...);
    // document.getElementById('btn_draw_area_b').addEventListener(...);
    // document.getElementById('btn_clear_f8').addEventListener(...);

    // ===== F9: 通行时间分析功能 =====
    document.getElementById('btn_analyze_f9').addEventListener('click', function() {
        const startTime = document.getElementById('f9_start_time').value;
        const endTime = document.getElementById('f9_end_time').value;
        console.log('触发: 分析最短通行时间', { startTime, endTime });
        analyzeTravelTime(map);
    });

    document.getElementById('btn_draw_f9_area_a').addEventListener('click', function() {
        console.log('触发: 绘制F9区域A');
        startDrawAreaA_F9(map);
    });

    document.getElementById('btn_draw_f9_area_b').addEventListener('click', function() {
        console.log('触发: 绘制F9区域B');
        startDrawAreaB(map);
    });

    document.getElementById('btn_clear_f9').addEventListener('click', function() {
        console.log('触发: 清除最短通行时间分析结果');
        clearTravelTimeResults(map);
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
            if (msgElement.textContent === message) { // 避免快速连续消息时提前隐藏
                msgElement.style.display = 'none';
            }
        }, 3000);
    }
}