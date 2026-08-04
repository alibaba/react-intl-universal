# react-intl-universal-extract
Extract [react-intl-universal](https://fe-tool.com/react-intl-universal)'s default messages in source code to locale files.

<img width="600" alt="image" src="https://img.alicdn.com/imgextra/i1/O1CN01WB2wMe1g5GiHzMAls_!!6000000004090-2-tps-2308-1090.png">

For example, suppose you have a file:
```jsx
  render() {
    const name = 'Tony';
    return (<>
      {intl.get('hello1').d('Hello World')}
      {intl.get('hello2', {name} ).d(`Hello ${name}`)}
    </>);
  }  
```

This tool will generate a json file which contains the extracted messages.

```json
{
  "hello1": "Hello World",
  "hello2": "Hello {name}",
}
```

## Default message syntax

Only interpolation in an ES6 template literal is transformed to ICU format:

```jsx
intl.get('greeting', { name }).d(`Hello ${name}`)
// Extracted as: "Hello {name}"
```

`${...}` inside a single- or double-quoted string is ordinary text and is preserved:

```jsx
intl.get('template_help').d('Use ${name} in the template')
// Extracted as: "Use ${name} in the template"
```

### Escaped newlines in quoted strings

For compatibility, the extractor preserves JavaScript escape sequences in single- and double-quoted default messages as source text. It does not evaluate `\n` as a line break:

```jsx
intl.get('quoted_lines').d('First line\nSecond line')
```

The parsed locale value contains a literal backslash followed by `n`:

```json
{
  "quoted_lines": "First line\\nSecond line"
}
```

Use a multiline template literal when the locale value requires an actual line break:

```jsx
intl.get('multiline').d(`First line
Second line`)
```

## Install
```sh
npm install --save-dev react-intl-universal-extract
```

## Usage

### CLI

In `package.json`, add a script:
```json
"scripts": {
  "intl:extract": "npx react-intl-universal-extract --cmd extract --source-path ./src --output-path ./src/locales/en_US.json",
}
```
Then run `npm run intl:extract`.

Parameters:
- `cmd`: only "extract" is supported currently.
- `source-path`: The source code directory path such as "./src"
- `output-path`: The extracted json file path such as "./src/locales/en_US.json"
- `verbose`: Show per-file and per-message details. Stage summaries are always shown.

The CLI prints concise Extract, Verify, and Write stages by default. Validation errors include the key and `file:line` location. Each conflicting default-message occurrence is printed on its own line:

```text
Extracting messages from ./src
Found 128 messages. Verifying...
❌ Missing default message for key="USER_NAME" - src/User.tsx:42
❌ Conflicting default message for key="SUBMIT": "Submit" - src/Form.tsx:18
❌ Conflicting default message for key="SUBMIT": "Save" - src/Dialog.tsx:27
Validation failed: 2 problems found.
```

### Exit status

- `0`: scanning, validation, and optional output writing all succeeded. A valid source directory with zero messages also returns `0`.
- `1`: scanning, message validation, output writing, or CLI command selection failed.

This makes the command suitable for CI checks. Failure output does not include the final `messages extracted` success summary.

### Programmable
```js
const intlTool = require('react-intl-universal-extract');
const result = intlTool.extract({
  sourcePath: './test-files',
});
console.log(result); 
/** result:
[{
  key: 'hello2',
  path: 'test-files/App.js',
  line: 5,
  originalDefaultMessage: 'Hello ${name}',
  transformedDefaultMessage: 'Hello {name}'
}]
*/
```

`extract(options)` continues to return an array and does not modify `process.exitCode`. CLI exit status handling is isolated to the executable command.

## License
This software is free to use under the BSD license.

## Contributing
See "develop.md"
