/**
 * Copyright 2016 DanceDeets.
 *
 * @flow
 */

import React from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import TabNavigator from 'react-native-tab-navigator';
import type {
  NavigationAction,
  NavigationRoute,
  NavigationSceneRendererProps,
  NavigationScreenProp,
} from 'react-navigation/src/TypeDefinition';
import { NavigationActions, StackNavigator } from 'react-navigation';
import LinearGradient from 'react-native-linear-gradient';
import { connect } from 'react-redux';
import { injectIntl, intlShape, defineMessages } from 'react-intl';
import { Event } from 'dancedeets-common/js/events/models';
import generateNavigator from '../containers/generateNavigator';
import type { Navigatable } from '../containers/generateNavigator';
import ProfilePage from '../containers/Profile';
import { yellowColors, gradientBottom, gradientTop } from '../Colors';
import { semiNormalize, ZoomableImage } from '../ui';
import { selectTab } from '../actions';
import type { User } from '../actions/types';
import NotificationPreferences from '../containers/NotificationPreferences';
import { track, trackWithEvent } from '../store/track';
import { TimeTracker } from '../util/timeTracker';
import { setDefaultState } from '../reducers/navigation';
import { BattleBrackets } from '../event_signups/views';
import * as RemoteConfig from '../remoteConfig';
import PositionProvider from '../providers/positionProvider';
import { FullEventView } from '../events/uicomponents';
import EventScreens from './screens/Event';
import LearnScreens from './screens/Learn';

const messages = defineMessages({
  events: {
    id: 'tab.events',
    defaultMessage: 'Events',
    description: 'Tab button to show list of events',
  },
  learn: {
    id: 'tab.learn',
    defaultMessage: 'Tutorials',
    description: 'Tab button to help folks learn about dance',
  },
  about: {
    id: 'tab.about',
    defaultMessage: 'About',
    description: 'Tab button to show general info about Dancedeets, Profile, and Share info',
  },
  notificationsTitle: {
    id: 'navigator.notificationsTitle',
    defaultMessage: 'Notification Settings',
    description: 'Titlebar for notification settings',
  },
});

const AboutNavigator = View;//generateNavigator('ABOUT_NAV');
setDefaultState('ABOUT_NAV', { key: 'About', message: messages.about });

const BattleSignupsNavigator = generateNavigator('EVENT_SIGNUPS_NAV');
setDefaultState('EVENT_SIGNUPS_NAV', {
  key: 'BattleSelector',
  title: 'Battle Signups',
});

class GradientTabBar extends React.Component {
  props: {
    style: View.propTypes.style,
    children: Array<React.Element<*>>,
  };

  render() {
    return (
      <LinearGradient
        start={[0.0, 0.0]}
        end={[0.0, 1]}
        colors={[gradientTop, gradientBottom]}
        style={this.props.style}
      >
        {this.props.children}
      </LinearGradient>
    );
  }
}

type CommonProps = {
  sceneProps: NavigationSceneRendererProps,
  navigatable: Navigatable,
  openAddEvent: (props: any) => void,
  intl: intlShape,
};

class _AboutView extends React.Component {
  props: CommonProps & {};

  render() {
    const { scene } = this.props.sceneProps;
    const { route } = scene;
    switch (route.key) {
      case 'About':
        return (
          <ProfilePage
            onNotificationPreferences={() => {
              track('Open Notification Preferences');
              this.props.navigatable.onNavigate({
                key: 'NotificationPreferences',
                title: this.props.intl.formatMessage(
                  messages.notificationsTitle
                ),
              });
            }}
          />
        );
      case 'NotificationPreferences':
        return <NotificationPreferences>Hey</NotificationPreferences>;
      default:
        console.error('Unknown case:', route.key);
        return null;
    }
  }
}
const AboutView = injectIntl(_AboutView);

class _TabbedAppView extends React.Component {
  props: {
    // Self-managed props
    user: ?User,
    selectedTab: string,
    selectTab: (tab: string) => void,
    intl: intlShape,
  };

  state: {
    eventSignupUserIds: Array<string>,
  };

  _eventSignupsNavigator: BattleSignupsNavigator;
  _eventNavigator: StackNavigator;
  _learnNavigator: StackNavigator;
  _aboutNavigator: AboutNavigator;

  constructor(props) {
    super(props);
    this.state = { eventSignupUserIds: [] };
  }

  componentWillMount() {
    this.loadWhitelist();
  }

  async loadWhitelist() {
    const eventSignupUserIds = (await RemoteConfig.get(
      'event_signup_user_ids'
    )) || [];
    this.setState({ eventSignupUserIds });
  }

  icon(source) {
    return <Image source={source} style={styles.icon} />;
  }

  renderTabNavigator() {
    let extraTabs = null;
    if (
      this.props.user &&
      this.state.eventSignupUserIds.includes(this.props.user.profile.id)
    ) {
      extraTabs = (
        <TabNavigator.Item
          selected={this.props.selectedTab === 'event_signups'}
          title={'Event Signups'}
          titleStyle={styles.titleStyle}
          selectedTitleStyle={styles.selectedTitleStyle}
          renderIcon={() =>
            this.icon(require('../containers/icons/events.png'))}
          renderSelectedIcon={() =>
            this.icon(require('../containers/icons/events-highlighted.png'))}
          onPress={() => {
            if (this.props.selectedTab === 'event_signups') {
              this._eventSignupsNavigator.dispatchProps.goHome();
            } else {
              track('Tab Selected', { Tab: 'Event Signups' });
              this.props.selectTab('event_signups');
            }
          }}
        >
          <BattleSignupsNavigator
            ref={x => {
              this._eventSignupsNavigator = x;
            }}
            renderScene={(
              sceneProps: NavigationSceneRendererProps,
              nav: Navigatable
            ) => <BattleBrackets sceneProps={sceneProps} navigatable={nav} />}
          />
        </TabNavigator.Item>
      );
    }
    return (
      <TabNavigator
        tabBarStyle={styles.tabBarStyle}
        sceneStyle={styles.tabBarSceneStyle}
        tabBarClass={GradientTabBar}
      >
        <TabNavigator.Item
          selected={this.props.selectedTab === 'events'}
          title={this.props.intl.formatMessage(messages.events)}
          titleStyle={styles.titleStyle}
          selectedTitleStyle={styles.selectedTitleStyle}
          renderIcon={() =>
            this.icon(require('../containers/icons/events.png'))}
          renderSelectedIcon={() =>
            this.icon(require('../containers/icons/events-highlighted.png'))}
          onPress={() => {
            if (this.props.selectedTab === 'events') {
              console.log(this._eventNavigator);
              this._eventNavigator._navigation.goBack();
            } else {
              track('Tab Selected', { Tab: 'Events' });
              this.props.selectTab('events');
            }
          }}
        >
          <EventScreens
            navRef={nav => {
              this._eventNavigator = nav;
            }}
          />
        </TabNavigator.Item>
        <TabNavigator.Item
          selected={this.props.selectedTab === 'learn'}
          title={this.props.intl.formatMessage(messages.learn)}
          titleStyle={styles.titleStyle}
          selectedTitleStyle={styles.selectedTitleStyle}
          renderIcon={() => this.icon(require('../containers/icons/learn.png'))}
          renderSelectedIcon={() =>
            this.icon(require('../containers/icons/learn-highlighted.png'))}
          onPress={() => {
            if (this.props.selectedTab === 'learn') {
              this._learnNavigator._navigation.goBack();
            } else {
              track('Tab Selected', { Tab: 'Learn' });
              this.props.selectTab('learn');
              // this.setState({ selectedTab: 'learn' });
            }
          }}
        >
          <LearnScreens
            navRef={nav => {
              this._learnNavigator = nav;
            }}
          />
        </TabNavigator.Item>
        <TabNavigator.Item
          selected={this.props.selectedTab === 'about'}
          title={this.props.intl.formatMessage(messages.about)}
          titleStyle={styles.titleStyle}
          selectedTitleStyle={styles.selectedTitleStyle}
          renderIcon={() =>
            this.icon(require('../containers/icons/profile.png'))}
          renderSelectedIcon={() =>
            this.icon(require('../containers/icons/profile-highlighted.png'))}
          onPress={() => {
            if (this.props.selectedTab !== 'about') {
              track('Tab Selected', { Tab: 'About' });
              this.props.selectTab('about');
            }
          }}
        >
          <AboutNavigator
            ref={x => {
              this._aboutNavigator = x;
            }}
            renderScene={(
              sceneProps: NavigationSceneRendererProps,
              nav: Navigatable
            ) => <AboutView sceneProps={sceneProps} navigatable={nav} />}
          />
        </TabNavigator.Item>
        {extraTabs}
      </TabNavigator>
    );
  }

  render() {
    return (
      <TimeTracker eventName="Tab Time" eventValue={this.props.selectedTab}>
        {this.renderTabNavigator()}
      </TimeTracker>
    );
  }
}
export default connect(
  state => ({
    user: state.user.userData,
    selectedTab: state.mainTabs.selectedTab,
  }),
  dispatch => ({
    selectTab: x => dispatch(selectTab(x)),
  })
)(injectIntl(_TabbedAppView));

const tabBarHeight = semiNormalize(52);

let styles = StyleSheet.create({
  icon: {
    width: semiNormalize(28),
    height: semiNormalize(28),
  },
  tabBarStyle: {
    backgroundColor: 'transparent',
    height: tabBarHeight,
  },
  tabBarSceneStyle: {
    paddingBottom: tabBarHeight,
  },
  titleStyle: {
    color: 'white',
    fontSize: semiNormalize(14),
  },
  selectedTitleStyle: {
    color: yellowColors[1],
  },
});
