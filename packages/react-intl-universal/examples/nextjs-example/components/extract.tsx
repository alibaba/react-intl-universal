import React from 'react';
import intl from 'core/intl';

interface StaticCodeBlockProps {
  label: React.ReactNode;
  code: string;
}

const StaticCodeBlock: React.FC<StaticCodeBlockProps> = ({ label, code }) => (
  <div className="example-panel">
    <div className="example-label">{label}</div>
    <pre className="extract-code">{code}</pre>
  </div>
);

const ExtractComponent: React.FC = () => {
  const packageLink = (chunks: React.ReactNode) => (
    <a href="https://www.npmjs.com/package/react-intl-universal-extract" target="_blank" rel="noreferrer">
      {chunks}
    </a>
  );
  const inlineCode = (chunks: React.ReactNode) => <code>{chunks}</code>;

  const sourceCode = `<div>
  {intl
    .get('EXTRACT_HELLO', { username: 'Tony' })
    .d('Hello, {username}!')}
</div>`;

  const scriptCode = `{
  "scripts": {
    "intl:extract": "npx react-intl-universal-extract --cmd extract --source-path ./src --output-path ./src/locales/en-US.json --verbose"
  }
}`;

  const commandCode = `npm run intl:extract`;

  const localeCode = `{
  "EXTRACT_HELLO": "Hello, {username}!"
}`;

  return (
    <div>
      <div className="title">{intl.get('EXAMPLE_TITLE_EXTRACT').d('Extract default messages')}</div>
      <p className="section-note section-note-success">
        {intl.get('EXAMPLE_NOTE_EXTRACT', {
          package: packageLink,
          code: inlineCode,
        }).d('<package>react-intl-universal-extract</package> reads <code>.d()</code> default messages from source code and writes them into a locale JSON file. Keep <code>.d()</code> as the source text, then use the generated file as the base for translation.')}
      </p>

      <div className="example-comparison extract-comparison">
        <StaticCodeBlock
          label={intl.get('EXAMPLE_LABEL_SOURCE_CODE').d('Source code')}
          code={sourceCode}
        />
        <StaticCodeBlock
          label={intl.get('EXAMPLE_LABEL_LOCALE_OUTPUT').d('Generated locale file')}
          code={localeCode}
        />
      </div>

      <div className="example-comparison extract-comparison">
        <StaticCodeBlock
          label={intl.get('EXAMPLE_LABEL_PACKAGE_SCRIPT').d('package.json script')}
          code={scriptCode}
        />
        <StaticCodeBlock
          label={intl.get('EXAMPLE_LABEL_RUN_COMMAND').d('Run command')}
          code={commandCode}
        />
      </div>
    </div>
  );
};

export default ExtractComponent;
