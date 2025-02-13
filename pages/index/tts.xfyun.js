
const CryptoJS = require('./crypto');
// 系统配置
const config = {
  //在控制台-我的应用-在线语音合成（流式版）获取
  appId: '',
  //在控制台-我的应用-在线语音合成（流式版）获取
  apiKey: '',
  //在控制台-我的应用-在线语音合成（流式版）获取
  apiSecret: '',
  hostUrl: 'wss://tts-api.xfyun.cn/v2/tts',
  host: 'tts-api.xfyun.cn',
  uri: '/v2/tts'
};

// 音频文件存放路径
let AUDIO_FILE_PATH = wx.env.USER_DATA_PATH + '/tts.audio.mp3';

// 获取授权信息
const getAuth = (config, date) => {
  // 获取当前时间 RFC1123格式
  // let date = (new Date().toUTCString())
  const signatureOrigin = `host: ${config.host}\ndate: ${date}\nGET ${config.uri} HTTP/1.1`;
  const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret);
  const signature = CryptoJS.enc.Base64.stringify(signatureSha);
  const authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authStr = CryptoJS.enc.Base64.stringify(
    CryptoJS.enc.Utf8.parse(authorizationOrigin)
  );
  console.log(authStr);
  return authStr;
};
export const TTS_STATUS = Object.freeze({
  INIT: 'init',// 初始化
  TTSING: 'ttsing',// wss连接中
  ERROR_TTS: 'errorTTS',// wss 连接错误
  CLOSE: 'close', // wss连接关闭
  PLAY: 'play', // 语音播放
  PLAYING: 'playing',
  PAUSE_PLAY: 'pausePlay', //语音播放暂停
  ENDPLAY: 'endPlay'// 语音播放结束
})
const getWebsocketUrl = () => {
  // 获取当前时间 RFC1123格式
  const date = new Date().toUTCString();
  return new Promise((resolve, _reject) => {
    // 设置当前临时状态为初始化
    const authStr = getAuth(config, date);
    const wssUrl = `${config.hostUrl}?authorization=${authStr}&date=${date}&host=${config.host}`;
    console.log('wssUrl：', wssUrl);
    resolve(encodeURI(wssUrl));
  });
};
class TTSRecorder {
  constructor({
    appId,
    apiKey,
    apiSecret,
    host,
    text = '',
    speed = 50,
    volume = 100,
    pitch = 50,
    voiceName = 'x4_lingxiaoying_en',
    tte = 'UTF8',
    defaultText = '请输入您要合成的文本',
    bgs = 0
  } = {}) {
    if (!appId || !apiKey || !apiSecret) {
      throw new Error(`appId,apiKey,apiSecret为必填，请配置正确配置，在讯飞开放平台控制台，
      创建应用进入语音合成（流式版）服务后即可查看,
      详细请访问https://www.xfyun.cn/doc/tts/online_tts/API.html`);
    }
    Object.assign(config, { appId, apiKey, apiSecret, host });
    this.speed = speed;
    this.volume = volume;
    this.pitch = pitch;
    this.voiceName = voiceName;
    this.text = text;
    this.tte = tte;
    this.bgs = bgs;
    this.defaultText = defaultText;
    this.appId = appId;
    this.status = TTS_STATUS.INIT;
    this.innerAudioContext = wx.createInnerAudioContext();
  }
  // 修改录音听写状态
  setStatus(status) {
    console.log('setStatus', status);
    this.onWillStatusChange && this.onWillStatusChange(this.status, status);
    this.status = status;
  }
  /**
   * @description 设置合成相关参数
   * @param {Object} {}
   * @param {Number} speed 语速，可选值：[0-100]，默认为50
   * @param {Number} volume 音量，可选值：[0-100]，默认为50
   * @param {Number} pitch 音高，可选值：[0-100]，默认为50
   * @param {String} text 文本内容
   * @param {Number} voiceName 音量，可选值：[0-100]，默认为50
   * @param {string} tte `文本编码格式 GB2312 GBK BIG5 UNICODE(小语种必须使用UNICODE编码，合成的文本需使用utf16小端的编码方式，详见java示例demo) GB18030 UTF8`
   * @param {Number} bgs 合成音频的背景音 0:无背景音（默认值） 1:有背景音
   */
  setParams({ speed, volume, pitch, text, voiceName, tte, bgs }) {
    speed !== undefined && (this.speed = speed);
    volume !== undefined && (this.volume = volume);
    pitch !== undefined && (this.pitch = pitch);
    bgs !== undefined && (this.bgs = bgs);
    text && (this.text = text);
    tte && (this.tte = tte);
    voiceName && (this.voiceName = voiceName);
    this.resetAudio();
    console.log(this);
    return this;
  }
  // 连接websocket
  connectWebSocket() {
    this.setStatus('ttsing');
    getWebsocketUrl().then((url) => {
      wx.connectSocket({
        url: url
      });
      // 监听连接成功
      wx.onSocketOpen((res) => {
        console.log('WebSocket连接已打开！', res);
        this.connected = true;
        this.webSocketSend();
      });
      // 监听服务器消息
      wx.onSocketMessage((res, err) => {
        // console.log('onSocketMessage:', res, err)
        if (err) {
          throw new Error(`onSocketMessageERROR:${JSON.stringify(err)}`);
        }

        if (
          '[object ArrayBuffer]' === Object.prototype.toString.call(res.data)
        ) {
          this.saveFile(wx.arrayBufferToBase64(res.data)).then((_filepath) => {
            this.audioPlay(AUDIO_FILE_PATH);
          });
          return;
        }
        const data = JSON.parse(res.data);

        if (data.code != 0) {
          console.error(`${data.code}: ${data.message}`);
          wx.closeSocket();
          return;
        }
        this.result(data);
        // callback(data)
      });
      // 监听连接断开
      wx.onSocketError((res) => {
        console.info('WebSocket连接打开失败，请检查！', res);
        this.setStatus(TTS_STATUS.ERROR_TTS);
        this.connected = false;
        // this.connectSocket()
        // this.setStatus(TTS_STATUS.ERROR_TTS);
        // console.error(`详情查看：${encodeURI(url.replace('wss:', 'https:'))}`);
      });
      // 监听连接关闭
      wx.onSocketClose((res) => {
        console.log('WebSocket 已关闭！', res);
        this.setStatus(TTS_STATUS.CLOSE);
        this.connected = false;
        // this.connectSocket()
      });
    });
  }
  // 处理音频数据
  transToAudioData(_audioData) { }
  // websocket发送数据
  webSocketSend() {
    var params = {
      common: {
        app_id: this.appId // APPID
      },
      business: {
        aue: 'lame',
        sfl: 0, // mp3 此处要注意只能设置为0 若设置为1 则需要合
        auf: 'audio/L16;rate=16000',
        vcn: this.voiceName,
        speed: this.speed,
        volume: this.volume,
        pitch: this.pitch,
        bgs: this.bgs,
        tte: this.tte
      },
      data: {
        status: 2,
        text: this.encode2Base64(this.text || this.defaultText)
      }
    };
    wx.sendSocketMessage({
      data: JSON.stringify(params)
    });
  }
  encode2Base64(text) {
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(text));
  }
  // websocket接收数据的处理
  result(jsonData) {
    if (!jsonData) {
      return;
    }
    // 合成失败
    if (jsonData.code !== 0 || !jsonData.data.audio) {
      // alert(`合成失败: ${jsonData.code}:${jsonData.message}`);
      console.error(`${jsonData.code}:${jsonData.message}`);
      this.resetAudio();
      return;
    }
    this.saveFile(jsonData.data.audio).then((filepath) => {
      this.audioPlay(filepath);
    });
    if (jsonData.code === 0 && jsonData.data.status === 2) {
      wx.closeSocket();
    }
  }
  /**
   * @description 存储音频数据
   * @param {Object} data 音频数据
   */
  saveFile(data, encoding = 'base64') {
    this.removeAudioFile();
    return new Promise((resove, _reject) => {
      const fs = wx.getFileSystemManager();
      const time = new Date().getTime();
      AUDIO_FILE_PATH = wx.env.USER_DATA_PATH + `/tts.${time}.audio.mp3`;
      fs.writeFileSync(AUDIO_FILE_PATH, data, encoding);
      resove(AUDIO_FILE_PATH);
    });
  }
  // 重置音频数据
  resetAudio() {
    this.audioStop();
    this.setStatus('init');
    // this.connected && wx.closeSocket()
  }
  // 音频初始化
  audioInit() {
    //创建内部 audio 上下文 InnerAudioContext 对象。
    this.innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext.onError(function (res) {
      console.warn('语音播放失败:', res);
      wx.showToast({
        title: '语音播放失败',
        icon: 'none'
      });
    });
  }
  // 音频播放
  audioPlay(_filePath) {
    this.setStatus(TTS_STATUS.PLAY);
    this.innerAudioContext.destroy();
    this.innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext.src = AUDIO_FILE_PATH;
    this.innerAudioContext.autoplay = true;
    this.innerAudioContext.play();
    this.innerAudioContext.onPlay(() => {
      this.setStatus(TTS_STATUS.PLAYING);
      console.log('开始播放');
    });
    this.innerAudioContext.onError((res) => {
      console.error('AudioERROR', res.errCode, res.errMsg);
    });
    this.innerAudioContext.onEnded((res) => {
      this.setStatus(TTS_STATUS.ENDPLAY);
      console.log('播放结束');
      // callback(res);
    });
  }
  // 开始播放
  play() {
    this.setStatus(TTS_STATUS.PLAY);
    this.innerAudioContext.play();
  }
  // 音频播放结束
  audioStop() {
    this.setStatus(TTS_STATUS.ENDPLAY);
    this.innerAudioContext.stop();
  }
  // 暂停
  pauseAudio() {
    this.setStatus(TTS_STATUS.PAUSE_PLAY);
    this.innerAudioContext.pause();
  }
  // /**
  //  * @description 自然播放结束
  //  * @param {function}} callback
  //  */
  // onAudioEnded(callback) {
  //   if (typeof callback != 'function') {
  //     return;
  //   }
  //   this.innerAudioContext.onEnded((res) => {
  //     console.log('播放结束');
  //     callback(res);
  //   });
  // }
  start(_option) {
    if (!this.innerAudioContext) {
      this.audioInit();
    }
    this.connectWebSocket();
  }
  stop() {
    this.audioStop();
  }
  destroy() {
    this.innerAudioContext = null;
    this.removeAudioFile();
  }
  /**
   * 清理文件缓存
   */
  removeAudioFile() {
    const fs = wx.getFileSystemManager();
    fs.readdir({
      dirPath: wx.env.USER_DATA_PATH,
      success: (res) => {
        const auditList = res.files.filter((n) => n.indexOf('.audio.mp3') >= 0);
        if (auditList.length > 0) {
          for (let i = auditList.length; --i >= 0;) {
            fs.unlink({
              filePath: wx.env.USER_DATA_PATH + '/' + auditList[i],
              complete(res) {
                console.log('removeSavedFile', res);
              }
            });
          }
        }
      }
    });
  }
}
export default TTSRecorder;
