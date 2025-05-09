/**
 * 车流密度分析模块 (F4功能)
 * 负责根据指定的网格大小，分析不同区域的车流密度变化
 */

// 存储当前分析网格图层
let currentGridLayer = null;

// 北京市边界范围 (仅用于密度分析)
const BEIJING_BOUNDS = {
    min_lon: 115.7,
    max_lon: 117.4,
    min_lat: 39.4,
    max_lat: 41.6
};

// 北京市中心点
const BEIJING_CENTER = [116.397428, 39.90923];

/**
 * 设置地图视野到北京市范围
 * @param {Object} map - 高德地图实例
 */
function focusOnBeijing(map) {
    // 只是将视图中心移动到北京，但不限制范围
    map.setZoomAndCenter(10, BEIJING_CENTER);
}

/**
 * 设置加载状态
 * @param {boolean} isLoading 是否处于加载状态
 */
function setLoading(isLoading) {
    const analyzeBtn = document.getElementById('btn_analyze_density');
    const clearBtn = document.getElementById('btn_clear_density');
    
    if (analyzeBtn && clearBtn) {
        if (isLoading) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = '分析中...';
            clearBtn.disabled = true;
        } else {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '分析车流密度';
            clearBtn.disabled = false;
        }
    }
}

/**
 * 分析车流密度
 * @param {Object} map - 高德地图实例
 * @param {string} startTime - 开始时间 (格式: YYYY-MM-DDThh:mm)
 * @param {string} endTime - 结束时间 (格式: YYYY-MM-DDThh:mm)
 * @param {number} gridSize - 网格大小(米)
 */
export function analyzeDensity(map, startTime, endTime, gridSize) {
    // 将地图中心设置到北京，但允许用户自由移动
    focusOnBeijing(map);
    
    // 清除当前密度图层
    clearDensityLayer(map);
    
    // 检查输入参数
    if (!startTime || !endTime || !gridSize) {
        showMessage('请填写完整的分析参数', 'error');
        return;
    }
    
    // 设置加载状态
    setLoading(true);
    
    // 显示加载提示
    showMessage('正在分析车流密度，可能需要一些时间...', 'info');
    
    // 调用后端API进行密度分析
    fetch('http://localhost:5000/api/density/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            grid_size: Number(gridSize),
            start_time: startTime,
            end_time: endTime
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => Promise.reject(err));
        }
        return response.json();
    })
    .then(result => {
        if (result.status === 'success') {
            if (!result.data || !result.data.grid_data) {
                throw new Error('返回数据格式不正确');
            }
            
            // 检查是否有网格数据
            if (result.data.grid_data.length === 0) {
                showMessage('所选时间范围内没有数据可显示', 'warning');
                return;
            }
            
            // 显示密度网格
            displayDensityGrid(map, result.data);
            // 显示统计信息
            showDensityStats(result.data.stats);
            
            showMessage(`分析完成，显示 ${result.data.grid_data.length} 个网格`);
        } else {
            throw new Error(result.message || '密度分析失败');
        }
    })
    .catch(error => {
        console.error('密度分析失败:', error);
        showMessage(`密度分析失败: ${error.message}`, 'error');
    })
    .finally(() => {
        // 恢复按钮状态
        setLoading(false);
    });
}

/**
 * 显示密度网格
 * @param {Object} map - 高德地图实例
 * @param {Object} data - 密度分析结果数据
 */
function displayDensityGrid(map, data) {
    console.log('开始创建密度网格...');
    const polygons = [];
    
    if (!data.grid_data || !Array.isArray(data.grid_data)) {
        console.error('网格数据格式错误:', data);
        return;
    }
    
    data.grid_data.forEach((grid, index) => {
        // 获取网格边界和密度值
        const { bounds, density } = grid;
        
        if (!bounds || !bounds.sw || !bounds.ne) {
            console.error('网格边界数据错误:', grid);
            return;
        }
        
        // 计算RGB颜色值
        let r, g, b;
        
        if (density <= 5) {
            // 绿色到黄色 (0,255,0) -> (255,255,0)
            r = Math.round((density / 5) * 255);
            g = 255;
            b = 0;
        } else if (density <= 10) {
            // 黄色到橙色 (255,255,0) -> (255,128,0)
            r = 255;
            g = Math.round(255 - ((density - 5) / 5) * 127);
            b = 0;
        } else {
            // 橙色到红色 (255,128,0) -> (255,0,0)
            r = 255;
            g = Math.round(128 - ((density - 10) / 90) * 128);
            b = 0;
        }
        
        // 密度值越高，填充越不透明
        const opacity = 0.2 + (density / 100) * 0.5;
        
        try {
            // 创建网格多边形
            const path = [
                [bounds.sw[0], bounds.sw[1]],  // 左下
                [bounds.ne[0], bounds.sw[1]],  // 右下
                [bounds.ne[0], bounds.ne[1]],  // 右上
                [bounds.sw[0], bounds.ne[1]]   // 左上
            ];
            
            console.log(`创建第${index + 1}个网格:`, {
                path,
                fillColor: `rgb(${r},${g},${b})`,
                fillOpacity: opacity
            });
            
            const polygon = new AMap.Polygon({
                path: path,
                strokeWeight: 1,
                strokeColor: '#666',
                fillColor: `rgb(${r},${g},${b})`,
                fillOpacity: opacity
            });
            
            // 添加点击事件，显示密度信息
            polygon.on('click', () => {
                new AMap.InfoWindow({
                    content: `<div style="padding:10px;">
                                <h4 style="margin:0;color:#0288d1;">网格密度信息</h4>
                                <p style="margin:5px 0;">车流密度：<b>${density}</b></p>
                                <p style="margin:5px 0;">位置：经度 ${bounds.sw[0].toFixed(6)} - ${bounds.ne[0].toFixed(6)}</p>
                                <p style="margin:5px 0;">纬度 ${bounds.sw[1].toFixed(6)} - ${bounds.ne[1].toFixed(6)}</p>
                              </div>`,
                    offset: new AMap.Pixel(0, -25)
                }).open(map, polygon.getBounds().getCenter());
            });
            
            polygons.push(polygon);
        } catch (error) {
            console.error(`创建第${index + 1}个网格失败:`, error);
        }
    });
    
    console.log(`成功创建${polygons.length}个网格多边形`);
    
    // 将所有多边形添加到图层
    try {
        currentGridLayer = new AMap.OverlayGroup(polygons);
        map.add(currentGridLayer);
        console.log('网格图层已添加到地图');
        
        // 调整视野以适应所有网格，但不限制地图范围
        if (polygons.length > 0) {
            map.setFitView(polygons, false, [20, 20, 20, 20]);
            console.log('地图视野已调整到显示所有网格');
        }
    } catch (error) {
        console.error('添加网格图层失败:', error);
    }
    
    showMessage(`密度分析完成，共显示 ${polygons.length} 个网格`);
}

/**
 * 显示密度统计信息
 * @param {Object} stats - 统计信息
 */
function showDensityStats(stats) {
    // 在页面上显示统计信息的实现
    const statsHtml = `
        <div class="density-stats" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <h4 style="margin: 0 0 10px 0;">密度分析统计</h4>
            <p>总轨迹点数：<b>${stats.total_points}</b></p>
            <p>有效网格数：<b>${stats.total_grids}</b></p>
            <p>最大密度值：<b>${stats.max_density}</b></p>
            <p>平均密度值：<b>${stats.avg_density.toFixed(2)}</b></p>
            <p>分析时间段：<br>
               ${stats.time_range.start} 至<br>
               ${stats.time_range.end}</p>
        </div>
    `;
    
    // 如果页面上有显示统计信息的容器，则更新内容
    const statsContainer = document.querySelector('.F4 .density-stats');
    if (statsContainer) {
        statsContainer.innerHTML = statsHtml;
    } else {
        // 如果没有容器，则创建一个并添加到F4功能组
        const f4Group = document.querySelector('.function-group.F4');
        if (f4Group) {
            const div = document.createElement('div');
            div.className = 'density-stats';
            div.innerHTML = statsHtml;
            f4Group.appendChild(div);
        }
    }
}

/**
 * 清除当前密度图层
 * @param {Object} map - 高德地图实例
 */
export function clearDensityLayer(map) {
    if (currentGridLayer) {
        map.remove(currentGridLayer);
        currentGridLayer = null;
    }
    
    // 清除统计信息显示
    const statsContainer = document.querySelector('.density-stats');
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
        
        // 3秒后自动隐藏
        setTimeout(() => {
            if (msgElement.textContent === message) {
                msgElement.style.display = 'none';
            }
        }, 3000);
    }
}
