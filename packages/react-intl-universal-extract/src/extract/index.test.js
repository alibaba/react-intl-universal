import script from "./index";
import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import { processParameters, verifyMessages, getNoDefaultMessages, logger } from '../util/util';

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
  console.log = jest.fn();
  return () => {
    console.log = originalLog;
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
  fs.mkdirSync(nestedDir, { recursive: true });
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
  writeFixture(sourceDir, 'Unsupported.md', `
    intl.get('unsupported_extension_key').d('Unsupported extension message')
  `);

  const result = script.extract({
    sourcePath: toPackageRelativePath(sourceDir),
    ignore: ['Ignored.jsx'],
  });

  expect(getTransformed(result, 'nested_key')).toBe('Nested message');
  expect(getOriginal(result, 'ignored_key')).toBeUndefined();
  expect(getOriginal(result, 'unsupported_extension_key')).toBeUndefined();
}));

test("extract logs and continues when writing the output file fails", () => withTempDir((tmpDir) => {
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
    expect(console.log).toHaveBeenCalled();
  } finally {
    restoreConsole();
  }
}));

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
