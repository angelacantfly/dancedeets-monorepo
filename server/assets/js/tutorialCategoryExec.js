/**
 * Copyright 2016 DanceDeets.
 *
 * @flow
 */

import renderReact from './renderReact';

function render() {
  renderReact(require('./tutorialCategory').default); // eslint-disable-line global-require
}

render();

if (module.hot) {
  module.hot.accept('./tutorialCategory', render);
}