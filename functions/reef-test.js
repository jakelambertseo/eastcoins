/* The game was called Reef while it was a mockup and lived at /reef-test.
   Every link anyone has pasted is that shape, so it keeps working and
   lands on the same page under its real name. Progress is untouched:
   the save is keyed to the origin, not the path. */
export const onRequestGet = ({ request }) =>
  Response.redirect(new URL("/fishing", request.url).toString(), 301);
