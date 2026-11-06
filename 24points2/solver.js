/*
 * 24-point solver — exact rational arithmetic, exhaustive search.
 * Works in the browser (window.TFMath) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TFMath = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TARGET = 24;
  const OPERATOR_SYMBOL = Object.freeze({
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷",
  });
  const OPERATOR_PRECEDENCE = Object.freeze({ "+": 1, "-": 1, "*": 2, "/": 2 });

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      const next = a % b;
      a = b;
      b = next;
    }
    return a || 1;
  }

  class Fraction {
    constructor(numerator, denominator = 1) {
      if (numerator instanceof Fraction) {
        this.n = numerator.n;
        this.d = numerator.d;
        return;
      }

      let n = Number(numerator);
      let d = Number(denominator);

      if (!Number.isFinite(n) || !Number.isFinite(d)) {
        throw new TypeError("Fraction requires finite numbers");
      }
      if (d === 0) {
        throw new RangeError("Division by zero");
      }

      n = Math.round(n);
      d = Math.round(d);

      if (d < 0) {
        n = -n;
        d = -d;
      }

      const divisor = gcd(n, d);
      this.n = n / divisor;
      this.d = d / divisor;
    }

    static from(value) {
      if (value instanceof Fraction) return value;
      if (typeof value === "number") return new Fraction(value, 1);
      if (value && typeof value === "object" && "n" in value && "d" in value) {
        return new Fraction(value.n, value.d);
      }
      throw new TypeError("Cannot convert value to Fraction");
    }

    static integer(value) {
      return new Fraction(value, 1);
    }

    add(other) {
      const b = Fraction.from(other);
      return new Fraction(this.n * b.d + b.n * this.d, this.d * b.d);
    }

    subtract(other) {
      const b = Fraction.from(other);
      return new Fraction(this.n * b.d - b.n * this.d, this.d * b.d);
    }

    multiply(other) {
      const b = Fraction.from(other);
      return new Fraction(this.n * b.n, this.d * b.d);
    }

    divide(other) {
      const b = Fraction.from(other);
      if (b.n === 0) throw new RangeError("Division by zero");
      return new Fraction(this.n * b.d, this.d * b.n);
    }

    negate() {
      return new Fraction(-this.n, this.d);
    }

    equals(other) {
      const b = Fraction.from(other);
      return this.n === b.n && this.d === b.d;
    }

    isZero() {
      return this.n === 0;
    }

    isInteger() {
      return this.d === 1;
    }

    compare(other) {
      const b = Fraction.from(other);
      return this.n * b.d - b.n * this.d;
    }

    get key() {
      return this.n + "/" + this.d;
    }

    toString() {
      return this.d === 1 ? String(this.n) : this.n + "/" + this.d;
    }

    valueOf() {
      return this.n / this.d;
    }
  }

  function applyOperation(left, right, operator) {
    switch (operator) {
      case "+":
        return left.add(right);
      case "-":
        return left.subtract(right);
      case "*":
        return left.multiply(right);
      case "/":
        return right.isZero() ? null : left.divide(right);
      default:
        return null;
    }
  }

  function normalizeInput(input, index) {
    let value;
    let label;
    let id = null;

    if (input && typeof input === "object" && !(input instanceof Fraction)) {
      value = Fraction.from(input.value);
      label =
        input.label !== undefined && input.label !== null
          ? String(input.label)
          : value.toString();
      if (input.id !== undefined && input.id !== null) id = String(input.id);
    } else {
      value = Fraction.from(input);
      label = value.toString();
    }

    return { value, label, id, index };
  }

  function createLeaf(item) {
    return {
      type: "leaf",
      value: item.value,
      label: item.label,
      id: item.id,
      index: item.index,
    };
  }

  function createOperation(left, right, operator) {
    const value = applyOperation(left.value, right.value, operator);
    if (value === null) return null;
    return {
      type: "operation",
      operator,
      value,
      left,
      right,
    };
  }

  function canonical(node) {
    if (node.type === "leaf") return "n:" + node.value.key;

    if (node.operator === "+" || node.operator === "*") {
      const parts = [];
      const collect = (current) => {
        if (
          current.type === "operation" &&
          current.operator === node.operator
        ) {
          collect(current.left);
          collect(current.right);
        } else {
          parts.push(canonical(current));
        }
      };
      collect(node);
      parts.sort();
      return node.operator + "{" + parts.join("|") + "}";
    }

    return (
      node.operator +
      "(" +
      canonical(node.left) +
      "," +
      canonical(node.right) +
      ")"
    );
  }

  function render(node) {
    if (node.type === "leaf") return node.label;
    return (
      renderChild(node.left, node.operator, "left") +
      " " +
      OPERATOR_SYMBOL[node.operator] +
      " " +
      renderChild(node.right, node.operator, "right")
    );
  }

  function isSimpleLeafLabel(label) {
    return /^(?:[A-Z]|\d{1,3})$/.test(label);
  }

  function needsLeafParentheses(node) {
    if (node.type !== "leaf") return false;
    return (
      node.value.n < 0 ||
      !isSimpleLeafLabel(node.label) ||
      node.label.indexOf("/") !== -1
    );
  }

  function renderChild(child, parentOperator, side) {
    const text = render(child);

    if (child.type === "leaf") {
      return needsLeafParentheses(child) ? "(" + text + ")" : text;
    }

    const childPrecedence = OPERATOR_PRECEDENCE[child.operator];
    const parentPrecedence = OPERATOR_PRECEDENCE[parentOperator];

    if (childPrecedence < parentPrecedence) return "(" + text + ")";

    if (
      side === "right" &&
      childPrecedence === parentPrecedence &&
      (parentOperator === "-" || parentOperator === "/")
    ) {
      return "(" + text + ")";
    }

    if (
      side === "right" &&
      parentOperator === "*" &&
      child.operator === "/"
    ) {
      return "(" + text + ")";
    }

    return text;
  }

  function stepsFor(node) {
    const steps = [];

    function walk(current) {
      if (current.type === "leaf") return;
      walk(current.left);
      walk(current.right);
      steps.push({
        expression:
          renderChild(current.left, current.operator, "left") +
          " " +
          OPERATOR_SYMBOL[current.operator] +
          " " +
          renderChild(current.right, current.operator, "right"),
        value: current.value.toString(),
      });
    }

    walk(node);
    return steps;
  }

  function scoreNode(node) {
    let score = 0;
    let depth = 0;

    function walk(current, level) {
      if (current.type === "leaf") return;
      depth = Math.max(depth, level);
      if (!current.value.isInteger()) score += 7;
      if (current.value.n < 0) score += 3;
      if (current.operator === "/") score += 1.5;
      if (current.value.d > 10) score += 1;
      walk(current.left, level + 1);
      walk(current.right, level + 1);
    }

    walk(node, 1);
    score += render(node).length * 0.06;
    score += depth * 0.15;
    return Math.round(score * 1000) / 1000;
  }

  function describeSolution(root) {
    return {
      root,
      formula: render(root) + " = " + root.value.toString(),
      expression: render(root),
      steps: stepsFor(root),
      score: scoreNode(root),
    };
  }

  /**
   * Search every legal combination of the supplied values.
   *
   * @param {Array<number|string|{value:number|Fraction,label?:string,id?:string}>} values
   * @param {number} target
   * @returns {{
   *   target:number,
   *   solutions:Array<{root:object,formula:string,expression:string,steps:object[],score:number}>,
   *   solutionCount:number,
   *   expressionCount:number,
   *   outcomeCount:number,
   *   outcomes:string[],
   *   hasSolution:boolean
   * }}
   */
  function solve(values, target = TARGET) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new TypeError("solve() needs a non-empty array of values");
    }

    const normalizedTarget = Fraction.from(target);
    const leaves = values.map(normalizeInput);
    const solutionMap = new Map();
    const outcomes = new Set();
    let expressionCount = 0;

    const items = leaves.map((item) => ({
      value: item.value,
      node: createLeaf(item),
    }));

    function search(currentItems) {
      if (currentItems.length === 1) {
        expressionCount += 1;
        const result = currentItems[0].value;
        outcomes.add(result.key);

        if (result.equals(normalizedTarget)) {
          const key = canonical(currentItems[0].node);
          if (!solutionMap.has(key)) {
            solutionMap.set(key, currentItems[0].node);
          }
        }
        return;
      }

      for (let i = 0; i < currentItems.length; i += 1) {
        for (let j = i + 1; j < currentItems.length; j += 1) {
          const left = currentItems[i];
          const right = currentItems[j];
          const rest = currentItems.filter(
            (_, index) => index !== i && index !== j
          );

          const operations = [
            ["+", left, right],
            ["*", left, right],
            ["-", left, right],
            ["-", right, left],
          ];

          if (!right.value.isZero()) operations.push(["/", left, right]);
          if (!left.value.isZero()) operations.push(["/", right, left]);

          for (const [operator, operationLeft, operationRight] of operations) {
            const node = createOperation(
              operationLeft.node,
              operationRight.node,
              operator
            );
            if (!node) continue;

            search(
              rest.concat([
                {
                  value: node.value,
                  node,
                },
              ])
            );
          }
        }
      }
    }

    search(items);

    const solutions = Array.from(solutionMap.values())
      .map(describeSolution)
      .sort((a, b) => a.score - b.score || a.formula.length - b.formula.length);

    return {
      target: normalizedTarget.valueOf(),
      solutions,
      solutionCount: solutions.length,
      expressionCount,
      outcomeCount: outcomes.size,
      outcomes: Array.from(outcomes),
      hasSolution: solutions.length > 0,
    };
  }

  return {
    Fraction,
    solve,
    renderExpression: render,
    operatorSymbol: OPERATOR_SYMBOL,
    TARGET,
  };
});
