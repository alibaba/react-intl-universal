import React from "react";
import ReactDOMServer from 'react-dom/server'
import App from './App';

exports.prerender = () => {
  return ReactDOMServer.renderToString(<App />)
}
