# Simple Version Plan

## Product Idea

The simple version treats the app as a small connection board, not an operations dashboard. A user should understand the page in a few seconds:

1. Add or update one ride profile.
2. Review likely matches.
3. Email or call directly, mark that contact happened, and mark a match after mutual agreement.

The underlying ride logic stays intact, including Supabase auth, one profile per user, carpool offers, carpool requests, Uber/Lyft split groups, route scoring, and ride status.

## Interface Direction

The page has two primary areas:

- **Your plan:** one compact form for name, contact info, corridor, ride plan, relevant seat/group counts, trip slots, and notes.
- **Likely matches:** a filtered list of available posts, sorted by route and schedule fit for the selected participant.

The route map, separate status dashboard, and full match sidebar are removed from the primary interface. Sample/admin participant preview remains available as a compact control because it is useful for testing and troubleshooting.

## Simplification Choices

- Show only the numeric fields that apply to the selected ride plan.
- Replace the old disabled-field explanation with one plain sentence under the ride-plan menu.
- Keep search and corridor filtering, but reduce status filtering to "Available posts" or "All posts."
- Make cards focus on connection essentials: ride type, corridor, neighborhood, trip slots, capacity/need, contact links, and one or two actions.
- Keep status controls on cards so hosts/admins can still mark posts as open, pending, matched, or full. The database still stores the final match status as `committed`.
- Require a contact marker before anyone can mark a match, so attendees contact each other first by email or phone and only record a match after mutual agreement.
- Let carpool drivers finalize carpool matches. For Uber/Lyft split groups, let either the organizer or the contacted participant mark the match once contact has been recorded.
- Do not send app-generated email notifications. The simple branch relies on visible email/phone links and honest contact-tracking language instead of a transactional email provider.

## No-Email Design Direction

- Treat `Email` and `Phone` as the primary actions on every card.
- Use secondary buttons only for record keeping: `Mark contacted`, `Mark help offered`, and `Mark matched`.
- Avoid labels such as `Inquire` or `Send request` because they imply the app notified the other person.
- Show activity labels as contact history, such as `Contacted by` or `Help offered by`, rather than as an app-managed inbox.

## What This Branch Is For

This branch is meant for stakeholder review of the simpler interaction model. It is not a rejection of the fuller app; it is a lower-friction version that can be compared against the richer dashboard on `main`.
