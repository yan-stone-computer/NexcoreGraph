import { AbilityConstant, ConfigurationConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { store } from '../common/Store';
import { initKnowledge } from '../common/KnowledgeIndex';
import { saveFormSnapshot } from '../common/LocalStore';
import { onContinueSave, restoreFlow, isContinuation, allowContinue } from '../common/Continuation';
import { applyPendingEntryTarget, parseEntryTarget } from '../common/NavigationIntent';

const DOMAIN = 0x0000;

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    try {
      this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET);
    } catch (err) {
      hilog.error(DOMAIN, 'testTag', 'Failed to set colorMode. Cause: %{public}s', JSON.stringify(err));
    }
    this.handleCardWant(want);
    // 跨设备自由流转：由其他设备接续过来时还原现场
    if (isContinuation(launchParam)) {
      restoreFlow(want);
    }
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onCreate');
  }

  /* 自由流转：源端把当前流程写进 wantParam，交给目标设备 */
  onContinue(wantParam: Record<string, Object>): AbilityConstant.OnContinueResult {
    if (!store.continueEnabled) {
      return AbilityConstant.OnContinueResult.REJECT;   // 登录页等敏感页不接续
    }
    const r = onContinueSave(wantParam);
    hilog.info(DOMAIN, 'testTag', 'onContinue result=%{public}s', String(r));
    return r;
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.handleCardWant(want);
    applyPendingEntryTarget();
    if (isContinuation(launchParam)) {
      restoreFlow(want);
    }
  }

  /* 服务卡片路由：只排队目标，登录成功后由页面消费。 */
  private handleCardWant(want: Want): void {
    const params = want.parameters;
    if (params === undefined) {
      return;
    }
    const target: string = parseEntryTarget(params['target']);
    if (target !== '') {
      store.pendingEntryTarget = target;
    }
  }

  onDestroy(): void {
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    // Main window is created, set main page for this ability
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onWindowStageCreate');

    // 知识库 RAG 索引（M-8）：rawfile 优先，失败回退内嵌子集，不阻塞首帧
    initKnowledge(this.context);

    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, 'testTag', 'Failed to load the content. Cause: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(DOMAIN, 'testTag', 'Succeeded in loading the content.');
    });
  }

  onWindowStageDestroy(): void {
    // Main window is destroyed, release UI related resources
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onWindowStageDestroy');
  }

  onForeground(): void {
    // Ability has brought to foreground
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onForeground');
    // 接续开关：登录页禁止接续，进入主界面后允许
    allowContinue(store.loggedIn);
  }

  onBackground(): void {
    // Ability has back to background
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onBackground');
    // M-5：退到后台时刷新服务卡片快照，卡片进程据此显示真实库存
    saveFormSnapshot();
  }

}
