#!/usr/bin/env python3
"""手册章节的唯一文件名约定。

四个脚本都要「只处理域章节文件」这件事。这个正则曾经被抄成四份，于是每次新增章号都得改四处
（已经漏过三次：06、27、30）。集中在这里，加章只改一行。

用法：from handbook_chapters import CHAPTER_RE
"""
import re

# 域章节：06–09 的横切章、10–19 的核心域，20+ 的专题/横切章
CHAPTER_RE = re.compile(r"^(0[6-9]|1\d|[23][0-9])-")
