"""Spell out digits as Saudi-style Arabic words so the TTS reads them naturally."""
import re

_UNITS = ["صفر", "واحد", "اثنين", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
          "إحدعش", "اثنعش", "ثلاثطعش", "أربعطعش", "خمسطعش", "ستطعش", "سبعطعش", "ثمنطعش", "تسعطعش"]
_TENS = ["", "", "عشرين", "ثلاثين", "أربعين", "خمسين", "ستين", "سبعين", "ثمانين", "تسعين"]
_HUNDREDS = ["", "مية", "ميتين", "ثلاثمية", "أربعمية", "خمسمية", "ستمية", "سبعمية", "ثمانمية", "تسعمية"]
_ARABIC_INDIC = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def _below_1000(n: int) -> str:
    parts = []
    h, rest = divmod(n, 100)
    if h:
        parts.append(_HUNDREDS[h])
    if rest:
        if rest < 20:
            parts.append(_UNITS[rest])
        else:
            t, u = divmod(rest, 10)
            parts.append(f"{_UNITS[u]} و{_TENS[t]}" if u else _TENS[t])
    return " و".join(parts)


def _scale(n: int, one: str, two: str, few: str, many: str) -> str:
    if n == 1:
        return one
    if n == 2:
        return two
    if 3 <= n <= 10:
        return f"{_below_1000(n)} {few}"
    return f"{number_to_words(n)} {many}"


def number_to_words(n: int) -> str:
    if n < 0:
        return "سالب " + number_to_words(-n)
    if n == 0:
        return _UNITS[0]
    parts = []
    millions, n = divmod(n, 1_000_000)
    thousands, n = divmod(n, 1000)
    if millions:
        parts.append(_scale(millions, "مليون", "مليونين", "ملايين", "مليون"))
    if thousands:
        parts.append(_scale(thousands, "ألف", "ألفين", "آلاف", "ألف"))
    if n:
        parts.append(_below_1000(n))
    return " و".join(parts)


def _time(m: re.Match) -> str:
    h, mins = int(m.group(1)), int(m.group(2))
    hour = number_to_words(h)
    if mins == 0:
        return hour
    if mins == 30:
        return f"{hour} ونص"
    if mins == 15:
        return f"{hour} وربع"
    if mins == 45:
        return f"{number_to_words(h % 12 + 1)} إلا ربع"
    return f"{hour} و{number_to_words(mins)} دقيقة"


def spell_numbers(text: str) -> str:
    text = text.translate(_ARABIC_INDIC)
    text = re.sub(r"\b(\d{1,2}):(\d{2})\b", _time, text)
    text = re.sub(r"(\d+)%", lambda m: number_to_words(int(m.group(1))) + " بالمية", text)
    text = re.sub(r"(?<=\d),(?=\d{3})", "", text)
    text = re.sub(r"\d+\.\d+", lambda m: m.group(0).replace(".", " فاصلة "), text)
    return re.sub(r"\d+", lambda m: number_to_words(int(m.group(0))) if len(m.group(0)) <= 9 else m.group(0), text)


if __name__ == "__main__":
    for s in ["250 ريال", "الساعة 1:30", "12:00", "2,500 ريال", "١٥٠ دقيقة", "1250000", "18%", "11 مهمة"]:
        print(s, "→", spell_numbers(s))
