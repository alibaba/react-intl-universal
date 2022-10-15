import React from 'react';
import util from 'core/util';

const MessageNotInComponent: React.FC<any> = () => {
  return (
    <div>
      <div className="title">Message Not in Component Example:</div>
      <div>{util.getMessage()}</div>
    </div>
  )
}

export default MessageNotInComponent;
