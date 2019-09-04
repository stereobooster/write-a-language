// Convert a text into a list of tokens
const tokenize = program =>
  program
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .replace(/\\/g, " \\ ")
    .replace(/λ/g, " λ ")
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
    // } else if (!isNaN(parseFloat(token))) {
    //   // numbers
    //   return parseFloat(token);
  } else {
    // symbols, which we represent as JS strings
    return token;
  }
};

class RuntimeError extends Error {}
class TypeError extends Error {}

const isList = ast => Array.isArray(ast);
const isLambdaSymbol = ast => ast === "\\" || ast === "λ" || ast === "lambda";
const isLambdaTerm = ast =>
  isList(ast) && ast.length === 3 && isLambdaSymbol(ast[0]);
const isApplicationTerm = ast => isList(ast) && ast.length === 2;

const isApplication = ast => {
  return isApplicationTerm(ast) && isLambdaTerm(ast[0]);
};

const parenthesise = (ast, parenthesis) =>
  isList(ast) && ast.length > 1 && !isLambdaTerm(ast)
    ? `(${prettyPrint(ast, parenthesis)})`
    : prettyPrint(ast, parenthesis);

const prettyPrintVariables = ast => (isList(ast) ? ast.join("") : ast);
// {
//   if (isList(ast)) {
//     if (ast.length > 1) {
//       return `(${ast.join(" ")})`;
//     } else {
//       return ast.join("");
//     }
//   } else {
//     return ast;
//   }
// };

const prettyPrint = (ast, parenthesis = false) => {
  // lambda
  if (isLambdaTerm(ast)) {
    const [lambda, variables, body] = ast;
    parenthesis = parenthesis || isApplication(body);
    return `λ${prettyPrintVariables(variables)}.${prettyPrint(
      body,
      parenthesis
    )}`;
  } else if (isApplicationTerm(ast)) {
    const [operator, operand] = ast;
    return `${
      isLambdaTerm(operator)
        ? "(" + prettyPrint(operator, parenthesis) + ")"
        : prettyPrint(operator, parenthesis)
    } ${prettyPrint(operand, parenthesis)}`;
  } else if (isList(ast)) {
    return ast.map(x => prettyPrint(x, parenthesis)).join(" ");
  } else {
    return ast;
  }
};

const curry = ast => {
  if (!isLambdaTerm(ast)) {
    throw new RuntimeError(`Lambda term expected (${ast})`);
  }
  const [lambda, variables, body] = ast;
  if (variables.length === 1) return ast;
  let newAst = body;
  for (let i = variables.length - 1; i >= 0; i--) {
    newAst = [lambda, variables[i], newAst];
  }
  return newAst;
};
// const uncurry = ast => {

const beta = ast => {
  if (!isApplication(ast)) {
    throw new RuntimeError(`Application term expected (${ast})`);
  }
  const [lambda, argument] = ast;
  let [_, variables, body] = lambda;
  variables = isList(variables) ? variables : [variables];
  body = isList(body) ? body : [body];
  const [variable, ...restVariables] = variables;
  // reduction
  body = body.map(x => (x === variable ? argument : x));
  return variables.length === 1 ? body : [_, restVariables, body];
};

const alpha = (ast, argument) => {
  if (!isLambdaTerm(ast)) {
    throw new RuntimeError(`Lambda term expected (${ast})`);
  }
  let [_, variables, body] = ast;
  variables = isList(variables) ? variables : [variables];
  body = isList(body) ? body : [body];
  const [variable, ...restVariables] = variables;
  // reduction
  body = body.map(x => (x === variable ? argument : x));
  return [_, [argument, ...restVariables], body];
};

// η-conversion
const eta = ast => {
  if (!isLambdaTerm(ast)) {
    throw new RuntimeError(`Lambda term expected (${ast})`);
  }
  let [_, variables, body] = ast;
  variables = isList(variables) ? variables : [variables];
  body = isList(body) ? body : [body];
  const [variable, ...restVariables] = variables;
  return variables.length === 1 &&
    isApplicationTerm(body) &&
    body[1] === variable
    ? body[0]
    : ast;
};
// const uneta = ast => {

const reduce = (ast, environment, depth) => {};

// Tests
const assert = require("assert");
{
  assert.equal(prettyPrint(parse("(λx x)")), "λx.x");
  assert.equal(prettyPrint(parse("(λ x x)")), "λx.x");
  assert.equal(prettyPrint(parse("(λ (x) (x))")), "λx.x");
  assert.equal(prettyPrint(parse("(λ (x y) (x y))")), "λxy.x y");
  assert.equal(prettyPrint(parse("(λ (x y) (x y))"), true), "λxy.x y");
  assert.equal(prettyPrint(parse("((λ(x y) (y x)) (λx x))")), "(λxy.y x) λx.x");
  assert.equal(prettyPrint(parse("(λx ((λy y) x))")), "λx.(λy.y) x");

  // currying
  const curried = curry(parse("(λ (x y) (x y))"));
  assert.equal(prettyPrint(curried), "λx.λy.x y");

  // α-renaming
  assert.equal(prettyPrint(alpha(parse("(λx x)"), "z")), "λz.z");

  // beta
  assert.equal(prettyPrint(beta(parse("((λx x) z)"))), "z");
  assert.equal(prettyPrint(beta(parse("((λx x) (λx x))"))), "λx.x");
  assert.equal(prettyPrint(beta(parse("((λ (x y) x) (λx x))"))), "λy.λx.x");
  // error - we need De Bruijn Representation
  // assert.equal(prettyPrint(beta(parse("((λ (x y) x) (λy y))"))), "λy.λx.x");

  // eta
  assert.equal(prettyPrint(eta(parse("(λx ((λy y) x))"))), "λy.y");
  assert.equal(prettyPrint(eta(parse("(λ (x z) ((λy y) x))"))), "λxz.(λy.y) x");
}

// REPL
const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "lamby> "
});
rl.prompt();

rl.on("line", input => {
  try {
    if (input.trim() !== "") {
      console.log("=", reduce(parse(input)));
    }
  } catch (e) {
    console.log(e.message);
  }
  rl.prompt();
});
