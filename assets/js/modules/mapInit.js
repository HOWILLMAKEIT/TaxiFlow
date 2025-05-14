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

// 搜索相关变量
let autoComplete = null;
let placeSearch = null;
let currentMarker = null;
let infoWindow = null;

/**
 * 初始化高德地图
 * @param {string} container - 地图容器ID
 * @returns {AMap.Map} 地图实例
 */
function initMap(container) {
    // 创建地图实例
    const createdMap = new AMap.Map(container, {
        viewMode: '2D',
        zoom: DEFAULT_ZOOM,
        center: DEFAULT_CENTER,
        resizeEnable: true,
    });

    // 添加地图控件
    createdMap.plugin(['AMap.ToolBar', 'AMap.Scale'], function() {
        createdMap.addControl(new AMap.ToolBar());
        createdMap.addControl(new AMap.Scale());
    });

    // 初始化搜索功能
    initSearch(createdMap);

    // 将创建好的地图实例赋值给模块顶层的 map 变量
    map = createdMap;
    mapPromiseResolve(map);
    return createdMap;
}

/**
 * 初始化搜索功能
 * @param {AMap.Map} map - 地图实例
 */
function initSearch(map) {
    // 创建搜索UI
    createSearchUI(map);

    // 初始化信息窗体
    infoWindow = new AMap.InfoWindow({offset: new AMap.Pixel(0, -30)});

    // 加载搜索插件
    map.plugin(['AMap.AutoComplete', 'AMap.PlaceSearch'], function() {
        // 初始化自动完成
        autoComplete = new AMap.AutoComplete({
            input: 'search-input',
            city: '全国'
        });

        // 初始化地点搜索
        placeSearch = new AMap.PlaceSearch({
            map: map,
            autoFitView: true
        });

        // 注册选择事件
        autoComplete.on('select', function(e) {
            if (e.poi && e.poi.name) {
                placeSearch.search(e.poi.name);
            }
        });
    });
}

/**
 * 创建搜索UI
 */
function createSearchUI(map) {
    // 创建搜索框容器
    const searchBox = document.createElement('div');
    searchBox.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);width:300px;z-index:100;display:flex;background:white;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.15);padding:5px;';

    // 创建输入框
    const input = document.createElement('input');
    input.id = 'search-input';
    input.placeholder = '搜索地点';
    input.style.cssText = 'flex:1;border:none;outline:none;padding:8px;font-size:14px;';

    // 创建清除按钮
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '清除';
    clearBtn.style.cssText = 'border:none;background:#f5f5f5;padding:0 10px;cursor:pointer;border-radius:2px;';

    // 添加清除按钮事件
    clearBtn.onclick = function() {
        // 清空输入框
        input.value = '';

        // 清除当前标记
        if (currentMarker) {
            map.remove(currentMarker);
            currentMarker = null;
        }

        // 关闭信息窗体
        if (infoWindow) {
            infoWindow.close();
        }

        // 清除地图上所有覆盖物
        clearAllOverlays(map);
    };

    // 组装DOM
    searchBox.appendChild(input);
    searchBox.appendChild(clearBtn);
    map.getContainer().appendChild(searchBox);
}

/**
 * 清除地图上所有覆盖物
 */
function clearAllOverlays(map) {
    // 获取地图上所有覆盖物
    const overlays = map.getAllOverlays();

    // 清除所有标记点
    const markers = overlays.filter(item => item.CLASS_NAME === 'AMap.Marker');
    if (markers.length > 0) {
        map.remove(markers);
        console.log(`已清除 ${markers.length} 个标记点`);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        initMap('map_container');
    }, 100);
});

// 导出
export { mapPromise, initMap };
