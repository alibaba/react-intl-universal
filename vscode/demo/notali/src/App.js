import React from 'react';
import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <div>{intl.get('1920159459').d('这里是测试汉子')}</div>
      <div>{intl.get('125442853').d('这里是测试汉子${e}你好')}</div>
    </div>
  );
}

export default App;
