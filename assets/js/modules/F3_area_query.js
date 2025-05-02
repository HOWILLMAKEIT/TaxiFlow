/**
 * 区域查询模块 - 提供基于矩形区域的出租车轨迹查询功能
 */

// 存储当前的查询区域和绘制工具实例
let currentQueryArea = null;
let drawTool = null;
let resultTracks = [];

/**
 * 初始化区域查询工具
 * @param {AMap.Map} map - 地图实例
 */
export function initAreaQueryTools(map) {
    console.log("初始化区域查询工具...");
    
    // 创建绘制工具实例
    drawTool = new AMap.MouseTool(map);
    
    // 监听绘制完成事件
    drawTool.on('draw', function(e) {
        // 记录绘制的区域对象
        if (currentQueryArea) {
            map.remove(currentQueryArea);
        }
        currentQueryArea = e.obj;
        
        // 提示可以开始查询
        showMessage("矩形区域绘制完成，请设置时间并点击查询按钮");
    });
}

/**
 * 启动矩形区域绘制
 */
export function startDrawRectangle() {
    console.log("开始绘制矩形区域...");
    clearQueryResults(); // 清除之前的图形和结果
    
    if (drawTool) {
        drawTool.rectangle({
            fillColor: '#ff9800',
            strokeColor: '#ffb74d',
            fillOpacity: 0.3,
            strokeOpacity: 0.8,
            strokeWeight: 2
        });
        
        showMessage("请在地图上点击并拖动鼠标绘制矩形查询区域");
    } else {
        console.error("绘制工具未初始化");
    }
}

/**
 * 执行区域查询
 * @param {AMap.Map} map - 地图实例
 * @param {Function} trackDisplayCallback - 显示查询结果的回调函数
 */
export function executeAreaQuery(map, trackDisplayCallback) {
    console.log("执行区域查询...");
    
    clearQueryResults(); // 清除统计信息和 resultTracks 数组
    
    if (!currentQueryArea || !(currentQueryArea instanceof AMap.Rectangle)) {
        showMessage("请先绘制一个矩形查询区域", "error");
        return;
    }
    
    // 获取查询时间范围
    const startTimeInput = document.getElementById('f3_start_time').value;
    const endTimeInput = document.getElementById('f3_end_time').value;
    
    if (!startTimeInput || !endTimeInput) {
        showMessage("请设置查询时间范围", "error");
        return;
    }
    
    // 获取矩形的边界框
    const bounds = currentQueryArea.getBounds();
    const southwest = bounds.getSouthWest(); // 左下角
    const northeast = bounds.getNorthEast(); // 右上角
    
    const queryData = {
        min_lon: southwest.lng, // 经度
        min_lat: southwest.lat, // 纬度
        max_lon: northeast.lng,
        max_lat: northeast.lat,
        start_time: startTimeInput,
        end_time: endTimeInput
    };
    
    // 显示加载提示
    showMessage("正在查询中，请稍候...", "info");
    
    // 调用后端API进行查询
    fetch('http://localhost:5000/api/area_query/rectangle', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errData => {
                throw new Error(errData.error || `服务器错误: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        // 查询成功，显示结果
        if (data.count === 0) {
            showMessage("查询区域内没有发现出租车轨迹", "warning");
        } else {
            showMessage(`查询成功，区域内有 ${data.count} 辆出租车，共 ${data.total_points} 个轨迹点`);
            
            // 只显示查询结果统计，不获取和显示轨迹
            showQueryStatistics(data);
        }
    })
    .catch(error => {
        console.error("区域查询失败:", error);
        showMessage(`查询失败: ${error.message}`, "error");
    });
}

/**
 * 显示查询结果统计信息
 * @param {Object} results - 查询结果数据
 */
function showQueryStatistics(results) {
    console.log("显示查询统计信息...");
    
    // 构建统计信息HTML
    const statsHtml = `
        <div class="query-statistics">
            <h4>查询结果统计</h4>
            <p>区域内车辆总数：<span>${results.count}</span></p>
            <p>轨迹点总数：<span>${results.total_points}</span></p>
            <p>查询用时：<span>${results.query_time.toFixed(3)} 秒</span></p>
        </div>
    `;
    
    // 显示统计信息（这里简单使用console.log，实际项目中应显示在页面中）
    console.log(statsHtml);
    
    // 如果页面上有指定的统计元素，则更新内容
    const statsElement = document.getElementById('query-statistics');
    if (statsElement) {
        statsElement.innerHTML = statsHtml;
        statsElement.style.display = 'block';
    }
}

/**
 * 清除当前的查询结果 (包括绘制的图形和统计信息)
 * @param {AMap.Map} map - 地图实例 (可选，用于清除地图上的图形)
 */
export function clearQueryResults(map) {
    console.log("清除查询结果...");
    resultTracks = [];
    
    // 清除地图上绘制的查询区域图形
    if (map && currentQueryArea) {
        map.remove(currentQueryArea);
        currentQueryArea = null;
    }
    
    // 如果页面上有统计信息元素，隐藏它
    const statsElement = document.getElementById('query-statistics');
    if (statsElement) {
        statsElement.style.display = 'none';
    }
}

/**
 * 停止绘制工具
 */
export function stopDrawingTool() {
    console.log("停止绘制工具...");
    if (drawTool) {
        drawTool.close(true); // true 表示清除绘制过程中的临时图形
    }
}

/**
 * 显示消息提示
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型：'info', 'success', 'warning', 'error'
 */
function showMessage(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // 如果页面上有消息提示元素，显示消息
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