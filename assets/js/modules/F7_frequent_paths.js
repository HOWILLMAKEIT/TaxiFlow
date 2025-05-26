/**
 * 频繁路径分析模块 (F7功能)
 * 负责分析并展示全城最频繁的路径
 */

// 存储当前显示的路径图层
let currentPathsLayer = null;

/**
 * 设置加载状态
 * @param {boolean} isLoading - 是否处于加载状态
 */
function setLoading(isLoading) {
    const analyzeBtn = document.getElementById('btn_analyze_f7');
    const clearBtn = document.getElementById('btn_clear_f7');
    
    if (analyzeBtn && clearBtn) {
        if (isLoading) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = '分析中...';
            clearBtn.disabled = true;
        } else {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '查找频繁路径';
            clearBtn.disabled = false;
        }
    }
}

/**
 * 分析频繁路径
 * @param {Object} map - 高德地图实例
 * @param {number} k - 返回前k条最频繁路径
 * @param {number} minLength - 最小路径长度(米)
 */
export function analyzeFrequentPaths(map, k, minLength) {
    // 清除当前显示的路径
    clearFrequentPaths(map);
    
    // 显示加载状态
    setLoading(true);
    
    // 显示加载提示
    showMessage('正在分析频繁路径，这可能需要一些时间...', 'info');    console.log('发送频繁路径分析请求:', { k, minLength });
      // 调用后端API进行分析
    fetch('http://localhost:5000/api/frequent_paths/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            k: parseInt(k),
            min_distance: parseFloat(minLength)
        })
    })
    .then(response => {
        console.log('收到服务器响应:', response.status);
        if (!response.ok) {
            // 尝试解析错误响应
            return response.text().then(text => {
                console.error('错误响应内容:', text);
                try {
                    // 尝试将响应解析为JSON
                    const error = JSON.parse(text);
                    throw new Error(error.message || '分析失败');
                } catch (e) {
                    // 如果不是JSON，返回原始错误文本
                    throw new Error(text || '服务器响应错误');
                }
            });
        }
        return response.json();
    })    .then(result => {
        if (!result.paths || result.paths.length === 0) {
            showMessage('未找到满足条件的频繁路径', 'warning');
            return;
        }
        displayFrequentPaths(map, result.paths);
        showStatistics(result);
        showMessage('频繁路径分析完成', 'success');
    })
    .catch(error => {
        console.error('频繁路径分析失败:', error);
        showMessage(`分析失败: ${error.message || '服务器响应错误'}`, 'error');
    })
    .finally(() => {
        // 无论成功还是失败，都恢复按钮状态
        setLoading(false);
    });
}

/**
 * 显示频繁路径
 * @param {Object} map - 高德地图实例
 * @param {Array} paths - 路径数组
 */
function displayFrequentPaths(map, paths) {
    const polylines = [];
    
    // 创建路径信息列表容器
    const pathInfoContainer = document.createElement('div');
    pathInfoContainer.className = 'path-info-list';
    pathInfoContainer.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        max-height: 80vh;
        overflow-y: auto;
        z-index: 1000;
        width: 300px;
    `;
    
    // 添加标题
    const title = document.createElement('h3');
    title.textContent = '频繁路径列表';
    title.style.margin = '0 0 10px 0';
    pathInfoContainer.appendChild(title);
    
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
            }).open(map, path.points[Math.floor(path.points.length/2)]);
        });
        
        polylines.push(polyline);
        
        // 创建路径信息项
        const pathInfo = document.createElement('div');
        pathInfo.style.cssText = `
            padding: 10px;
            margin-bottom: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: ${color}10;
            cursor: pointer;
        `;
        
        // 添加路径信息内容
        const startPoint = path.points[0];
        const endPoint = path.points[path.points.length - 1];
        pathInfo.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 5px;">
                <div style="width: 12px; height: 12px; background: ${color}; margin-right: 8px; border-radius: 50%;"></div>
                <h4 style="margin: 0;">路径 #${index + 1}</h4>
            </div>
            <p style="margin: 5px 0;">频次：${path.frequency} 次</p>
            <p style="margin: 5px 0;">长度：${(path.length/1000).toFixed(2)} 公里</p>
            <p style="margin: 5px 0;">点数：${path.points.length} 个</p>
            <p style="margin: 5px 0;">起点：(${startPoint[0].toFixed(6)}, ${startPoint[1].toFixed(6)})</p>
            <p style="margin: 5px 0;">终点：(${endPoint[0].toFixed(6)}, ${endPoint[1].toFixed(6)})</p>
        `;
        
        // 添加点击事件，点击时高亮显示对应路径
        pathInfo.onclick = () => {
            // 移除所有路径的高亮
            polylines.forEach(p => p.setOptions({ strokeWeight: 8 }));
            // 高亮当前路径
            polyline.setOptions({ strokeWeight: 12 });
            // 将地图中心移动到路径中点
            map.setCenter(path.points[Math.floor(path.points.length/2)]);
        };
        
        pathInfoContainer.appendChild(pathInfo);
    });
    
    // 添加关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    closeButton.onclick = () => pathInfoContainer.remove();
    pathInfoContainer.appendChild(closeButton);
    
    // 将路径信息列表添加到地图容器
    map.getContainer().appendChild(pathInfoContainer);
    
    // 创建图层组
    currentPathsLayer = new AMap.OverlayGroup(polylines);
    map.add(currentPathsLayer);
    
    // 调整视野以适应所有路径
    map.setFitView(polylines);
    
    showMessage(`找到 ${paths.length} 条频繁路径`);
}

/**
 * 显示统计信息
 * @param {Object} data - 分析结果数据
 */
function showStatistics(data) {
    let queryTimeHtml = '';
    if (typeof data.query_time === 'number') {
        queryTimeHtml = `<p>查询用时：<b>${data.query_time.toFixed(2)}秒</b></p>`;
    }
    const statsHtml = `
        <div class="frequent-paths-stats" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <h4 style="margin: 0 0 10px 0;">频繁路径分析统计</h4>
            <p>分析的总路径数：<b>${data.total_paths_analyzed}</b></p>
            <p>满足条件的路径数：<b>${data.paths.length}</b></p>
            ${queryTimeHtml}
        </div>
    `;
    // 显示或更新统计信息
    let statsContainer = document.querySelector('.F7 .frequent-paths-stats');
    if (statsContainer) {
        statsContainer.innerHTML = statsHtml;
    } else {
        const f7Group = document.querySelector('.function-group.F7');
        if (f7Group) {
            const div = document.createElement('div');
            div.className = 'frequent-paths-stats';
            div.innerHTML = statsHtml;
            f7Group.appendChild(div);
        }
    }
}

/**
 * 清除当前显示的频繁路径
 * @param {Object} map - 高德地图实例
 */
export function clearFrequentPaths(map) {
    if (currentPathsLayer) {
        map.remove(currentPathsLayer);
        currentPathsLayer = null;
    }
    
    // 清除统计信息
    const statsContainer = document.querySelector('.frequent-paths-stats');
    if (statsContainer) {
        statsContainer.remove();
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