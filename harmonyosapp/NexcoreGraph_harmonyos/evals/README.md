# GuardrailBench

离线、确定性的 AI 安全回归台，覆盖两类硬门槛：

- `sanitize`：内部思考、XML 标签和代码围栏不得进入用户正文；
- `grounding`：回答中的数字必须能在代码装配的证据中找到。

运行：

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
node evals/run.js --out evals/result.json
```

该评测不调用模型，不消耗 API 额度。`hardFailViolations` 必须为 `0`。
