import React from 'react';
import intl from 'core/intl';
import ExampleBlock from 'components/example-block';
import { renderCode } from 'components/format-doc-links';

const LocaleFormattingComponent: React.FC = () => {
  const formatListCode = `<div>
  {intl.formatList([
    <strong key="react">React</strong>,
    <strong key="typescript">TypeScript</strong>,
    <strong key="nextjs">Next.js</strong>,
  ], { type: 'conjunction', style: 'long' })}
</div>`;

  const formatParenthesesCode = `<div>
  {intl.formatParentheses(
    <strong key="beta">{intl.get('EXAMPLE_STATUS_BETA').d('Beta')}</strong>
  )}
</div>`;

  const getColonCode = `<div>
  {intl.get('EXAMPLE_STATUS').d('Status')}
  {intl.getColon()}
  <strong>{intl.get('EXAMPLE_STATUS_ACTIVE').d('Active')}</strong>
</div>`;

  return (
    <div>
      <div className="title">
        {intl.get('EXAMPLE_TITLE_LOCALE_HELPERS').d('Locale-aware lists and punctuation')}
      </div>
      <p className="section-note">
        {intl.get('EXAMPLE_NOTE_LOCALE_HELPERS', {
          code: renderCode,
        }).d('Use <code>intl.formatList</code> to join React nodes and use <code>intl.formatParentheses</code> or <code>intl.getColon</code> for punctuation that matches the active locale.')}
      </p>
      <ExampleBlock code={formatListCode} />
      <ExampleBlock code={formatParenthesesCode} />
      <ExampleBlock code={getColonCode} />
    </div>
  );
};

export default LocaleFormattingComponent;
