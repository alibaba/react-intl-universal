import React from 'react'
import intl from 'core/intl';
import ExampleBlock from 'components/example-block';
import {
  renderCode,
} from 'components/format-doc-links';

const CurrencyComponent: React.FC<any> = () => {
  const viewCount = 1234567;
  const score = 1234.567;
  return (
    <div>
      <div className="title">{intl.get('EXAMPLE_TITLE_NUMBER_CURRENCY').d('Number formatting')}</div>
      <p className="section-note">
        {intl.get('EXAMPLE_NOTE_NUMBER_CURRENCY', {
          code: renderCode,
        }).d('Format plain numbers with <code>intl.formatNumber</code>, then pass the formatted value into <code>intl.get</code>. Locale messages keep simple placeholders such as <code>{count}</code>.')}
      </p>
      <ExampleBlock code={"<div>{intl.get('VIEW_COUNT', { count: intl.formatNumber(viewCount) }).d('{count} views')}</div>"} scope={{ viewCount }} />
      <ExampleBlock code={"<div>{intl.get('AVERAGE_SCORE', { score: intl.formatNumber(score) }).d('Average score: {score}')}</div>"} scope={{ score }} />
    </div>
  )
}

export default CurrencyComponent;
