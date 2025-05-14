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
    });
    
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