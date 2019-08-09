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

// tests
const assert = require("assert");

try {
  parse(")");
} catch (e) {
  assert.equal(e.message, `Unexpected ")"`);
}
try {
  parse("(* 2 2");
} catch (e) {
  assert.equal(e.message, `Expected ")" at the end of the input`);
}
try {
  console.log(parse("()+"));
} catch (e) {
  assert.equal(e.message, `Unexpected "+" after ")"`);
}

class RuntimeError extends Error {}

class TypeError extends Error {}

const evaluate = (ast, env = {}) => {
  // function call handling
  let [name, first, second] = ast;
  const numberOfArguments = ast.length - 1;
  if (name === "+") {
    if (numberOfArguments !== 2) {
      throw new TypeError(
        `"${name}" needs 2 arguments, instead got ${numberOfArguments}`
      );
    }
    if (!Array.isArray(first) && typeof first !== "number") {
      throw new TypeError(
        `"${name}" expects number as the first argument, instead got "${first}"`
      );
    }
    if (!Array.isArray(second) && typeof firsecondst !== "number") {
      throw new TypeError(
        `"${name}" expects number as the second argument, instead got "${second}"`
      );
    }
    return evaluate(first, env) + evaluate(second, env);
  } else if (name === "-") {
    if (numberOfArguments !== 2) {
      throw new TypeError(
        `"${name}" needs 2 arguments, instead got ${numberOfArguments}`
      );
    }
    if (!Array.isArray(first) && typeof first !== "number") {
      throw new TypeError(
        `"${name}" expects number as the first argument, instead got "${first}"`
      );
    }
    if (!Array.isArray(second) && typeof firsecondst !== "number") {
      throw new TypeError(
        `"${name}" expects number as the second argument, instead got "${second}"`
      );
    }
    return evaluate(first, env) - evaluate(second, env);
  } else {
    throw new RuntimeError(`"${name}" is not a function`);
  }
};

// Tests
try {
  evaluate(parse("(* 2 2)"));
} catch (e) {
  assert.equal(e.message, `"*" is not a function`);
}
try {
  evaluate(parse("(+ 2 2 2)"));
} catch (e) {
  assert.equal(e.message, `"+" needs 2 arguments, instead got 3`);
}
try {
  evaluate(parse("(+ x x)"));
} catch (e) {
  assert.equal(
    e.message,
    `"+" expects number as the first argument, instead got "x"`
  );
}

const env = {};

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
      console.log(evaluate(parse(input)));
    }
  } catch (e) {
    console.log(e.message);
  }
  rl.prompt();
});
