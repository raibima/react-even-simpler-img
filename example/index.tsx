import 'react-app-polyfill/ie11';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SimpleImg as RSimpleImg } from 'react-simple-img';

import { ImageLoader, SimpleImg } from '../';

const urls = [
  `https://picsum.photos/200?foo=${Math.random().toString(16)}`,
  `https://picsum.photos/200?foo=${Math.random().toString(16)}`,
  `https://picsum.photos/200?foo=${Math.random().toString(16)}`,
];

const App = () => {
  return (
    <div>
      {urls.map(url => (
        <SimpleImg key={url} src={url} />
      ))}

      {urls.map(url => (
        <RSimpleImg key={`rsimpleimg-${url}`} src={url} />
      ))}
    </div>
  );
};

ReactDOM.render(
  <ImageLoader>
    <App />
  </ImageLoader>,
  document.getElementById('root')
);
