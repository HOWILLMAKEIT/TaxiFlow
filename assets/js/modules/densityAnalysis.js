/**
 * 车流密度分析模块 (F4功能)
 * 负责根据指定的网格大小，分析不同区域的车流密度变化
 */

// 存储当前分析网格图层
let currentGridLayer = null;

/**
 * 分析车流密度
 * @param {Object} map - 高德地图实例
 * @param {string} startTime - 开始时间 (格式: YYYY-MM-DDThh:mm)
 * @param {string} endTime - 结束时间 (格式: YYYY-MM-DDThh:mm)
 * @param {number} gridSize - 网格大小(米)
 */
export function analyzeDensity(map, startTime, endTime, gridSize) {
    // 清除当前密度图层
    clearDensityLayer(map);
    
    // 检查输入参数
    if (!startTime || !endTime || !gridSize) {
        console.error('密度分析：参数不完整');
        return;
    }
    
    // 将网格大小转为数字
    gridSize = parseFloat(gridSize);
    
    console.log(`分析时间段 ${startTime} 到 ${endTime} 内，网格大小 ${gridSize}米 的车流密度`);
    
    // TODO: 实际应用中，需要加载指定时间段内的GPS数据，然后划分网格并统计每个网格内的车辆数
    // 这里仅作为示例，随机生成一些密度数据
    generateMockDensityData(map, gridSize);
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
}

/**
 * 生成模拟的密度数据（仅作为示例）
 * @param {Object} map - 高德地图实例
 * @param {number} gridSize - 网格大小(米)
 */
function generateMockDensityData(map, gridSize) {
    // 获取地图当前范围
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest(); // 西南角
    const ne = bounds.getNorthEast(); // 东北角
    
    // 计算网格数量
    // 注意：这里简化处理，实际上需要考虑经纬度转换为米的计算
    const distance = AMap.GeometryUtil.distance([sw.lng, sw.lat], [ne.lng, ne.lat]);
    const gridSizeDegree = gridSize / 111000; // 粗略转换，1度约等于111公里
    
    const gridCountLng = Math.ceil((ne.lng - sw.lng) / gridSizeDegree);
    const gridCountLat = Math.ceil((ne.lat - sw.lat) / gridSizeDegree);
    
    // 创建多边形数组
    const polygons = [];
    
    // 为每个网格创建一个填充色不同的多边形
    for (let i = 0; i < gridCountLng; i++) {
        for (let j = 0; j < gridCountLat; j++) {
            // 计算网格四个角的坐标
            const gridLngStart = sw.lng + i * gridSizeDegree;
            const gridLatStart = sw.lat + j * gridSizeDegree;
            const gridLngEnd = sw.lng + (i + 1) * gridSizeDegree;
            const gridLatEnd = sw.lat + (j + 1) * gridSizeDegree;
            
            // 随机生成密度值 (0-100)
            const density = Math.floor(Math.random() * 100);
            
            // 基于密度值生成颜色 (绿 -> 黄 -> 红)
            const r = density < 50 ? Math.round(density * 5.1) : 255;
            const g = density < 50 ? 255 : Math.round(255 - (density - 50) * 5.1);
            const b = 0;
            
            // 密度值越高，填充越不透明
            const opacity = 0.1 + (density / 100) * 0.6;
            
            // 创建多边形
            const polygon = new AMap.Polygon({
                path: [
                    [gridLngStart, gridLatStart],
                    [gridLngEnd, gridLatStart],
                    [gridLngEnd, gridLatEnd],
                    [gridLngStart, gridLatEnd]
                ],
                strokeWeight: 1,
                strokeColor: '#666',
                fillColor: `rgb(${r},${g},${b})`,
                fillOpacity: opacity
            });
            
            // 添加点击事件，显示密度信息
            polygon.on('click', function() {
                const center = polygon.getBounds().getCenter();
                new AMap.InfoWindow({
                    content: `<div style="padding:10px;">
                                <h4 style="margin:0;color:#0288d1;">网格密度信息</h4>
                                <p style="margin:5px 0;">车流密度等级：<b>${density}</b></p>
                              </div>`,
                    offset: new AMap.Pixel(0, -25),
                    closeWhenClickMap: true
                }).open(map, [center.lng, center.lat]);
            });
            
            polygons.push(polygon);
        }
    }
    
    // 将所有多边形添加到图层
    currentGridLayer = new AMap.OverlayGroup(polygons);
    map.add(currentGridLayer);
} 