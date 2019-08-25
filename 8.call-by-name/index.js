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
const isCallByNameFunction = ast => isList(ast) && ast[0] === "callByName";

const checkNumberOfArguments = (name, numberOfArguments, expected) => {
  if (numberOfArguments !== expected) {
    throw new TypeError(
      `"${name}" expects ${expected} arguments, instead got ${numberOfArguments}`
    );
  }
};

const prettyPrinter = res =>
  isFunction(res)
    ? `(function (${res[1].join(" ")}) (${res[2].join(" ")}))`
    : res;

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
  "-": (a, b) => a - b
};

const evaluate = (ast, environment = { ...defaultEnvironment }) => {
  environment["evaluate"] = body => evaluate(body, environment);
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
  } else if (name === "callByName") {
    checkNumberOfArguments(name, numberOfArguments, 2);
    checkArgumentIsListOfSymbols(name, "first", first);
    return [...ast, environment];
  } else {
    const func = isSymbol(name)
      ? environment[name]
      : evaluate(name, environment);
    if (isNativeFunction(func)) {
      checkNumberOfArguments(name, numberOfArguments, func.length);
      const evaluatedArguments = [];
      for (let i = 0; i < func.length; i++) {
        const evaluatedValue = evaluate(ast[i + 1], environment);
        // checkArgumentIsNumber(name, `${i + 1}`, evaluatedValue);
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
        // checkArgumentIsNumber(name, `${i + 1}`, evaluatedValue);
        functionEnvironment[argumentNames[i]] = evaluatedValue;
      }
      return evaluate(functionBody, functionEnvironment);
    }
    if (isCallByNameFunction(func)) {
      const [_, argumentNames, functionBody, closureEnvironment] = func;
      checkNumberOfArguments(name, numberOfArguments, argumentNames.length);
      const functionEnvironment = { ...environment, ...closureEnvironment };
      for (let i = 0; i < argumentNames.length; i++) {
        functionEnvironment[argumentNames[i]] = ast[i + 1];
      }
      // functionEnvironment["evaluate"] = body =>
      //   evaluate(body, functionEnvironment);
      return evaluate(functionBody, functionEnvironment);
    }
    throw new RuntimeError(
      `"${isSymbol(name) ? name : func}" is not a function`
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
  // quote
  //

  evaluate(parse("(define quote (callByName (x) x))"), testEnvironment);
  const list = evaluate(parse("(quote (1))"), testEnvironment);
  assert.equal(list.length, 1);
  assert.equal(list[0], 1);

  //
  // if
  //

  evaluate(
    parse("(define true  (callByName (x y) (evaluate x)))"),
    testEnvironment
  );
  evaluate(
    parse("(define false (callByName (x y) (evaluate y)))"),
    testEnvironment
  );
  // it doesn't work with call-by-value
  try {
    evaluate(
      parse(`
        (define if-error (function (condition then else)
          ((evaluate condition)
            then
            else
          )
        ))`),
      testEnvironment
    );
    const result = evaluate(
      parse("(if-error (< 2 1) unknownVariable 100)"),
      testEnvironment
    );
    assert.equal(result, 100);
  } catch (e) {
    assert.equal(
      e.message,
      'Can\'t find "unknownVariable" variable. Use `(define unknownVariable ...)` to define it'
    );
  }
  // it does work with call-by-name
  evaluate(
    parse(`
      (define if (callByName (condition then else)
        ((evaluate (evaluate condition))
          (evaluate then)
          (evaluate else)
        )
      ))`),
    testEnvironment
  );
  const result = evaluate(
    parse("(if (< 2 1) unknownVariable 100)"),
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
  // it doesn't work with call-by-value
  try {
    evaluate(
      parse(`
        (define factorial-error (Y
          (function (fact)
            (function (n)
              (if (< n 2)
                1
                (* n (fact (- n 1)))
              )
            )
          )
        ))`),
      testEnvironment
    );
    const factorialFive = evaluate(
      parse("(factorial-error 5)"),
      testEnvironment
    );
    assert.equal(factorialFive, 120);
  } catch (e) {
    assert.equal(e.message, "Maximum call stack size exceeded");
  }
  // it does work with call-by-name
  evaluate(
    parse(`
      (define factorial (Y
        (callByName (fact)
          (function (n)
            (if (< n 2)
              1
              (* n ((evaluate fact) (- n 1)))
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
