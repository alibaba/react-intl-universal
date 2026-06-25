import React from 'react';
import ExampleBlock from 'components/example-block';

const MessageNotInComponent: React.FC<any> = () => {
  return (
    <div>
      <div className="title">Messages outside React components</div>
      <ExampleBlock code={`(() => {
  const util = {
    getMessage: () => intl.get('MESSAGE_NOT_IN_COMPONENT').d('react-intl-universal is able to internationalize message not in React.Component'),
  };

  return <div>{util.getMessage()}</div>;
})()`} />
    </div>
  )
}

export default MessageNotInComponent;
