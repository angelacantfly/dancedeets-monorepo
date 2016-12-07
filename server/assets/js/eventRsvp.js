import $ from 'jquery';
import React from 'react';
import {
  injectIntl,
  intlShape,
  FormattedMessage,
} from 'react-intl';
import { messages } from 'dancedeets-common/js/events/messages';

const choiceStrings = [
  {
    internal: 'attending',
    messageName: 'attending',
  },
  {
    internal: 'maybe',
    messageName: 'maybe',
  },
  {
    internal: 'declined',
    messageName: 'declined',
  },
];

export type RsvpValue = 'attending' | 'maybe' | 'declined' | 'none';


class _RsvpComponent extends React.Component {
  props: {
    event: Event;
    userRsvp: RsvpValue;
  }

  state: {
    rsvpValue: RsvpValue;
    updated: boolean;
    disableAll: boolean;
  }

  constructor(props) {
    super(props);
    this.state = {
      rsvpValue: this.props.userRsvp,
      updated: false,
      disableAll: false,
    };
    this.choiceBinds = choiceStrings.map(({ internal, messageName }) => this.onChange.bind(this, internal));
    (this: any).loadRsvpsFor = this.loadRsvpsFor.bind(this);
  }

  componentDidMount() {
    if (!window.hasCalledFbInit) {
      $(document).bind('fb-load', () => {
        this.componentDidMount();
      });
      return;
    }
    console.log('RsvpComponent.componentDidMount Running', window.FB);
    window.FB.getLoginStatus((response) => {
      console.log('getLoginStatus returned ', response.status);
      if (response.status === 'connected') {
        this.loadRsvpsFor(response.authResponse.userID);
      }
    });
  }

  async onChange(rsvpValue, changeEvent) {
    if (this.state.rsvpValue === rsvpValue) {
      return;
    }
    const result = await $.ajax({
      type: 'POST',
      url: '/events/rsvp_ajax',
      data: {
        rsvp: rsvpValue,
        event_id: this.props.event.id,
      },
    });
    this.setState({
      rsvpValue,
      updated: true,
    });
  }

  disableAll() {
    if (!this.state.disableAll) {
      this.setState({ disableAll: true });
    }
  }

  async loadRsvpsFor(userId) {
    choiceStrings.forEach(({ internal, messageName }) => {
      window.FB.api(`/${this.props.event.id}/${internal}/${userId}`, 'get', {}, (response) => {
        if (response.error) {
          // Disable all buttons since we don't have permission to RSVP
          this.disableAll();
          return;
        }
        if (response.data.length) {
          if (!this.state.updated) {
            this.setState({ rsvpValue: internal });
          }
        }
      });
    });
  }

  render() {
    const id = this.props.event.id;

    const buttons = choiceStrings.map(({ internal, messageName }, index) => {
      const activeClass = this.state.rsvpValue === internal ? 'active btn-no-focus' : '';
      return (<button
        type="button"
        className={`btn btn-default ${activeClass}`}
        id={`rsvp_${id}_${internal}`}
        value={internal}
        disabled={this.state.disableAll ? 'disabled' : ''}
        onClick={this.choiceBinds[index]}
      >
        <FormattedMessage id={messages[messageName].id} />
      </button>);
    });
    return (
      <form style={{ margin: '0px', display: 'inline' }} className="form-inline">
        <div className="btn-group" role="group" aria-label="RSVPs">
          {buttons}
        </div>
      </form>
    );
  }
}
export const RsvpComponent = injectIntl(_RsvpComponent);