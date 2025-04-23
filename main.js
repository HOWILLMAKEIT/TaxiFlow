/**
 * 出租车轨迹分析系统 - Electron主进程
 */

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// 保持对窗口对象的全局引用，避免JavaScript对象被垃圾回收时窗口关闭
let mainWindow;

// 创建窗口
function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    webPreferences: {
      nodeIntegration: true,  // 允许在渲染进程中使用Node.js
      contextIsolation: false,
      webSecurity: false     // 允许加载本地资源
    }
  });

  // 加载应用的主页面
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 检查是否以开发模式运行 (现在检查 --inspect)
  const isDev = process.argv.includes('--inspect');
  
  // 在开发模式下打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 当窗口关闭时发出的事件
  mainWindow.on('closed', function () {
    // 取消引用窗口对象
    mainWindow = null;
  });

  // 创建应用菜单
  createMenu(isDev);
}

// 创建应用程序菜单
function createMenu(isDev) {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click() {
            app.quit();
          }
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+R',
          click() {
            mainWindow.reload();
          }
        },
        {
          type: 'separator'
        },
        {
          label: '重置缩放',
          accelerator: 'CmdOrCtrl+0',
          click() {
            mainWindow.webContents.setZoomLevel(0);
          }
        },
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+Plus',
          click() {
            const zoomLevel = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(zoomLevel + 0.5);
          }
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          click() {
            const zoomLevel = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(zoomLevel - 0.5);
          }
        },
        {
          type: 'separator'
        },
        {
          label: '全屏',
          accelerator: 'F11',
          click() {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click() {
            showAboutDialog();
          }
        }
      ]
    }
  ];

  // 在开发模式下添加开发者工具菜单
  if (isDev) {
    template[1].submenu.push(
      {
        type: 'separator'
      },
      {
        label: '开发者工具',
        accelerator: 'F12',
        click() {
          mainWindow.webContents.toggleDevTools();
        }
      }
    );
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 显示关于对话框
function showAboutDialog() {
  const { dialog } = require('electron');
  dialog.showMessageBox(mainWindow, {
    title: '关于',
    message: 'TaxiFlow出租车轨迹分析系统',
    detail: '版本: 1.0.0\n基于Electron开发的桌面应用程序\n用于分析和可视化出租车轨迹数据。',
    buttons: ['确定'],
    icon: path.join(__dirname, 'assets/icons/icon.png')
  });
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(createWindow);

// 在所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  // 在macOS上，除非用户用Cmd + Q确定地退出
  // 否则绝大部分应用及其菜单栏会保持激活
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口
  if (mainWindow === null) {
    createWindow();
  }
}); 