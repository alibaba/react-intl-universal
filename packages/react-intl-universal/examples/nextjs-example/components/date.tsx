import React from 'react'
import intl from 'core/intl';
import ExampleBlock from 'components/example-block';
import {
  renderCode,
  renderIntlMessageFormatLink,
} from 'components/format-doc-links';

const DateComponent: React.FC<any> = () => {
  const start = new Date();
  const end = new Date();
  const expires = new Date();
  return (
    <div>
      <div className="title">{intl.get('EXAMPLE_TITLE_DATE_TIME').d('Date and time formatting')}</div>
      <p className="section-note">
        {intl.get('EXAMPLE_NOTE_DATE_TIME', {
          code: renderCode,
          formatjs: renderIntlMessageFormatLink,
        }).d('Pass JavaScript <code>Date</code> values and format them with ICU date/time styles such as <code>short</code>, <code>medium</code>, <code>long</code>, or <code>full</code>. See the <formatjs>intl-messageformat docs</formatjs> for supported formatting behavior.')}
      </p>
      <ExampleBlock code={"<div>{intl.get('SALE_START', { start }).d('Sale begins {start, date}')}</div>"} scope={{ start }} />
      <ExampleBlock code={"<div>{intl.get('SALE_END', { end }).d('Sale ends {end, date, long}')}</div>"} scope={{ end }} />
      <ExampleBlock code={"<div>{intl.get('COUPON', { expires }).d('Coupon expires at {expires, time, medium}')}</div>"} scope={{ expires }} />
    </div>
  )
}

export default DateComponent;
