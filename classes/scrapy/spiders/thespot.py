import datetime
import dateutil
import icalendar
import scrapy
from .. import items


def expand_rrule(event):
    rrulestr = event['RRULE'].to_ical().decode('utf-8')
    start = event.decoded('dtstart')
    if isinstance(start, datetime.datetime):
        start = start.replace(tzinfo=None)
    rrule = dateutil.rrule.rrulestr(rrulestr, dtstart=start)
    if not set(['UNTIL', 'COUNT']).intersection(
            event['RRULE'].keys()):
        # pytz.timezones don't know any transition dates after 2038
        # either
        rrule._until = datetime.today() + datetime.timedelta(years=1)
    elif rrule._until.tzinfo:
        rrule._until = rrule._until.replace(tzinfo=None)
    return rrule

class TheSpotDanceCenter(scrapy.Spider):
    name = 'TheSpot'
    allowed_domains = ['localender.com']
    start_urls = [
        'http://www.localendar.com/public/TheSpotDanceCenter.ics',
    ]

    def parse(self, response):
        ical_body = response.body
        calendar = icalendar.Calendar.from_ical(ical_body.replace('\xc2\xa0', ' ').encode('iso-8859-1'))
        for event in calendar.subcomponents:
            try:
                if not isinstance(event, icalendar.Event):
                    continue
                summary = event['summary']
                if '-' in summary:
                    name, teacher = summary.split('-', 1)
                elif ' with ' in summary:
                    name, teacher = summary.split(' with ', 1)
                else:
                    name = summary
                    teacher = None
                item = items.ClassItem()
                item['source_page'] = response.url
                item['style'] = name
                item['teacher'] = teacher
                item['start_time'] = event.decoded('dtstart')
                if 'dtend' in event:
                    item['end_time'] = event.decoded('dtend')
                else:
                    item['end_time'] = event.decoded('dtstart') + datetime.timedelta(hours=6)
                if not 'rrule' in event:
                    yield item
                else:
                    rrule = expand_rrule(event)
                    duration = item['end_time'] - item['start_time']
                    for recurrance in rrule:
                        newitem = item.copy()
                        print recurrance
                        newitem['start_time'] = recurrance
                        newitem['end_time'] = recurrance + duration
                        yield newitem
            except:
                print event
                raise

