import React from 'react';
import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <div>你好</div>
      <div>{intl.get('-599575533').d('测试汉子1')}</div>
      <div>测试汉子2</div>
    </div>
  );
}

export default App;
