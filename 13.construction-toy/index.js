
import readline from "readline";
import { parse } from "./parser.js"
import { defaultEnvironment, evaluate, prettyPrinter } from "./evaluator.js"

const environment = { ...defaultEnvironment };

// REPL
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
