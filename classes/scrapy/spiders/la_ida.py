import dateparser
import datetime
import urlparse

from .. import items


def parse_times(times):
    start, end = times.split(u' - ')
    return dateparser.parse(start).time(), dateparser.parse(end).time()

class IDA(items.StudioScraper):
    name = 'IDA'
    allowed_domains = ['www.idahollywood.com']
    latlong = (34.1019203, -118.339862)
    address = '6755 Hollywood Blvd., Suite 200 Los Angeles, CA 90028'

    start_urls = [
        'http://www.idahollywood.com/schedule',
    ]

    @classmethod
    def _extract_text_without_hidden(cls, cell):
        contents = cls._extract_text(cell)
        contents_hide = cls._extract_text(cell.css('.inline-hide'))
        return contents.replace(contents_hide, '').strip()

    def parse_classes(self, response):
        day_li = response.css('ul.quicktabs-tabs li')
        dates = [dateparser.parse(self._extract_text(day)).date() for day in day_li]

        for i, day_row in enumerate(response.css('.quicktabs-tabpage')):
            date = dates[i]
            for row in day_row.css('.quicktabs-views-group'):

                style = self._extract_text_without_hidden(row.css('.views-field-field-add-class-details-'))
                if not self._street_style(style):
                    continue

                times = self._extract_text(row.css('.time-default'))
                start_time, end_time = parse_times(times)
                teacher_cell = row.css('.views-field-field-instructor')
                teacher = self._extract_text_without_hidden(teacher_cell)

                teacher_link = None
                teacher_href = teacher_cell.xpath('.//a/@href')
                if teacher_href:
                    teacher_link = teacher_href.extract()[0]
                    url = urlparse.urljoin(response.url, teacher_link)
                    teacher_link = url

                item = items.StudioClass()
                item['start_time'] = datetime.datetime.combine(date, start_time)
                item['end_time'] = datetime.datetime.combine(date, end_time)
                item['style'] = style.title()
                item['teacher'] = teacher
                item['teacher_link'] = teacher_link

                for new_item in self._repeated_items_iterator(item):
                    yield new_item

"""
                <tr>
                    <td width="162" align="left" height="27" style="border-left-style: none; border-left-width: medium; border-right-style: solid; border-right-width: 1px; border-bottom-style: solid; border-bottom-width: 1px; text-decoration:none; color:#000000; font-family:Arial; font-size:10pt">
                    <font face="Arial" size="2">10:00 a.m. - 11:30 a.m.</font></td>
                    <td width="36" align="left" height="27" style="border-right-style: solid; border-right-width: 1px; border-bottom-style: solid; border-bottom-width: 1px; text-decoration:none; color:#000000; font-family:Arial; font-size:10pt">
                    1</td>
                    <td width="206" align="left" height="27" style="border-right-style: solid; border-right-width: 1px; border-bottom-style: solid; border-bottom-width: 1px; text-decoration:none; color:#000000; font-family:Arial; font-size:10pt">
                    <font face="Arial" size="2">Jazz 2 Technique</font></td>
                    <td width="198" align="left" height="27" style="border-right-style: solid; border-right-width: 1px; border-bottom-style: solid; border-bottom-width: 1px; text-decoration:none; color:#000000; font-family:Arial; font-size:10pt">
    <font face="Arial" size="2">
    <a style="text-decoration: none; color: #000000" href="teachers/prudich_bill/prudich_bill.htm">Bill Prudich</a></font></td>
                    <td width="72" align="left" height="27" style="border-right-style: solid; border-right-width: 1px; border-bottom-style: solid; border-bottom-width: 1px; text-decoration:none; color:#000000; font-family:Arial; font-size:10pt">
                    &nbsp;</td>
                    <td width="298" height="27" style="border-right-style: none; border-right-width: medium; border-bottom-style: solid; border-bottom-width: 1px; text-decoration:none; color:#000000; font-family:Arial; font-size:10pt">
                    &nbsp;</td>
                </tr>
"""
