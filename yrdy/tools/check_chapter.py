# -*- coding: utf-8 -*-
"""日更流水线单章检查器：字数（全文去空白含标点）＋破折号残留。
用法：python tools/check_chapter.py <章节文件路径> [更多路径...]
字数口径与 08-chapters.md 一致；标准：1800-2600（目标 2000-2400）。"""
import re
import sys

LO, HI = 1800, 2600

def check(path):
    t = open(path, encoding="utf-8").read()
    n = len(re.sub(r"\s", "", t))
    dashes = t.count("——") + len(re.findall(r"(?<!-)—(?!-)", t))
    bad = []
    if n < LO or n > HI:
        bad.append("字数越界")
    if dashes:
        bad.append("破折号残留%d处" % dashes)
    flag = "FAIL " + ";".join(bad) if bad else "OK"
    print("%s | %d 字 | %s" % (path, n, flag))
    return not bad

if __name__ == "__main__":
    ok = all([check(p) for p in sys.argv[1:]])
    sys.exit(0 if ok else 1)
