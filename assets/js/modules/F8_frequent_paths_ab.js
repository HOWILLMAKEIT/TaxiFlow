/**
 * F8 频繁路径分析模块 - 实现从A到B的最频繁路径分析
 */

// 存储当前的两个查询区域
let areaAF8 = null;
let areaBF8 = null;
let drawToolF8 = null;
let currentDrawingAreaF8 = 'A'; // 当前正在绘制的区域，'A'或'B'
let frequentPaths = []; // 存储分析结果路径

/**
 * 初始化F8频繁路径分析工具
 * @param {AMap.Map} map - 地图实例
 */
export function initFrequentPathsABTools(map) {
    console.log("初始化F8频繁路径分析工具...");

    if (!drawToolF8) {
        drawToolF8 = new AMap.MouseTool(map);
    }

    drawToolF8.on('draw', function(e) {
        const bounds = e.obj.getBounds();
        const rect = [
            bounds.getSouthWest().lng, bounds.getSouthWest().lat,
            bounds.getNorthEast().lng, bounds.getNorthEast().lat
        ];

        if (currentDrawingAreaF8 === 'A') {
            areaAF8 = rect;
            showMessage("区域A绘制完成，请绘制区域B", "info");
            addAreaLabel(map, e.obj, 'A');
            currentDrawingAreaF8 = 'B';
            drawToolF8.rectangle();
        } else {
            areaBF8 = rect;
            showMessage("区域B绘制完成，可以开始分析", "success");
            addAreaLabel(map, e.obj, 'B');
            drawToolF8.close();
        }
    });
}

/**
 * 开始绘制区域A
 * @param {AMap.Map} map - 地图实例
 */
export function startDrawAreaA_F8(map) {
    clearFrequentPathsABResults(map);
    currentDrawingAreaF8 = 'A';
    drawToolF8.rectangle();
    showMessage("请在地图上绘制区域A", "info");
}

/**
 * 开始绘制区域B
 * @param {AMap.Map} map - 地图实例
 */
export function startDrawAreaB_F8(map) {
    if (!areaAF8) {
        showMessage("请先绘制区域A", "error");
        return;
    }
    currentDrawingAreaF8 = 'B';
    drawToolF8.rectangle();
    showMessage("请在地图上绘制区域B", "info");
}

/**
 * 执行A到B的频繁路径分析
 * @param {AMap.Map} map - 地图实例
 */
export function analyzeFrequentPathsAB_F8(map) {
    console.log("执行A到B频繁路径分析...");

    if (!areaAF8 || !areaBF8) {
        showMessage("请先绘制区域A和区域B", "error");
        return;
    }

    const k = parseInt(document.getElementById('f8_k').value);

    // 设置加载状态
    setLoading(true);

    fetch('http://localhost:5000/api/frequent_paths_ab/analyze_ab', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            k,
            rect_a: areaAF8,
            rect_b: areaBF8
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const error = JSON.parse(text);
                    throw new Error(error.error || `服务器错误: ${response.status}`);
                } catch (e) {
                    throw new Error(text || `服务器错误: ${response.status}`);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        if (!data.paths || data.paths.length === 0) {
            showMessage("未找到符合条件的路径", "warning");
            return;
        }
        displayFrequentPaths(map, data.paths);
        displayPathStatistics(data);
        showMessage(`找到${data.paths.length}条频繁路径`, "success");
    })
    .catch(error => {
        console.error('分析失败:', error);
        if (error.message === 'Failed to fetch') {
            showMessage("无法连接到服务器，请确保后端服务已启动", "error");
        } else {
            showMessage(`分析失败: ${error.message}`, "error");
        }
    })
    .finally(() => {
        setLoading(false);
    });
}

/**
 * 设置加载状态
 * @param {boolean} isLoading - 是否处于加载状态
 */
function setLoading(isLoading) {
    const analyzeBtn = document.getElementById('btn_analyze_f8');
    const clearBtn = document.getElementById('btn_clear_f8');
    
    if (analyzeBtn && clearBtn) {
        if (isLoading) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = '分析中...';
            clearBtn.disabled = true;
        } else {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '分析A到B的频繁路径';
            clearBtn.disabled = false;
        }
    }
}

/**
 * 显示频繁路径
 * @param {AMap.Map} map - 地图实例
 * @param {Array} paths - 路径数组
 */
function displayFrequentPaths(map, paths) {
    // 清除现有路径
    clearFrequentPaths(map);
    
    paths.forEach((path, index) => {
        // 计算颜色 - 使用彩虹色谱
        const hue = (index / paths.length) * 360;
        const color = `hsl(${hue}, 100%, 50%)`;
        
        const polyline = new AMap.Polyline({
            path: path.points,
            strokeColor: color,
            strokeWeight: 8,
            strokeOpacity: 0.8,
            strokeStyle: "solid",
            showDir: true,
            lineJoin: 'round',
            lineCap: 'round'
        });
        
        // 添加点击事件显示路径信息
        polyline.on('click', () => {
            new AMap.InfoWindow({
                content: `
                    <div style="padding:10px;">
                        <h4 style="margin:0 0 5px;">频繁路径 #${index + 1}</h4>
                        <p>频次：${path.frequency} 次</p>
                        <p>长度：${(path.length/1000).toFixed(2)} 公里</p>
                    </div>
                `,
                offset: new AMap.Pixel(0, -25)
            }).open(map, getMidPoint(path.points));
        });
        
        map.add(polyline);
        frequentPaths.push(polyline);
    });
    
    // 调整视野以适应所有路径
    map.setFitView(frequentPaths);
}

/**
 * 显示路径统计信息
 * @param {Object} data - 分析结果数据
 */
function displayPathStatistics(data) {
    let container = document.getElementById('path-statistics-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'path-statistics-container';
        container.className = 'path-statistics';
        document.querySelector('.function-group').appendChild(container);
    }
    
    const totalPaths = data.paths.length;
    const totalFrequency = data.paths.reduce((sum, path) => sum + path.frequency, 0);
    const avgLength = data.paths.reduce((sum, path) => sum + path.length, 0) / totalPaths;
    
    container.innerHTML = `
        <h5>统计信息</h5>
        <p>总路径数：${totalPaths}</p>
        <p>总频次：${totalFrequency}</p>
        <p>平均路径长度：${(avgLength/1000).toFixed(2)} 公里</p>
    `;
}

/**
 * 获取路径中点
 * @param {Array} points - 路径点数组
 * @returns {Array} 中点坐标
 */
function getMidPoint(points) {
    const midIndex = Math.floor(points.length / 2);
    return points[midIndex];
}

/**
 * 添加区域标签
 * @param {AMap.Map} map - 地图实例
 * @param {AMap.Rectangle} rect - 矩形区域
 * @param {string} label - 标签文本
 */
function addAreaLabel(map, rect, label) {
    const bounds = rect.getBounds();
    const center = bounds.getCenter();
    
    const marker = new AMap.Marker({
        position: center,
        content: `<div class="area-label">${label}</div>`,
        offset: new AMap.Pixel(-10, -10)
    });
    
    map.add(marker);
}

/**
 * 清除F8频繁路径分析结果
 * @param {AMap.Map} map - 地图实例
 */
export function clearFrequentPathsABResults(map) {
    // 清除区域
    if (areaAF8 || areaBF8) {
        map.getAllOverlays().forEach(overlay => {
            if (overlay instanceof AMap.Rectangle || 
                (overlay instanceof AMap.Marker && overlay.getContent().includes('area-label'))) {
                map.remove(overlay);
            }
        });
        areaAF8 = null;
        areaBF8 = null;
    }

    // 清除路径
    clearFrequentPaths(map);
    
    // 清除统计信息
    const statContainer = document.getElementById('path-statistics-container');
    if (statContainer) statContainer.remove();
    
    showMessage("已清除A到B频繁路径分析结果", "info");
}

/**
 * 清除当前显示的所有频繁路径
 * @param {AMap.Map} map - 地图实例
 */
export function clearFrequentPaths(map) {
    if (frequentPaths.length > 0) {
        frequentPaths.forEach(path => map.remove(path));
        frequentPaths = [];
    }
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
        
        setTimeout(() => {
            if (msgElement.textContent === message) {
                msgElement.style.display = 'none';
            }
        }, 3000);
    }
}