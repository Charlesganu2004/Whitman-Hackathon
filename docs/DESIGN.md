# Unscroll design direction

Unscroll connects a student's next opportunity with a more intentional phone habit. The name describes replacing unplanned scrolling with interview practice. Its promise is “Practice for what's next.”

The interface uses forest green, sage, and ivory. One green accent drives actions, selected states, progress, and focus. System typography keeps the iPhone rendering crisp without font downloads. Native shapes create the orbit, focus lock, flame badge, progress rings, and navigation icons at device resolution.

## Reference study

The supplied [Dribbble UI collection](https://dribbble.com/tags/ui/), [iOS app collection](https://dribbble.com/tags/ios-app-design), and [Muzli iOS examples](https://muz.li/inspiration/ios-app-examples/) inform the layered hero, compact cards, visualization, and illustrated focus state. [UX Pilot](https://uxpilot.ai/ai-ui-generator), [StartDesigns](https://www.startdesigns.com/blog/ui-ux-design-examples/), [HTMLBurger](https://htmlburger.com/blog/best-ui-websites/), and [Maze](https://maze.co/collections/ux-ui-design/ui-design-examples/) were inspected for layout and hierarchy references. The [Learn UI iOS guide](https://www.learnui.design/blog/ios-design-guidelines-templates.html) and [Justinmind iOS guide](https://www.justinmind.com/ui-design/ios-app-design) inform reachable navigation, readable type, and mobile layout.

These are references, not copied screens or downloaded art. No third-party design assets are shipped, and no accounts or paid UI-generator services were used.

## REA observation workflow

The reviewed REA commit and limitations remain in `INTAKE.md`. Its browser observation sequence is applied through the available browser tools: inspect rendered structure, trigger a real interaction, inspect resulting state and API behavior, then review screenshots. Source, tokens, request bodies and resume data are not sent to a third-party design service. REA's executable runtime remains uninstalled because its full runtime intake is incomplete.

## Motion

- The opening screen introduces the name and focus orbit while the real startup work runs.
- Primary actions compress slightly on press and return with a short spring.
- Progress meters transition to their measured value.
- Dashboard and roadmap sections enter in short staggered groups.
- The focus orbit settles and reacts to earned access rather than moving indefinitely during a question.
- Loading uses an indeterminate indicator rather than a fabricated completion percentage.

Reduced-motion preferences suppress positional and scaling motion. Motion never delays a required action or substitutes for quiz progress. Controls retain visible labels, focus states, and touch targets.

## Flow

Opening animation, account entry, study-plan survey, placement, then a dashboard with a learning roadmap. Returning students preserve their stored answers, lessons, streaks, and progress. Frequency preferences include sessions per day, days per week, and a session time goal; earned app access remains based on evaluated answers.
