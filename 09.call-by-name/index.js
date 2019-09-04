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
const isCallByNameFunction = ast => isList(ast) && ast[0] === "callByName";
// lazy computation
const isLazy = ast => isList(ast) && ast[0] === "lazy";

const prettyPrinter = (ast, environment = {}) => {
  if (isFunction(ast)) {
    return `F(${prettyPrinter(ast[1])} …)`;
  } else if (isCallByNameFunction(ast)) {
    return `N(${prettyPrinter(ast[1])} …)`;
  } else if (isSymbol(ast)) {
    if (isAtom(environment[ast])) {
      return `${ast}=${environment[ast]}`;
    } else if (isNativeFunction(environment[ast])) {
      return ast;
    } else if (environment[ast] !== undefined) {
      return `${ast}=${prettyPrinter(environment[ast], environment)}`;
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

const isExpression = ast => isList(ast) && !isFunction(ast);

const lazyEvaluate = (ast, environment, depth) => {
  // if we get lazy computation return it
  if (isLazy(ast)) return ast;
  // if we get expression return lazy computation
  if (isExpression(ast)) return ["lazy", ast, environment];
  // special case
  //   if symbol is not defined yet, we postpone evaluation to make it behave more "lazy"
  //   if it won't be defined at the moment of "evaluate" it will result in error
  if (isSymbol(ast) && environment[ast] === undefined)
    return ["lazy", ast, environment];
  // sanity check
  if (!(isSymbol(ast) || isNumber(ast) || isFunction(ast)) && isExpression(ast))
    throw new Error("We don't expect this");
  return evaluate(ast, environment, depth);
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
    return (environment[first] = evaluate(second, environment, depth + 1));
  } else if (name === "function") {
    checkNumberOfArguments(name, numberOfArguments, 2);
    checkArgumentIsListOfSymbols(name, "first", first);
    checkArgumentIsList(name, "second", second);
    return [...ast, environment];
  } else if (name === "callByName") {
    checkNumberOfArguments(name, numberOfArguments, 2);
    checkArgumentIsListOfSymbols(name, "first", first);
    return [...ast, environment];
  } else if (name === "lazy") {
    return evaluate(first, second, depth + 1);
  } else {
    const func = evaluate(name, environment, depth + 1);
    if (isNativeFunction(func)) {
      checkNumberOfArguments(name, numberOfArguments, func.length);
      const evaluatedArguments = [];
      for (let i = 0; i < func.length; i++) {
        const evaluatedValue = evaluate(ast[i + 1], environment, depth + 1);
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
        const evaluatedValue = evaluate(ast[i + 1], environment, depth + 1);
        // checkArgumentIsNumber(name, `${i + 1}`, evaluatedValue);
        functionEnvironment[argumentNames[i]] = evaluatedValue;
      }
      return evaluate(functionBody, functionEnvironment, depth + 1);
    }
    if (isCallByNameFunction(func)) {
      const [_, argumentNames, functionBody, closureEnvironment] = func;
      checkNumberOfArguments(name, numberOfArguments, argumentNames.length);
      const functionEnvironment = { ...environment, ...closureEnvironment };
      for (let i = 0; i < argumentNames.length; i++) {
        functionEnvironment[argumentNames[i]] = lazyEvaluate(
          ast[i + 1],
          environment,
          depth + 1
        );
      }
      return evaluate(functionBody, functionEnvironment, depth + 1);
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

  // we use `'` to denote that the variable isn't evaluated

  //
  // if
  //

  evaluate(
    parse("(define true  (callByName (x' y') (evaluate x')))"),
    testEnvironment
  );
  evaluate(
    parse("(define false (callByName (x' y') (evaluate y')))"),
    testEnvironment
  );
  evaluate(
    parse("(define less (callByName (x' y') (evaluate (< x' y'))))"),
    testEnvironment
  );
  // it does work with call-by-name
  evaluate(
    parse(`
      (define if (callByName (condition' then' else')
        (
          (evaluate condition')
          (evaluate then')
          (evaluate else')
        )
      ))`),
    testEnvironment
  );
  // values work
  let result = evaluate(
    parse("(if (less 2 1) unknownVariable 100)"),
    testEnvironment
  );
  assert.equal(result, 100);
  // expressions work
  result = evaluate(
    parse("(if (less 2 1) (unknownVariable) (+ 99 1))"),
    testEnvironment
  );
  assert.equal(result, 100);

  // it doesn't work with call-by-value
  try {
    evaluate(
      parse(`
        (define if2 (function
          (condition then else)
          (condition then else)
        ))`),
      testEnvironment
    );
    let result = evaluate(
      parse("(if2 (less 2 1) unknownVariable 100)"),
      testEnvironment
    );
    assert.equal(result, 100);
  } catch (e) {
    assert.equal(
      e.message,
      'Can\'t find "unknownVariable" variable. Use `(define unknownVariable ...)` to define it'
    );
  }

  //
  // The Y combinator https://mvanier.livejournal.com/2897.html
  //

  evaluate(
    parse(`
      (define Y
        (callByName (f')
          ((evaluate f') (Y f'))
        )
      )`),
    testEnvironment
  );
  // it does work with call-by-name
  evaluate(
    parse(`
      (define factorial (Y
        (callByName (fact')
          (function (n)
            (if (less n 2)
              1
              (* n ((evaluate fact') (- n 1)))
            )
          )
        )
      ))`),
    testEnvironment
  );
  const factorialFive = evaluate(parse("(factorial 5)"), testEnvironment);
  assert.equal(factorialFive, 120);

  // it doesn't work with call-by-value
  try {
    evaluate(
      parse(`
        (define Y2
          (function (f)
            (f (Y2 f))
          )
        )`),
      testEnvironment
    );
    evaluate(
      parse(`
        (define factorial2 (Y2
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
    const factorialFive = evaluate(parse("(factorial2 5)"), testEnvironment);
    assert.equal(factorialFive, 120);
  } catch (e) {
    assert.equal(e.message, "Maximum call stack size exceeded");
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
      console.log("=", prettyPrinter(evaluate(parse(input), environment)));
    }
  } catch (e) {
    console.log(e.message);
  }
  rl.prompt();
});
