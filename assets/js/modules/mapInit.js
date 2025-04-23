/**
 * 地图初始化模块 - 负责地图的加载、配置和基本操作
 */

// 默认地图中心点 - 北京市中心
const DEFAULT_CENTER = [116.397428, 39.90923];
const DEFAULT_ZOOM = 12;

// 在模块顶层声明 map 变量，初始值为 null
let map = null;
// 创建一个 Promise，用于通知地图初始化完成
let mapPromiseResolve = null;
const mapPromise = new Promise(resolve => {
    mapPromiseResolve = resolve;
});

// 测试坐标数据
const testTrackData = [
    [116.368904, 39.913423],
    [116.382122, 39.901176],
    [116.387271, 39.912501],
    [116.398258, 39.904600]
];

/**
 * 初始化高德地图
 * @param {string} container - 地图容器ID
 * @returns {AMap.Map} 地图实例
 */
function initMap(container) {
    // 创建地图实例
    const createdMap = new AMap.Map(container, {
        viewMode: '2D',           // 2D模式
        zoom: DEFAULT_ZOOM,       // 初始缩放级别
        center: DEFAULT_CENTER,   // 初始地图中心点
        resizeEnable: true,       // 是否监控地图容器尺寸变化
    });

    // 添加地图控件
    createdMap.plugin([
        'AMap.ToolBar',
        'AMap.Scale',
        'AMap.HawkEye',
        'AMap.MapType',
        'AMap.Geolocation'
        // MouseTool 和 GeometryUtil 已在 HTML 中通过 URL 参数加载
    ], function() {
        // 添加工具条控件
        createdMap.addControl(new AMap.ToolBar());
        // 添加比例尺控件
        createdMap.addControl(new AMap.Scale());
        // 添加鹰眼控件
        createdMap.addControl(new AMap.HawkEye({isOpen: false}));
        // 添加地图类型切换控件
        createdMap.addControl(new AMap.MapType());
        // 添加定位控件
        createdMap.addControl(new AMap.Geolocation());
    });

    // 添加地图事件监听器示例
    createdMap.on('click', function(e) {
        console.log('点击位置:', e.lnglat.getLng(), e.lnglat.getLat());
    });

    // 将创建好的地图实例赋值给模块顶层的 map 变量
    map = createdMap;
    console.log('地图实例已创建并赋值:', map); // 添加日志确认
    mapPromiseResolve(map); // 解析 Promise，传递 map 实例
}

/**
 * 绘制测试轨迹
 * @param {AMap.Map} map - 地图实例
 * @returns {AMap.Polyline} 轨迹实例
 */
function drawTestTrack(map) {
    // 创建折线实例
    const polyline = new AMap.Polyline({
        path: testTrackData,
        isOutline: true,
        outlineColor: '#ffeeff',
        borderWeight: 2,
        strokeColor: "#3366FF", 
        strokeOpacity: 1,
        strokeWeight: 6,
        strokeStyle: "solid",
        strokeDasharray: [10, 5],
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 50,
    });

    // 将折线添加至地图实例
    polyline.setMap(map);
    
    // 缩放地图到合适的视野级别
    map.setFitView([polyline]);
    
    return polyline;
}

document.addEventListener('DOMContentLoaded', function() {
    // 短暂延迟确保容器尺寸已计算
    setTimeout(() => {
        initMap('map_container'); // 调用初始化函数，它会修改顶层的 map 变量并解析 Promise
    }, 100);
});

// 导出 Promise 和其他函数，不再直接导出 map
export { mapPromise, initMap, drawTestTrack }; 