# Builds the Unscroll pitch deck. Run from the repository root: python build_deck.py <output.pptx>
import sys
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

OUT = sys.argv[1]
MEDIA = 'docs/media/'
YOUTUBE = 'https://youtu.be/fKccxDHB6GI'
REPO = 'https://github.com/Charlesganu2004/Whitman-Hackathon'
FONT = 'Arial'
BG, SURFACE, HERO, INK, MUTED, LINE, ACCENT, ON_ACCENT, PALE = '111014', '1D1A20', '211820', 'FAEFF5', 'B9A7B3', '3D303A', 'F28DBB', '27121E', '35232F'
W, H = 13.333, 7.5

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(W), Inches(H)
BLANK = prs.slide_layouts[6]


def rgb(value):
    return RGBColor.from_string(value)


def new_slide(notes):
    slide = prs.slides.add_slide(BLANK)
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = rgb(BG)
    slide.notes_slide.notes_text_frame.text = notes
    return slide


def ring(slide, cx, cy, diameter, color=LINE):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(cx - diameter / 2), Inches(cy - diameter / 2), Inches(diameter), Inches(diameter))
    shape.fill.background()
    shape.line.color.rgb = rgb(color)
    shape.line.width = Pt(1)
    shape.shadow.inherit = False
    return shape


def box(slide, x, y, w, h, fill=SURFACE, line=LINE, radius=0.06, shape=MSO_SHAPE.ROUNDED_RECTANGLE):
    item = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    item.fill.solid()
    item.fill.fore_color.rgb = rgb(fill)
    if line:
        item.line.color.rgb = rgb(line)
        item.line.width = Pt(1)
    else:
        item.line.fill.background()
    item.shadow.inherit = False
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        item.adjustments[0] = radius
    return item


def text(slide, x, y, w, h, runs, size=16, bold=False, color=INK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=None, link=None):
    """runs: a string, or a list of paragraphs, each a string or a list of (text, colour) pairs."""
    holder = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    # A link on the box, not on the text, keeps the deck's own colours instead of the default blue underline.
    if link:
        holder.click_action.hyperlink.address = link
    frame = holder.text_frame
    frame.word_wrap = True
    frame.margin_left = frame.margin_right = frame.margin_top = frame.margin_bottom = 0
    frame.vertical_anchor = anchor
    paragraphs = runs if isinstance(runs, list) else [runs]
    for index, paragraph in enumerate(paragraphs):
        p = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
        p.alignment = align
        if spacing:
            p.line_spacing = spacing
        for part in (paragraph if isinstance(paragraph, list) else [(paragraph, color)]):
            run = p.add_run()
            run.text = part[0]
            run.font.name = FONT
            run.font.size = Pt(size)
            run.font.bold = bold
            run.font.color.rgb = rgb(part[1])
    return frame


def badge(slide, x, y, label, size=0.62, font=16):
    shape = box(slide, x, y, size, size, fill=ACCENT, line=None, shape=MSO_SHAPE.OVAL)
    frame = shape.text_frame
    frame.margin_left = frame.margin_right = frame.margin_top = frame.margin_bottom = 0
    frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = label
    run.font.name, run.font.size, run.font.bold = FONT, Pt(font), True
    run.font.color.rgb = rgb(ON_ACCENT)
    return shape


def heading(slide, eyebrow, title, number, x=0.7, w=11.9):
    text(slide, x, 0.6, w, 0.3, eyebrow.upper(), size=12, bold=True, color=MUTED)
    text(slide, x, 0.95, w, 1.2, title, size=36, bold=True, spacing=0.95)
    text(slide, W - 1.4, H - 0.6, 0.7, 0.3, f'{number:02d}', size=11, color=MUTED, align=PP_ALIGN.RIGHT)
    text(slide, 0.7, H - 0.6, 3, 0.3, [[('unscroll', MUTED), ('.', ACCENT)]], size=11, bold=True)


def phone(slide, image, x, y, height):
    width = height * 0.4618
    box(slide, x - 0.12, y - 0.12, width + 0.24, height + 0.24, fill='2B272C', line='4A444B', radius=0.09)
    picture = slide.shapes.add_picture(MEDIA + image, Inches(x), Inches(y), height=Inches(height))
    picture.line.color.rgb = rgb(BG)
    picture.line.width = Pt(1)
    return picture


# 1. Title
s = new_slide('Open with the line, then the one-sentence promise. Unscroll is an iPhone app a student team built at the Whitman Hackathon. Pause on the phone screen: this is the real app, running today.')
ring(s, 10.9, 3.6, 8.6)
ring(s, 10.9, 3.6, 6.4)
ring(s, 1.2, 7.4, 5.2)
text(s, 0.9, 1.25, 7, 0.3, 'WHITMAN HACKATHON   ·   PRODUCT PITCH', size=12, bold=True, color=MUTED)
text(s, 0.9, 1.85, 7.6, 1.5, [[('unscroll', INK), ('.', ACCENT)]], size=88, bold=True)
text(s, 0.9, 3.55, 7.6, 0.7, 'Less scrolling. More becoming.', size=30, bold=True)
text(s, 0.9, 4.45, 6.6, 1.2, 'Pass a short interview with Jarvis, your AI interviewer. Earn your break.', size=20, color=MUTED, spacing=1.15)
box(s, 0.9, 5.95, 3.1, 0.6, fill=ACCENT, line=None, radius=0.5).click_action.hyperlink.address = YOUTUBE
text(s, 0.9, 5.95, 3.1, 0.6, 'Watch the 40 second film', size=14, bold=True, color=ON_ACCENT, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, link=YOUTUBE)
phone(s, 'screen-today.jpg', 9.45, 0.62, 6.26)

# 2. Why: the problem
s = new_slide('Start with the problem, in the audience\'s own experience. Interview practice matters and is easy to put off, because its reward is months away. The feed is one tap away and rewards you now. So the scroll wins. We are describing the tension we designed for, not quoting a study.')
ring(s, 12.6, 0.4, 5.4)
heading(s, 'Why  ·  the problem', 'The scroll always wins', 2)
text(s, 0.7, 2.35, 6.2, 2.6, 'Interview practice is important and easy to put off. The feed is one tap away, and it pays out right now.', size=24, spacing=1.2)
text(s, 0.7, 5.35, 6.2, 0.9, 'The tension we designed for. Our observation as students, not a statistic.', size=14, color=MUTED, spacing=1.15)
for index, (label, reward, fill, ink) in enumerate([('Scrolling', 'Reward: now', ACCENT, ON_ACCENT), ('Interview practice', 'Reward: months away', PALE, MUTED)]):
    y = 2.35 + index * 2.05
    box(s, 7.6, y, 5.0, 1.75, fill=HERO, radius=0.1)
    text(s, 8.05, y + 0.3, 4.1, 0.5, label, size=22, bold=True)
    box(s, 8.05, y + 0.95, 2.9, 0.5, fill=fill, line=None, radius=0.5)
    text(s, 8.05, y + 0.95, 2.9, 0.5, reward, size=14, bold=True, color=ink, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

# 3. What: the idea
s = new_slide('What Unscroll is, in one sentence: it makes practice earn the break. A short practice session feels more rewarding when it unlocks something the student already wants. Say plainly that this is a design hypothesis we want to test with students, not a measured result.')
ring(s, 12.6, 0.4, 5.4)
heading(s, 'What  ·  Unscroll', 'Make practice earn the break', 3)
text(s, 0.7, 2.35, 6.2, 2.4, 'Unscroll swaps the next scroll for a short interview. Pass, and the apps you chose open for a timed break.', size=24, spacing=1.2)
text(s, 0.7, 5.35, 6.2, 0.9, 'A design bet to test with students, not a result we have measured.', size=14, color=MUTED, spacing=1.15)
box(s, 7.6, 2.25, 5.0, 4.0, fill=HERO, radius=0.07)
box(s, 8.05, 2.8, 4.1, 0.95, fill=PALE, line=None, radius=0.3)
text(s, 8.05, 2.8, 4.1, 0.95, 'The next scroll', size=20, bold=True, color=MUTED, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
text(s, 8.05, 3.8, 4.1, 0.55, 'becomes', size=14, color=MUTED, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
box(s, 8.05, 4.4, 4.1, 0.95, fill=ACCENT, line=None, radius=0.3)
text(s, 8.05, 4.4, 4.1, 0.95, 'One interview rep', size=20, bold=True, color=ON_ACCENT, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
text(s, 8.05, 5.45, 4.1, 0.5, 'then a break you earned', size=14, color=MUTED, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

# 3. How it works
s = new_slide('Three steps. One: the student picks the apps that distract them. Two: a short daily interview with Jarvis, technical and behavioral, typed or spoken. Three: passing opens a 15, 30 or 60 minute break. A failed answer cannot be skipped: you read the feedback, then get a different question.')
heading(s, 'How  ·  it works', 'Three steps, repeated daily', 4)
steps = [
    ('1', 'Pick your distractions', 'Choose the apps that pull you in, plus your major, goals and target companies.'),
    ('2', 'Pass an interview with Jarvis', 'A short daily set of technical and behavioral questions. Answer by voice or by typing.'),
    ('3', 'Earn your break', 'Pass to open a 15, 30 or 60 minute break. A missed answer returns as a different question.'),
]
for index, (number, title, body) in enumerate(steps):
    x = 0.7 + index * 4.09
    box(s, x, 2.45, 3.75, 3.85)
    badge(s, x + 0.4, 2.85, number, size=0.72, font=20)
    text(s, x + 0.4, 3.85, 2.95, 0.95, title, size=22, bold=True, spacing=1.0)
    text(s, x + 0.4, 4.85, 2.95, 1.3, body, size=15, color=MUTED, spacing=1.15)

# 4. Jarvis
s = new_slide('This is the standout feature. Jarvis is a conversation, not a form. He reads the question aloud. Asking him to clarify is free. A hint costs ten evaluation points, at most three per question, and pass or fail still uses the raw grade. Behavioral answers get STAR feedback: situation, task, action, result.')
ring(s, 12.9, 6.9, 4.6)
phone(s, 'screen-jarvis.jpg', 0.92, 0.62, 6.26)
text(s, 4.75, 0.6, 7.8, 0.3, 'HOW  ·  THE INTERVIEWER', size=12, bold=True, color=MUTED)
text(s, 4.75, 0.95, 7.9, 1.5, ['Meet Jarvis,', 'your AI interviewer'], size=36, bold=True, spacing=0.95)
rows = [
    ('He asks, then listens', 'Answer out loud or type it. He reads each question to you.'),
    ('Clarifying questions are free', 'Ask what he means before you answer. It is never graded.'),
    ('Hints cost evaluation points', 'Ten points each, three per question. Pass or fail uses the raw grade.'),
    ('Feedback on what you said', 'Behavioral answers get STAR feedback, line by line.'),
]
for index, (title, body) in enumerate(rows):
    y = 2.75 + index * 1.0
    box(s, 4.75, y + 0.08, 0.34, 0.34, fill=ACCENT, line=None, shape=MSO_SHAPE.OVAL)
    text(s, 5.35, y, 7.2, 0.4, title, size=19, bold=True)
    text(s, 5.35, y + 0.42, 7.2, 0.45, body, size=14, color=MUTED)
text(s, W - 1.4, H - 0.6, 0.7, 0.3, '05', size=11, color=MUTED, align=PP_ALIGN.RIGHT)

# 6. The film
s = new_slide('Play the film here. It is forty seconds, drawn, scored and narrated entirely in code. Click the picture or the button: it opens on YouTube. The three lines beside it are what the film says: why (the scroll wins), what (practice earns the break), how (pick apps, pass with Jarvis, earn the break). If the room has no sound, the captions carry it.')
heading(s, 'The film', 'Why, what and how in forty seconds', 6)
poster = s.shapes.add_picture(MEDIA + 'unscroll-ad-poster.jpg', Inches(0.7), Inches(2.3), width=Inches(6.8))
poster.click_action.hyperlink.address = YOUTUBE
poster.line.color.rgb = rgb(LINE)
poster.line.width = Pt(1)
box(s, 4.6, 5.5, 2.7, 0.5, fill=ACCENT, line=None, radius=0.5).click_action.hyperlink.address = YOUTUBE
text(s, 4.6, 5.5, 2.7, 0.5, 'Play on YouTube', size=14, bold=True, color=ON_ACCENT, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, link=YOUTUBE)
text(s, 0.7, 6.3, 6.8, 0.35, 'youtu.be/fKccxDHB6GI   ·   drawn, scored and narrated in code', size=13, color=MUTED, link=YOUTUBE)
for index, (label, line) in enumerate([('WHY', 'It always starts with one more scroll.'), ('WHAT', 'Your apps stay locked until you pass today\'s interview.'), ('HOW', 'Pick your apps, pass with Jarvis, earn your break.')]):
    y = 2.3 + index * 1.31
    box(s, 8.0, y, 4.63, 1.2)
    text(s, 8.3, y + 0.16, 4.0, 0.3, label, size=12, bold=True, color=ACCENT)
    text(s, 8.3, y + 0.48, 4.05, 0.65, line, size=15, spacing=1.1)

# 7. Evaluation and road map
s = new_slide('The evaluation tells a student where they stand in three skills: communication, talking through technical problems, and coding. Standings come only from graded answers, and a skill with no answers shows as not measured yet. The road map is five levels, Beginner to Master, and you drag it sideways.')
heading(s, 'How  ·  the evaluation', 'Know where you stand', 7, w=8.2)
text(s, 0.7, 2.25, 7.9, 0.9, 'Three skill standings from your graded answers, and a road map of five levels you can drag.', size=18, color=MUTED, spacing=1.15)
meters = [('Communication', 0.72), ('Technical discussion', 0.56), ('Coding', 0.34)]
box(s, 0.7, 3.45, 7.9, 3.0)
text(s, 7.0, 3.62, 1.4, 0.3, 'ILLUSTRATION', size=10, bold=True, color=MUTED, align=PP_ALIGN.RIGHT)
for index, (label, share) in enumerate(meters):
    y = 3.95 + index * 0.78
    text(s, 1.05, y, 5, 0.38, label, size=17, bold=True)
    box(s, 1.05, y + 0.42, 7.2, 0.16, fill=PALE, line=None, radius=0.5)
    box(s, 1.05, y + 0.42, 7.2 * share, 0.16, fill=ACCENT, line=None, radius=0.5)
phone(s, 'screen-roadmap.jpg', 9.6, 0.62, 6.26)

# 7. Free tiers
s = new_slide('Everything here runs on free tiers. NVIDIA grades and drives Jarvis in about two seconds. Groq turns speech into text and gives Jarvis his voice. With no key at all the app still works on rubric feedback and the phone voice. Keys live only on the server, never in the app or the repository.')
ring(s, 0.2, 7.2, 4.8)
heading(s, 'How  ·  under the hood', 'AI and voice, all on free tiers', 8)
box(s, 0.7, 2.3, 11.93, 3.75)
columns = [(1.05, 3.5), (4.7, 1.75), (6.55, 3.75), (10.45, 2.0)]
for (x, w), label in zip(columns, ['JOB', 'PROVIDER', 'MODEL', 'MEASURED']):
    text(s, x, 2.55, w, 0.3, label, size=11, bold=True, color=MUTED)
table = [
    ('Interviewer and grading', 'NVIDIA', 'nemotron-3-super-120b', '1.6 to 2.6 s'),
    ('Your voice to text', 'Groq', 'whisper-large-v3-turbo', 'about 0.5 s'),
    ('Jarvis voice', 'Groq', 'orpheus-v1-english', '0.5 to 1.0 s'),
    ('No key at all', 'On device', 'Rubric feedback, phone voice', 'Still works'),
]
for row, cells in enumerate(table):
    y = 3.0 + row * 0.74
    for column, ((x, w), cell) in enumerate(zip(columns, cells)):
        text(s, x, y, w, 0.5, cell, size=16, bold=column == 0, color=INK if column in (0, 3) else MUTED, anchor=MSO_ANCHOR.MIDDLE)
text(s, 0.7, 6.25, 11.9, 0.4, 'Expo  ·  React Native  ·  TypeScript  ·  Node 24  ·  SQLite.   Keys stay on the server, never in the app or the repository.', size=13, color=MUTED)

# 8. Proven and next
s = new_slide('Be straight about the line between proven and not yet proven. Proven today: it runs on an iPhone through Expo Go, 163 automated tests pass with CI green, and live AI grading and voice work on free tiers. Still to prove: real app shielding needs the signed native iPhone build, which is untested on a device; code answers are reviewed, not executed; and the free tiers are rate limited.')
heading(s, 'Honest status', 'What is proven, and what is next', 9)
panels = [
    (0.7, 'Proven today', ACCENT, ['Runs on an iPhone through Expo Go', '163 automated tests pass, CI green', 'Live AI grading and voice on free tiers']),
    (6.83, 'Still to prove', MUTED, ['App shielding needs the signed native build', 'Code answers are reviewed, not executed', 'Free tiers are rate limited']),
]
for x, title, dot, lines in panels:
    box(s, x, 2.3, 5.8, 4.0)
    text(s, x + 0.45, 2.6, 4.9, 0.5, title, size=22, bold=True)
    for index, line in enumerate(lines):
        y = 3.4 + index * 0.9
        box(s, x + 0.45, y + 0.1, 0.24, 0.24, fill=dot, line=None, shape=MSO_SHAPE.OVAL)
        text(s, x + 0.95, y, 4.5, 0.75, line, size=17, spacing=1.1)

# 9. Demo and close
s = new_slide('Run the demo in this order on the iPhone, about three minutes. Describe the earned break as practice mode in Expo Go; do not present app shielding as working. Close on the line, then leave the links on screen for questions.')
ring(s, 10.3, 3.9, 7.4)
heading(s, 'Live demo', 'One complete rep', 10, w=6.3)
demo = [
    'Create an account on the iPhone',
    'Jarvis asks. Ask him one free clarifying question',
    'Take one hint, then answer by voice or typing',
    'Read the feedback and the STAR lines',
    'See the recap, the standings and the earned break',
]
for index, line in enumerate(demo):
    y = 2.35 + index * 0.78
    badge(s, 0.7, y, str(index + 1), size=0.5, font=14)
    text(s, 1.45, y, 5.6, 0.5, line, size=17, anchor=MSO_ANCHOR.MIDDLE)
box(s, 7.6, 1.0, 5.0, 5.3, fill=HERO, radius=0.07)
text(s, 8.05, 1.5, 4.1, 2.3, 'A better reason to put the phone down.', size=32, bold=True, spacing=1.0)
text(s, 8.05, 4.0, 4.1, 0.5, [[('unscroll', INK), ('.', ACCENT)]], size=22, bold=True)
text(s, 8.05, 4.55, 4.1, 0.4, 'Less scrolling. More becoming.', size=14, color=MUTED)
text(s, 8.05, 5.2, 4.1, 0.35, 'Film: youtu.be/fKccxDHB6GI', size=13, color=ACCENT, link=YOUTUBE)
text(s, 8.05, 5.6, 4.1, 0.35, 'Code: github.com/Charlesganu2004/Whitman-Hackathon', size=11, color=MUTED, link=REPO)

prs.save(OUT)
print('saved', OUT, 'slides:', len(prs.slides))
