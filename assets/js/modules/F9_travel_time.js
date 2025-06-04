/**
 * 最短通行时间分析模块 - 提供分析从区域A到区域B的最短通行时间功能
 */

// 存储当前的查询区域
let areaA = null;
let areaB = null;
let drawTool = null;
let currentDrawingArea = 'A'; // 当前正在绘制的区域，'A'或'B'
let travelPath = null; // 存储最短通行时间的路径
let travelMarkers = []; // 存储起点和终点标记

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

/**
 * 初始化最短通行时间分析工具
 * @param {AMap.Map} map - 地图实例
 */
export function initTravelTimeTools(map) {
    console.log("初始化最短通行时间分析工具...");

    // 使用现有的绘制工具或创建新的
    if (!drawTool) {
        drawTool = new AMap.MouseTool(map);
    }

    // 监听绘制完成事件
    drawTool.on('draw', function(e) {
        if (currentDrawingArea === 'A') {
            // 记录区域A
            if (areaA) {
                map.remove(areaA);
            }
            areaA = e.obj;
            areaA.setOptions({
                fillColor: '#1791fc',
                fillOpacity: 0.3,
                strokeColor: '#1791fc',
                strokeWeight: 2
            });

            // 添加标签
            addAreaLabel(map, areaA, 'A');

            // 提示绘制区域B
            showMessage("区域A绘制完成，现在请绘制区域B");

            // 自动开始绘制区域B
            currentDrawingArea = 'B';
            drawTool.rectangle();
        } else {
            // 记录区域B
            if (areaB) {
                map.remove(areaB);
            }
            areaB = e.obj;
            areaB.setOptions({
                fillColor: '#ff6600',
                fillOpacity: 0.3,
                strokeColor: '#ff6600',
                strokeWeight: 2
            });

            // 添加标签
            addAreaLabel(map, areaB, 'B');

            // 提示可以开始分析
            showMessage("区域B绘制完成，请设置时间范围，然后点击分析按钮");

            // 停止绘制工具
            drawTool.close();
        }
    });


}

/**
 * 添加区域标签
 * @param {AMap.Map} map - 地图实例
 * @param {AMap.Rectangle} area - 矩形区域
 * @param {string} label - 标签文本
 */
function addAreaLabel(map, area, label) {
    const bounds = area.getBounds();
    const center = bounds.getCenter();

    const textMarker = new AMap.Text({
        text: `区域${label}`,
        position: [center.lng, center.lat],
        style: {
            'background-color': label === 'A' ? '#1791fc' : '#ff6600',
            'color': 'white',
            'border-radius': '3px',
            'border-width': '0',
            'padding': '2px 6px',
            'font-size': '12px',
            'font-weight': 'bold'
        },
        offset: new AMap.Pixel(0, 0),
        zIndex: 101
    });

    map.add(textMarker);

    // 将标签与区域关联，以便后续一起删除
    if (label === 'A') {
        areaA.label = textMarker;
    } else {
        areaB.label = textMarker;
    }
}

/**
 * 开始绘制区域A
 * @param {AMap.Map} map - 地图实例
 */
export function startDrawAreaA(map) {
    // 清除之前的结果
    clearTravelTimeResults(map);

    // 设置当前绘制的区域为A
    currentDrawingArea = 'A';

    // 开始绘制矩形
    drawTool.rectangle();

    // 显示提示信息
    showMessage("请在地图上绘制区域A（矩形）");
}

/**
 * 开始绘制区域B
 * @param {AMap.Map} map - 地图实例
 */
export function startDrawAreaB(map) {
    // 如果区域A不存在，先绘制区域A
    if (!areaA) {
        startDrawAreaA(map);
        return;
    }

    // 设置当前绘制的区域为B
    currentDrawingArea = 'B';

    // 开始绘制矩形
    drawTool.rectangle();

    // 显示提示信息
    showMessage("请在地图上绘制区域B（矩形）");
}

/**
 * 执行最短通行时间分析
 * @param {AMap.Map} map - 地图实例
 */
export function analyzeTravelTime(map) {
    console.log("执行最短通行时间分析...");

    if (!areaA || !areaB) {
        showMessage("请先绘制两个区域", "error");
        return;
    }

    // 获取分析时间范围
    const startTimeInput = document.getElementById('f9_start_time').value;
    const endTimeInput = document.getElementById('f9_end_time').value;

    if (!startTimeInput || !endTimeInput) {
        showMessage("请设置分析时间范围", "error");
        return;
    }

    // 获取两个矩形的边界框
    const boundsA = areaA.getBounds();
    const southwestA = boundsA.getSouthWest();
    const northeastA = boundsA.getNorthEast();

    const boundsB = areaB.getBounds();
    const southwestB = boundsB.getSouthWest();
    const northeastB = boundsB.getNorthEast();

    const queryData = {
        area_a: {
            min_lon: southwestA.lng,
            min_lat: southwestA.lat,
            max_lon: northeastA.lng,
            max_lat: northeastA.lat
        },
        area_b: {
            min_lon: southwestB.lng,
            min_lat: southwestB.lat,
            max_lon: northeastB.lng,
            max_lat: northeastB.lat
        },
        start_time: startTimeInput,
        end_time: endTimeInput
    };

    // 显示加载提示
    showMessage("正在分析最短通行时间，请稍候...", "info");

    // 调用后端API进行分析
    fetch('http://localhost:5000/api/travel_time/analyze', {
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
        // 分析成功，显示结果
        showMessage(`分析完成，最短通行时间: ${data.travel_time.toFixed(2)} 分钟`);

        // 显示最短通行时间的路径
        showTravelPath(map, data);
    })
    .catch(error => {
        console.error("最短通行时间分析失败:", error);
        showMessage(`分析失败: ${error.message}`, "error");
    });
}

/**
 * 显示最短通行时间的路径
 * @param {AMap.Map} map - 地图实例
 * @param {Object} data - 分析结果数据
 */
function showTravelPath(map, data) {
    // 清除之前的路径
    if (travelPath) {
        map.remove(travelPath);
        travelPath = null;
    }

    // 清除之前的标记
    travelMarkers.forEach(marker => map.remove(marker));
    travelMarkers = [];

    // 提取路径点
    const path = data.track.path.map(point => [point.lon, point.lat]);

    console.log("路径点数量:", path.length);

    // 只有当路径点不为空时才创建路径
    if (path.length > 0) {
        // 创建路径
        travelPath = new AMap.Polyline({
            path: path,
            strokeColor: '#00a1e4',
            strokeWeight: 6,
            strokeOpacity: 0.8,
            strokeStyle: 'solid',
            lineJoin: 'round',
            lineCap: 'round',
            zIndex: 50
        });

        // 添加路径到地图
        map.add(travelPath);

        // 自动调整地图视野以包含整个路径
        map.setFitView([travelPath]);

        // 添加起点和终点标记
        // 起点标记
        const startMarker = new AMap.Marker({
            position: path[0],
            content: '<div class="track-marker start-marker">起</div>',
            offset: new AMap.Pixel(-15, -15),
            zIndex: 101
        });

        // 终点标记
        const endMarker = new AMap.Marker({
            position: path[path.length - 1],
            content: '<div class="track-marker end-marker">终</div>',
            offset: new AMap.Pixel(-15, -15),
            zIndex: 101
        });

        // 添加标记到地图
        map.add([startMarker, endMarker]);
        travelMarkers.push(startMarker, endMarker);
    } else {
        // 如果没有路径点，则显示区域A和区域B的中心点
        const boundsA = areaA.getBounds();
        const centerA = boundsA.getCenter();

        const boundsB = areaB.getBounds();
        const centerB = boundsB.getCenter();

        // 创建一个简单的路径，连接A和B的中心点
        const simplePath = [
            [centerA.lng, centerA.lat],
            [centerB.lng, centerB.lat]
        ];

        // 创建虚线路径
        travelPath = new AMap.Polyline({
            path: simplePath,
            strokeColor: '#ff6600',
            strokeWeight: 4,
            strokeOpacity: 0.6,
            strokeStyle: 'dashed',
            lineJoin: 'round',
            lineCap: 'round',
            zIndex: 50
        });

        // 添加路径到地图
        map.add(travelPath);

        // 自动调整地图视野以包含整个路径
        map.setFitView([areaA, areaB, travelPath]);

        // 添加起点和终点标记
        const startMarker = new AMap.Marker({
            position: [centerA.lng, centerA.lat],
            content: '<div class="track-marker start-marker">起</div>',
            offset: new AMap.Pixel(-15, -15),
            zIndex: 101
        });

        const endMarker = new AMap.Marker({
            position: [centerB.lng, centerB.lat],
            content: '<div class="track-marker end-marker">终</div>',
            offset: new AMap.Pixel(-15, -15),
            zIndex: 101
        });

        // 添加标记到地图
        map.add([startMarker, endMarker]);
        travelMarkers.push(startMarker, endMarker);

        // 显示提示信息
        showMessage("未找到完整轨迹点，显示简化路径", "warning");
    }

    // 显示通行时间信息
    showTravelTimeInfo(map, data);
}

/**
 * 显示通行时间信息
 * @param {AMap.Map} map - 地图实例
 * @param {Object} data - 分析结果数据
 */
function showTravelTimeInfo(map, data) {
    // 创建结果容器
    const resultContainer = document.getElementById('f9-result-container');
    resultContainer.innerHTML = '';

    // 创建结果信息
    const resultInfo = document.createElement('div');
    resultInfo.className = 'travel-time-info';
    resultInfo.innerHTML = `
        <h4>最短通行时间分析结果</h4>
        <p><strong>出租车ID:</strong> ${data.taxi_id}</p>
        <p><strong>通行时间:</strong> ${data.travel_time.toFixed(2)} 分钟</p>
        <p><strong>出发时间:</strong> ${data.start_time}</p>
        <p><strong>到达时间:</strong> ${data.end_time}</p>
        <p><strong>轨迹点数:</strong> ${data.track.path.length}</p>
    `;

    // 添加结果信息到容器
    resultContainer.appendChild(resultInfo);
}

/**
 * 清除最短通行时间分析结果
 * @param {AMap.Map} map - 地图实例
 */
export function clearTravelTimeResults(map) {
    // 清除区域A和B及其标签
    if (areaA) {
        map.remove(areaA);
        if (areaA.label) {
            map.remove(areaA.label);
        }
        areaA = null;
    }
    if (areaB) {
        map.remove(areaB);
        if (areaB.label) {
            map.remove(areaB.label);
        }
        areaB = null;
    }

    // 清除路径
    if (travelPath) {
        map.remove(travelPath);
        travelPath = null;
    }

    // 清除标记
    travelMarkers.forEach(marker => map.remove(marker));
    travelMarkers = [];

    // 清除结果信息
    const resultContainer = document.getElementById('f9-result-container');
    if (resultContainer) {
        resultContainer.innerHTML = '';
    }

    showMessage("已清除最短通行时间分析结果");
}
