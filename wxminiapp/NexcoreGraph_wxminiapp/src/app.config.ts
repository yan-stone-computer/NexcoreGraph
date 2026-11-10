export default defineAppConfig({
  pages: [
    'pages/workbench/index',
    'pages/home/index',
    'pages/library/index',
    'pages/mine/index',
    'pages/login/index',
    'pages/library-detail/index',
    'pages/intake/index',
    'pages/plans/index',
    'pages/alerts/index',
    'pages/shopping/index'
  ],
  subPackages: [
    {
      // 图谱页独立分包（M-A2 / 9.3 主包 ≤2MB 对策）：运行时生成，主包只留工作台
      root: 'pages/graph',
      pages: ['index']
    },
    {
      root: 'pages/outfit',
      pages: ['index']
    },
    {
      // 可信 AI 实验台：高级能力独立分包，避免影响首屏体积
      root: 'pages/lab',
      pages: ['index']
    }
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#F5F9FB',
    navigationBarTitleText: '启核图策',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#6B7C8C',
    selectedColor: '#57D794',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/workbench/index',
        text: 'AI 工作台',
        iconPath: 'assets/tabbar/chat.png',
        selectedIconPath: 'assets/tabbar/chat-selected.png'
      },
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
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tabbar/mine.png',
        selectedIconPath: 'assets/tabbar/mine-selected.png'
      }
    ]
  }
})
