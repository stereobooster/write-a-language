// Convert a text into a list of tokens
const tokenize = program =>
  program
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .replace(/^\s+|\s+$/g, "")
    .split(/\s+/g);

class RuntimeError extends Error {}

const parse = program => tokens_to_ast(tokenize(program));

const tokens_to_ast = tokens => {
  if (tokens.length === 0) {
    throw new SyntaxError("Unexpected end of file");
  }
  const token = tokens.shift();
  if (token === "(") {
    let L = [];
    while (tokens[0] !== ")") {
      L.push(tokens_to_ast(tokens));
    }
    tokens.shift(); // pop off ')'
    return L;
  } else if (token === ")") {
    throw new SyntaxError("Unexpected closing parenthesis");
  } else if (!isNaN(parseFloat(token))) {
    // Numbers become numbers
    return parseFloat(token);
  } else {
    // Every other token is a symbol. For simplicity we use strings
    return token;
  }
};

const evaluate = (ast, env = {}) => {
  // number handling, like this: 2
  if (typeof ast === "number") {
    return ast;
  } else if (typeof ast === "string") {
    if (env[ast] === undefined) {
      throw new RuntimeError(
        `Can't find "${ast}" variable. Use \`(define ${ast} 1)\` to define it, where 1 is a value`
      );
    }
    return env[ast];
  } else {
    // function call handling
    let [name, first, second] = ast;
    const numberOfArguments = ast.length - 1;
    if (name === "+") {
      if (numberOfArguments !== 2) {
        throw new RuntimeError(
          `"${name}" call needs 2 arguments, instead got ${numberOfArguments}`
        );
      }
      return evaluate(first, env) + evaluate(second, env);
    } else if (name === "-") {
      if (numberOfArguments !== 2) {
        throw new RuntimeError(
          `"${name}" call needs 2 arguments, instead got ${numberOfArguments}`
        );
      }
      return evaluate(first, env) - evaluate(second, env);
    } else if (name === "define") {
      if (numberOfArguments !== 2) {
        throw new RuntimeError(
          `"${name}" call needs 2 arguments, instead got ${numberOfArguments}`
        );
      }
      if (typeof first !== "string") {
        throw new RuntimeError(
          `Fitst argument of define suppose to be symbol, instead found "${first}"`
        );
      }
      return (env[first] = evaluate(second, env));
    } else {
      throw new RuntimeError(`"${name}" is not a function`);
    }
  }
};

// Tests
const assert = require("assert");
const program = "(- 5 (+ 2 1))";
assert.deepStrictEqual(tokenize(program), [
  "(",
  "-",
  "5",
  "(",
  "+",
  "2",
  "1",
  ")",
  ")"
]);
assert.deepStrictEqual(parse(program), ["-", 5, ["+", 2, 1]]);
assert.deepStrictEqual(evaluate(["-", 5, ["+", 2, 1]]), 2);

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
    if (input !== "") {
      console.log(evaluate(parse(input), env));
    }
  } catch (e) {
    console.log(e.message);
  }
  rl.prompt();
});
