/**
 * 区域查询模块 - 提供基于区域(圆形、矩形、多边形)的出租车轨迹查询功能
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
        showMessage("区域绘制完成，请点击查询按钮开始搜索该区域内的出租车轨迹");
    });
}

/**
 * 启动圆形区域绘制
 */
export function startDrawCircle() {
    console.log("开始绘制圆形区域...");
    clearQueryResults();
    
    if (drawTool) {
        drawTool.circle({
            fillColor: '#00b0ff',
            strokeColor: '#80d8ff',
            fillOpacity: 0.3,
            strokeOpacity: 0.8,
            strokeWeight: 2
        });
        
        showMessage("请在地图上点击并拖动鼠标绘制圆形查询区域");
    } else {
        console.error("绘制工具未初始化");
    }
}

/**
 * 启动矩形区域绘制
 */
export function startDrawRectangle() {
    console.log("开始绘制矩形区域...");
    clearQueryResults();
    
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
 * 启动多边形区域绘制
 */
export function startDrawPolygon() {
    console.log("开始绘制多边形区域...");
    clearQueryResults();
    
    if (drawTool) {
        drawTool.polygon({
            fillColor: '#4caf50',
            strokeColor: '#81c784',
            fillOpacity: 0.3,
            strokeOpacity: 0.8,
            strokeWeight: 2
        });
        
        showMessage("请在地图上依次点击绘制多边形查询区域，双击结束绘制");
    } else {
        console.error("绘制工具未初始化");
    }
}

/**
 * 执行区域查询
 * @param {AMap.Map} map - 地图实例
 * @param {Array} trackData - 轨迹数据数组
 * @param {Function} trackDisplayCallback - 显示查询结果的回调函数
 */
export function executeAreaQuery(map, trackData, trackDisplayCallback) {
    console.log("执行区域查询...");
    
    // 清除之前的查询结果
    clearQueryResults();
    
    if (!currentQueryArea) {
        showMessage("请先绘制查询区域", "error");
        return;
    }
    
    // 查询区域类型和包含关系的判断逻辑
    let containsFunction;
    
    if (currentQueryArea instanceof AMap.Circle) {
        // 圆形区域
        const center = currentQueryArea.getCenter();
        const radius = currentQueryArea.getRadius();
        
        containsFunction = (point) => {
            return AMap.GeometryUtil.distance(center, point) <= radius;
        };
    } else if (currentQueryArea instanceof AMap.Rectangle) {
        // 矩形区域
        const bounds = currentQueryArea.getBounds();
        
        containsFunction = (point) => {
            return bounds.contains(point);
        };
    } else if (currentQueryArea instanceof AMap.Polygon) {
        // 多边形区域
        const path = currentQueryArea.getPath();
        
        containsFunction = (point) => {
            return AMap.GeometryUtil.isPointInRing(point, path);
        };
    } else {
        showMessage("不支持的区域类型", "error");
        return;
    }
    
    // 筛选包含在区域内的轨迹
    const results = trackData.filter(track => {
        // 检查轨迹的任意点是否在区域内
        return track.path.some(point => containsFunction(point));
    });
    
    if (results.length === 0) {
        showMessage("查询区域内没有发现出租车轨迹", "warning");
    } else {
        showMessage(`查询成功，共找到 ${results.length} 条轨迹`);
        
        // 保存查询结果
        resultTracks = results;
        
        // 使用回调函数显示轨迹
        if (typeof trackDisplayCallback === 'function') {
            trackDisplayCallback(map, results);
        }
        
        // 显示查询结果统计
        showQueryStatistics(results);
    }
}

/**
 * 显示查询结果统计信息
 * @param {Array} results - 查询结果轨迹数组
 */
function showQueryStatistics(results) {
    console.log("显示查询统计信息...");
    
    // 计算统计信息
    const totalVehicles = results.length;
    const totalPoints = results.reduce((sum, track) => sum + track.path.length, 0);
    
    // 计算平均速度
    let speedPoints = 0;
    let speedSum = 0;
    
    results.forEach(track => {
        if (track.speed && track.speed.length > 0) {
            speedSum += track.speed.reduce((a, b) => a + b, 0);
            speedPoints += track.speed.length;
        }
    });
    
    const avgSpeed = speedPoints > 0 ? (speedSum / speedPoints).toFixed(2) : "未知";
    
    // 构建统计信息HTML
    const statsHtml = `
        <div class="query-statistics">
            <h4>查询结果统计</h4>
            <p>车辆总数：<span>${totalVehicles}</span></p>
            <p>轨迹点总数：<span>${totalPoints}</span></p>
            <p>平均速度：<span>${avgSpeed} km/h</span></p>
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
 * 清除当前的查询结果
 */
export function clearQueryResults() {
    console.log("清除查询结果...");
    resultTracks = [];
    
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
        drawTool.close(true);
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
            msgElement.style.display = 'none';
        }, 3000);
    }
} 