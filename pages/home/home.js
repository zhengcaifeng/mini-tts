// pages/home/home.js

const plugin = requirePlugin('WechatSI')
const RecorderManager = wx.getRecorderManager()
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  startRecord() {
    console.log('开始录音')
    const options = {
      duration: 60000, // 录音时长，单位 ms
      sampleRate: 16000, // 采样率
      numberOfChannels: 1, // 录音通道数
      encodeBitRate: 48000, // 编码码率
      format: 'mp3', // 音频格式
    }
    RecorderManager.start(options)
  },
  stopRecord() {
    RecorderManager.stop()

    RecorderManager.onStop(res => {
      console.log('录音停止', res)
      const { tempFilePath, duration, fileSize } = res
      console.log('录音文件路径:', tempFilePath)
      console.log('录音时长:', duration, 'ms')
      console.log('录音文件大小:', fileSize, 'Byte')
    })
  },
  playRecord() { },
  // 事件处理函数
  speechHandler() {
    console.log('speechHandler')
    plugin.textToSpeech({
      lang: 'zh_CN',
      tts: true,
      content: '一个常见的需求',
      success: function (res) {
        console.log(res, '===合成的音频')
        console.log('succ tts', res.filename)
        const innerAudioContext = wx.createInnerAudioContext()
        innerAudioContext.src = res.filename // 本地音频地址
        innerAudioContext.play()
      },
      fail: function (res) {
        console.log('fail tts', res)
      },
    })
  },
})