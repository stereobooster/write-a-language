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
const isSymbol = ast => typeof ast === "string";
// function represented as list (triple) with first item function
const isFunction = ast => isList(ast) && ast[0] === "function";
const isNativeFunction = ast => typeof ast === "function";

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
    (typeof value === "string" &&
      (typeof environment[value] === "number" ||
        // ignore undefined because it will throw exception later
        typeof environment[value] === "undefined")) ||
    // define can evaluate to number, but we ignore this for simplicity
    (isExpression(value) && value[0] !== "function" && value[0] !== "define");
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
  "+": (a, b) => a + b,
  "-": (a, b) => a - b
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
    return (environment[first] = evaluate(second, environment));
  } else if (name === "function") {
    checkNumberOfArguments(name, numberOfArguments, 2);
    checkArgumentIsListOfSymbols(name, "first", first);
    checkArgumentIsList(name, "second", second);
    return [...ast, environment];
  } else {
    if (isNativeFunction(environment[name])) {
      checkNumberOfArguments(name, numberOfArguments, environment[name].length);
      const evaluatedArguments = [];
      for (let i = 0; i < environment[name].length; i++) {
        const argumentValue = ast[i + 1];
        checkArgumentIsNumber(name, `${i + 1}`, argumentValue, environment);
        evaluatedArguments[i] = evaluate(argumentValue, environment);
      }
      return environment[name](...evaluatedArguments);
    }
    if (isFunction(environment[name])) {
      const [_, argumentNames, functionBody, closureEnvironment] = environment[
        name
      ];
      checkNumberOfArguments(name, numberOfArguments, argumentNames.length);
      const functionEnvironment = { ...environment, ...closureEnvironment };
      for (let i = 0; i < argumentNames.length; i++) {
        const argumentValue = ast[i + 1];
        checkArgumentIsNumber(name, `${i + 1}`, argumentValue, environment);
        functionEnvironment[argumentNames[i]] = evaluate(
          argumentValue,
          environment
        );
      }
      return evaluate(functionBody, functionEnvironment);
    }
    throw new RuntimeError(`"${name}" is not a function`);
  }
};

// Tests
const assert = require("assert");
{
  // single argument
  assert.equal(evaluate(parse("(id 1)"), { id: x => x }), 1);
  let testEnvironment = { ...defaultEnvironment };
  // sanity check
  assert.equal(evaluate(parse("(- 2 1)"), testEnvironment), 1);
  // closures
  evaluate(
    parse(`
      (define getFun
        (function (x y)
          (function (i j)
            (- (+ x y) (+ i j))
          )
        )
      )`),
    testEnvironment
  );
  evaluate(parse(`(define fun (getFun 5 4))`), testEnvironment);
  assert.equal(evaluate(parse(`(fun 3 2)`), testEnvironment), 4);
  // global variable defined after function
  evaluate(
    parse(`
      (define getPluzz
        (function ()
          (function (x y) (+ z (+ x y)))
        )
      )`),
    testEnvironment
  );
  evaluate(parse("(define pluzzz (getPluzz))"), testEnvironment);
  evaluate(parse("(define z 13)"), testEnvironment);
  assert.equal(evaluate(parse("(pluzzz 2 1)"), testEnvironment), 16);
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

const prettyPrinter = res =>
  isFunction(res)
    ? `(function (${res[1].join(" ")}) (${res[2].join(" ")}))`
    : res;

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
