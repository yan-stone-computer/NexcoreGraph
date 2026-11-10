import { describe, expect, it } from '@ohos/hypium';
import { visibleReply } from '../main/ets/common/ReplyText';

export default function replyTextTest() {
  describe('replyText', () => {
    it('extracts the visible body from reasoning wrappers', 0, () => {
      const raw = '[思考过程：内部推理][回复内容：冰箱里还有 2 盒牛奶。]';
      expect(visibleReply(raw)).assertEqual('冰箱里还有 2 盒牛奶。');
    });

    it('removes xml thinking blocks', 0, () => {
      expect(visibleReply('<thought>隐藏</thought>\n今晚吃鸡蛋。')).assertEqual('今晚吃鸡蛋。');
    });

    it('returns an empty string when only reasoning is present', 0, () => {
      expect(visibleReply('[思考过程：没有正文]')).assertEqual('');
    });
  });
}
