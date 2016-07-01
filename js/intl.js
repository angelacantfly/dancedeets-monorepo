/**
 * Copyright 2016 DanceDeets.
 *
 * @flow
 */

'use strict';

import React, { PropTypes } from 'react';
import { IntlProvider } from 'react-intl';
import Locale from 'react-native-locale';
import areIntlLocalesSupported  from 'intl-locales-supported';


const defaultLocale = 'en';
const locales = ['en', 'ja', 'fr', 'zh', 'ko'];

const getCurrentLocale = () => {
  const currentLocale = Locale.constants().localeIdentifier.split('_')[0].split('-')[0];
  console.log(currentLocale);
  return locales.indexOf(currentLocale) !== -1
    ? currentLocale
    : defaultLocale;
};

import ja from './messages/ja';
import zh from './messages/zh';
const messages = {
  ja,
  zh,
};

// https://github.com/yahoo/intl-locales-supported#usage
if (global.Intl) {
  // Determine if the built-in `Intl` has the locale data we need.
  if (!areIntlLocalesSupported(locales)) {
    // `Intl` exists, but it doesn't have the data we need, so load the
    // polyfill and replace the constructors we need with the polyfill's.
    require('intl');
    Intl.NumberFormat = IntlPolyfill.NumberFormat; // eslint-disable-line no-undef
    Intl.DateTimeFormat = IntlPolyfill.DateTimeFormat; // eslint-disable-line no-undef
  }
} else {
  // No `Intl`, so use and load the polyfill.
  global.Intl = require('intl');
}

export default function intl(Wrapped) {
  class Internationalize extends React.Component {

    static propTypes = {
      intl: PropTypes.object.isRequired,
      start: PropTypes.func.isRequired,
    };

    render() {
      const currentLocale = getCurrentLocale();
      return (
        <IntlProvider
          defaultLocale={defaultLocale}
          key={currentLocale} // https://github.com/yahoo/react-intl/issues/234
          locale={currentLocale}
          messages={messages[currentLocale]}
        >
          <Wrapped {...this.props} />
        </IntlProvider>
      );
    }

  }

  return Internationalize;
}
