export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/library/index',
    'pages/chat/index',
    'pages/mine/index',
    'pages/login/index',
    'pages/library-detail/index',
    'pages/intake/index',
    'pages/plans/index',
    'pages/alerts/index',
    'pages/shopping/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#F8F8F7',
    navigationBarTitleText: '启核图策',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#7C776C',
    selectedColor: '#C9A86A',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
            {
              pagePath: 'pages/home/index',
              text: '首页',
              iconPath: 'assets/tabbar/home.png',
              selectedIconPath: 'assets/tabbar/home-selected.png'
            },
            {
              pagePath: 'pages/library/index',
              text: '资源库',
              iconPath: 'assets/tabbar/library.png',
              selectedIconPath: 'assets/tabbar/library-selected.png'
            },
            {
              pagePath: 'pages/chat/index',
              text: 'AI 助手',
              iconPath: 'assets/tabbar/chat.png',
              selectedIconPath: 'assets/tabbar/chat-selected.png'
            },
            {
              pagePath: 'pages/mine/index',
              text: '我的',
              iconPath: 'assets/tabbar/mine.png',
              selectedIconPath: 'assets/tabbar/mine-selected.png'
            }
          ]
  }
})
