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

const isList = ast => Array.isArray(ast);
const isSymbol = ast => typeof ast === "string";
// function represented as list (triple) with first item function
const isFunction = ast => isList(ast) && ast[0] === "function";
const isNativeFunction = ast => typeof ast === "function";

const prettyPrinter = res =>
  isFunction(res)
    ? `(function (${res[1].join(" ")}) (${res[2].join(" ")}))`
    : res;

const checkNumberOfArguments = (name, numberOfArguments, expected) => {
  if (numberOfArguments !== expected) {
    throw new TypeError(
      `"${name}" expects ${expected} arguments, instead got ${numberOfArguments}`
    );
  }
};
const checkArgumentIsNumber = (name, position, value, environment) => {
  const isNumber = typeof value === "number";
  if (!isNumber) {
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
  "-": (a, b) => a - b,
  "<": (a, b) => a < b,
  true: true,
  false: false
};

const keywords = ["define", "function", "if"];

const evaluate = (ast, environment = { ...defaultEnvironment }) => {
  if (typeof ast === "string") {
    if (environment[ast] === undefined) {
      throw new RuntimeError(
        `Can't find "${ast}" variable. Use \`(define ${ast} ...)\` to define it`
      );
    }
    if (keywords.includes(ast))
      throw new RuntimeError(`Can't get value of built-in function "${first}"`);
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
    if (environment[first] !== undefined)
      throw new RuntimeError(`Can't redefine "${first}" variable`);
    if (keywords.includes(first))
      throw new RuntimeError(`Can't redefine built-in function "${first}"`);
    return (environment[first] = evaluate(second, environment));
  } else if (name === "function") {
    checkNumberOfArguments(name, numberOfArguments, 2);
    checkArgumentIsListOfSymbols(name, "first", first);
    checkArgumentIsList(name, "second", second);
    return [...ast, environment];
  } else if (name === "if") {
    checkNumberOfArguments(name, numberOfArguments, 3);
    const [_, condition, thenAction, elseAction] = ast;
    const conditionResult = evaluate(condition, environment);
    if (conditionResult === true) {
      return evaluate(thenAction, environment);
    } else if (conditionResult === false) {
      return evaluate(elseAction, environment);
    } else {
      throw new TypeError(
        `"if" condition should evaluate to true or false. Instead got ${conditionResult}`
      );
    }
  } else {
    const func = evaluate(name, environment);
    if (isNativeFunction(func)) {
      checkNumberOfArguments(name, numberOfArguments, func.length);
      const evaluatedArguments = [];
      for (let i = 0; i < func.length; i++) {
        const evaluatedValue = evaluate(ast[i + 1], environment);
        checkArgumentIsNumber(name, `${i + 1}`, evaluatedValue);
        evaluatedArguments[i] = evaluatedValue;
      }
      return func(...evaluatedArguments);
    }
    if (isFunction(func)) {
      const [_, argumentNames, functionBody, closureEnvironment] = func;
      checkNumberOfArguments(name, numberOfArguments, argumentNames.length);
      const functionEnvironment = { ...environment, ...closureEnvironment };
      for (let i = 0; i < argumentNames.length; i++) {
        const evaluatedValue = evaluate(ast[i + 1], environment);
        checkArgumentIsNumber(name, `${i + 1}`, evaluatedValue);
        functionEnvironment[argumentNames[i]] = evaluatedValue;
      }
      return evaluate(functionBody, functionEnvironment);
    }
    throw new RuntimeError(`"${name}" is not a function`);
  }
};

// Tests
const assert = require("assert");
{
  // values work
  let result = evaluate(parse("(if (< 2 1) unknownVariable 100)"));
  assert.equal(result, 100);
  // expressions work
  result = evaluate(parse("(if (< 2 1) (unknownVariable) (+ 99 1))"));
  assert.equal(result, 100);
  // values in condition work
  result = evaluate(parse("(if false (unknownVariable) (+ 99 1))"));
  assert.equal(result, 100);
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
