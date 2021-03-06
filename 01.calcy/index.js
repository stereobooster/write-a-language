// Convert a text into a list of tokens
const tokenize = program =>
  program
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .replace(/^\s+|\s+$/g, "")
    .split(/\s+/g);

const parse = program => tokens_to_ast(tokenize(program));

const tokens_to_ast = tokens => {
  if (tokens.length === 0) {
    throw new SyntaxError("Expected ')' at the end of input");
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
    throw new SyntaxError("Unexpected ')'");
  } else if (!isNaN(parseFloat(token))) {
    // numbers
    return parseFloat(token);
  } else {
    // symbols, which we represent as JS strings
    return token;
  }
};

const evaluate = ast => {
  // number handling, like this: 2
  if (typeof ast === "number") {
    return ast;
  } else {
    // function call handling
    let [name, first, second] = ast;
    if (name === "+") {
      return evaluate(first) + evaluate(second);
    } else if (name === "-") {
      return evaluate(first) - evaluate(second);
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
      console.log("=", evaluate(parse(input)));
    }
  } catch (e) {
    console.log(e.message);
  }
  rl.prompt();
});
