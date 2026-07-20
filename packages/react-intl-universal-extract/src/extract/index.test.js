import script from "./index";
import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  processParameters,
  verifyMessages,
  verifyMessageResult,
  getNoDefaultMessages,
  logger,
} from '../util/util';
import { EXTRACT_ERROR_CODE, MESSAGE_ERROR_CODE } from '../util/constant';

const getOriginal = (result, key) => {
  return (_.find(result, { key }) || {}).originalDefaultMessage;
}

const getTransformed = (result, key) => {
  return (_.find(result, { key }) || {}).transformedDefaultMessage;
}

const createTempDir = () => fs.mkdtempSync(path.join(process.cwd(), '.tmp-extract-test-'));

const writeFixture = (dir, fileName, content) => {
  fs.writeFileSync(path.join(dir, fileName), content);
};

const toPackageRelativePath = (targetPath) => path.relative(process.cwd(), targetPath);

const silenceConsole = () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  return () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  };
};

const withTempDir = (callback) => {
  const dir = createTempDir();
  try {
    return callback(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const runCli = (args) => spawnSync(process.execPath, [
  path.join(process.cwd(), 'bin/index.js'),
  ...args,
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

test("Test extract", () => {
  const result = script.extract({
    sourcePath: './test-files',
    outputPath: './locales/en_US.json',
    // verbose: true,
  });

  expect(getOriginal(result, 'basic1')).toBe('default message');
  expect(getTransformed(result, 'basic1')).toBe('default message');

  expect(getOriginal(result, 'basic2')).toBe('Default message for basic[2]');
  expect(getTransformed(result, 'basic2')).toBe('Default message for basic[2]');

  expect(getOriginal(result, 'basic3')).toBe('Default message for basic(3)');
  expect(getTransformed(result, 'basic3')).toBe('Default message for basic(3)');

  expect(getOriginal(result, 'basic4')).toBe('Default message for basic(4) with 中文');
  expect(getTransformed(result, 'basic4')).toBe('Default message for basic(4) with 中文');

  expect(getOriginal(result, 'basic5')).toBe('Default message for basic5 with 中文(5)');
  expect(getTransformed(result, 'basic5')).toBe('Default message for basic5 with 中文(5)');

  expect(getOriginal(result, 'basic6')).toBe('Default message for basic6 with "123(中文)"');
  expect(getTransformed(result, 'basic6')).toBe('Default message for basic6 with "123(中文)"');

  expect(getOriginal(result, 'trailing_comma1')).toBe('你好');
  expect(getTransformed(result, 'trailing_comma1')).toBe('你好');

  expect(getOriginal(result, 'character1')).toBe('Expression support: ==,!=,>=,>,<=,<,&&,!,(),+,-,*,/,%');
  expect(getTransformed(result, 'character1')).toBe('Expression support: ==,!=,>=,>,<=,<,&&,!,(),+,-,*,/,%');

  expect(getOriginal(result, 'html1')).toBe('<span>This is html</span>');
  expect(getTransformed(result, 'html1')).toBe('<span>This is html</span>');

  expect(getOriginal(result, 'html2')).toBe('<span>This is html</span>');
  expect(getTransformed(result, 'html2')).toBe('<span>This is html</span>');

  expect(getOriginal(result, 'html3')).toBe('<span>(This is html)</span>');
  expect(getTransformed(result, 'html3')).toBe('<span>(This is html)</span>');

  expect(getOriginal(result, 'html4')).toBe('<span>Hello4 {name}</span>');
  expect(getTransformed(result, 'html4')).toBe('<span>Hello4 {name}</span>');

  expect(getOriginal(result, 'html5')).toBe('<span>Hello5 {name}, welcome to <a href={webLink}>my website!</a></span>');
  expect(getTransformed(result, 'html5')).toBe('<span>Hello5 {name}, welcome to <a href={webLink}>my website!</a></span>');

  expect(getOriginal(result, 'html6')).toBe('<span>welcome to <a href="https://www.npmjs.com/package/react-intl-extract">my website</a></span>');
  expect(getTransformed(result, 'html6')).toBe('<span>welcome to <a href="https://www.npmjs.com/package/react-intl-extract">my website</a></span>');

  expect(getOriginal(result, 'html7')).toBe('<span>Hello7 {name}</span>');
  expect(getTransformed(result, 'html7')).toBe('<span>Hello7 {name}</span>');

  expect(getOriginal(result, 'html8')).toBe('<span>html8</span>');
  expect(getTransformed(result, 'html8')).toBe('<span>html8</span>');

  expect(getOriginal(result, 'html9')).toBe('<span>html9</span>');
  expect(getTransformed(result, 'html9')).toBe('<span>html9</span>');

  expect(getOriginal(result, 'newline1')).toBe('Default message for newline1');
  expect(getTransformed(result, 'newline1')).toBe('Default message for newline1');

  expect(getOriginal(result, 'newline2')).toBe('Default message for newline2');
  expect(getTransformed(result, 'newline2')).toBe('Default message for newline2');

  expect(getOriginal(result, 'newline3')).toBe('Default message for newline1');
  expect(getTransformed(result, 'newline3')).toBe('Default message for newline1');

  expect(getOriginal(result, 'newline4')).toBe('Default message for newline2');
  expect(getTransformed(result, 'newline4')).toBe('Default message for newline2');

  expect(getOriginal(result, 'trailing_comma2')).toBe('Default message with trailing comma');
  expect(getTransformed(result, 'trailing_comma2')).toBe('Default message with trailing comma');

  expect(getOriginal(result, 'same-same_line2')).toBe('Default message for same_line2');
  expect(getTransformed(result, 'same-same_line2')).toBe('Default message for same_line2');

  expect(getOriginal(result, 'same_line1')).toBe('Default message for same_line1');
  expect(getTransformed(result, 'same_line1')).toBe('Default message for same_line1');

  expect(getOriginal(result, 'var1')).toBe('Hello1, ${name}. Welcome to ${where}!');
  expect(getTransformed(result, 'var1')).toBe('Hello1, {name}. Welcome to {where}!');

  expect(getOriginal(result, 'var2')).toBe('你好2, ${name}. 欢迎来到 ${where}！');
  expect(getTransformed(result, 'var2')).toBe('你好2, {name}. 欢迎来到 {where}！');

  expect(getOriginal(result, 'var3')).toBe('Hello3, ${name}. Welcome to ${where}!');
  expect(getTransformed(result, 'var3')).toBe('Hello3, {name}. Welcome to {where}!');

  expect(getOriginal(result, 'var4')).toBe('你好4, ${name}. 欢迎来到 ${where}！');
  expect(getTransformed(result, 'var4')).toBe('你好4, {name}. 欢迎来到 {where}！');

  expect(getOriginal(result, 'var5')).toBe('Hello5, ${name}. Welcome to ${where}!');
  expect(getTransformed(result, 'var5')).toBe('Hello5, {name}. Welcome to {where}!');

  expect(getOriginal(result, 'rich_get1')).toBe('Hello, {name}. Read the <link>documentation</link>.');
  expect(getTransformed(result, 'rich_get1')).toBe('Hello, {name}. Read the <link>documentation</link>.');

  expect(getOriginal(result, 'rich_get2')).toBe('You have {count} <badge>urgent tasks</badge>.');
  expect(getTransformed(result, 'rich_get2')).toBe('You have {count} <badge>urgent tasks</badge>.');

  expect(getOriginal(result, 'rich_get3')).toBe('Hello, <strong>{name}</strong>. Visit <link>the guide</link>.');
  expect(getTransformed(result, 'rich_get3')).toBe('Hello, <strong>{name}</strong>. Visit <link>the guide</link>.');

  expect(getOriginal(result, 'rich_get4')).toBe('Hello, ${name}. Read the <link>documentation</link>.');
  expect(getTransformed(result, 'rich_get4')).toBe('Hello, {name}. Read the <link>documentation</link>.');
  expect((_.find(result, { key: 'basic1' }) || {}).line).toBe(18);

});

test("extract creates missing output directories", () => withTempDir((tmpDir) => {
  const sourceDir = path.join(tmpDir, 'src');
  const outputPath = path.join(tmpDir, 'locales', 'generated', 'en_US.json');
  fs.mkdirSync(sourceDir, { recursive: true });
  writeFixture(sourceDir, 'App.jsx', `
    import intl from 'react-intl-universal';

    export default function App() {
      return intl.get('create_dir_key').d('Create {kind} directory.');
    }
  `);

  const result = script.extract({
    sourcePath: toPackageRelativePath(sourceDir),
    outputPath: toPackageRelativePath(outputPath),
  });

  expect(getTransformed(result, 'create_dir_key')).toBe('Create {kind} directory.');
  expect(JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).toEqual({
    create_dir_key: 'Create {kind} directory.',
  });
}));

test("extract returns empty result when a key has no default message", () => withTempDir((tmpDir) => {
  const restoreConsole = silenceConsole();
  try {
    const sourceDir = path.join(tmpDir, 'src');
    fs.mkdirSync(sourceDir, { recursive: true });
    writeFixture(sourceDir, 'MissingDefault.jsx', `
      import intl from 'react-intl-universal';

      export default function MissingDefault() {
        return intl.get('missing_default_key');
      }
    `);

    const result = script.extract({
      sourcePath: toPackageRelativePath(sourceDir),
    });

    expect(result).toEqual([]);
    expect(console.log).toHaveBeenCalled();
  } finally {
    restoreConsole();
  }
}));

test("extract ignores configured files and handles nested source directories", () => withTempDir((tmpDir) => {
  const sourceDir = path.join(tmpDir, 'src');
  const nestedDir = path.join(sourceDir, 'nested');
  const ignoredNestedDir = path.join(nestedDir, 'ignored');
  fs.mkdirSync(nestedDir, { recursive: true });
  fs.mkdirSync(ignoredNestedDir, { recursive: true });
  writeFixture(nestedDir, 'Nested.jsx', `
    import intl from 'react-intl-universal';

    export default function Nested() {
      return intl.get('nested_key').d('Nested message');
    }
  `);
  writeFixture(sourceDir, 'Ignored.jsx', `
    import intl from 'react-intl-universal';

    export default function Ignored() {
      return intl.get('ignored_key').d('Ignored message');
    }
  `);
  writeFixture(ignoredNestedDir, 'NestedIgnored.jsx', `
    import intl from 'react-intl-universal';

    export default function NestedIgnored() {
      return intl.get('nested_ignored_key').d('Nested ignored message');
    }
  `);
  writeFixture(sourceDir, 'Unsupported.md', `
    intl.get('unsupported_extension_key').d('Unsupported extension message')
  `);

  const result = script.extract({
    sourcePath: toPackageRelativePath(sourceDir),
    ignore: ['Ignored.jsx', 'nested/ignored/**'],
  });

  expect(getTransformed(result, 'nested_key')).toBe('Nested message');
  expect(getOriginal(result, 'ignored_key')).toBeUndefined();
  expect(getOriginal(result, 'nested_ignored_key')).toBeUndefined();
  expect(getOriginal(result, 'unsupported_extension_key')).toBeUndefined();
}));

test("public extract keeps its array result when writing the output file fails", () => withTempDir((tmpDir) => {
  const restoreConsole = silenceConsole();
  try {
    const sourceDir = path.join(tmpDir, 'src');
    const directoryOutputPath = path.join(tmpDir, 'locales');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(directoryOutputPath, { recursive: true });
    writeFixture(sourceDir, 'App.jsx', `
      import intl from 'react-intl-universal';

      export default function App() {
        return intl.get('write_failure_key').d('Still returns messages');
      }
    `);

    const result = script.extract({
      sourcePath: toPackageRelativePath(sourceDir),
      outputPath: toPackageRelativePath(directoryOutputPath),
    });

    expect(getTransformed(result, 'write_failure_key')).toBe('Still returns messages');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(EXTRACT_ERROR_CODE.OUTPUT_WRITE_FAILED));
  } finally {
    restoreConsole();
  }
}));

test("structured extraction reports output write failure", () => withTempDir((tmpDir) => {
  const restoreConsole = silenceConsole();
  try {
    const sourceDir = path.join(tmpDir, 'src');
    const directoryOutputPath = path.join(tmpDir, 'locales');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(directoryOutputPath, { recursive: true });
    writeFixture(sourceDir, 'App.jsx', `
      import intl from 'react-intl-universal';
      export default () => intl.get('write_failure_key').d('Message');
    `);

    const result = script.extractWithResult({
      sourcePath: toPackageRelativePath(sourceDir),
      outputPath: toPackageRelativePath(directoryOutputPath),
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(EXTRACT_ERROR_CODE.OUTPUT_WRITE_FAILED);
    expect(getTransformed(result.messages, 'write_failure_key')).toBe('Message');
  } finally {
    restoreConsole();
  }
}));

test("extracted and missing-default messages include source lines", () => withTempDir((tmpDir) => {
  const restoreConsole = silenceConsole();
  try {
    const sourceDir = path.join(tmpDir, 'src');
    fs.mkdirSync(sourceDir, { recursive: true });
    writeFixture(sourceDir, 'Lines.jsx', [
      "import intl from 'react-intl-universal';",
      '',
      "const valid = intl.get('line_valid').d('Line message');",
      "const invalid = intl.get('line_missing');",
    ].join('\n'));

    const result = script.extractWithResult({
      sourcePath: toPackageRelativePath(sourceDir),
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(EXTRACT_ERROR_CODE.MESSAGE_VALIDATION_FAILED);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: MESSAGE_ERROR_CODE.NO_DEFAULT_MESSAGE,
        key: 'line_missing',
        line: 4,
      }),
    ]));
  } finally {
    restoreConsole();
  }
}));

test("validation de-duplicates default-message conflicts by key", () => {
  const restoreConsole = silenceConsole();
  try {
    const result = verifyMessageResult([
      { key: 'DUPLICATE_KEY', originalDefaultMessage: 'First message', path: 'A.jsx', line: 1 },
      { key: 'DUPLICATE_KEY', originalDefaultMessage: 'First message', path: 'B.jsx', line: 2 },
      { key: 'DUPLICATE_KEY', originalDefaultMessage: 'Second message', path: 'C.jsx', line: 3 },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toEqual(expect.objectContaining({
      code: MESSAGE_ERROR_CODE.DEFAULT_MESSAGE_CONFLICT,
      key: 'DUPLICATE_KEY',
    }));
    const output = console.error.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).toContain('Conflicting default message for key="DUPLICATE_KEY": "First message" - A.jsx:1');
    expect(output).toContain('Conflicting default message for key="DUPLICATE_KEY": "First message" - B.jsx:2');
    expect(output).toContain('Conflicting default message for key="DUPLICATE_KEY": "Second message" - C.jsx:3');
    expect(output).not.toContain(MESSAGE_ERROR_CODE.DEFAULT_MESSAGE_CONFLICT);
  } finally {
    restoreConsole();
  }
});

test("non-verbose extraction prints stages but not per-file details", () => withTempDir((tmpDir) => {
  const restoreConsole = silenceConsole();
  try {
    const sourceDir = path.join(tmpDir, 'src');
    fs.mkdirSync(sourceDir, { recursive: true });
    writeFixture(sourceDir, 'App.jsx', "intl.get('stage_key').d('Stage message');");

    script.extract({ sourcePath: toPackageRelativePath(sourceDir) });

    const output = console.log.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).toContain('Extracting messages from');
    expect(output).toContain('Found 1 messages. Verifying...');
    expect(output).toContain('Validation passed');
    expect(output).not.toContain('Processing file:');
  } finally {
    restoreConsole();
  }
}));

test("verbose extraction includes per-file details", () => withTempDir((tmpDir) => {
  const restoreConsole = silenceConsole();
  try {
    const sourceDir = path.join(tmpDir, 'src');
    fs.mkdirSync(sourceDir, { recursive: true });
    writeFixture(sourceDir, 'App.jsx', "intl.get('verbose_key').d('Verbose message');");

    script.extract({ sourcePath: toPackageRelativePath(sourceDir), verbose: true });

    expect(console.log.mock.calls.map((call) => call.join(' ')).join('\n')).toContain('Processing file:');
  } finally {
    logger.verbose = false;
    restoreConsole();
  }
}));

test("public extract does not modify the host process exit code", () => withTempDir((tmpDir) => {
  const restoreConsole = silenceConsole();
  const previousExitCode = process.exitCode;
  try {
    const sourceDir = path.join(tmpDir, 'src');
    fs.mkdirSync(sourceDir, { recursive: true });
    writeFixture(sourceDir, 'Missing.jsx', "intl.get('api_missing_default');");
    process.exitCode = 23;

    expect(script.extract({ sourcePath: toPackageRelativePath(sourceDir) })).toEqual([]);
    expect(process.exitCode).toBe(23);
  } finally {
    process.exitCode = previousExitCode;
    restoreConsole();
  }
}));

test("CLI returns zero for successful extraction", () => withTempDir((tmpDir) => {
  const sourceDir = path.join(tmpDir, 'src');
  fs.mkdirSync(sourceDir, { recursive: true });
  writeFixture(sourceDir, 'App.jsx', "intl.get('cli_success').d('CLI success');");

  const result = runCli(['--cmd', 'extract', '--source-path', toPackageRelativePath(sourceDir)]);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain('1 messages extracted.');
}));

test("CLI returns zero for a valid empty source directory", () => withTempDir((tmpDir) => {
  const sourceDir = path.join(tmpDir, 'src');
  fs.mkdirSync(sourceDir, { recursive: true });

  const result = runCli(['--cmd', 'extract', '--source-path', toPackageRelativePath(sourceDir)]);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain('0 messages extracted.');
}));

test("CLI returns one for a missing default message without a success summary", () => withTempDir((tmpDir) => {
  const sourceDir = path.join(tmpDir, 'src');
  fs.mkdirSync(sourceDir, { recursive: true });
  writeFixture(sourceDir, 'Missing.jsx', "intl.get('cli_missing_default');");

  const result = runCli(['--cmd', 'extract', '--source-path', toPackageRelativePath(sourceDir)]);
  const fixturePath = toPackageRelativePath(path.join(sourceDir, 'Missing.jsx'));

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`Missing default message for key="cli_missing_default" - ${fixturePath}:1`);
  expect(result.stderr).not.toContain(MESSAGE_ERROR_CODE.NO_DEFAULT_MESSAGE);
  expect(result.stdout).not.toContain('messages extracted.');
}));

test("CLI returns one for conflicting default messages", () => withTempDir((tmpDir) => {
  const sourceDir = path.join(tmpDir, 'src');
  fs.mkdirSync(sourceDir, { recursive: true });
  writeFixture(sourceDir, 'Conflicts.jsx', [
    "intl.get('cli_conflict').d('First');",
    "intl.get('cli_conflict').d('Second');",
  ].join('\n'));

  const result = runCli(['--cmd', 'extract', '--source-path', toPackageRelativePath(sourceDir)]);
  const fixturePath = toPackageRelativePath(path.join(sourceDir, 'Conflicts.jsx'));

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`Conflicting default message for key="cli_conflict": "First" - ${fixturePath}:1`);
  expect(result.stderr).toContain(`Conflicting default message for key="cli_conflict": "Second" - ${fixturePath}:2`);
  expect(result.stderr).not.toContain(MESSAGE_ERROR_CODE.DEFAULT_MESSAGE_CONFLICT);
  expect(result.stdout).not.toContain('messages extracted.');
}));

test("CLI returns one when source scanning fails", () => withTempDir((tmpDir) => {
  const missingSource = path.join(tmpDir, 'missing');
  const result = runCli(['--cmd', 'extract', '--source-path', toPackageRelativePath(missingSource)]);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(EXTRACT_ERROR_CODE.SOURCE_SCAN_FAILED);
  expect(result.stdout).not.toContain('messages extracted.');
}));

test("CLI returns one when writing the output file fails", () => withTempDir((tmpDir) => {
  const sourceDir = path.join(tmpDir, 'src');
  const outputDirectory = path.join(tmpDir, 'locales');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  writeFixture(sourceDir, 'App.jsx', "intl.get('cli_write_failure').d('Message');");

  const result = runCli([
    '--cmd',
    'extract',
    '--source-path',
    toPackageRelativePath(sourceDir),
    '--output-path',
    toPackageRelativePath(outputDirectory),
  ]);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(EXTRACT_ERROR_CODE.OUTPUT_WRITE_FAILED);
  expect(result.stdout).not.toContain('messages extracted.');
  expect(result.stdout).not.toContain('Wrote 1 messages');
}));

test("CLI returns one for an unknown command", () => {
  const result = runCli(['--cmd', 'sync']);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Unknown command sync.');
});

test("utility helpers cover parameter parsing, validation, and logging behavior", () => {
  const restoreConsole = silenceConsole();
  try {
    const params = processParameters('extract', {
      verbose: 'true',
      ignore: 'foo, bar',
      extensions: '[".js",".tsx"]',
    });

    expect(params.verbose).toBe(true);
    expect(params.ignore).toEqual(['foo', 'bar']);
    expect(params.extensions).toEqual(['.js', '.tsx']);

    expect(getNoDefaultMessages("intl.get('NO_DEFAULT')", 'Sample.jsx')).toEqual([
      {
        key: 'NO_DEFAULT',
        path: 'Sample.jsx',
        line: 1,
        isValid: false,
        invalidType: 'no_default',
      },
    ]);

    expect(verifyMessages([
      {
        key: 'DUPLICATE_KEY',
        originalDefaultMessage: 'First message',
      },
      {
        key: 'DUPLICATE_KEY',
        originalDefaultMessage: 'Second message',
      },
    ])).toBe(false);

    logger.log('log branch');
    logger.success('success branch');
    logger.info('info branch');
    logger.error('error branch');
    logger.warning('warning branch');
    expect(console.log).toHaveBeenCalled();
  } finally {
    logger.verbose = false;
    restoreConsole();
  }
});
