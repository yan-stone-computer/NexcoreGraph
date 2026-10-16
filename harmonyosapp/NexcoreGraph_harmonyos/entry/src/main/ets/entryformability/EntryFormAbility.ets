import { FormExtensionAbility, formBindingData, formProvider } from '@kit.FormKit';
import { Want } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { store } from '../common/Store';
import { Item } from '../common/Db';

/* 启核图策 · 服务卡片 FormAbility（M-5 卡片多端适配）
   数据来源优先级：① 端侧写入 Preferences 的 formSnapshot（真实库存，杀进程/断网也可用）；
   ② 取不到时退回进程内 store 计算（首次安装、尚未落盘）。
   卡片页按需取 total/libs/expiring/exp1/exp2；点击路由由 postCardAction 直发 EntryAbility。 */

const PREFS_NAME: string = 'nexcore_local';
const SNAPSHOT_KEY: string = 'formSnapshot';

/** Preferences 里的快照（M-5）：字段与 LocalStore.saveFormSnapshot 一一对应 */
class FormSnapshot {
  total: number = 0;
  libs: number = 0;
  expiring: number = 0;
  exp1: string = '';
  exp2: string = '';
  updatedAt: string = '';
}

/** 读取端侧落盘的真实库存快照；失败返回 null（走进程内兜底） */
function localSnapshot(ctx: Object): Record<string, Object> | null {
  try {
    const p = preferences.getPreferencesSync(ctx as Context, { name: PREFS_NAME });
    const raw = p.getSync(SNAPSHOT_KEY, '') as string;
    if (raw === '') {
      return null;
    }
    const s = JSON.parse(raw) as FormSnapshot;
    const data: Record<string, Object> = {
      'total': s.total,
      'libs': s.libs,
      'expiring': s.expiring,
      'exp1': s.exp1,
      'exp2': s.exp2
    };
    return data;
  } catch (_e) {
    return null;
  }
}

function snapshot(): Record<string, Object> {
  let total = 0;
  let expiring = 0;
  const exp: Item[] = [];
  store.libraries.forEach((lib) => {
    total += lib.items.length;
    lib.items.forEach((it) => {
      if (it.expDays > 0 && it.expDays <= 7) {
        expiring += 1;
        exp.push(it);
      }
    });
  });
  exp.sort((a, b) => a.expDays - b.expDays);
  const data: Record<string, Object> = {
    'total': total,
    'libs': store.libraries.length,
    'expiring': expiring,
    'exp1': exp.length > 0 ? `${exp[0].name} · ${exp[0].expDays} 天后到期` : '',
    'exp2': exp.length > 1 ? `${exp[1].name} · ${exp[1].expDays} 天后到期` : ''
  };
  return data;
}

export default class EntryFormAbility extends FormExtensionAbility {
  onAddForm(_want: Want): formBindingData.FormBindingData {
    const local = localSnapshot(this.context);
    return formBindingData.createFormBindingData(local !== null ? local : snapshot());
  }

  onUpdateForm(formId: string): void {
    // ponytail: 全量快照推送，卡片多于 3 张或需差量时再引入按 formId 分发
    try {
      const local = localSnapshot(this.context);
      formProvider.updateForm(formId, formBindingData.createFormBindingData(local !== null ? local : snapshot()));
    } catch (_e) {
      // 卡片已移除等场景忽略
    }
  }

  onRemoveForm(_formId: string): void {
  }
}
