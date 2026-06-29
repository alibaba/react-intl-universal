import React from 'react'
import intl from 'core/intl';
import ExampleBlock from 'components/example-block';
import {
  renderCode,
  renderIntlMessageFormatLink,
} from 'components/format-doc-links';

const CurrencyComponent: React.FC<any> = () => {
  let price = 123456.78;
  return (
    <div>
      <div className="title">{intl.get('EXAMPLE_TITLE_NUMBER_CURRENCY').d('Number and currency formatting')}</div>
      <p className="section-note">
        {intl.get('EXAMPLE_NOTE_NUMBER_CURRENCY', {
          code: renderCode,
          formatjs: renderIntlMessageFormatLink,
        }).d('Use ICU number formatting with a currency code such as <code>USD</code>. The rendered currency symbol, grouping, and decimal separators follow the active locale. See the <formatjs>intl-messageformat docs</formatjs> for more number formatting options.')}
      </p>
      <ExampleBlock code={"<div>{intl.get('SALE_PRICE', { price }).d('The price is {price, number, USD}')}</div>"} scope={{ price }} />
    </div>
  )
}

export default CurrencyComponent;
