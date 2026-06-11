# Current Interface Plan

## Product Idea

The current app treats the experience as a small connection board, not an operations dashboard. A user should understand the page in a few seconds:

1. Add, update, or remove one ride profile.
2. Review likely matches.
3. Email or call directly, mark which trip slots contact is about, and mark only agreed slots as matched after mutual agreement.

The underlying ride logic stays intact, including Supabase auth, one profile per user, carpool offers, carpool requests, Uber/Lyft split groups, internal route scoring, match categories, per-slot interest/matching, and ride status.

## Interface Direction

The page has three primary areas:

- **Your plan:** one compact form for name, contact info, corridor, ride plan, relevant seat/group counts, trip slots, and notes, plus signed-in controls to edit or remove the user's post.
- **Your activity:** a signed-in summary of contacts, pending slots, and confirmed matches so users do not need to scan every card for changed status.
- **Likely matches:** a filtered list of available posts, sorted by route and schedule fit for the selected participant.

The primary interface stays focused on the ride profile, likely matches, filters, route-fit context, and contact-first actions. The `How to use this app` button opens a modal guide so instructions remain visible without occupying the main workflow. Sample/admin participant preview remains available in a collapsed drawer because it is useful for testing and troubleshooting but should not read as part of the normal attendee workflow.

## Simplification Choices

- Show only the numeric fields that apply to the selected ride plan.
- Collapse sign-in and saved ride-plan details until the user needs to interact with them.
- Keep signed-out sample mode clearly labeled, and let users choose `Stay in sample mode` if they start sign-in and change their mind.
- Collapse prototype/admin preview tools until they are needed.
- Explain the selected ride plan with one plain sentence under the ride-plan menu.
- Keep search and corridor filtering, but reduce status filtering to "Available posts" or "All posts."
- Make cards focus on connection essentials: ride type, corridor, neighborhood, trip slots, capacity/need, contact reveal buttons, and one or two actions.
- Put notes and contact/match history behind a `Details and history` disclosure so the board stays easy to scan. Notes are visible to signed-in users, so helper copy warns users not to enter private details.
- Show a compact route-fit legend so labels like `Same corridor`, `Nearby route`, and `Likely detour` have context.
- Show match categories instead of exact numeric fit scores.
- Keep status controls on cards so hosts/admins can still mark posts as open, pending, matched, or full. The database still stores the final match status as `committed`.
- Require a contact marker before anyone can mark a match, so attendees contact each other first by email or phone and only record a match after mutual agreement.
- Treat contact markers and final matches as slot-specific. A user can express interest in `Thu AM` and `Thu PM`, then match only `Thu AM` while leaving `Thu PM` pending.
- Let carpool drivers finalize carpool matches. For Uber/Lyft split groups, let either the organizer or the contacted participant mark the match once contact has been recorded.
- Send one lightweight email notification when someone records contact/help on another person's post, so the post owner knows to sign in and review the possible match. The email should not include phone numbers or full ride details; users still coordinate directly after opening the app.
- Keep `Matched` out of the ordinary status dropdown for unmatched posts; users should reach that state through `Mark matched`.
- Hide post status controls from people who do not own the post unless they are admins.

## Contact And Notification Direction

- Treat `Reveal email` and `Reveal phone` as the primary contact actions on every card.
- Use secondary buttons only for record keeping: `Record contact`, `Record help offer`, and `Mark matched`.
- Use a slot picker before recording contact/help or marking a match when there is more than one eligible shared slot.
- Require at least one contact method to be revealed before showing `Record contact` or `Record help offer`.
- Avoid request-sending labels that imply a confirmed ride or in-app inbox. The notification only tells the post owner someone marked a possible fit and should sign in to review details.
- Do not use disabled buttons for instructions such as `Contact first`; show that guidance as plain helper text instead.
- Show activity labels as contact history, such as `Contacted by` or `Help offered by`, rather than as an app-managed inbox. Include slot labels so users can tell which trip portions are pending or matched.

## What This Plan Records

This plan records the simpler interaction model that has now become the primary app direction on `main`. It is not a rejection of the earlier fuller dashboard; it documents the lower-friction version chosen for future development.
