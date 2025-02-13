// app.js
App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })
  },

  globalData: {
    // 讯飞云语音合成配置
    xfyun: {

      appId: "20ec2179",
      apiSecret: "MTMwZThlY2JlMGM4OGIzOWNkM2NkYTk3",
      apiKey: "02bae1781b21795137e13af4e7dadbf2",

    },
  },
})
