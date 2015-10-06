# -*- coding: utf-8 -*-

# Define here the models for your scraped items
#
# See documentation in:
# http://doc.scrapy.org/en/latest/topics/items.html

import scrapy
from scrapy import loader
from scrapy.loader import processors
import string

class ClassItem(scrapy.Item):
    studio = scrapy.Field()
    source_page = scrapy.Field()
    recurrence_id = scrapy.Field()
    style = scrapy.Field()
    teacher = scrapy.Field()
    teacher_link = scrapy.Field()
    start_time = scrapy.Field()
    end_time = scrapy.Field()

StripAndCombine = processors.Compose(processors.MapCompose(string.strip), processors.Join(' '), processors.MapCompose(string.strip))
class ClassLoader(loader.ItemLoader):
    default_output_processor = processors.TakeFirst()

    teacher_in = StripAndCombine
    style_in = StripAndCombine

    def recurrence_id_out(self, value, context_loader):
        """Returns a recurrence_id using fields that remain stable week-to-week,
        and also uniquely identify a class recurrance."""
        studio = context_loader['item'].get_output_value('studio')
        style = context_loader['item'].get_output_value('style')
        start_time = context_loader['item'].get_output_value('start_time')
        start_time_string = start_time.strftime('Day %w: %H:%M')
        return '%s: %s: %s' % (studio, start_time_string, style)
