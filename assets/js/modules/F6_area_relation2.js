/**
 * 区域关联分析2模块 - 提供单区域与其他区域间车流量分析功能
 */

// 存储当前的查询区域
let targetRect = null;
let drawTool = null;
let flowChart = null; // 存储流量图表实例

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
 * 初始化区域关联分析2工具
 * @param {AMap.Map} map - 地图实例
 */
export function initAreaRelation2Tools(map) {
    console.log("初始化区域关联分析2工具...");

    // 使用现有的绘制工具或创建新的
    if (!drawTool) {
        drawTool = new AMap.MouseTool(map);
    }

    // 监听绘制完成事件
    drawTool.on('draw', function(e) {
        if (targetRect) {
            map.remove(targetRect);
            if (targetRect.label) {
                map.remove(targetRect.label);
            }
        }
        targetRect = e.obj;
        targetRect.setOptions({
            fillColor: '#1791fc',
            fillOpacity: 0.3,
            strokeColor: '#1791fc',
            strokeWeight: 2
        });

        // 添加标签
        addAreaLabel(map, targetRect, '目标区域');

        // 提示可以开始分析
        showMessage("目标区域绘制完成，请设置时间和间隔，然后点击分析流量按钮");

        // 停止绘制工具
        drawTool.close();
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
        text: label,
        position: [center.lng, center.lat],
        style: {
            'background-color': '#1791fc',
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
    area.label = textMarker;
}

/**
 * 开始绘制目标区域
 * @param {AMap.Map} map - 地图实例
 */
export function startDrawTargetArea(map) {
    // 清除之前的结果
    clearAreaRelation2Results(map);

    // 开始绘制矩形
    drawTool.rectangle();

    // 显示提示信息
    showMessage("请在地图上绘制目标区域（矩形）");
}

/**
 * 执行区域关联分析2
 * @param {AMap.Map} map - 地图实例
 */
export function executeAreaRelation2Analysis(map) {
    console.log("执行区域关联分析2...");

    if (!targetRect) {
        showMessage("请先绘制目标区域", "error");
        return;
    }

    // 获取分析时间范围
    const startTimeInput = document.getElementById('f6_start_time').value;
    const endTimeInput = document.getElementById('f6_end_time').value;

    if (!startTimeInput || !endTimeInput) {
        showMessage("请设置分析时间范围", "error");
        return;
    }

    // 获取矩形的边界框
    const bounds = targetRect.getBounds();
    const southwest = bounds.getSouthWest(); // 左下角
    const northeast = bounds.getNorthEast(); // 右上角

    const queryData = {
        inner_rect: {
            min_lon: southwest.lng,
            min_lat: southwest.lat,
            max_lon: northeast.lng,
            max_lat: northeast.lat
        },
        start_time: startTimeInput,
        end_time: endTimeInput
    };

    // 显示加载提示
    showMessage("正在分析区域流量，请稍候...", "info");

    // 调用后端API进行分析
    fetch('http://localhost:5000/api/area_relation2/analyze', {
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
        showMessage("区域关联分析完成");

        // 显示流量变化图表
        showFlowChart(data);
    })
    .catch(error => {
        console.error("区域关联分析失败:", error);
        showMessage(`分析失败: ${error.message}`, "error");
    });
}

/**
 * 显示流量变化图表
 * @param {Object} data - 分析结果数据
 */
function showFlowChart(data) {
    // 准备图表数据
    const timeLabels = data.time_slots.map(slot => slot.label);
    const innerToOuter = data.time_slots.map(slot => slot.inner_to_outer);
    const outerToInner = data.time_slots.map(slot => slot.outer_to_inner);

    // 创建或获取图表容器
    let chartContainer = document.getElementById('flow-chart-container');
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'flow-chart-container';
        chartContainer.style.width = '100%';
        chartContainer.style.height = '300px';
        document.getElementById('f6-result-container').appendChild(chartContainer);
    }

    // 如果已有图表实例，先销毁
    if (flowChart) {
        flowChart.dispose();
    }

    // 使用ECharts绘制图表
    flowChart = echarts.init(chartContainer);

    // 获取自定义提示框容器
    const tooltipDom = document.getElementById('chart-tooltip');

    // 设置图表选项
    const option = {
        title: {
            text: '目标区域与其他区域间车流量变化',
            left: 'center',
            top: 10,
            textStyle: {
                fontSize: 16
            }
        },
        tooltip: {
            show: false // 禁用默认提示框
        },
        legend: {
            data: ['流出到其他区域', '从其他区域流入'],
            top: 40,
            left: 'center'
        },
        grid: {
            top: 80,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: timeLabels
        },
        yAxis: {
            type: 'value',
            name: '车辆数'
        },
        series: [
            {
                name: '流出到其他区域',
                type: 'line',
                data: innerToOuter,
                itemStyle: {
                    color: '#1791fc'
                }
            },
            {
                name: '从其他区域流入',
                type: 'line',
                data: outerToInner,
                itemStyle: {
                    color: '#ff6600'
                }
            }
        ]
    };

    // 渲染图表
    flowChart.setOption(option);

    // 添加总计信息
    const totalInfo = document.createElement('div');
    totalInfo.style.cssText = 'margin-top: 10px; text-align: center; font-size: 12px; color: #666;';
    totalInfo.innerHTML = `总计: 流出 ${data.total.inner_to_outer} 辆, 流入 ${data.total.outer_to_inner} 辆`;
    document.getElementById('f6-result-container').appendChild(totalInfo);

    // 添加自定义提示框事件
    flowChart.on('mouseover', function(params) {
        const tooltipDom = document.getElementById('chart-tooltip');
        if (tooltipDom) {
            // 构建提示框内容
            let content = `<div style="font-weight:bold;margin-bottom:8px;">${params.name}</div>`;

            // 查找对应时间点的数据
            const index = timeLabels.indexOf(params.name);
            if (index !== -1) {
                content += `<div style="display:flex;align-items:center;margin:5px 0;">
                    <span style="display:inline-block;width:10px;height:10px;background-color:#1791fc;margin-right:5px;"></span>
                    <span style="font-weight:bold;">流出到其他区域:</span>
                    <span style="margin-left:5px;">${innerToOuter[index]} 辆</span>
                </div>`;
                content += `<div style="display:flex;align-items:center;margin:5px 0;">
                    <span style="display:inline-block;width:10px;height:10px;background-color:#ff6600;margin-right:5px;"></span>
                    <span style="font-weight:bold;">从其他区域流入:</span>
                    <span style="margin-left:5px;">${outerToInner[index]} 辆</span>
                </div>`;
            }

            // 设置提示框内容和位置
            tooltipDom.innerHTML = content;
            tooltipDom.style.display = 'block';

            // 计算位置 - 显示在鼠标左侧
            const containerRect = document.getElementById('map_container').getBoundingClientRect();
            const tooltipRect = tooltipDom.getBoundingClientRect();

            // 确保提示框在地图区域内且在鼠标左侧
            let left = params.event.event.clientX - tooltipRect.width - 20;
            let top = params.event.event.clientY - tooltipRect.height / 2;

            // 边界检查
            if (left < containerRect.left) {
                left = params.event.event.clientX + 20; // 如果左侧空间不足，显示在右侧
            }
            if (top < containerRect.top) {
                top = containerRect.top + 10;
            } else if (top + tooltipRect.height > containerRect.bottom) {
                top = containerRect.bottom - tooltipRect.height - 10;
            }

            tooltipDom.style.left = left + 'px';
            tooltipDom.style.top = top + 'px';
        }
    });

    // 鼠标移动时更新提示框位置
    flowChart.on('mousemove', function(params) {
        const tooltipDom = document.getElementById('chart-tooltip');
        if (tooltipDom && tooltipDom.style.display === 'block') {
            // 计算位置 - 显示在鼠标左侧
            const containerRect = document.getElementById('map_container').getBoundingClientRect();
            const tooltipRect = tooltipDom.getBoundingClientRect();

            // 确保提示框在地图区域内且在鼠标左侧
            let left = params.event.event.clientX - tooltipRect.width - 20;
            let top = params.event.event.clientY - tooltipRect.height / 2;

            // 边界检查
            if (left < containerRect.left) {
                left = params.event.event.clientX + 20; // 如果左侧空间不足，显示在右侧
            }
            if (top < containerRect.top) {
                top = containerRect.top + 10;
            } else if (top + tooltipRect.height > containerRect.bottom) {
                top = containerRect.bottom - tooltipRect.height - 10;
            }

            tooltipDom.style.left = left + 'px';
            tooltipDom.style.top = top + 'px';
        }
    });

    // 鼠标移出图表时隐藏提示框
    flowChart.on('mouseout', function() {
        const tooltipDom = document.getElementById('chart-tooltip');
        if (tooltipDom) {
            tooltipDom.style.display = 'none';
        }
    });
}

/**
 * 清除区域关联分析2结果
 * @param {AMap.Map} map - 地图实例
 */
export function clearAreaRelation2Results(map) {
    // 清除目标区域及其标签
    if (targetRect) {
        map.remove(targetRect);
        if (targetRect.label) {
            map.remove(targetRect.label);
        }
        targetRect = null;
    }

    // 清除图表
    if (flowChart) {
        try {
            flowChart.dispose();
        } catch (e) {
            console.error('清除图表时出错:', e);
        }
        flowChart = null;
    }

    const chartContainer = document.getElementById('flow-chart-container');
    if (chartContainer && chartContainer.parentNode) {
        chartContainer.parentNode.removeChild(chartContainer);
    }

    // 清除总计信息和其他结果
    const resultContainer = document.getElementById('f6-result-container');
    if (resultContainer) {
        resultContainer.innerHTML = '';
    }

    // 隐藏自定义提示框
    const tooltipDom = document.getElementById('chart-tooltip');
    if (tooltipDom) {
        tooltipDom.style.display = 'none';
    }

    showMessage("已清除区域关联分析2结果");
}
