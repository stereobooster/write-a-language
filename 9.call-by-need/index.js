// Convert a text into a list of tokens
const tokenize = program =>
  program
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .replace(/^\s+|\s+$/g, "")
    .split(/\s+/g);

const parse = program => tokens_to_ast(tokenize(program));

const tokens_to_ast = (tokens, subcall = false) => {
  if (tokens.length === 0) {
    throw new SyntaxError(`Expected ")" at the end of the input`);
  }
  const token = tokens.shift();
  if (token === "(") {
    let L = [];
    while (tokens[0] !== ")") {
      L.push(tokens_to_ast(tokens, true));
    }
    tokens.shift(); // pop off ')'
    if (!subcall && tokens.length !== 0) {
      throw new SyntaxError(`Unexpected "${tokens[0]}" after ")"`);
    }
    return L;
  } else if (token === ")") {
    throw new SyntaxError(`Unexpected ")"`);
  } else if (!isNaN(parseFloat(token))) {
    // numbers
    return parseFloat(token);
  } else {
    // symbols, which we represent as JS strings
    return token;
  }
};

class RuntimeError extends Error {}
class TypeError extends Error {}

const isNumber = ast => typeof value === "number";
const isSymbol = ast => typeof ast === "string";
const isAtom = ast => isNumber(ast) || isSymbol(ast);
const isList = ast => Array.isArray(ast);
// detects function value, but not function expression
const isFunction = ast =>
  isList(ast) && ast[0] === "function" && ast.length === 4;
const isNativeFunction = ast => typeof ast === "function";
const isLazy = ast => isList(ast) && ast[0] === "lazy";

const isExpression = ast => isList(ast) && !isFunction(ast);

const lazyEvaluate = (ast, environment, depth) => {
  // if we get lazy computation return it
  if (isLazy(ast)) return ast;
  // if we get expression return lazy computation
  if (isExpression(ast)) return ["lazy", ast, environment];
  // sanity check
  if (!(isSymbol(ast) || isNumber(ast) || isFunction(ast)) && isExpression(ast))
    throw new Error("We don't expect this");
  return evaluate(ast, environment, depth);
};

const prettyPrinter = (ast, environment = {}) => {
  if (isFunction(ast)) {
    return `F(${prettyPrinter(ast[1])} …)`;
    // return `F ${prettyPrinter(ast[1])} ${prettyPrinter(ast[2])}`;
  } else if (isSymbol(ast)) {
    if (isAtom(environment[ast])) {
      return `${ast}=${environment[ast]}`;
    } else if (isNativeFunction(environment[ast])) {
      return ast;
    } else if (environment[ast] !== undefined) {
      return `${ast}=${prettyPrinter(environment[ast], environment)}`;
      // return `${ast}=${prettyPrinter(environment[ast], environment)}`;
    } else {
      return ast;
    }
  } else if (isLazy(ast)) {
    return `L${prettyPrinter(ast[1])}`;
  } else if (isList(ast)) {
    return `(${ast.map(x => prettyPrinter(x, environment)).join(" ")})`;
  } else {
    return ast;
  }
};

const printStack = (ast, environment, depth) =>
  // stack trace for debugging
  console.log(`${"  ".repeat(depth)}${prettyPrinter(ast, environment)}`);

const checkNumberOfArguments = (name, numberOfArguments, expected) => {
  if (numberOfArguments !== expected) {
    throw new TypeError(
      `"${name}" expects ${expected} arguments, instead got ${numberOfArguments}`
    );
  }
};
const checkArgumentIsNumber = (name, position, value, environment) => {
  if (!isNumber(value)) {
    throw new TypeError(
      `"${name}" expects number as the ${position} argument, instead got "${prettyPrinter(
        value
      )}"`
    );
  }
};
const checkArgumentIsSymbol = (name, position, value) => {
  if (!isSymbol(value)) {
    throw new TypeError(
      `"${name}" expects symbol as the ${position} argument, instead got "${value}"`
    );
  }
};
const checkArgumentIsList = (name, position, value) => {
  if (!isList(value)) {
    throw new TypeError(
      `"${name}" expects list as the ${position} argument, instead got "${value}"`
    );
  }
};
const checkArgumentIsListOfSymbols = (name, position, value) => {
  if (!isList(value) || value.some(x => !isSymbol(x))) {
    throw new TypeError(
      `"${name}" expects list as the ${position} argument, instead got "${value}"`
    );
  }
};

const defaultEnvironment = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b
};

const evaluate = (ast, environment = { ...defaultEnvironment }, depth = 0) => {
  // stack trace for debugging
  // printStack(ast, environment, depth);
  environment["evaluate"] = body => evaluate(body, environment, depth + 1);
  if (typeof ast === "string") {
    if (environment[ast] === undefined) {
      throw new RuntimeError(
        `Can't find "${ast}" variable. Use \`(define ${ast} ...)\` to define it`
      );
    }
    return environment[ast];
  } else if (typeof ast === "number") {
    return ast;
  }
  // function call handling
  const [name, first, second] = ast;
  const numberOfArguments = ast.length - 1;
  if (name === "define") {
    checkNumberOfArguments(name, numberOfArguments, 2);
    checkArgumentIsSymbol(name, "first", first);
    if (
      environment[first] !== undefined ||
      first === "define" ||
      first === "function"
    ) {
      throw new RuntimeError(`Can't redefine "${first}" variable`);
    }
    return (environment[first] = lazyEvaluate(second, environment, depth + 1));
  } else if (name === "function") {
    checkNumberOfArguments(name, numberOfArguments, 2);
    checkArgumentIsListOfSymbols(name, "first", first);
    // checkArgumentIsList(name, "second", second);
    return [...ast, environment];
  } else if (name === "lazy") {
    // return evaluate(first, second, depth + 1);
    let result = evaluate(first, second, depth + 1);
    while (isLazy(result)) {
      result = evaluate(result, environment, depth + 1);
    }
    return result;
  } else {
    let func = isSymbol(name)
      ? environment[name]
      : evaluate(name, environment, depth + 1);

    if (isLazy(func)) {
      func = evaluate(func, environment, depth + 1);
    }

    if (isNativeFunction(func)) {
      checkNumberOfArguments(name, numberOfArguments, func.length);
      const evaluatedArguments = [];
      for (let i = 0; i < func.length; i++) {
        const evaluatedValue = evaluate(ast[i + 1], environment, depth + 1);
        evaluatedArguments[i] = evaluatedValue;
      }
      return func(...evaluatedArguments);
    }
    if (isFunction(func)) {
      const [_, argumentNames, functionBody, closureEnvironment] = func;
      checkNumberOfArguments(name, numberOfArguments, argumentNames.length);
      let functionEnvironment = {};
      for (let i = 0; i < argumentNames.length; i++) {
        functionEnvironment[argumentNames[i]] = lazyEvaluate(
          ast[i + 1],
          environment,
          depth + 1
        );
      }
      functionEnvironment = {
        ...environment,
        ...closureEnvironment,
        ...functionEnvironment
      };
      let result = evaluate(functionBody, functionEnvironment, depth + 1);
      if (depth === 0 && isLazy(result)) {
        result = evaluate(result, environment, depth + 1);
      }
      return result;
    }
    throw new RuntimeError(
      `"${isSymbol(name) ? name : func}" (${func}) is not a function`
    );
  }
};

// Tests
const assert = require("assert");
{
  const testEnvironment = {
    ...defaultEnvironment,
    "<": (a, b) => (a < b ? "true" : "false"),
    "*": (a, b) => a * b
  };

  //
  // if
  //

  evaluate(parse("(define true  (function (x y) x))"), testEnvironment);
  evaluate(parse("(define false (function (x y) y))"), testEnvironment);
  evaluate(
    parse("(define less (function (x y) (evaluate (< x y))))"),
    testEnvironment
  );
  evaluate(
    parse(`
      (define if (function
        (condition then else)
        (condition then else)
      ))`),
    testEnvironment
  );
  const result = evaluate(
    parse("(if (less 2 1) (+ 1 unknownVariable) (+ 1 99))"),
    testEnvironment
  );
  assert.equal(result, 100);

  //
  // The Y combinator https://mvanier.livejournal.com/2897.html
  //

  evaluate(
    parse(`
      (define Y
        (function (f)
          (f (Y f))
        )
      )`),
    testEnvironment
  );
  evaluate(
    parse(`
      (define factorial (Y
        (function (fact)
          (function (n)
            (if (less n 2)
              (+ 1 0)
              (* n (fact (- n 1)))
            )
          )
        )
      ))`),
    testEnvironment
  );
  const factorialFive = evaluate(parse("(factorial 5)"), testEnvironment);
  assert.equal(factorialFive, 120);
}

const environment = { ...defaultEnvironment };

// REPL
const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "calcy> "
});
rl.prompt();

rl.on("line", input => {
  try {
    if (input.trim() !== "") {
      console.log("=", prettyPrinter(evaluate(parse(input), environment)));
    }
  } catch (e) {
    console.log(e.message);
  }
  rl.prompt();
});
