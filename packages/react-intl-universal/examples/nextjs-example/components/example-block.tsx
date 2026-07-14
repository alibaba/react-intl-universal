import React from 'react';
import { themes } from 'prism-react-renderer';
import { LiveEditor, LiveError, LivePreview, LiveProvider } from 'react-live';
import intl from 'core/intl';

const editorTheme = {
  ...themes.github,
  plain: {
    ...themes.github.plain,
    backgroundColor: 'transparent',
  },
};

interface ExampleBlockProps {
  code: string;
  tone?: 'default' | 'rich' | 'legacy';
  scope?: Record<string, unknown>;
}

const ExampleBlock: React.FC<ExampleBlockProps> = ({ code, tone = 'default', scope = {} }) => {
  return (
    <LiveProvider code={code} language="jsx" theme={editorTheme} scope={{ React, intl, ...scope }}>
      <div className={`example-comparison example-comparison-${tone}`}>
        <div className="example-panel">
          <div className="example-label">Code</div>
          <LiveEditor className="example-code" style={{ backgroundColor: 'transparent' }} />
        </div>
        <div className="example-panel">
          <div className="example-label">Rendered result</div>
          <LivePreview className="example-output" />
          <LiveError className="example-error" />
        </div>
      </div>
    </LiveProvider>
  );
};

export default ExampleBlock;
