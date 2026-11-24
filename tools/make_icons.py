"""지예 작업 현황 — PWA 아이콘 생성 (Pillow 전용, 외부 파일 없음).

    python3 tools/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(parents=True, exist_ok=True)

SS = 4  # 슈퍼샘플링 배율

TOP = (0x33, 0x2E, 0x5C)
BOTTOM = (0x6A, 0x5A, 0xA8)
DOTS = [(0x34, 0xD3, 0x99), (0xFB, 0xBF, 0x24), (0xA5, 0xB4, 0xFC)]
BAR_W = [0.34, 0.28, 0.22]  # 카드 안쪽 패딩을 넘지 않는 막대 길이


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), TOP)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        col = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
        draw.line([(0, y), (size, y)], fill=col)
    return img


def draw_icon(px: int, maskable: bool = False) -> Image.Image:
    size = px * SS
    img = gradient(size)
    draw = ImageDraw.Draw(img, "RGBA")

    # maskable은 잘려도 되는 가장자리를 비우도록 내용을 72%로 줄인다.
    scale = 0.72 if maskable else 1.0

    def box(cx: float, cy: float, half_w: float, half_h: float):
        return [
            (cx - half_w * scale) * size,
            (cy - half_h * scale) * size,
            (cx + half_w * scale) * size,
            (cy + half_h * scale) * size,
        ]

    # 카드
    draw.rounded_rectangle(
        box(0.5, 0.5, 0.285, 0.285),
        radius=0.085 * scale * size,
        fill=(255, 255, 255, 246),
    )

    # 세 줄: 점 + 막대
    centers = [0.385, 0.5, 0.615]
    for i, cy in enumerate(centers):
        r = 0.030
        dot = box(0.345, cy, r, r)
        draw.ellipse(dot, fill=DOTS[i] + (255,))
        bar_h = 0.030
        draw.rounded_rectangle(
            box(0.395 + BAR_W[i] / 2, cy, BAR_W[i] / 2, bar_h),
            radius=bar_h * scale * size,
            fill=(0x3D, 0x36, 0x64, 92),
        )

    return img.resize((px, px), Image.LANCZOS)


def main() -> None:
    for name, px, maskable in [
        ("icon-512.png", 512, False),
        ("icon-192.png", 192, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon-180.png", 180, False),
        ("favicon-64.png", 64, False),
    ]:
        draw_icon(px, maskable).save(OUT / name, optimize=True)
        print("saved", OUT / name)


if __name__ == "__main__":
    main()
