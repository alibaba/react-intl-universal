import React from 'react'
import intl from 'react-intl-universal';

const BasicComponent: React.FC<any> = () => {
  return (
    <div>
      <div className="title">Basic Examples:</div>
      <div>{intl.get('SIMPLE')}</div>
      <div>{intl.get('HELLO', { name: 'Tony', where: 'Alibaba' })}</div>
    </div>
  );
}

export default BasicComponent;