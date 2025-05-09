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

// 自动完成实例
let autoComplete = null;
// 地点搜索实例
let placeSearch = null;
// 当前标记
let currentMarker = null;
// 信息窗体
let infoWindow = null;

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

    // 初始化地址搜索功能
    initAddressSearch(createdMap);

    // 将创建好的地图实例赋值给模块顶层的 map 变量
    map = createdMap;
    console.log('地图实例已创建并赋值:', map); // 添加日志确认
    mapPromiseResolve(map); // 解析 Promise，传递 map 实例
}

/**
 * 初始化地址搜索功能
 * @param {AMap.Map} map - 地图实例
 */
function initAddressSearch(map) {
    // 创建搜索框和结果容器
    createSearchUI();

    // 初始化信息窗体
    infoWindow = new AMap.InfoWindow({
        offset: new AMap.Pixel(0, -30)
    });

    // 加载自动完成和地点搜索插件
    map.plugin(['AMap.AutoComplete', 'AMap.PlaceSearch'], function() {
        // 创建自动完成实例
        autoComplete = new AMap.AutoComplete({
            input: 'search-input',
            city: '全国', // 可以指定城市，如 '北京'
            citylimit: false, // 是否限制在当前城市
            outPutDirAuto: true // 输出结果自动定位
        });

        // 创建地点搜索实例
        placeSearch = new AMap.PlaceSearch({
            map: map,
            pageSize: 5, // 单页显示结果条数
            autoFitView: true // 是否自动调整地图视野使绘制的 Marker 点都处于视口的可见范围
        });

        // 监听自动完成选择事件
        autoComplete.on('select', function(e) {
            // 清空搜索结果列表
            hideSearchResults();

            // 使用选中的地点进行搜索
            placeSearch.search(e.poi.name, function(status, result) {
                if (status === 'complete' && result.info === 'OK') {
                    // 搜索成功，结果已经自动添加到地图上
                    const poi = result.poiList.pois[0];
                    addMarker(map, poi);
                } else {
                    // 搜索失败
                    console.error('地点搜索失败');
                }
            });
        });

        // 监听自动完成结果事件
        autoComplete.on('complete', function(result) {
            // 显示搜索结果
            showSearchResults(map, result.tips);
        });

        // 添加搜索框清除按钮事件
        document.getElementById('search-clear').addEventListener('click', function() {
            clearAddressSearch(map);
        });

        console.log('地址搜索功能初始化完成');
    });

    // 点击地图其他区域时隐藏搜索结果
    document.addEventListener('click', function(e) {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');

        if (e.target !== searchInput && (!searchResults || !searchResults.contains(e.target))) {
            hideSearchResults();
        }
    });
}

/**
 * 创建搜索框和结果容器
 */
function createSearchUI() {
    // 创建搜索框容器
    const searchBox = document.createElement('div');
    searchBox.className = 'search-box';
    searchBox.style.cssText = `
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        width: 300px;
        z-index: 100;
        background-color: white;
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        display: flex;
        padding: 5px;
    `;

    // 创建搜索输入框
    const searchInput = document.createElement('input');
    searchInput.id = 'search-input';
    searchInput.type = 'text';
    searchInput.placeholder = '请输入地址关键字';
    searchInput.style.cssText = `
        flex: 1;
        border: none;
        outline: none;
        padding: 8px;
        font-size: 14px;
    `;

    // 创建清除按钮
    const clearButton = document.createElement('button');
    clearButton.id = 'search-clear';
    clearButton.textContent = '清除';
    clearButton.style.cssText = `
        border: none;
        background-color: #f5f5f5;
        padding: 0 10px;
        cursor: pointer;
        border-radius: 2px;
        margin-left: 5px;
    `;

    // 创建搜索结果容器
    const searchResults = document.createElement('div');
    searchResults.id = 'search-results';
    searchResults.style.cssText = `
        position: absolute;
        top: 50px;
        left: 50%;
        transform: translateX(-50%);
        width: 300px;
        max-height: 300px;
        overflow-y: auto;
        background-color: white;
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        z-index: 100;
        display: none;
    `;

    // 添加到DOM
    searchBox.appendChild(searchInput);
    searchBox.appendChild(clearButton);
    document.getElementById('map_container').appendChild(searchBox);
    document.getElementById('map_container').appendChild(searchResults);

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .result-item {
            padding: 10px 15px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
        }
        .result-item:hover {
            background-color: #f0f0f0;
        }
        .result-name {
            font-weight: bold;
            margin-bottom: 3px;
        }
        .result-address {
            font-size: 13px;
            color: #666;
        }
        .marker-info {
            padding: 10px;
            max-width: 300px;
        }
        .marker-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .marker-address {
            font-size: 13px;
            color: #666;
        }
    `;
    document.head.appendChild(style);
}

/**
 * 显示搜索结果列表
 * @param {AMap.Map} map - 地图实例
 * @param {Array} tips - 搜索提示结果
 */
function showSearchResults(map, tips) {
    const searchResultsContainer = document.getElementById('search-results');
    if (!searchResultsContainer) return;

    searchResultsContainer.innerHTML = '';

    if (tips && tips.length > 0) {
        tips.forEach(tip => {
            const item = document.createElement('div');
            item.className = 'result-item';

            const name = document.createElement('div');
            name.className = 'result-name';
            name.textContent = tip.name;

            const address = document.createElement('div');
            address.className = 'result-address';
            address.textContent = tip.district;

            item.appendChild(name);
            item.appendChild(address);

            // 点击结果项
            item.addEventListener('click', function() {
                document.getElementById('search-input').value = tip.name;
                hideSearchResults();

                // 使用选中的地点进行搜索
                placeSearch.search(tip.name, function(status, result) {
                    if (status === 'complete' && result.info === 'OK') {
                        const poi = result.poiList.pois[0];
                        addMarker(map, poi);
                    } else {
                        console.error('地点搜索失败');
                    }
                });
            });

            searchResultsContainer.appendChild(item);
        });

        searchResultsContainer.style.display = 'block';
    } else {
        hideSearchResults();
    }
}

/**
 * 隐藏搜索结果列表
 */
function hideSearchResults() {
    const searchResultsContainer = document.getElementById('search-results');
    if (searchResultsContainer) {
        searchResultsContainer.style.display = 'none';
    }
}

/**
 * 添加标记
 * @param {AMap.Map} map - 地图实例
 * @param {Object} poi - 地点信息
 */
function addMarker(map, poi) {
    // 清除之前的标记
    if (currentMarker) {
        map.remove(currentMarker);
    }

    // 创建新标记
    currentMarker = new AMap.Marker({
        position: poi.location,
        title: poi.name,
        animation: 'AMAP_ANIMATION_DROP'
    });

    // 将标记添加到地图
    map.add(currentMarker);

    // 设置地图中心点
    map.setCenter(poi.location);

    // 显示信息窗体
    const content = `
        <div class="marker-info">
            <div class="marker-title">${poi.name}</div>
            <div class="marker-address">${poi.address || poi.pname + poi.cityname + poi.adname}</div>
        </div>
    `;
    infoWindow.setContent(content);
    infoWindow.open(map, poi.location);

    // 点击标记时显示信息窗体
    currentMarker.on('click', function() {
        infoWindow.open(map, poi.location);
    });
}

/**
 * 清除地址搜索结果
 * @param {AMap.Map} map - 地图实例
 */
function clearAddressSearch(map) {
    // 清除标记
    if (currentMarker) {
        map.remove(currentMarker);
        currentMarker = null;
    }

    // 关闭信息窗体
    if (infoWindow) {
        infoWindow.close();
    }

    // 清空搜索框
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }

    // 隐藏搜索结果
    hideSearchResults();
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