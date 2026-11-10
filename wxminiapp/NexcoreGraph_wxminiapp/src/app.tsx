import { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import { useStore } from '@/store/useStore';
import { start as startLiveSync } from '@/services/livesync';
import { api } from '@/services/api';
import Taro from '@tarojs/taro';
// 全局样式
import './app.scss';

function App(props) {
  // 可以使用所有的 React Hooks
  useEffect(() => {
    /* 隐私授权：微信要求在使用相机/相册/位置等能力前征得同意。
       这里注册官方的按需授权回调；真实上线还需在公众平台配置《用户隐私保护指引》。 */
    try {
      const anyTaro = Taro as any;
      if (typeof anyTaro.onNeedPrivacyAuthorization === 'function') {
        anyTaro.onNeedPrivacyAuthorization((resolve: (arg: any) => void) => {
          Taro.showModal({
            title: '隐私保护提示',
            content: '为了拍照建档与家庭协作，需要访问相机/相册。你的照片仅用于识别物品，聊天记录仅存本机。',
            confirmText: '同意',
            cancelText: '暂不',
          }).then((r) => resolve({ event: r.confirm ? 'agree' : 'disagree', buttonId: '' }))
        });
      }
    } catch (e) { /* 基础库不支持时忽略 */ }
  });

  // 对应 onShow
  useDidShow(() => {
    // 登录后启动活同步（连不上自建后端会静默降级为本地模式）
    const st = useStore.getState();
    if (st.loggedIn && st.db && st.db.familyId) {
      api.enablePersistence();
      startLiveSync(st.db.familyId);
    }
  });

  // 对应 onHide
  useDidHide(() => {});

  return props.children;
}

export default App;
