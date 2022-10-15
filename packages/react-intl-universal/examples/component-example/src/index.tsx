
import React from 'react';
import intl from 'react-intl-universal';
import IntlResourceLoader from './core/IntlResourceLoader';

interface Props {
}

interface State {
}

export default class ExampleComponent extends React.Component<Props, State> {

  constructor(props: Props) {
    super(props);
    // load the componet's locale data into intl singleton instance
    IntlResourceLoader.load();
  }

  public render() {
    const name = 'Tony';
    const where = 'Alibaba';
    return (<div>
      {intl.get('EXAMPLE_COMPONENT_HELLO', { name, where })}
    </div>);
  }

}
