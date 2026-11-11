/* Deterministic resource-domain inference shared by inventory, graph and twin rules. */

export const DOMAIN_FOOD: string = 'food';
export const DOMAIN_MEDICINE: string = 'medicine';
export const DOMAIN_FITNESS: string = 'fitness';
export const DOMAIN_TOOL: string = 'tool';
export const DOMAIN_DAILY: string = 'daily';
export const DOMAIN_OTHER: string = 'other';

function normalized(text: string): string {
  return text.toLowerCase().replace(/[\s，。；、,.!?（）()_-]/g, '');
}

function hasAny(text: string, words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    if (text.indexOf(words[i]) >= 0) {
      return true;
    }
  }
  return false;
}

export function inferResourceDomain(name: string, libraryName: string = '', category: string = ''): string {
  const source: string = normalized(name + ' ' + libraryName + ' ' + category);
  if (source === '') {
    return DOMAIN_OTHER;
  }
  if (hasAny(source, [
    '药', '药品', '药盒', '急救', '退烧', '止痛', '感冒', '消炎', '创可贴', '碘伏',
    '体温计', '血压计', '血糖', '维生素', '胶囊', '片剂', '口服液', '喷雾'
  ])) {
    return DOMAIN_MEDICINE;
  }
  if (hasAny(source, [
    '健身', '运动', '哑铃', '壶铃', '杠铃', '弹力带', '拉力带', '瑜伽垫', '跑步机',
    '划船机', '动感单车', '跳绳', '握力器', '筋膜枪', '护膝', '护腕'
  ])) {
    return DOMAIN_FITNESS;
  }
  if (hasAny(source, [
    '工具', '五金', '维修', '螺丝刀', '扳手', '钳子', '锤子', '电钻', '钻头', '卷尺',
    '老虎钳', '美工刀', '砂纸', '螺丝', '螺母', '膨胀管'
  ])) {
    return DOMAIN_TOOL;
  }
  if (hasAny(source, [
    '日用', '洗护', '洗发', '沐浴', '牙膏', '纸巾', '卫生纸', '洗衣液', '垃圾袋',
    '衣物', '衣服', '毛巾', '电池'
  ])) {
    return DOMAIN_DAILY;
  }
  if (hasAny(source, [
    '食品', '食材', '饮料', '零食', '调味', '冰箱', '厨房', '菜', '肉', '蛋', '奶',
    '水果', '蔬菜', '米', '面', '油', '盐', '糖', '胡萝卜', '番茄', '鸡蛋', '牛奶'
  ])) {
    return DOMAIN_FOOD;
  }
  return DOMAIN_OTHER;
}

export function domainLabel(domain: string): string {
  if (domain === DOMAIN_FOOD) {
    return '食品';
  }
  if (domain === DOMAIN_MEDICINE) {
    return '药品';
  }
  if (domain === DOMAIN_FITNESS) {
    return '健身器材';
  }
  if (domain === DOMAIN_TOOL) {
    return '工具';
  }
  if (domain === DOMAIN_DAILY) {
    return '日用品';
  }
  return '其他';
}

export function isConsumableDomain(domain: string): boolean {
  return domain === DOMAIN_FOOD || domain === DOMAIN_MEDICINE || domain === DOMAIN_DAILY;
}

export function domainIcon(domain: string): string {
  if (domain === DOMAIN_MEDICINE) {
    return 'pill';
  }
  if (domain === DOMAIN_FITNESS) {
    return 'dumbbell';
  }
  if (domain === DOMAIN_TOOL) {
    return 'wrench';
  }
  return 'package';
}
