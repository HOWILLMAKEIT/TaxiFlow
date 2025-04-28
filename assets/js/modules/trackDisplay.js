/**
 * 轨迹显示模块 - 负责出租车轨迹的显示和管理
 */

// 存储当前显示的轨迹对象，便于后续清除
let currentTracks = [];
// 存储当前的轨迹动画实例
let currentAnimation = null;

/**
 * 显示出租车轨迹
 * @param {AMap.Map} map - 地图实例
 * @param {Array} trackData - 可选，自定义轨迹数据，默认使用示例数据
 */
export function showTrack(map, trackData) {
    console.log("显示出租车轨迹...");
    
    // 轨迹样式配置
    const trackStyles = [
        {
            strokeColor: "#FF3333",  // 红色
            strokeWeight: 5,
            strokeOpacity: 0.8,
            lineJoin: 'round',
            isOutline: false,
            borderWeight: 1
        },
        {
            strokeColor: "#3366FF",  // 蓝色
            strokeWeight: 5,
            strokeOpacity: 0.8,
            lineJoin: 'round',
            isOutline: false,
            borderWeight: 1
        },
        {
            strokeColor: "#33CC33",  // 绿色
            strokeWeight: 5,
            strokeOpacity: 0.8,
            lineJoin: 'round',
            isOutline: false,
            borderWeight: 1
        }
    ];
    
    // 先清除已有轨迹
    clearCurrentTracks(map);
    
    // 绘制每条轨迹
    trackData.forEach((track, index) => {
        // 选择轨迹样式 (循环使用样式)
        const style = trackStyles[index % trackStyles.length];
        
        // 创建贝塞尔曲线轨迹
        const polyline = new AMap.BezierCurve({
            path: track.path,
            ...style,
            showDir: true, // 显示方向箭头
            geodesic: true, // 启用大地线模式，使曲线更平滑
            isOutline: true, // 显示轮廓
            outlineColor: '#ffffff', // 轮廓颜色
            borderWeight: 2, // 轮廓宽度
            zIndex: 50 // 确保轨迹在节点标记下方显示
        });
        
        // 将折线添加到地图
        polyline.setMap(map);
        
        // 创建起点标记
        const startMarker = new AMap.Marker({
            position: track.path[0],
            content: `<div class="track-marker start-marker">${track.id}</div>`,
            offset: new AMap.Pixel(-15, -15),
            zIndex: 110 // 确保起终点在轨迹和节点上方
        });
        
        // 创建终点标记
        const endMarker = new AMap.Marker({
            position: track.path[track.path.length - 1],
            content: '<div class="track-marker end-marker"></div>',
            offset: new AMap.Pixel(-15, -15),
            zIndex: 110
        });
        
        // 将标记添加到地图
        startMarker.setMap(map);
        endMarker.setMap(map);
        
        // 添加到当前轨迹列表中，便于后续清除
        currentTracks.push(polyline, startMarker, endMarker);
        
        // 为每个节点添加小圆点标记
        track.path.forEach((point, pointIndex) => {
            // 跳过起点和终点，因为已经有专门的标记
            if (pointIndex > 0 && pointIndex < track.path.length - 1) {
                const nodeMarker = new AMap.Marker({
                    position: point,
                    content: `<div class="node-marker" style="width:8px;height:8px;border-radius:50%;background:${style.strokeColor};border:1px solid white;"></div>`,
                    offset: new AMap.Pixel(-4, -4),
                    zIndex: 100 // 确保节点在轨迹上方
                });
                nodeMarker.setMap(map);
                currentTracks.push(nodeMarker);
            }
        });
        
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
    
    // 调整地图视野
    const fitViewElements = currentTracks.filter(obj => {
        return obj && typeof obj.getBounds === 'function';
    });
    
    if (fitViewElements.length > 0) {
        map.setFitView(fitViewElements);
    }
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
            if (obj.remove && typeof obj.remove === 'function') {
                obj.remove();
            } else {
                map.remove(obj);
            }
        });
        
        // 清空轨迹数组
        currentTracks = [];
    }
    
    // 确保动画被停止
    if (currentAnimation) {
        currentAnimation.stop();
        currentAnimation = null;
    }
}

