/**
 * Copyright 2016 DanceDeets.
 *
 * @flow
 */

import React from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import type {
  NavigationAction,
  NavigationRoute,
  NavigationSceneRendererProps,
  NavigationScreenProp,
} from 'react-navigation/src/TypeDefinition';
import { NavigationActions } from 'react-navigation';
import { connect } from 'react-redux';
import { injectIntl, intlShape, defineMessages } from 'react-intl';
import { track, trackWithEvent } from '../../store/track';
import ProfilePage from '../Profile';
import NotificationPreferences from '../NotificationPreferences';
import StackNavigator from './Navigator';

const messages = defineMessages({
  notificationsTitle: {
    id: 'navigator.notificationsTitle',
    defaultMessage: 'Notification Settings',
    description: 'Titlebar for notification settings',
  },
  about: {
    id: 'tab.about',
    defaultMessage: 'About',
    description: 'Tab button to show general info, as well as panel title',
  },
});

class MainScreen extends React.Component {
  static navigationOptions = ({ screenProps }) => ({
    title: screenProps.intl.formatMessage(messages.about),
  });

  props: {
    navigation: NavigationScreenProp<NavigationRoute, NavigationAction>,
  };

  constructor(props) {
    super(props);
    (this: any).onNotificationPreferences = this.onNotificationPreferences.bind(
      this
    );
  }

  onNotificationPreferences() {
    track('Open Notification Preferences');
    this.props.navigation.navigate('NotificationPreferences');
  }

  render() {
    return (
      <ProfilePage onNotificationPreferences={this.onNotificationPreferences} />
    );
  }
}

class NotificationScreen extends React.Component {
  static navigationOptions = ({ screenProps }) => ({
    title: screenProps.intl.formatMessage(messages.notificationsTitle),
  });

  render() {
    return <NotificationPreferences />;
  }
}

export const AboutScreensNavigator = StackNavigator('about', {
  AboutMain: { screen: MainScreen },
  NotificationPreferences: { screen: NotificationScreen },
});

