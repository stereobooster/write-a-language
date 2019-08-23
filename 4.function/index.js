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

const isExpression = ast => Array.isArray(ast);
const isList = ast => Array.isArray(ast);
const isSymbol = ast => typeof value !== "string";

const checkNumberOfArguments = (name, numberOfArguments, expected) => {
  if (numberOfArguments !== expected) {
    throw new TypeError(
      `"${name}" expects ${expected} arguments, instead got ${numberOfArguments}`
    );
  }
};
const checkArgumentIsNumber = (name, position, value, environment) => {
  const isNumber =
    typeof value === "number" ||
    (typeof value === "string" && typeof environment[value] === "number") ||
    (isExpression(value) && value[0] !== "define" && value[0] !== "function");
  if (!isNumber) {
    throw new TypeError(
      `"${name}" expects number as the ${position} argument, instead got "${value}"`
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
  "+": (x, y) => x + y,
  "-": (x, y) => x - y
};

const evaluate = (ast, environment = { ...defaultEnvironment }) => {
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
  let [name, first, second] = ast;
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
    return (environment[first] = evaluate(second, environment));
  } else if (
    name === "function"
    // name === "lambda" || // classical name for anonymous function
    // name === "λ" || // greek letter for lambda
    // name === "\\" // a lot of keyboard misses lambda letter, so people use slash instead
  ) {
    checkNumberOfArguments(name, numberOfArguments, 2);
    checkArgumentIsListOfSymbols(name, "first", first);
    checkArgumentIsList(name, "second", second);
    const argumentNames = first;
    const functionBody = second;
    return (_first, _second) => {
      const closureEnvironment = {
        ...environment,
        [argumentNames[0]]: _first,
        [argumentNames[1]]: _second
      };
      return evaluate(functionBody, closureEnvironment);
    };
  } else {
    if (typeof environment[name] === "function") {
      // assume all functions expect 2 numbers
      checkNumberOfArguments(name, numberOfArguments, 2);
      checkArgumentIsNumber(name, "first", first, environment);
      checkArgumentIsNumber(name, "second", second, environment);
      return environment[name](
        evaluate(first, environment),
        evaluate(second, environment)
      );
    } else {
      throw new RuntimeError(`"${name}" is not a function`);
    }
  }
};

// Tests
const assert = require("assert");
{
  let testEnvironment = { ...defaultEnvironment };
  // "external" functions
  assert.equal(evaluate(parse("(* 2 2)"), { "*": (x, y) => x * y }), 4);
  // application of arguments
  evaluate(parse("(define minus (function (x y) (- x y)))"), testEnvironment);
  assert.equal(evaluate(parse("(minus 2 1)"), testEnvironment), 1);
  // evaluation of arguments
  assert.equal(evaluate(parse("(minus (+ 1 1) 1)"), testEnvironment), 1);
  // shadow variables
  assert.equal(evaluate(parse("(define x 10)"), testEnvironment), 10);
  assert.equal(evaluate(parse("(minus 2 x)"), testEnvironment), -8);
  // type checking
  try {
    evaluate(parse("(function 1 (- x y))"), testEnvironment);
  } catch (e) {
    assert.equal(
      e.message,
      `"function" expects list as the first argument, instead got "1"`
    );
  }
  try {
    evaluate(parse("(function (x y) 1)"), testEnvironment);
  } catch (e) {
    assert.equal(
      e.message,
      `"function" expects list as the second argument, instead got "1"`
    );
  }
  try {
    evaluate(parse("(minus minus minus)"), testEnvironment);
  } catch (e) {
    assert.equal(
      e.message,
      `"minus" expects number as the first argument, instead got "minus"`
    );
  }
  // recursion
  try {
    evaluate(
      parse("(define recursion (function (x y) (recursion x y)))"),
      testEnvironment
    );
    evaluate(parse("(recursion 1 2)"), testEnvironment);
  } catch (e) {
    assert.equal(e.message, `Maximum call stack size exceeded`);
  }
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
      console.log(evaluate(parse(input), environment));
    }
  } catch (e) {
    console.log(e.message);
  }
  rl.prompt();
});
