# Lego Lisp

To run CLI REPL

```sh
node index.js
```

Requires Node.js >= v13

Let's make a programming language in which we can easily add features - e.g. adding new features doesn't reuire change of existing features, like Lego blocks.

Basic set of features (core):

- application of a native function, for example `(someFunction someVariableOrValue)`
- application of a function, for example `(someFunction someVariableOrValue)`
- anonymous function, for example `(function () ())`
- variable substitution
- variable binding, for example `(define someVariable someValue)`

AST types: `list`, `symbol`
Types: `symbol`, `function`, `nativeFunction`
Operators: `function`, `define`, `()` (application), variable substitutions
Native functions: -

### Numbers

AST types: `number`
Types: `number`
Operators: -
Native functions: for example, `+`, `-`, etc.

### `if`

AST types: `boolen`
Types: `boolean`
Operators: `if`
Native functions: for example, `==`, `>`, etc.

### Pattern matching

- https://lispcookbook.github.io/cl-cookbook/pattern_matching.html
- https://elixir-lang.org/getting-started/case-cond-and-if.html#if-and-unless
- http://learnyouahaskell.com/syntax-in-functions
- https://github.com/nim-lang/RFCs/issues/245#issuecomment-695780794
- Exhaustive check https://www.typescriptlang.org/docs/handbook/release-notes/typescript-1-8.html#example-4
- https://elmprogramming.com/pattern-matching.html
- https://reasonml.github.io/docs/en/pattern-matching.html#unused-warning

### `quote`

AST types: -
Types: `list`, `null`
Operators: `quote`
Native functions: -

### List operations

AST types: -
Types: `list`, `null`
Operators: list constructor
Native functions: -

### Macros

- https://lispcookbook.github.io/cl-cookbook/macros.html
- https://www.scheme.com/tspl4/further.html
- https://school.racket-lang.org/2019/plan/mon-aft-lecture.html

### Strings

AST types: `string`
Types: `string`
Operators: -
Native functions: for example, `length`.

### Hash map

Other names: dictionary, struct, record

### Array

Other names: vector

### Loops

### Lazy evaluation

### Tail call optimization

### Continuations

- https://courses.cs.washington.edu/courses/cse341/04wi/lectures/15-scheme-continuations.html
- https://www.ps.uni-saarland.de/~duchier/python/continuations.html

### Dynamic type checker

- https://www.eiffel.com/values/design-by-contract/introduction/

> The term was coined by Bertrand Meyer in connection with his design of the Eiffel programming language and first described in various articles starting in 1986 and the two successive editions (1988, 1997) of his book Object-Oriented Software Construction.

Other names: guard, type guard, guard glaus, assertion

- https://basarat.gitbook.io/typescript/type-system/typeguard
- https://www.programiz.com/swift-programming/guard-statement
- https://stackoverflow.com/questions/52507795/haskell-pattern-matching-with-guards

### Static type checker

- https://crypto.stanford.edu/~blynn/lambda/pts.html

### Modules

Other names: Namespace

### Other

Comments, different braces, better errors

### Try catch

### IO

### Prolog

### Partial application

### Named params

### Event loop

###
