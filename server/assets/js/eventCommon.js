/**
 * Copyright 2016 DanceDeets.
 *
 * @flow
 */

import React from 'react';
import url from 'url';
import LazyLoad from 'react-lazyload';
import type { Cover, JSONObject } from 'dancedeets-common/js/events/models';
import { Event, SearchEvent } from 'dancedeets-common/js/events/models';

export class SquareEventFlyer extends React.Component {
  props: {
    event: SearchEvent,
    lazyLoad?: boolean,
  };

  generateCroppedCover(picture: Cover, width: number, height: number) {
    const parsedSource = url.parse(picture.source, true);
    parsedSource.query = { ...parsedSource.query, width, height };
    const newSourceUrl = url.format(parsedSource);

    return {
      source: newSourceUrl,
      width,
      height,
    };
  }

  render() {
    const event = this.props.event;
    const picture = event.picture;
    if (!picture) {
      return null;
    }
    const width = 180;
    const height = 180;

    const scaledHeight = '100'; // height == width

    const croppedPicture = this.generateCroppedCover(picture, width, height);
    let imageTag = (
      <div
        style={{
          height: 0,
          paddingBottom: `${scaledHeight}%`,
        }}
      >
        <img
          role="presentation"
          src={croppedPicture.source}
          style={{
            width: '100%',
          }}
          className="no-border"
        />
      </div>
    );
    if (this.props.lazyLoad) {
      imageTag = (
        <LazyLoad height={height} once offset={300}>{imageTag}</LazyLoad>
      );
    }
    return (
      <a className="link-event-flyer" href={event.getUrl()}>
        {imageTag}
      </a>
    );
  }
}
