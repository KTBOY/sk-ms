# -*- coding: utf-8 -*-
"""《九州烟云》正文分章/合卷工具（2026-09-10 起正文按章落位）。

用法：
    python tools/split_merge_chapters.py split   # 整卷 md -> 卷文件夹/第NNN章-标题.md（一次性迁移）
    python tools/split_merge_chapters.py merge   # 章节文件 -> 导出合并稿/卷XX-卷名.md（供墨枢回导等需要整卷文件的场景）

split 安全性：逐字节重组原文件内容并断言相等后才落盘；原卷文件不动，确认无误后人工处置。
"""
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "正文"
MERGE_OUT = Path(__file__).resolve().parent.parent / "导出合并稿"

HEADING = re.compile(r"^## 第([一二三四五六七八九十百千零〇两\d]+)章[ \u3000]*(\S.*?)\s*$", re.M)

CN_DIGITS = {"零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
             "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
CN_UNITS = {"十": 10, "百": 100, "千": 1000}


def cn2int(s: str) -> int:
    if s.isdigit():
        return int(s)
    total, section, num = 0, 0, 0
    for ch in s:
        if ch in CN_DIGITS:
            num = CN_DIGITS[ch]
        elif ch in CN_UNITS:
            section += (num if num else 1) * CN_UNITS[ch]
            num = 0
        else:
            raise ValueError(f"无法解析章号: {s}")
    return total + section + num


def sanitize(title: str) -> str:
    t = re.sub(r'[\\/:*?"<>|]', "", title).strip().rstrip(".")
    return t


def read(path: Path) -> str:
    with open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def split() -> None:
    vol_files = sorted(p for p in BASE.glob("卷*.md") if p.is_file())
    if not vol_files:
        print("未发现整卷文件（可能已拆分）。")
        return
    for vf in vol_files:
        text = read(vf)
        ms = list(HEADING.finditer(text))
        if not ms:
            print(f"[跳过] {vf.name}: 未匹配到章节标题")
            continue
        starts = [m.start() for m in ms] + [len(text)]
        segments = [text[starts[i]:starts[i + 1]] for i in range(len(ms))]
        prelude = text[:ms[0].start()]
        assert prelude + "".join(segments) == text, f"{vf.name}: 重组与原文件不一致，中止"
        folder = BASE / vf.stem
        nums = [cn2int(m.group(1)) for m in ms]
        assert nums == sorted(nums) and len(set(nums)) == len(nums), f"{vf.name}: 章号不连续或重复"
        written = []
        if prelude.strip():
            write(folder / "卷首.md", prelude)
            written.append("卷首.md")
        for m, seg, n in zip(ms, segments, nums):
            fname = f"第{n:03d}章-{sanitize(m.group(2))}.md"
            fp = folder / fname
            if fp.exists():
                raise SystemExit(f"[中止] 已存在: {fp}")
            write(fp, seg)
            written.append(fname)
        print(f"[OK] {vf.name} -> {folder.name}/  共 {len(ms)} 章（第 {nums[0]}~{nums[-1]} 章），"
              f"生成 {len(written)} 个文件，逐字节校验通过")


def merge() -> None:
    folders = sorted(p for p in BASE.iterdir() if p.is_dir() and p.name.startswith("卷"))
    if not folders:
        print("未发现卷文件夹。")
        return
    MERGE_OUT.mkdir(exist_ok=True)
    for fd in folders:
        parts = []
        head = fd / "卷首.md"
        if head.exists():
            parts.append(read(head))
        chapters = sorted((p for p in fd.glob("第*章-*.md")),
                          key=lambda p: int(re.search(r"第(\d+)章", p.name).group(1)))
        for p in chapters:
            parts.append(read(p))
        out = MERGE_OUT / f"{fd.name}.md"
        write(out, "".join(parts))
        print(f"[OK] {fd.name}/ + {len(chapters)} 章 -> 导出合并稿/{out.name}")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "split":
        split()
    elif mode == "merge":
        merge()
    else:
        print(__doc__)
