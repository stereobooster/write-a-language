import assert from "assert";
import { parse } from "./parser.js";

class RuntimeError extends Error {}
class TypeError extends Error {}
class SyntaxError extends Error {}

// syntax checks
const getAstType = (ast) => {
  if (Array.isArray(ast)) {
    return "list";
  }
  const t = typeof ast;
  if (t === "string") return "symbol";
  if (t === "number") return t;
  throw new RuntimeError(`Unknown type "${t}"`);
};
const checkArgumentIs = (name, position, expected, value) => {
  if (expected === undefined || expected === "all") return;
  const [type, subType] = expected.split(/\<|\>/);
  if (getAstType(value) !== type) {
    throw new SyntaxError(
      `"${name}" expects ${expected} as the ${position} argument, instead got "${prettyPrinter(
        value
      )}"`
    );
  }
  if (subType === undefined || subType === "all") return;
  value.forEach((subValue) => {
    if (getAstType(subValue) !== subType) {
      throw new SyntaxError(
        `"${name}" expects ${expected} as the ${position} argument, instead got "${prettyPrinter(
          value
        )}"`
      );
    }
  });
};

// type checks
const getType = (value) => {
  if (Array.isArray(value)) {
    if (value[0] === "function") return "function";
    return "list";
  }
  const t = typeof value;
  if (t === "string") return "symbol";
  if (t === "function") return "nativeFunction";
  if (t === "number") return t;
  throw new RuntimeError(`Unknown type "${t}"`);
};

const prettyPrinter = (value) => {
  const valueType = getType(value);
  if (valueType === "function")
    return `(function (${value[1].join(" ")}) (${value[2].join(" ")}))`;
  if (valueType === "list") return `(${value.join(" ")})`;
  return value;
};

const checkNumberOfArguments = (name, numberOfArguments, expected) => {
  if (numberOfArguments !== expected) {
    throw new TypeError(
      `"${name}" expects ${expected} arguments, instead got ${numberOfArguments}`
    );
  }
};

const validate = (name, types, values) => {
  checkNumberOfArguments(name, values.length, types.length);
  types.forEach((type, position) => {
    const value = values[position];
    if (type !== "all" && getType(value) !== type) {
      throw new TypeError(
        `"${name}" expects ${type} as the ${
          position + 1
        } argument, instead got "${prettyPrinter(value)}"`
      );
    }
  });
};

// Syntax rules (those are not type signatures):
//  _:t or :t - some variable of type t
//  :list<t> - list of type t
//  :all - universal type
//  define - will match exact symbol "define"
//  () - will match exact s-expression
//  (...) - will match s-expression of any length
//  ? - evaluated expression (for the future)
const rules = {
  ":number": (ast, _environment, _evaluate) => {
    return ast;
  },
  // other names: atom
  ":symbol": (ast, environment, _evaluate) => {
    if (environment[ast] === undefined) {
      throw new RuntimeError(
        `Can't find "${ast}" variable. Use \`(define ${ast} ...)\` to define it`
      );
    }
    return environment[ast];
  },
  // other names: let, var, const
  "(define :symbol :all)": (ast, environment, evaluate) => {
    const [_, first, second] = ast;
    if (environment[first] !== undefined) {
      throw new RuntimeError(`Can't redefine "${first}" variable`);
    }
    return (environment[first] = evaluate(second, environment));
  },
  "(quote :all)": (ast, _environment, _evaluate) => {
    const [_, first] = ast;
    return first;
  },
  "(eval :all)": (ast, environment, evaluate) => {
    const [_, first] = ast;
    return evaluate(evaluate(first, environment));
  },
  // other names: anonymous function, lambda, fun, fn, closure
  "(function :list<symbol> :all)": (ast, environment, _evaluate) => {
    const [name, argumentsWithType, body] = ast;
    const args = [];
    const argumentTypes = [];
    argumentsWithType.forEach((argumentWithType) => {
      const [name, type] = argumentWithType.split(":");
      args.push(name);
      argumentTypes.push(type || "all");
    });
    return [name, args, body, environment, argumentTypes];
  },
  // other names: application of a function, function call
  "(:all ...)": (ast, environment, evaluate) => {
    const [name, ...args] = ast;
    const func = environment[name];
    const funcType = getType(func);
    if (funcType === "nativeFunction") {
      const argumentTypes = func.argumentTypes;
      if (!argumentTypes)
        checkNumberOfArguments(name, args.length, func.length);
      const evaluatedArguments = args.map((arg) => evaluate(arg, environment));
      if (argumentTypes) validate(name, func.argumentTypes, evaluatedArguments);
      return func(...evaluatedArguments);
    }
    if (funcType === "function") {
      const [
        _,
        argumentNames,
        functionBody,
        closureEnvironment,
        argumentTypes,
      ] = func;
      const evaluatedArguments = args.map((arg) => evaluate(arg, environment));
      validate(name, argumentTypes, evaluatedArguments);
      const functionEnvironment = { ...environment, ...closureEnvironment };
      for (let i = 0; i < argumentNames.length; i++) {
        functionEnvironment[argumentNames[i]] = evaluatedArguments[i];
      }
      return evaluate(functionBody, functionEnvironment);
    }
    throw new TypeError(`"${name}" is not a function`);
  },
  // "()": (_ast, _environment, _evaluate) => null,
};

// match priority: exact symbol -> exact type -> all
const getMatchRule = (rules) => {
  // :number, :symbol etc.
  const basicTypes = {};
  // (define ...), (quote ...) etc.
  const symbolMatches = {};
  // (:symbol) etc.
  const listTypes = {};

  Object.entries(rules).forEach(([rule, evaluate]) => {
    const parsedRule = parse(rule);
    if (getAstType(parsedRule) === "list") {
      const [name, type] = parsedRule[0].split(":");
      const validate = (ast) => {
        if (parsedRule[parsedRule.length - 1] !== "...") {
          const expected = parsedRule.length - 1;
          const numberOfArguments = ast.length - 1;
          if (numberOfArguments !== expected) {
            throw new SyntaxError(
              `"${name}" expects ${expected} arguments, instead got ${numberOfArguments}`
            );
          }
        }
        for (let i = 1; i < parsedRule.length; i++) {
          const [_, typei] = parsedRule[i].split(":");
          checkArgumentIs(name, i, typei, ast[i]);
        }
      };
      if (type === undefined) {
        symbolMatches[name] = { evaluate, validate };
      } else {
        listTypes[type] = { evaluate, validate };
      }
    } else {
      const [_, type] = parsedRule.split(":");
      basicTypes[type] = { evaluate };
    }
  });

  const matchRule = (ast) => {
    const type = getAstType(ast);
    if (type !== "list") {
      return basicTypes[type] || basicTypes["all"];
    }
    const [name] = ast;
    const nameType = getType(name);
    if (nameType === "symbol" && symbolMatches[name] !== undefined) {
      return symbolMatches[name];
    }
    return listTypes[nameType] || listTypes["all"];
  };
  const operators = Object.keys(symbolMatches);
  return { matchRule, operators };
};

const environmentWithTypes = {
  "(+ :number :number)": (a, b) => a + b,
  "(- :number :number)": (a, b) => a - b,
  "(print :all)": (a) => console.log(a),
};

const processEnvironment = (environment) => {
  const newEnvironment = {};
  Object.keys(environment).forEach((signature) => {
    const parsedSignature = parse(signature);
    if (getType(parsedSignature) === "symbol") {
      newEnvironment[signature] = environment[signature];
      return;
    }
    const [name, ...variables] = parsedSignature;
    newEnvironment[name] = environment[signature];
    newEnvironment[name].argumentTypes = variables.map((variable) =>
      variable.replace(":", "")
    );
  });
  return newEnvironment;
};

const defaultEnvironment = processEnvironment(environmentWithTypes);
const { matchRule, operators } = getMatchRule(rules);
operators.forEach((element) => {
  defaultEnvironment[element] = `(${element} ...)`;
});

export const evaluate = (ast, environment = { ...defaultEnvironment }) => {
  const { evaluate: ruleEvaluate, validate: ruleValidate } = matchRule(ast);
  if (ruleValidate !== undefined) {
    ruleValidate(ast);
  }
  return ruleEvaluate(ast, environment, evaluate);
};

// Tests
{
  const list = evaluate(parse("(quote (1))"));
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0], 1);
  // sanity check
  try {
    evaluate(parse("(- - -)"));
  } catch (e) {
    assert.strictEqual(
      e.message,
      `"-" expects number as the 1 argument, instead got "(a, b) => a - b"`
    );
  }
}
