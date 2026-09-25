# 24 点游戏（AI 玩家版）

单文件 HTML 游戏：随机发四张牌，通过加减乘除（可加括号）把牌面算成 24。内置 AI 求解器，可在玩家放弃时给出前两种解法，也可在帮助中提示第一步。

## 运行方式

无需安装任何环境，双击 `index.html` 用浏览器打开即可（推荐 Chrome / Edge）。

窗口过窄时界面会整体等比缩放，拖拽与点击不受影响。

## 设计框架

```
index.html（单文件应用）
├── CSS        界面样式：牌桌、扑克牌、虚线槽、按钮、模态框
├── HTML 结构
│   ├── header      标题 + 牌面开关（是否包含 J、Q、K、0）
│   ├── #table      牌桌：手牌区（拖拽源） + 运算区（左右槽 + 四个运算符按钮）
│   ├── #status     状态提示栏
│   ├── #steps      计算步骤列表
│   ├── .toolbar    开始游戏 / 重新开始 / 放弃 / 计时 / 帮助 / 关于 / 退出游戏
│   └── #modal      通用模态框（胜负结果、AI 解法、帮助、关于共用）
└── JavaScript（核心逻辑）
    ├── 分数工具     frac / fAdd / fSub / fMul / fDiv / fmt / is24 —— 全程精确分数运算
    ├── solve24      AI 求解器（详见下节）
    ├── state        全局状态：牌列表、槽占用、是否对局中、初始牌面、解法缓存、步骤、计时器
    ├── 牌管理       addCard / removeCard / normalizeHand（手牌区自动均匀排布）
    ├── 拖拽         bindDrag（Pointer 事件 + 缩放坐标换算）、dropCard（槽命中判定 / 占位回弹）
    ├── 运算         applyOp：两槽就位 → 点运算符 → 生成结果新牌 → 判定胜负
    ├── 对局控制     deal（发牌）、giveUp（放弃并求解）、startTimer/timerTick（倒计时）、quitGame
    └── 展示         renderSteps（步骤列表）、showModal（弹窗）、fitScale（窄窗口自适应）
```

### 核心交互流程

```
点击「开始游戏」
      │ 随机发 4 张牌（默认 1~10，勾选开关后 0~13 含 J/Q/K/0）
      ▼
拖动两张牌到左右虚线槽 ──► 点击 ＋ － × ÷
      │                       │
      │                       ▼
      │            分数精确计算，两张牌合并为一张结果新牌
      │            步骤写入「计算步骤」列表
      │                       │
      │            ┌──────────┴──────────┐
      │            │ 还有剩余牌           │ 只剩一张牌
      │            ▼                      ▼
      │        新牌继续拖拽运算     结果 = 24 → 胜利
      │                             结果 ≠ 24 → 失败
      ▼
任意时刻：重新开始（重发） / 放弃（AI 求解） / 计时（倒计时判负）
```

胜负规则：所有牌用完且最终结果为 24 即获胜；倒计时归零判负；放弃后由 AI 判定本局是否有解。

## AI 计算 24 点算法

### 1. 整体思路：两两合并 + 递归枚举

经典深度优先枚举。每次从当前牌中任选两张，用六种运算合并成一张"新牌"（新牌的值、表达式、步骤一并记录），牌数减一后递归处理；当只剩一张牌时检查是否等于 24。

```
solve(牌集合):
    若只剩 1 张牌:
        该牌 = 24 ？ 记录一个解法
        返回
    任意选两张 a, b:
        对六种运算 a+b, a×b, a−b, b−a, a÷b, b÷a:
            solve(剩余牌 + [运算结果])
```

四张牌时路径总数约为 `C(4,2)×6 × C(3,2)×6 × C(2,2)×6 ≈ 3900` 条，毫秒级即可枚举完毕。

### 2. 关键设计

- **精确分数运算，不用浮点数**
  每张牌的值是 `{n: 分子, d: 分母}` 的分数对象，加减乘除后自动约分（`gcd` 约分）。像 `8 ÷ (3 − 8÷3) = 24` 中的中间值 `1/3`、`8/3` 都能精确表示，避免 `0.333...` 浮点误差导致漏解。显示时：分母为 1 显示整数，否则显示 `8/3`。

- **利用交换律减少重复分支**
  加法、乘法满足交换律，每对牌只算一种顺序（`a+b`、`a×b`）；减法、除法必须算两种顺序（`a−b` 与 `b−a`、`a÷b` 与 `b÷a`）。每对牌从 12 种运算降到 6 种，枚举量减半。除数为 0 的分支直接跳过。

- **表达式去重 + 提前终止**
  用 `Set` 记录已发现解的表达式字符串，跳过完全相同的算式；集齐 2 个不同的解后立即停止搜索（需求只要求"前两种方法"）。

- **同时记录三份信息**
  每次合并时同步维护三条平行数组：
  - `items`：分数值（用于继续计算与最终判定）
  - `exprs`：表达式字符串（如 `(6×4)`、`((6×4)×1)`），解出后即为完整算式
  - `steps`：每步过程（如 `6 × 4 = 24`）——「帮助」中的**第一步提示**取自 `steps[0]`，「放弃」弹窗中的分步过程取自完整 `steps`

### 3. 核心代码（节选自 index.html，略有精简）

```javascript
function solve24(values, limit = 2) {
  const sols = [], seen = new Set();

  function helper(items, exprs, steps) {
    if (sols.length >= limit) return;                    // 已集齐，提前终止
    if (items.length === 1) {
      if (is24(items[0]) && !seen.has(exprs[0])) {       // 等于24且表达式未重复
        seen.add(exprs[0]);
        sols.push({ expr: strip(exprs[0]), steps: steps.slice() });
      }
      return;
    }
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j], ea = exprs[i], eb = exprs[j];
        const rest  = items.filter((_, k) => k !== i && k !== j);
        const erest = exprs.filter((_, k) => k !== i && k !== j);
        const cands = [
          [fAdd(a, b), '(' + ea + '＋' + eb + ')', ea + ' ＋ ' + eb + ' = ' + fmt(fAdd(a, b))],
          [fMul(a, b), '(' + ea + '×' + eb + ')', ea + ' × ' + eb + ' = ' + fmt(fMul(a, b))],
          [fSub(a, b), '(' + ea + '－' + eb + ')', ea + ' － ' + eb + ' = ' + fmt(fSub(a, b))],
          [fSub(b, a), '(' + eb + '－' + ea + ')', eb + ' － ' + ea + ' = ' + fmt(fSub(b, a))],
        ];
        if (b.n !== 0) cands.push([fDiv(a, b), ...]);    // b 为 0 时跳过除法
        if (a.n !== 0) cands.push([fDiv(b, a), ...]);
        for (const [val, ex, st] of cands)
          helper(rest.concat([val]), erest.concat([ex]), steps.concat([st]));
      }
  }
  helper(values.map(frac), values.map(String), []);
  return sols;   // [{ expr: 完整算式, steps: [分步过程] }, ...]
}
```

### 4. 求解结果在游戏中的两处应用

| 场景 | 使用方式 |
|------|----------|
| 「放弃」 | 对本局初始 4 张牌求解，弹窗展示前两种解法（完整算式 + 分步过程）；一个解都没有则提示**本局无解** |
| 「帮助」 | 展示规则与运算方法后，取 `sols[0].steps[0]` 作为**第一步提示**（如 `6 × 4 = 24`），并附参考解法 |

发牌时（`deal`）即预计算 `state.sols = solve24(vals, 2)` 缓存起来，两个功能共用，无需重复求解。

## 需求对照

| 需求 | 实现位置 |
|------|----------|
| 随机发 4 张牌 / 重新开始 | `deal()`，「开始游戏」「重新开始」按钮 |
| 拖拽两张牌 + 选运算符 | `bindDrag` / `dropCard` / 运算符按钮 `applyOp` |
| 结果继续参与运算 | 结果生成新牌回到手牌区，可再次拖拽 |
| 全部用完且 = 24 获胜 | `applyOp` 末尾胜负判定 |
| 放弃 → AI 给前两种方法 / 无解提示 | `giveUp()` + `solve24` |
| 倒计时（默认 30 秒）超时判负 | `startTimer` / `timerTick` |
| 帮助（运算方法 + 第一步提示） | `showHelp()` |
| 关于（规则 + 作者） | `showAbout()` |
| 退出游戏 | `quitGame()`（浏览器阻止关窗时给出提示） |
| J、Q、K、0 牌面开关（默认不含） | header 复选框，影响 `deal()` 的取值池 |
| 牌面显示数字 | 卡片 `.rank` 大字 + 左上角角标 |
