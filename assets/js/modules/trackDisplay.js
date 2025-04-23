/**
 * 轨迹显示模块 - 负责出租车轨迹的显示和管理
 */

// 存储当前显示的轨迹对象，便于后续清除
let currentTracks = [];

// 新的演示轨迹数据：从天安门广场到天坛公园
const sampleTrackData = [
    {
        id: "演示路线", // 更直观的ID
        path: [
            // 1. 天安门广场附近 (起点)
            [116.3915, 39.9056],
            // 2. 沿着前门大街向南
            [116.3950, 39.8980],
            // 3. 继续向南，接近天坛西门
            [116.4000, 39.8900],
            // 4. 天坛公园内或附近 (终点)
            [116.4075, 39.8835]
        ],
        timestamp: [ // 对应的时间戳 (示例)
            "2024-01-01 09:00:00",
            "2024-01-01 09:03:00",
            "2024-01-01 09:06:00",
            "2024-01-01 09:10:00"
        ],
        speed: [30, 25, 28, 20] // 对应的速度 (示例, km/h)
    }
    // 如果需要，可以添加更多演示路线
];

/**
 * 显示出租车轨迹
 * @param {AMap.Map} map - 地图实例
 * @param {Array} trackData - 可选，自定义轨迹数据，默认使用示例数据
 */
export function showTrack(map, trackData = sampleTrackData) {
    console.log("显示出租车轨迹...");
    
    // 轨迹样式配置
    const trackStyles = [
        {
            strokeColor: "#FF3333",  // 红色
            strokeWeight: 6,
            strokeOpacity: 0.8,
            lineJoin: 'round'
        },
        {
            strokeColor: "#3366FF",  // 蓝色
            strokeWeight: 6,
            strokeOpacity: 0.8,
            lineJoin: 'round'
        },
        {
            strokeColor: "#33CC33",  // 绿色
            strokeWeight: 6,
            strokeOpacity: 0.8,
            lineJoin: 'round'
        }
    ];
    
    // 先清除已有轨迹
    clearCurrentTracks(map);
    
    // 绘制每条轨迹
    trackData.forEach((track, index) => {
        // 选择轨迹样式 (循环使用样式)
        const style = trackStyles[index % trackStyles.length];
        
        // 创建轨迹折线
        const polyline = new AMap.Polyline({
            path: track.path,
            ...style,
            strokeDasharray: [10, 5]
        });
        
        // 将折线添加到地图
        polyline.setMap(map);
        
        // 创建起点标记
        const startMarker = new AMap.Marker({
            position: track.path[0],
            content: `<div class="track-marker start-marker">${track.id}</div>`,
            offset: new AMap.Pixel(-15, -15)
        });
        
        // 创建终点标记
        const endMarker = new AMap.Marker({
            position: track.path[track.path.length - 1],
            content: '<div class="track-marker end-marker"></div>',
            offset: new AMap.Pixel(-15, -15)
        });
        
        // 将标记添加到地图
        startMarker.setMap(map);
        endMarker.setMap(map);
        
        // 添加到当前轨迹列表中，便于后续清除
        currentTracks.push(polyline, startMarker, endMarker);
        
        // 为起点标记添加信息窗体
        const infoWindow = new AMap.InfoWindow({
            content: `
                <div class="track-info">
                    <h4>出租车信息</h4>
                    <p>车辆ID: ${track.id}</p>
                    <p>起始时间: ${track.timestamp[0]}</p>
                    <p>结束时间: ${track.timestamp[track.timestamp.length-1]}</p>
                    <p>平均速度: ${track.speed.reduce((a, b) => a + b, 0) / track.speed.length} km/h</p>
                </div>
            `,
            offset: new AMap.Pixel(0, -30)
        });
        
        // 点击起点标记时打开信息窗体
        startMarker.on('click', () => {
            infoWindow.open(map, startMarker.getPosition());
        });
    });
    
    // 调整地图视野以包含所有轨迹
    map.setFitView(currentTracks);
}

/**
 * 清除当前地图上显示的所有轨迹
 * @param {AMap.Map} map - 地图实例
 */
export function clearCurrentTracks(map) {
    console.log("清除当前轨迹...");
    
    if (currentTracks.length > 0) {
        // 移除所有轨迹对象
        currentTracks.forEach(obj => {
            map.remove(obj);
        });
        
        // 清空轨迹数组
        currentTracks = [];
    }
} 