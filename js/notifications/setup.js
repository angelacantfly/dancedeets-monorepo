/**
 * Copyright 2016 DanceDeets.
 *
 * @flow
 */

'use strict';

import { Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';
import type { TokenRegistration } from '../store/track';
import { setupToken } from '../store/track';
import {
  auth,
  event as fetchEvent,
} from '../api/dancedeets';
import type {Event} from '../events/models';

async function registerToken(tokenRegistration: TokenRegistration) {
  setupToken(tokenRegistration);
  if (tokenRegistration.os === 'android') {
    auth({android_device_token: tokenRegistration.token});
  } else {
    //auth({android_device_token: tokenData.token});
  }
}

function hashCode(s: string) {
  let hash = 0;
  if (s.length == 0) {
    return hash;
  }
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}


async function sendUpcomingEventReminder(event: Event) {

  // TODO: Limitations of PushNotification:
  // - can't set a large bitmap unless it's included in our resources
  // - can't set CATEGORY_EVENT
  // - can't set a pendingIntent that opens ACTION_VIEW (maybe not important?)
  // - check if we have vibration privilege?
  // - we can add actions, but we can't make them be ACTION_VIEW mapUrl actions or have icons...
  // - Look up SharedPreference for whether we want to play sounds?
  const eventTime = event.start_time; // TODO: need to get only as string
  const eventLocation = event.venue.name;
  PushNotification.localNotification({
      /* Android Only Properties */
      id: hashCode('upcoming:' + event.id), // (optional) Valid unique 32 bit integer specified as string. default: Autogenerated Unique ID
      // ticker: "My Notification Ticker", // (optional) used for accessibility
      autoCancel: true, // (optional) default: true
      largeIcon: 'eventFlyerimageBitmap',
      smallIcon: 'penguin_head_outline', // (optional) default: "ic_notification" with fallback for "ic_launcher"
      bigText: event.description, // (optional) default: "message" prop
      subText: 'Open Event', // (optional) default: none
      //color: "red", // (optional) default: system default
      //vibrate: true, // (optional) default: true
      //vibration: 300, // vibration length in milliseconds, ignored if vibrate=false, default: 1000
      tag: 'upcoming_email', // (optional) add tag to message
      group: 'upcoming_email', // (optional) add message to group on watch
      ongoing: false, // (optional) set whether this is an "ongoing" notification

      /* iOS only properties */
      //alertAction: // (optional) default: view
      //category: // (optional) default: null
      //userInfo: // (optional) default: null (object containing additional notification data)

      /* iOS and Android properties */
      title: event.name, // (optional, for iOS this is only used in apple watch, the title will be the app name on other iOS devices)
      message: `${eventTime}: ${eventLocation}`, // (required)
      playSound: false, // (optional) default: true
      soundName: 'thats_whats_happening', // (optional) Sound to play when the notification is shown. Value of 'default' plays the default sound. It can be set to a custom sound such as 'android.resource://com.xyz/raw/my_sound'. It will look for the 'my_sound' audio file in 'res/raw' directory and play it. default: 'default' (default sound is played)
      //number: '10', // (optional) Valid 32 bit integer specified as string. default: none (Cannot be zero)
  });
}

async function receivedNotification(notification: any) {
  /*
    collapse_key: "do_not_collapse"
    foreground: true
    google.message_id: "0:1474442091773929%85df5223f9fd7ecd"
    google.sent_time: 1474442091764
    id: "1814580795"
    mp_campaign_id: "1459430"
    mp_message: "test"
    test: "1"
    userInteraction: false
  */
  console.log( 'NOTIFICATION:', notification );
  const notificationsEnabled = true;
  const notificationsUpcomingEventsEnabled = true;
  if (notification.notification_type === 'EVENT_REMINDER') {
    if (notificationsEnabled && notificationsUpcomingEventsEnabled) {
      const notificationEvent = await fetchEvent(notification.event_id);
      sendUpcomingEventReminder(notificationEvent);
    }
  }
}

export function setup() {
  PushNotification.configure({
      // (optional) Called when Token is generated (iOS and Android)
      onRegister: registerToken,

      // (required) Called when a remote or local notification is opened or received
      onNotification: receivedNotification,

      // ANDROID ONLY: GCM Sender ID (optional - not required for local notifications, but is need to receive remote push notifications)
      senderID: '911140565156',

      // IOS ONLY (optional): default: all - Permissions to register.
      permissions: {
          alert: true,
          badge: true,
          sound: true
      },

      // Should the initial notification be popped automatically
      // default: true
      popInitialNotification: false,

      /**
        * (optional) default: true
        * - Specified if permissions (ios) and token (android and ios) will requested or not,
        * - if not, you must call PushNotificationsHandler.requestPermissions() later
        */
      requestPermissions: Platform.OS === 'android',
  });
}
