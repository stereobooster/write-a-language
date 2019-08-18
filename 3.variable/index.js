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
const checkNumberOfArguments = (name, numberOfArguments, expected) => {
  if (numberOfArguments !== expected) {
    throw new TypeError(
      `"${name}" expects ${expected} arguments, instead got ${numberOfArguments}`
    );
  }
};
const checkArgumentIsNumber = (name, position, value) => {
  if (!isExpression(value) && typeof value !== "number") {
    throw new TypeError(
      `"${name}" expects number as the ${position} argument, instead got "${value}"`
    );
  }
};
const checkArgumentIsSymbol = (name, position, value) => {
  if (typeof value !== "string") {
    throw new TypeError(
      `"${name}" expects symbol as the ${position} argument, instead got "${value}"`
    );
  }
};

const evaluate = (ast, environment = {}) => {
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
  if (name === "+") {
    checkNumberOfArguments(name, numberOfArguments, 2);
    return evaluate(first, environment) + evaluate(second, environment);
  } else if (name === "-") {
    checkNumberOfArguments(name, numberOfArguments, 2);
    return evaluate(first, environment) - evaluate(second, environment);
  } else if (name === "define") {
    checkNumberOfArguments(name, numberOfArguments, 2);
    checkArgumentIsSymbol(name, "first", first);
    if (environment[first] !== undefined || first === "+" || first === "-") {
      throw new RuntimeError(`Can't redefine "${first}" variable`);
    }
    return (environment[first] = evaluate(second, environment));
  } else {
    throw new RuntimeError(`"${name}" is not a function`);
  }
};

// Tests
const assert = require("assert");
{
  let testEnvironment = {};
  assert.equal(evaluate(parse("(define x 1)"), testEnvironment), 1);
  assert.equal(testEnvironment["x"], 1);

  assert.equal(evaluate(parse("(+ x x)"), { x: 1 }), 2);

  try {
    evaluate(parse("(+ x x)"), {});
  } catch (e) {
    assert.equal(
      e.message,
      'Can\'t find "x" variable. Use `(define x ...)` to define it'
    );
  }

  try {
    evaluate(parse("(define 1 1)"), {});
  } catch (e) {
    assert.equal(
      e.message,
      `"define" expects symbol as the first argument, instead got "1"`
    );
  }

  try {
    evaluate(parse("(define x 1)"), { x: 1 });
  } catch (e) {
    assert.equal(e.message, `Can't redefine "x" variable`);
  }

  testEnvironment = { y: 1 };
  evaluate(parse("(define x y)"), testEnvironment);
  assert.equal(testEnvironment["x"], 1);

  try {
    evaluate(parse("(define x x)"));
  } catch (e) {
    assert.equal(
      e.message,
      'Can\'t find "x" variable. Use `(define x ...)` to define it'
    );
  }

  try {
    testEnvironment = {};
    evaluate(parse("(define + 1)"), testEnvironment);
    // we don't want this to be valid program
    evaluate(parse("(+ + +)"), testEnvironment);
  } catch (e) {
    assert.equal(e.message, `Can't redefine "+" variable`);
  }
}

const environment = {};

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
