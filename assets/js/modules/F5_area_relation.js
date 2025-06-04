
/**
 * 区域关联分析模块 - 提供双区域间车流量分析功能
 */

// 存储当前的两个查询区域
let areaA = null;
let areaB = null;
let drawTool = null;
let currentDrawingArea = 'A'; // 当前正在绘制的区域，'A'或'B'
let flowChart = null; // 存储流量图表实例

/**
 * 初始化区域关联分析工具
 * @param {AMap.Map} map - 地图实例
 */
export function initAreaRelationTools(map) {
    console.log("初始化区域关联分析工具...");

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
            showMessage("区域B绘制完成，请设置时间和间隔，然后点击分析流量按钮");

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
    clearAreaRelationResults(map);

    // 设置当前绘制的区域为A
    currentDrawingArea = 'A';

    // 开始绘制矩形
    drawTool.rectangle();

    // 显示提示信息
    showMessage("请在地图上绘制区域A（矩形）");
}

/**
 * 执行区域关联分析
 * @param {AMap.Map} map - 地图实例
 */
export function executeAreaRelationAnalysis(map) {
    console.log("执行区域关联分析...");

    if (!areaA || !areaB) {
        showMessage("请先绘制两个区域", "error");
        return;
    }

    // 获取分析时间范围和间隔
    const startTimeInput = document.getElementById('f5_start_time').value;
    const endTimeInput = document.getElementById('f5_end_time').value;
    const intervalInput = document.getElementById('f5_interval').value || '60'; // 默认60分钟

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
        end_time: endTimeInput,
        interval: parseInt(intervalInput)
    };

    // 显示加载提示
    showMessage("正在分析区域间流量，请稍候...", "info");

    // 调用后端API进行分析
    fetch('http://localhost:5000/api/area_relation/analyze', {
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
 * @param {Object} data - 流量数据
 */
function showFlowChart(data) {
    // 创建或获取图表容器
    let chartContainer = document.getElementById('flow-chart-container');
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'flow-chart-container';
        chartContainer.style.width = '100%';
        chartContainer.style.height = '300px';
        document.getElementById('f5-result-container').appendChild(chartContainer);
    }

    // 如果已有图表实例，先销毁
    if (flowChart) {
        flowChart.dispose();
    }

    // 使用ECharts绘制图表
    flowChart = echarts.init(chartContainer);

    // 准备图表数据
    const timeLabels = data.time_slots.map(slot => slot.label);
    const aToB = data.time_slots.map(slot => slot.a_to_b);
    const bToA = data.time_slots.map(slot => slot.b_to_a);

    // 获取自定义提示框容器
    const tooltipDom = document.getElementById('chart-tooltip');

    // 设置图表选项
    const option = {
        title: {
            text: '区域间车流量变化',
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
            data: ['A到B', 'B到A'],
            top: 40,
            left: 'center'
        },
        grid: {
            top: 80,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            name: "时间"
        },
        yAxis: {
            type: 'value',
            name: '车辆数'
        },
        series: [
            {
                name: 'A到B',
                type: 'line',
                data: aToB,
                itemStyle: {
                    color: '#1791fc'
                }
            },
            {
                name: 'B到A',
                type: 'line',
                data: bToA,
                itemStyle: {
                    color: '#ff6600'
                }
            }
        ]
    };

    // 渲染图表
    flowChart.setOption(option);

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
                    <span style="font-weight:bold;">A到B:</span>
                    <span style="margin-left:5px;">${aToB[index]} 辆</span>
                </div>`;
                content += `<div style="display:flex;align-items:center;margin:5px 0;">
                    <span style="display:inline-block;width:10px;height:10px;background-color:#ff6600;margin-right:5px;"></span>
                    <span style="font-weight:bold;">B到A:</span>
                    <span style="margin-left:5px;">${bToA[index]} 辆</span>
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
 * 清除区域关联分析结果
 * @param {AMap.Map} map - 地图实例
 */
export function clearAreaRelationResults(map) {
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

    // 隐藏自定义提示框
    const tooltipDom = document.getElementById('chart-tooltip');
    if (tooltipDom) {
        tooltipDom.style.display = 'none';
    }

    showMessage("已清除区域关联分析结果");
}

/**
 * 显示消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (info, warning, error)
 */
function showMessage(message, type = 'info') {
    const messageBox = document.getElementById('message-box');
    if (messageBox) {
        messageBox.textContent = message;
        messageBox.className = `message ${type}`;
        messageBox.style.display = 'block';

        // 3秒后自动隐藏
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 3000);
    }
}







